import { db } from '../../db/pool'
import { Appointment } from '../../types/appointment'
import { CreateAppointmentInput, UpdateAppointmentInput } from '../../schemas/appointment.schema'

export type AppointmentUpdateResult =
	| { status: 'updated'; appointment: Appointment }
	| { status: 'not_found' }
	| { status: 'conflict' }

export type SortCursor =
	| { sortKey: 'date'; appointmentDate: string; startTime: string; id: string }
	| { sortKey: 'time'; startTime: string; appointmentDate: string; id: string }
	| { sortKey: 'patientNid'; patientNid: string; appointmentDate: string; id: string }
	| { sortKey: 'patientName'; patientName: string; appointmentDate: string; id: string }
	| { sortKey: 'doctor'; doctorName: string; appointmentDate: string; id: string }
	| { sortKey: 'intervention'; serviceName: string; appointmentDate: string; id: string }
	| { sortKey: 'status'; status: string; appointmentDate: string; id: string }

export interface AppointmentListParams {
	q?: string
	patientNid?: string
	patientName?: string
	patientPhone?: string
	// join patients — CNP / birth date / family doctor aren't denormalized onto appointments
	patientCnp?: string
	familyDoctor?: string
	birthDateStart?: string
	birthDateEnd?: string
	dateStart?: string
	dateEnd?: string
	doctorId?: string
	moduleId?: string
	categoryId?: string
	createdByUserId?: string
	createdByUserName?: string
	status?: 'confirmed' | 'unconfirmed' | 'no_answer' | 'canceled'
	showCanceled?: boolean
	sortKey?: 'date' | 'time' | 'patientNid' | 'patientName' | 'doctor' | 'intervention' | 'status'
	sortDirection?: 'asc' | 'desc'
	includeTotal?: boolean
	cursor?: SortCursor
	limit?: number
}

export interface PaginatedAppointmentsResult {
	items: Appointment[]
	total: number | null
	limit: number
	hasMore: boolean
	nextCursor: SortCursor | null
}

const ORDER_BY = 'ORDER BY a.appointment_date ASC, a.start_time ASC, a.id ASC'
const LIST_SELECT_COLUMNS = `
  a.id,
  a.patient_id,
  a.patient_name,
  a.patient_nid,
  a.patient_phone,
  p.cod_cnp AS patient_cnp,
  p.data_nasterii AS patient_birth_date,
  p.medic_familie_nume AS patient_family_doctor,
  a.doctor_id,
  a.doctor_name,
  a.module_id,
  a.module_name,
  a.category_id,
  a.category_name,
  a.service_id,
  a.service_name,
  a.appointment_date,
  a.start_time,
  a.end_time,
  a.duration_minutes,
  a.status,
  a.notes,
  a.created_by_user_id,
  a.created_by_user_name,
  a.created_at,
  a.updated_at,
  a.canceled_at,
  a.version,
  a.deleted_at
`

function toContainsPattern(value?: string): string | null {
	const trimmed = value?.trim()
	return trimmed ? `%${trimmed}%` : null
}

