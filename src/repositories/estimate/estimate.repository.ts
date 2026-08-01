import { db } from '../../db/pool'
import { Estimate } from '../../types/estimate'
import { CreateEstimateInput, UpdateEstimateInput } from '../../schemas/estimate.schema'

export type EstimateUpdateResult =
	| { status: 'updated'; estimate: Estimate }
	| { status: 'not_found' }
	| { status: 'conflict' }

export type SortCursor =
	| { sortKey: 'default'; createdAt: string; id: string }
	| { sortKey: 'patientName'; patientName: string; createdAt: string; id: string }
	| { sortKey: 'doctorName'; doctorName: string; createdAt: string; id: string }
	| { sortKey: 'moduleName'; moduleName: string; createdAt: string; id: string }
	| { sortKey: 'serviceName'; serviceName: string; createdAt: string; id: string }
	| { sortKey: 'categoryName'; categoryName: string; createdAt: string; id: string }

export interface EstimateListParams {
	q?: string
	doctorId?: string
	moduleId?: string
	categoryId?: string
	appointmentId?: string
	dateStart?: string
	dateEnd?: string
	sortKey?: 'patientName' | 'doctorName' | 'moduleName' | 'serviceName' | 'categoryName'
	sortDirection?: 'asc' | 'desc'
	includeTotal?: boolean
	cursor?: SortCursor
	limit?: number
}

export interface PaginatedEstimatesResult {
	items: Estimate[]
	total: number | null
	limit: number
	hasMore: boolean
	nextCursor: SortCursor | null
}

const ORDER_BY = 'ORDER BY created_at DESC, id DESC'
const LIST_SELECT_COLUMNS = `
  id,
  appointment_id,
  patient_id,
  patient_name,
  patient_nid,
  doctor_id,
  doctor_name,
  module_id,
  module_name,
  category_id,
  category_name,
  service_id,
  service_name,
  price_id,
  price,
  payment_source,
  created_by_user_id,
  created_at,
  updated_at,
  version,
  deleted_at
`

function toContainsPattern(value?: string): string | null {
	const trimmed = value?.trim()
	return trimmed ? `%${trimmed}%` : null
}

function buildEstimateListWhere(params: EstimateListParams, startIndex = 1): { whereClause: string; values: unknown[] } {
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
		conditions.push(`(patient_name ILIKE ${p} OR patient_nid ILIKE ${p})`)
	}

	if (params.doctorId) pushCondition('doctor_id = __PARAM__::uuid', params.doctorId)
	if (params.moduleId) pushCondition('module_id = __PARAM__::uuid', params.moduleId)
	if (params.categoryId) pushCondition('category_id = __PARAM__::uuid', params.categoryId)
	if (params.appointmentId) pushCondition('appointment_id = __PARAM__::uuid', params.appointmentId)
	if (params.dateStart) pushCondition('created_at >= __PARAM__::date', params.dateStart)
	if (params.dateEnd) pushCondition("created_at < (__PARAM__::date + INTERVAL '1 day')", params.dateEnd)

	return {
		whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
		values,
	}
}

function buildOrderBy(sortKey?: EstimateListParams['sortKey'], sortDirection: EstimateListParams['sortDirection'] = 'desc'): string {
	const direction = sortDirection === 'asc' ? 'ASC' : 'DESC'

	switch (sortKey) {
		case 'patientName':
			return `ORDER BY patient_name ${direction}, created_at ${direction}, id ${direction}`
		case 'doctorName':
			return `ORDER BY doctor_name ${direction}, created_at ${direction}, id ${direction}`
		case 'moduleName':
			return `ORDER BY module_name ${direction}, created_at ${direction}, id ${direction}`
		case 'serviceName':
			return `ORDER BY service_name ${direction}, created_at ${direction}, id ${direction}`
		case 'categoryName':
			return `ORDER BY category_name ${direction}, created_at ${direction}, id ${direction}`
		default:
			return ORDER_BY
	}
}

