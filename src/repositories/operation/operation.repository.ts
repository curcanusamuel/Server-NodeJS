import { db } from '../../db/pool'
import { Operation } from '../../types/operation'
import { CreateOperationInput, UpdateOperationInput } from '../../schemas/operation.schema'

export type OperationUpdateResult =
	| { status: 'updated'; operation: Operation }
	| { status: 'not_found' }
	| { status: 'conflict' }

export type SortCursor =
	| { sortKey: 'date'; operationDate: string; id: string }
	| { sortKey: 'patientName'; patientName: string; operationDate: string; id: string }
	| { sortKey: 'module'; moduleName: string; operationDate: string; id: string }
	| { sortKey: 'intervention'; interventionName: string; operationDate: string; id: string }
	| { sortKey: 'doctor'; doctorName: string; operationDate: string; id: string }
	| { sortKey: 'paymentSource'; paymentSource: string | null; operationDate: string; id: string }
	| { sortKey: 'price'; price: number; operationDate: string; id: string }
	| { sortKey: 'receiptDate'; receiptDate: string | null; operationDate: string; id: string }
	| { sortKey: 'status'; paid: boolean; operationDate: string; id: string }

export interface OperationListParams {
	q?: string
	doctorId?: string
	doctorName?: string
	paid?: boolean
	dateStart?: string
	dateEnd?: string
	sortKey?: 'date' | 'patientName' | 'module' | 'intervention' | 'doctor' | 'paymentSource' | 'price' | 'receiptDate' | 'status'
	sortDirection?: 'asc' | 'desc'
	includeTotal?: boolean
	cursor?: SortCursor
	limit?: number
}

export interface PaginatedOperationsResult {
	items: Operation[]
	total: number | null
	limit: number
	hasMore: boolean
	nextCursor: SortCursor | null
}

export interface OperationSummaryResult {
	totalCount: number
	totalAmount: number
	paidCount: number
	paidAmount: number
	unpaidCount: number
	unpaidAmount: number
}