function buildAppointmentListWhere(params: AppointmentListParams, startIndex = 1): { whereClause: string; values: unknown[] } {
	const conditions: string[] = []
	const values: unknown[] = []
	let parameterIndex = startIndex

	const pushCondition = (sql: string, value: unknown): void => {
		conditions.push(sql.split('__PARAM__').join(`$${parameterIndex}`))
		values.push(value)
		parameterIndex += 1
	}

	const searchPattern = toContainsPattern(params.q)
	if (searchPattern) {
		const p = `$${parameterIndex}`
		values.push(searchPattern)
		parameterIndex += 1
		conditions.push(
			`(a.patient_name ILIKE ${p} OR a.patient_nid ILIKE ${p} OR a.patient_phone ILIKE ${p} OR COALESCE(p.cod_cnp, '') ILIKE ${p} OR a.doctor_name ILIKE ${p} OR a.service_name ILIKE ${p} OR COALESCE(a.notes, '') ILIKE ${p} OR a.created_by_user_name ILIKE ${p})`
		)
	}

	const patientNidPattern = toContainsPattern(params.patientNid)
	if (patientNidPattern) pushCondition('a.patient_nid ILIKE __PARAM__', patientNidPattern)

	const patientNamePattern = toContainsPattern(params.patientName)
	if (patientNamePattern) pushCondition('a.patient_name ILIKE __PARAM__', patientNamePattern)

	const patientPhonePattern = toContainsPattern(params.patientPhone)
	if (patientPhonePattern) pushCondition('a.patient_phone ILIKE __PARAM__', patientPhonePattern)

	const patientCnpPattern = toContainsPattern(params.patientCnp)
	if (patientCnpPattern) pushCondition('p.cod_cnp ILIKE __PARAM__', patientCnpPattern)

	const familyDoctorPattern = toContainsPattern(params.familyDoctor)
	if (familyDoctorPattern) pushCondition('p.medic_familie_nume ILIKE __PARAM__', familyDoctorPattern)

	if (params.birthDateStart) pushCondition('p.data_nasterii >= __PARAM__::date', params.birthDateStart)
	if (params.birthDateEnd) pushCondition('p.data_nasterii <= __PARAM__::date', params.birthDateEnd)

	if (params.doctorId) pushCondition('a.doctor_id = __PARAM__::uuid', params.doctorId)
	if (params.moduleId) pushCondition('a.module_id = __PARAM__::uuid', params.moduleId)
	if (params.categoryId) pushCondition('a.category_id = __PARAM__::uuid', params.categoryId)
	if (params.createdByUserId) pushCondition('a.created_by_user_id = __PARAM__::uuid', params.createdByUserId)
	if (params.createdByUserName) pushCondition('a.created_by_user_name ILIKE __PARAM__', `%${params.createdByUserName}%`)

	if (params.status) {
		pushCondition('a.status = __PARAM__::appointment_status_enum', params.status)
	} else if (!params.showCanceled) {
		conditions.push(`a.status <> 'canceled'`)
	}

	if (params.dateStart) pushCondition('a.appointment_date >= __PARAM__::date', params.dateStart)
	if (params.dateEnd) pushCondition('a.appointment_date <= __PARAM__::date', params.dateEnd)

	return {
		whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
		values,
	}
}

function buildOrderBy(sortKey?: AppointmentListParams['sortKey'], sortDirection: AppointmentListParams['sortDirection'] = 'asc'): string {
	const direction = sortDirection === 'desc' ? 'DESC' : 'ASC'

	switch (sortKey) {
		case 'date':
			return `ORDER BY a.appointment_date ${direction}, a.start_time ${direction}, a.id ${direction}`
		case 'time':
			return `ORDER BY a.start_time ${direction}, a.appointment_date ${direction}, a.id ${direction}`
		case 'patientNid':
			return `ORDER BY a.patient_nid ${direction}, a.appointment_date ${direction}, a.id ${direction}`
		case 'patientName':
			return `ORDER BY a.patient_name ${direction}, a.appointment_date ${direction}, a.id ${direction}`
		case 'doctor':
			return `ORDER BY a.doctor_name ${direction}, a.appointment_date ${direction}, a.id ${direction}`
		case 'intervention':
			return `ORDER BY a.service_name ${direction}, a.appointment_date ${direction}, a.id ${direction}`
		case 'status':
			return `ORDER BY a.status ${direction}, a.appointment_date ${direction}, a.id ${direction}`
		default:
			return ORDER_BY
	}
}