function rowToEstimate(row: Record<string, unknown>): Estimate {
	return {
		id: row.id as string,
		appointmentId: (row.appointment_id as string | null) ?? null,
		patientId: row.patient_id as string,
		patientName: row.patient_name as string,
		patientNid: row.patient_nid as string,
		doctorId: row.doctor_id as string,
		doctorName: row.doctor_name as string,
		moduleId: row.module_id as string,
		moduleName: row.module_name as string,
		categoryId: row.category_id as string,
		categoryName: row.category_name as string,
		serviceId: row.service_id as string,
		serviceName: row.service_name as string,
		priceId: (row.price_id as string | null) ?? null,
		price: Number(row.price),
		paymentSource: (row.payment_source as string | null) ?? null,
		createdByUserId: row.created_by_user_id as string,
		createdAt: row.created_at as Date,
		updatedAt: row.updated_at as Date,
		version: row.version as number,
		deletedAt: (row.deleted_at as string | null) ?? null,
	}
}

export const estimateRepository = {
	async list(params: EstimateListParams = {}): Promise<PaginatedEstimatesResult> {
		const { whereClause, values } = buildEstimateListWhere(params)
		const sortKey = params.sortKey
		const direction = params.sortDirection === 'asc' ? 'ASC' : 'DESC'
		const orderBy = buildOrderBy(sortKey, params.sortDirection)
		const limit = Math.min(Math.max(params.limit ?? 50, 1), 100)
		const allValues = [...values]
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
				case 'default':
					addCursor(
						`AND (created_at, id) ${op} (__P1__::timestamptz, __P2__::uuid)`,
						c.createdAt, c.id
					)
					break
				case 'patientName':
					addCursor(
						`AND (patient_name, created_at, id) ${op} (__P1__, __P2__::timestamptz, __P3__::uuid)`,
						c.patientName, c.createdAt, c.id
					)
					break
				case 'doctorName':
					addCursor(
						`AND (doctor_name, created_at, id) ${op} (__P1__, __P2__::timestamptz, __P3__::uuid)`,
						c.doctorName, c.createdAt, c.id
					)
					break
				case 'moduleName':
					addCursor(
						`AND (module_name, created_at, id) ${op} (__P1__, __P2__::timestamptz, __P3__::uuid)`,
						c.moduleName, c.createdAt, c.id
					)
					break
				case 'serviceName':
					addCursor(
						`AND (service_name, created_at, id) ${op} (__P1__, __P2__::timestamptz, __P3__::uuid)`,
						c.serviceName, c.createdAt, c.id
					)
					break
				case 'categoryName':
					addCursor(
						`AND (category_name, created_at, id) ${op} (__P1__, __P2__::timestamptz, __P3__::uuid)`,
						c.categoryName, c.createdAt, c.id
					)
					break
			}
		}

		const whereWithCursor = whereClause
			? `${whereClause} AND deleted_at IS NULL ${cursorClause}`
			: cursorClause
				? `WHERE deleted_at IS NULL ${cursorClause}`
				: 'WHERE deleted_at IS NULL'

		const sql = `
      SELECT ${LIST_SELECT_COLUMNS}
      FROM estimates
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
			const effectiveSortKey = sortKey ?? 'default'
			switch (effectiveSortKey) {
				case 'patientName':
					nextCursor = { sortKey: 'patientName', patientName: lastRow.patient_name, createdAt: lastRow.created_at, id: lastRow.id }
					break
				case 'doctorName':
					nextCursor = { sortKey: 'doctorName', doctorName: lastRow.doctor_name, createdAt: lastRow.created_at, id: lastRow.id }
					break
				case 'moduleName':
					nextCursor = { sortKey: 'moduleName', moduleName: lastRow.module_name, createdAt: lastRow.created_at, id: lastRow.id }
					break
				case 'serviceName':
					nextCursor = { sortKey: 'serviceName', serviceName: lastRow.service_name, createdAt: lastRow.created_at, id: lastRow.id }
					break
				case 'categoryName':
					nextCursor = { sortKey: 'categoryName', categoryName: lastRow.category_name, createdAt: lastRow.created_at, id: lastRow.id }
					break
				default:
					nextCursor = { sortKey: 'default', createdAt: lastRow.created_at, id: lastRow.id }
					break
			}
		}

		return {
			items: rows.map(rowToEstimate),
			total: null,
			limit,
			hasMore,
			nextCursor,
		}
	},

	async count(params: EstimateListParams = {}): Promise<{ total: number }> {
		const { whereClause, values } = buildEstimateListWhere(params)
		const filter = whereClause ? `${whereClause} AND deleted_at IS NULL` : 'WHERE deleted_at IS NULL'
		const result = await db.query(`SELECT COUNT(*)::int AS total FROM estimates ${filter}`, values)
		return { total: Number(result.rows[0]?.total ?? 0) }
	},

	async approximateCount(): Promise<number> {
		const result = await db.query(
			`SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'estimates'`
		)
		return Number(result.rows[0]?.estimate ?? 0)
	},

	async findById(id: string): Promise<Estimate | null> {
		const result = await db.query(
			`SELECT ${LIST_SELECT_COLUMNS} FROM estimates WHERE id = $1 AND deleted_at IS NULL`,
			[id]
		)
		return result.rows[0] ? rowToEstimate(result.rows[0]) : null
	},

	async create(data: CreateEstimateInput): Promise<Estimate> {
		const result = await db.query(
			`INSERT INTO public.estimates (
        appointment_id, patient_id, patient_name, patient_nid,
        doctor_id, doctor_name, module_id, module_name,
        category_id, category_name, service_id, service_name,
        price_id, price, payment_source, created_by_user_id
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16
      ) RETURNING ${LIST_SELECT_COLUMNS}`,
			[
				data.appointmentId ?? null,
				data.patientId,
				data.patientName,
				data.patientNid,
				data.doctorId,
				data.doctorName,
				data.moduleId,
				data.moduleName,
				data.categoryId,
				data.categoryName,
				data.serviceId,
				data.serviceName,
				data.priceId ?? null,
				data.price,
				data.paymentSource ?? null,
				data.createdByUserId,
			]
		)
		return rowToEstimate(result.rows[0])
	},

	async update(id: string, data: UpdateEstimateInput): Promise<EstimateUpdateResult> {
		const fields: string[] = []
		const values: unknown[] = []
		let i = 1

		const fieldMap: Record<string, string> = {
			appointmentId: 'appointment_id',
			patientId: 'patient_id',
			patientName: 'patient_name',
			patientNid: 'patient_nid',
			doctorId: 'doctor_id',
			doctorName: 'doctor_name',
			moduleId: 'module_id',
			moduleName: 'module_name',
			categoryId: 'category_id',
			categoryName: 'category_name',
			serviceId: 'service_id',
			serviceName: 'service_name',
			priceId: 'price_id',
			price: 'price',
			paymentSource: 'payment_source',
		}

		for (const [key, col] of Object.entries(fieldMap)) {
			if (key in data) {
				fields.push(`${col} = $${i++}`)
				values.push((data as Record<string, unknown>)[key])
			}
		}

		if (fields.length === 0) {
			const existing = await this.findById(id)
			if (!existing) return { status: 'not_found' }
			return { status: 'updated', estimate: existing }
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
			`UPDATE public.estimates
       SET ${fields.join(', ')}
       WHERE id = $${idIndex} AND deleted_at IS NULL ${versionCheck}
       RETURNING ${LIST_SELECT_COLUMNS}`,
			values
		)

		if (result.rows[0]) {
			return { status: 'updated', estimate: rowToEstimate(result.rows[0]) }
		}

		const statusResult = await db.query('SELECT deleted_at, version FROM estimates WHERE id = $1', [id])
		if (!statusResult.rows[0] || statusResult.rows[0].deleted_at) return { status: 'not_found' }
		if (clientVersion !== undefined && statusResult.rows[0].version !== clientVersion) {
			return { status: 'conflict' }
		}
		return { status: 'not_found' }
	},

	async delete(id: string): Promise<boolean> {
		const result = await db.query(
			'UPDATE estimates SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
			[id]
		)
		return (result.rowCount ?? 0) > 0
	},
}