const ORDER_BY = 'ORDER BY operation_date DESC, id DESC'
const LIST_SELECT_COLUMNS = `
  id,
  price_id,
  patient_id,
  patient_name,
  patient_nid,
  (SELECT p.cod_cnp FROM patients p WHERE p.id = operations.patient_id) AS patient_cnp,
  (SELECT p.data_nasterii FROM patients p WHERE p.id = operations.patient_id) AS patient_birth_date,
  (SELECT p.medic_familie_nume FROM patients p WHERE p.id = operations.patient_id) AS patient_family_doctor,
  doctor_id,
  doctor_name,
  company_id,
  company_name,
  operation_date,
  module_name,
  category_name,
  intervention_name,
  payment_source,
  price,
  paid,
  payment_method,
  receipt_number,
  receipt_date,
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

function buildOperationListWhere(params: OperationListParams, startIndex = 1): { whereClause: string; values: unknown[] } {
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
			`(patient_name ILIKE ${p} OR patient_nid ILIKE ${p} OR intervention_name ILIKE ${p} OR company_name ILIKE ${p})`
		)
	}

	if (params.doctorId) pushCondition('doctor_id = __PARAM__::uuid', params.doctorId)
	if (params.doctorName) pushCondition('doctor_name ILIKE __PARAM__', `%${params.doctorName}%`)
	if (params.paid !== undefined) pushCondition('paid = __PARAM__', params.paid)
	if (params.dateStart) pushCondition('operation_date >= __PARAM__::date', params.dateStart)
	if (params.dateEnd) pushCondition('operation_date <= __PARAM__::date', params.dateEnd)

	return {
		whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
		values,
	}
}

function buildOrderBy(sortKey?: OperationListParams['sortKey'], sortDirection: OperationListParams['sortDirection'] = 'desc'): string {
	const direction = sortDirection === 'asc' ? 'ASC' : 'DESC'

	switch (sortKey) {
		case 'date':
			return `ORDER BY operation_date ${direction}, id ${direction}`
		case 'patientName':
			return `ORDER BY patient_name ${direction}, operation_date ${direction}, id ${direction}`
		case 'module':
			return `ORDER BY module_name ${direction}, operation_date ${direction}, id ${direction}`
		case 'intervention':
			return `ORDER BY intervention_name ${direction}, operation_date ${direction}, id ${direction}`
		case 'doctor':
			return `ORDER BY doctor_name ${direction}, operation_date ${direction}, id ${direction}`
		case 'paymentSource':
			return `ORDER BY payment_source ${direction} NULLS LAST, operation_date ${direction}, id ${direction}`
		case 'price':
			return `ORDER BY price ${direction}, operation_date ${direction}, id ${direction}`
		case 'receiptDate':
			return `ORDER BY receipt_date ${direction} NULLS LAST, operation_date ${direction}, id ${direction}`
		case 'status':
			return `ORDER BY paid ${direction}, operation_date ${direction}, id ${direction}`
		default:
			return ORDER_BY
	}
}

function rowToOperation(row: Record<string, unknown>): Operation {
	return {
		id: row.id as string,
		priceId: (row.price_id as string | null) ?? null,
		patientId: row.patient_id as string,
		patientName: row.patient_name as string,
		patientNid: row.patient_nid as string,
		patientCnp: (row.patient_cnp as string | null) ?? '',
		patientBirthDate: (row.patient_birth_date as Date | null) ?? null,
		patientFamilyDoctor: (row.patient_family_doctor as string | null) ?? '',
		doctorId: row.doctor_id as string,
		doctorName: row.doctor_name as string,
		companyId: (row.company_id as string | null) ?? null,
		companyName: row.company_name as string,
		operationDate: row.operation_date as Date,
		moduleName: row.module_name as string,
		categoryName: row.category_name as string,
		interventionName: row.intervention_name as string,
		paymentSource: (row.payment_source as string | null) ?? null,
		price: Number(row.price),
		paid: Boolean(row.paid),
		paymentMethod: (row.payment_method as 'card' | 'cash' | null) ?? null,
		receiptNumber: (row.receipt_number as string | null) ?? null,
		receiptDate: (row.receipt_date as Date | null) ?? null,
		createdByUserId: row.created_by_user_id as string,
		createdAt: row.created_at as Date,
		updatedAt: row.updated_at as Date,
		version: row.version as number,
		deletedAt: (row.deleted_at as string | null) ?? null,
	}
}

export const operationRepository = {
	async list(params: OperationListParams = {}): Promise<PaginatedOperationsResult> {
		const { whereClause, values } = buildOperationListWhere(params)
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
				case 'date':
					addCursor(
						`AND (operation_date, id) ${op} (__P1__::date, __P2__::uuid)`,
						c.operationDate, c.id
					)
					break
				case 'patientName':
					addCursor(
						`AND (patient_name, operation_date, id) ${op} (__P1__, __P2__::date, __P3__::uuid)`,
						c.patientName, c.operationDate, c.id
					)
					break
				case 'module':
					addCursor(
						`AND (module_name, operation_date, id) ${op} (__P1__, __P2__::date, __P3__::uuid)`,
						c.moduleName, c.operationDate, c.id
					)
					break
				case 'intervention':
					addCursor(
						`AND (intervention_name, operation_date, id) ${op} (__P1__, __P2__::date, __P3__::uuid)`,
						c.interventionName, c.operationDate, c.id
					)
					break
				case 'doctor':
					addCursor(
						`AND (doctor_name, operation_date, id) ${op} (__P1__, __P2__::date, __P3__::uuid)`,
						c.doctorName, c.operationDate, c.id
					)
					break
				case 'price':
					addCursor(
						`AND (price, operation_date, id) ${op} (__P1__::numeric, __P2__::date, __P3__::uuid)`,
						c.price, c.operationDate, c.id
					)
					break
				case 'status':
					addCursor(
						`AND (paid, operation_date, id) ${op} (__P1__::boolean, __P2__::date, __P3__::uuid)`,
						c.paid, c.operationDate, c.id
					)
					break
				case 'paymentSource':
					// nullable column, sorted NULLS LAST regardless of direction: the null
					// group always trails, so "next page" past a null cursor only needs
					// to keep scanning the null group by id.
					if (c.paymentSource === null) {
						addCursor(
							`AND (payment_source IS NULL AND (operation_date, id) ${op} (__P1__::date, __P2__::uuid))`,
							c.operationDate, c.id
						)
					} else {
						addCursor(
							`AND ((payment_source, operation_date, id) ${op} (__P1__, __P2__::date, __P3__::uuid) OR payment_source IS NULL)`,
							c.paymentSource, c.operationDate, c.id
						)
					}
					break
				case 'receiptDate':
					if (c.receiptDate === null) {
						addCursor(
							`AND (receipt_date IS NULL AND (operation_date, id) ${op} (__P1__::date, __P2__::uuid))`,
							c.operationDate, c.id
						)
					} else {
						addCursor(
							`AND ((receipt_date, operation_date, id) ${op} (__P1__::date, __P2__::date, __P3__::uuid) OR receipt_date IS NULL)`,
							c.receiptDate, c.operationDate, c.id
						)
					}
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
      FROM operations
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
				case 'patientName':
					nextCursor = { sortKey: 'patientName', patientName: lastRow.patient_name, operationDate: lastRow.operation_date, id: lastRow.id }
					break
				case 'module':
					nextCursor = { sortKey: 'module', moduleName: lastRow.module_name, operationDate: lastRow.operation_date, id: lastRow.id }
					break
				case 'intervention':
					nextCursor = { sortKey: 'intervention', interventionName: lastRow.intervention_name, operationDate: lastRow.operation_date, id: lastRow.id }
					break
				case 'doctor':
					nextCursor = { sortKey: 'doctor', doctorName: lastRow.doctor_name, operationDate: lastRow.operation_date, id: lastRow.id }
					break
				case 'paymentSource':
					nextCursor = { sortKey: 'paymentSource', paymentSource: (lastRow.payment_source as string | null) ?? null, operationDate: lastRow.operation_date, id: lastRow.id }
					break
				case 'price':
					nextCursor = { sortKey: 'price', price: Number(lastRow.price), operationDate: lastRow.operation_date, id: lastRow.id }
					break
				case 'receiptDate':
					nextCursor = { sortKey: 'receiptDate', receiptDate: (lastRow.receipt_date as string | null) ?? null, operationDate: lastRow.operation_date, id: lastRow.id }
					break
				case 'status':
					nextCursor = { sortKey: 'status', paid: Boolean(lastRow.paid), operationDate: lastRow.operation_date, id: lastRow.id }
					break
				default:
					nextCursor = { sortKey: 'date', operationDate: lastRow.operation_date, id: lastRow.id }
					break
			}
		}

		return {
			items: rows.map(rowToOperation),
			total: null,
			limit,
			hasMore,
			nextCursor,
		}
	},

	async count(params: OperationListParams = {}): Promise<{ total: number }> {
		const { whereClause, values } = buildOperationListWhere(params)
		const filter = whereClause ? `${whereClause} AND deleted_at IS NULL` : 'WHERE deleted_at IS NULL'
		const result = await db.query(`SELECT COUNT(*)::int AS total FROM operations ${filter}`, values)
		return { total: Number(result.rows[0]?.total ?? 0) }
	},

	async summary(params: OperationListParams = {}): Promise<OperationSummaryResult> {
		const { whereClause, values } = buildOperationListWhere(params)
		const filter = whereClause ? `${whereClause} AND deleted_at IS NULL` : 'WHERE deleted_at IS NULL'
		const result = await db.query(
			`
				SELECT
					COUNT(*)::int AS total_count,
					COALESCE(SUM(price), 0)::numeric AS total_amount,
					COUNT(*) FILTER (WHERE paid = TRUE)::int AS paid_count,
					COALESCE(SUM(price) FILTER (WHERE paid = TRUE), 0)::numeric AS paid_amount,
					COUNT(*) FILTER (WHERE paid = FALSE)::int AS unpaid_count,
					COALESCE(SUM(price) FILTER (WHERE paid = FALSE), 0)::numeric AS unpaid_amount
				FROM operations
				${filter}
			`,
			values,
		)
		const row = result.rows[0] ?? {}
		return {
			totalCount: Number(row.total_count ?? 0),
			totalAmount: Number(row.total_amount ?? 0),
			paidCount: Number(row.paid_count ?? 0),
			paidAmount: Number(row.paid_amount ?? 0),
			unpaidCount: Number(row.unpaid_count ?? 0),
			unpaidAmount: Number(row.unpaid_amount ?? 0),
		}
	},

	async approximateCount(): Promise<number> {
		const result = await db.query(
			`SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'operations'`
		)
		return Number(result.rows[0]?.estimate ?? 0)
	},

	async findById(id: string): Promise<Operation | null> {
		const result = await db.query(
			`SELECT ${LIST_SELECT_COLUMNS} FROM operations WHERE id = $1 AND deleted_at IS NULL`,
			[id]
		)
		return result.rows[0] ? rowToOperation(result.rows[0]) : null
	},

	async create(data: CreateOperationInput): Promise<Operation> {
		const result = await db.query(
			`INSERT INTO public.operations (
        price_id, patient_id, patient_name, patient_nid,
        doctor_id, doctor_name, company_id, company_name,
        operation_date, module_name, category_name, intervention_name,
        payment_source, price, paid, payment_method,
        receipt_number, receipt_date, created_by_user_id
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19
      ) RETURNING ${LIST_SELECT_COLUMNS}`,
			[
				data.priceId ?? null,
				data.patientId,
				data.patientName,
				data.patientNid,
				data.doctorId,
				data.doctorName,
				data.companyId ?? null,
				data.companyName,
				data.operationDate,
				data.moduleName,
				data.categoryName,
				data.interventionName,
				data.paymentSource ?? null,
				data.price,
				data.paid,
				data.paymentMethod ?? null,
				data.receiptNumber ?? null,
				data.receiptDate ?? null,
				data.createdByUserId,
			]
		)
		return rowToOperation(result.rows[0])
	},

	async update(id: string, data: UpdateOperationInput): Promise<OperationUpdateResult> {
		const fields: string[] = []
		const values: unknown[] = []
		let i = 1

		const fieldMap: Record<string, string> = {
			priceId: 'price_id',
			patientId: 'patient_id',
			patientName: 'patient_name',
			patientNid: 'patient_nid',
			doctorId: 'doctor_id',
			doctorName: 'doctor_name',
			companyId: 'company_id',
			companyName: 'company_name',
			operationDate: 'operation_date',
			moduleName: 'module_name',
			categoryName: 'category_name',
			interventionName: 'intervention_name',
			paymentSource: 'payment_source',
			price: 'price',
			paid: 'paid',
			paymentMethod: 'payment_method',
			receiptNumber: 'receipt_number',
			receiptDate: 'receipt_date',
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
			return { status: 'updated', operation: existing }
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
			`UPDATE public.operations
       SET ${fields.join(', ')}
       WHERE id = $${idIndex} AND deleted_at IS NULL ${versionCheck}
       RETURNING ${LIST_SELECT_COLUMNS}`,
			values
		)

		if (result.rows[0]) {
			return { status: 'updated', operation: rowToOperation(result.rows[0]) }
		}

		const statusResult = await db.query('SELECT deleted_at, version FROM operations WHERE id = $1', [id])
		if (!statusResult.rows[0] || statusResult.rows[0].deleted_at) return { status: 'not_found' }
		if (clientVersion !== undefined && statusResult.rows[0].version !== clientVersion) {
			return { status: 'conflict' }
		}
		return { status: 'not_found' }
	},

	async delete(id: string): Promise<boolean> {
		const result = await db.query(
			'UPDATE operations SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
			[id]
		)
		return (result.rowCount ?? 0) > 0
	},
}