function rowToAppointment(row: Record<string, unknown>): Appointment {
	return {
		id: row.id as string,
		patientId: row.patient_id as string,
		patientName: row.patient_name as string,
		patientNid: row.patient_nid as string,
		patientPhone: row.patient_phone as string,
		patientCnp: (row.patient_cnp as string | null) ?? '',
		patientBirthDate: (row.patient_birth_date as Date | null) ?? null,
		patientFamilyDoctor: (row.patient_family_doctor as string | null) ?? '',
		doctorId: row.doctor_id as string,
		doctorName: row.doctor_name as string,
		moduleId: row.module_id as string,
		moduleName: row.module_name as string,
		categoryId: row.category_id as string,
		categoryName: row.category_name as string,
		serviceId: row.service_id as string,
		serviceName: row.service_name as string,
		appointmentDate: row.appointment_date as Date,
		startTime: row.start_time as string,
		endTime: (row.end_time as string | null) ?? null,
		durationMinutes: (row.duration_minutes as number | null) ?? null,
		status: row.status as Appointment['status'],
		notes: (row.notes as string | null) ?? null,
		createdByUserId: row.created_by_user_id as string,
		createdByUserName: row.created_by_user_name as string,
		createdAt: row.created_at as Date,
		updatedAt: row.updated_at as Date,
		canceledAt: (row.canceled_at as Date | null) ?? null,
		version: row.version as number,
		deletedAt: (row.deleted_at as string | null) ?? null,
	}
}

export const appointmentRepository = {
	async list(params: AppointmentListParams = {}): Promise<PaginatedAppointmentsResult> {
		const { whereClause, values } = buildAppointmentListWhere(params)
		const sortKey = params.sortKey
		const direction = params.sortDirection === 'desc' ? 'DESC' : 'ASC'
		const orderBy = buildOrderBy(sortKey, params.sortDirection)
		const limit = Math.min(Math.max(params.limit ?? 50, 1), 100)
		const allValues = [...values]
		const joinClause = 'LEFT JOIN patients p ON p.id = a.patient_id'
		let cursorClause = ''

		if (params.cursor) {
			const c = params.cursor
			const op = direction === 'ASC' ? '>' : '<'

			const addCursor = (clause: string, ...cursorValues: unknown[]) => {
				let result = clause
				cursorValues.forEach((val, i) => {
					const idx = allValues.length + 1
					result = result.split(`__P${i + 1}__`).join(`$${idx}`)
					allValues.push(val)
				})
				cursorClause = result
			}

			switch (c.sortKey) {
				case 'date':
					addCursor(
						`AND (a.appointment_date, a.start_time, a.id) ${op} (__P1__::date, __P2__::time, __P3__::uuid)`,
						c.appointmentDate, c.startTime, c.id
					)
					break
				case 'time':
					addCursor(
						`AND (a.start_time, a.appointment_date, a.id) ${op} (__P1__::time, __P2__::date, __P3__::uuid)`,
						c.startTime, c.appointmentDate, c.id
					)
					break
				case 'patientNid':
					addCursor(
						`AND (a.patient_nid, a.appointment_date, a.id) ${op} (__P1__, __P2__::date, __P3__::uuid)`,
						c.patientNid, c.appointmentDate, c.id
					)
					break
				case 'patientName':
					addCursor(
						`AND (a.patient_name, a.appointment_date, a.id) ${op} (__P1__, __P2__::date, __P3__::uuid)`,
						c.patientName, c.appointmentDate, c.id
					)
					break
				case 'doctor':
					addCursor(
						`AND (a.doctor_name, a.appointment_date, a.id) ${op} (__P1__, __P2__::date, __P3__::uuid)`,
						c.doctorName, c.appointmentDate, c.id
					)
					break
				case 'intervention':
					addCursor(
						`AND (a.service_name, a.appointment_date, a.id) ${op} (__P1__, __P2__::date, __P3__::uuid)`,
						c.serviceName, c.appointmentDate, c.id
					)
					break
				case 'status':
					addCursor(
						`AND (a.status, a.appointment_date, a.id) ${op} (__P1__::appointment_status_enum, __P2__::date, __P3__::uuid)`,
						c.status, c.appointmentDate, c.id
					)
					break
			}
		}

		const whereWithCursor = whereClause
			? `${whereClause} AND a.deleted_at IS NULL ${cursorClause}`
			: cursorClause
				? `WHERE a.deleted_at IS NULL ${cursorClause}`
				: 'WHERE a.deleted_at IS NULL'

		const sql = `
      SELECT ${LIST_SELECT_COLUMNS}
      FROM appointments a
      ${joinClause}
      ${whereWithCursor}
      ${orderBy}
      LIMIT $${allValues.length + 1}
    `
		allValues.push(limit + 1)

		const result = await db.query(sql, allValues)
		const rows = result.rows.slice(0, limit)
		const hasMore = result.rows.length > limit
		const lastRow = rows[rows.length - 1]

		let nextCursor: SortCursor | null = null
		if (hasMore && lastRow) {
			const effectiveSortKey = sortKey ?? 'date'
			switch (effectiveSortKey) {
				case 'time':
					nextCursor = { sortKey: 'time', startTime: lastRow.start_time, appointmentDate: lastRow.appointment_date, id: lastRow.id }
					break
				case 'patientNid':
					nextCursor = { sortKey: 'patientNid', patientNid: lastRow.patient_nid, appointmentDate: lastRow.appointment_date, id: lastRow.id }
					break
				case 'patientName':
					nextCursor = { sortKey: 'patientName', patientName: lastRow.patient_name, appointmentDate: lastRow.appointment_date, id: lastRow.id }
					break
				case 'doctor':
					nextCursor = { sortKey: 'doctor', doctorName: lastRow.doctor_name, appointmentDate: lastRow.appointment_date, id: lastRow.id }
					break
				case 'intervention':
					nextCursor = { sortKey: 'intervention', serviceName: lastRow.service_name, appointmentDate: lastRow.appointment_date, id: lastRow.id }
					break
				case 'status':
					nextCursor = { sortKey: 'status', status: lastRow.status, appointmentDate: lastRow.appointment_date, id: lastRow.id }
					break
				default:
					nextCursor = { sortKey: 'date', appointmentDate: lastRow.appointment_date, startTime: lastRow.start_time, id: lastRow.id }
					break
			}
		}

		return {
			items: rows.map(rowToAppointment),
			total: null,
			limit,
			hasMore,
			nextCursor,
		}
	},

	async count(params: AppointmentListParams = {}): Promise<{ total: number }> {
		const { whereClause, values } = buildAppointmentListWhere(params)
		const joinClause = 'LEFT JOIN patients p ON p.id = a.patient_id'
		const filter = whereClause ? `${whereClause} AND a.deleted_at IS NULL` : 'WHERE a.deleted_at IS NULL'
		const result = await db.query(
			`SELECT COUNT(*)::int AS total FROM appointments a ${joinClause} ${filter}`,
			values
		)
		return { total: Number(result.rows[0]?.total ?? 0) }
	},

	async approximateCount(): Promise<number> {
		const result = await db.query(
			`SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'appointments'`
		)
		return Number(result.rows[0]?.estimate ?? 0)
	},

	async findById(id: string): Promise<Appointment | null> {
		const result = await db.query(
			`SELECT ${LIST_SELECT_COLUMNS} FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id WHERE a.id = $1 AND a.deleted_at IS NULL`,
			[id]
		)
		return result.rows[0] ? rowToAppointment(result.rows[0]) : null
	},

	async create(data: CreateAppointmentInput): Promise<Appointment> {
		const result = await db.query(
			`INSERT INTO public.appointments (
        patient_id, patient_name, patient_nid, patient_phone,
        doctor_id, doctor_name, module_id, module_name,
        category_id, category_name, service_id, service_name,
        appointment_date, start_time, end_time, duration_minutes,
        status, notes, created_by_user_id, created_by_user_name
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20
      ) RETURNING id, patient_id, patient_name, patient_nid, patient_phone,
        doctor_id, doctor_name, module_id, module_name,
        category_id, category_name, service_id, service_name,
        appointment_date, start_time, end_time, duration_minutes,
        status, notes, created_by_user_id, created_by_user_name,
        created_at, updated_at, canceled_at, version, deleted_at`,
			[
				data.patientId,
				data.patientName,
				data.patientNid,
				data.patientPhone,
				data.doctorId,
				data.doctorName,
				data.moduleId,
				data.moduleName,
				data.categoryId,
				data.categoryName,
				data.serviceId,
				data.serviceName,
				data.appointmentDate,
				data.startTime,
				data.endTime ?? null,
				data.durationMinutes ?? null,
				data.status,
				data.notes ?? null,
				data.createdByUserId,
				data.createdByUserName,
			]
		)
		return rowToAppointment(result.rows[0])
	},

	async update(id: string, data: UpdateAppointmentInput): Promise<AppointmentUpdateResult> {
		const fields: string[] = []
		const values: unknown[] = []
		let i = 1

		const fieldMap: Record<string, string> = {
			patientId: 'patient_id',
			patientName: 'patient_name',
			patientNid: 'patient_nid',
			patientPhone: 'patient_phone',
			doctorId: 'doctor_id',
			doctorName: 'doctor_name',
			moduleId: 'module_id',
			moduleName: 'module_name',
			categoryId: 'category_id',
			categoryName: 'category_name',
			serviceId: 'service_id',
			serviceName: 'service_name',
			appointmentDate: 'appointment_date',
			startTime: 'start_time',
			endTime: 'end_time',
			durationMinutes: 'duration_minutes',
			status: 'status',
			notes: 'notes',
		}

		for (const [key, col] of Object.entries(fieldMap)) {
			if (key in data) {
				fields.push(`${col} = $${i++}`)
				values.push((data as Record<string, unknown>)[key])
			}
		}

		if ('status' in data) {
			// derive canceled_at from the new status, using the pre-update column value via COALESCE
			fields.push(
				data.status === 'canceled'
					? 'canceled_at = COALESCE(canceled_at, NOW())'
					: 'canceled_at = NULL'
			)
		}

		if (fields.length === 0) {
			const existing = await this.findById(id)
			if (!existing) return { status: 'not_found' }
			return { status: 'updated', appointment: existing }
		}

		fields.push('version = version + 1')

		values.push(id)
		const idIndex = i++

		const clientVersion = (data as Record<string, unknown>).version
		let versionCheck = ''
		if (clientVersion !== undefined) {
			values.push(clientVersion)
			versionCheck = `AND version = $${i++}`
		}

		const result = await db.query(
			`UPDATE public.appointments
       SET ${fields.join(', ')}
       WHERE id = $${idIndex} AND deleted_at IS NULL ${versionCheck}
       RETURNING id, patient_id, patient_name, patient_nid, patient_phone,
         doctor_id, doctor_name, module_id, module_name,
         category_id, category_name, service_id, service_name,
         appointment_date, start_time, end_time, duration_minutes,
         status, notes, created_by_user_id, created_by_user_name,
         created_at, updated_at, canceled_at, version, deleted_at`,
			values
		)

		if (result.rows[0]) {
			return { status: 'updated', appointment: rowToAppointment(result.rows[0]) }
		}

		const statusResult = await db.query('SELECT deleted_at, version FROM appointments WHERE id = $1', [id])
		if (!statusResult.rows[0] || statusResult.rows[0].deleted_at) return { status: 'not_found' }
		if (clientVersion !== undefined && statusResult.rows[0].version !== clientVersion) {
			return { status: 'conflict' }
		}
		return { status: 'not_found' }
	},

	async delete(id: string): Promise<boolean> {
		const result = await db.query(
			'UPDATE appointments SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
			[id]
		)
		return (result.rowCount ?? 0) > 0
	},
}
