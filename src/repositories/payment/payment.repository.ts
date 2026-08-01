import { db } from '../../db/pool'
import { Payment } from '../../types/payment'
import { CreatePaymentInput, UpdatePaymentInput } from '../../schemas/payment.schema'

export type PaymentUpdateResult =
	| { status: 'updated'; payment: Payment }
	| { status: 'not_found' }
	| { status: 'conflict' }

export type SortCursor =
	| { sortKey: 'default'; createdAt: string; id: string }
	| { sortKey: 'patientName'; patientName: string; createdAt: string; id: string }
	| { sortKey: 'amount'; amount: number; createdAt: string; id: string }
	| { sortKey: 'paymentSource'; paymentSource: string | null; createdAt: string; id: string }
	| { sortKey: 'paymentMethod'; paymentMethod: string | null; createdAt: string; id: string }
	| { sortKey: 'receiptDate'; receiptDate: string | null; createdAt: string; id: string }
	| { sortKey: 'receiptNumber'; receiptNumber: string | null; createdAt: string; id: string }

export interface PaymentListParams {
	q?: string
	operationId?: string
	appointmentId?: string
	estimateId?: string
	paid?: boolean
	dateStart?: string
	dateEnd?: string
	sortKey?: 'patientName' | 'amount' | 'paymentSource' | 'paymentMethod' | 'receiptDate' | 'receiptNumber'
	sortDirection?: 'asc' | 'desc'
	includeTotal?: boolean
	cursor?: SortCursor
	limit?: number
}

export interface PaginatedPaymentsResult {
	items: Payment[]
	total: number | null
	limit: number
	hasMore: boolean
	nextCursor: SortCursor | null
}

const ORDER_BY = 'ORDER BY created_at DESC, id DESC'
const LIST_SELECT_COLUMNS = `
  id,
  operation_id,
  appointment_id,
  estimate_id,
  patient_id,
  patient_name,
  patient_nid,
  service_id,
  service_name,
  price_id,
  price,
  amount,
  payment_source,
  payment_method,
  receipt_number,
  receipt_date,
  paid,
  paid_at,
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

function buildPaymentListWhere(params: PaymentListParams, startIndex = 1): { whereClause: string; values: unknown[] } {
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
		conditions.push(`(patient_name ILIKE ${p} OR patient_nid ILIKE ${p} OR receipt_number ILIKE ${p})`)
	}

	if (params.operationId) pushCondition('operation_id = __PARAM__::uuid', params.operationId)
	if (params.appointmentId) pushCondition('appointment_id = __PARAM__::uuid', params.appointmentId)
	if (params.estimateId) pushCondition('estimate_id = __PARAM__::uuid', params.estimateId)
	if (params.paid !== undefined) pushCondition('paid = __PARAM__', params.paid)
	if (params.dateStart) pushCondition('created_at >= __PARAM__::date', params.dateStart)
	if (params.dateEnd) pushCondition("created_at < (__PARAM__::date + INTERVAL '1 day')", params.dateEnd)

	return {
		whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
		values,
	}
}

function buildOrderBy(sortKey?: PaymentListParams['sortKey'], sortDirection: PaymentListParams['sortDirection'] = 'desc'): string {
	const direction = sortDirection === 'asc' ? 'ASC' : 'DESC'

	switch (sortKey) {
		case 'patientName':
			return `ORDER BY patient_name ${direction}, created_at ${direction}, id ${direction}`
		case 'amount':
			return `ORDER BY amount ${direction}, created_at ${direction}, id ${direction}`
		case 'paymentSource':
			return `ORDER BY payment_source ${direction} NULLS LAST, created_at ${direction}, id ${direction}`
		case 'paymentMethod':
			return `ORDER BY payment_method ${direction} NULLS LAST, created_at ${direction}, id ${direction}`
		case 'receiptDate':
			return `ORDER BY receipt_date ${direction} NULLS LAST, created_at ${direction}, id ${direction}`
		case 'receiptNumber':
			return `ORDER BY receipt_number ${direction} NULLS LAST, created_at ${direction}, id ${direction}`
		default:
			return ORDER_BY
	}
}

function rowToPayment(row: Record<string, unknown>): Payment {
	return {
		id: row.id as string,
		operationId: (row.operation_id as string | null) ?? null,
		appointmentId: (row.appointment_id as string | null) ?? null,
		estimateId: (row.estimate_id as string | null) ?? null,
		patientId: row.patient_id as string,
		patientName: row.patient_name as string,
		patientNid: row.patient_nid as string,
		serviceId: (row.service_id as string | null) ?? null,
		serviceName: row.service_name as string,
		priceId: (row.price_id as string | null) ?? null,
		price: row.price !== null && row.price !== undefined ? Number(row.price) : null,
		amount: Number(row.amount),
		paymentSource: (row.payment_source as string | null) ?? null,
		paymentMethod: (row.payment_method as 'card' | 'cash' | null) ?? null,
		receiptNumber: (row.receipt_number as string | null) ?? null,
		receiptDate: (row.receipt_date as Date | null) ?? null,
		paid: Boolean(row.paid),
		paidAt: (row.paid_at as Date | null) ?? null,
		createdByUserId: row.created_by_user_id as string,
		createdAt: row.created_at as Date,
		updatedAt: row.updated_at as Date,
		version: row.version as number,
		deletedAt: (row.deleted_at as string | null) ?? null,
	}
}

export const paymentRepository = {
	async list(params: PaymentListParams = {}): Promise<PaginatedPaymentsResult> {
		const { whereClause, values } = buildPaymentListWhere(params)
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
				case 'amount':
					addCursor(
						`AND (amount, created_at, id) ${op} (__P1__::numeric, __P2__::timestamptz, __P3__::uuid)`,
						c.amount, c.createdAt, c.id
					)
					break
				case 'paymentSource':
					if (c.paymentSource === null) {
						addCursor(
							`AND (payment_source IS NULL AND (created_at, id) ${op} (__P1__::timestamptz, __P2__::uuid))`,
							c.createdAt, c.id
						)
					} else {
						addCursor(
							`AND ((payment_source, created_at, id) ${op} (__P1__, __P2__::timestamptz, __P3__::uuid) OR payment_source IS NULL)`,
							c.paymentSource, c.createdAt, c.id
						)
					}
					break
				case 'paymentMethod':
					if (c.paymentMethod === null) {
						addCursor(
							`AND (payment_method IS NULL AND (created_at, id) ${op} (__P1__::timestamptz, __P2__::uuid))`,
							c.createdAt, c.id
						)
					} else {
						addCursor(
							`AND ((payment_method, created_at, id) ${op} (__P1__::payment_method_enum, __P2__::timestamptz, __P3__::uuid) OR payment_method IS NULL)`,
							c.paymentMethod, c.createdAt, c.id
						)
					}
					break
				case 'receiptDate':
					if (c.receiptDate === null) {
						addCursor(
							`AND (receipt_date IS NULL AND (created_at, id) ${op} (__P1__::timestamptz, __P2__::uuid))`,
							c.createdAt, c.id
						)
					} else {
						addCursor(
							`AND ((receipt_date, created_at, id) ${op} (__P1__::date, __P2__::timestamptz, __P3__::uuid) OR receipt_date IS NULL)`,
							c.receiptDate, c.createdAt, c.id
						)
					}
					break
				case 'receiptNumber':
					if (c.receiptNumber === null) {
						addCursor(
							`AND (receipt_number IS NULL AND (created_at, id) ${op} (__P1__::timestamptz, __P2__::uuid))`,
							c.createdAt, c.id
						)
					} else {
						addCursor(
							`AND ((receipt_number, created_at, id) ${op} (__P1__, __P2__::timestamptz, __P3__::uuid) OR receipt_number IS NULL)`,
							c.receiptNumber, c.createdAt, c.id
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
      FROM payments
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
				case 'amount':
					nextCursor = { sortKey: 'amount', amount: Number(lastRow.amount), createdAt: lastRow.created_at, id: lastRow.id }
					break
				case 'paymentSource':
					nextCursor = { sortKey: 'paymentSource', paymentSource: (lastRow.payment_source as string | null) ?? null, createdAt: lastRow.created_at, id: lastRow.id }
					break
				case 'paymentMethod':
					nextCursor = { sortKey: 'paymentMethod', paymentMethod: (lastRow.payment_method as string | null) ?? null, createdAt: lastRow.created_at, id: lastRow.id }
					break
				case 'receiptDate':
					nextCursor = { sortKey: 'receiptDate', receiptDate: (lastRow.receipt_date as string | null) ?? null, createdAt: lastRow.created_at, id: lastRow.id }
					break
				case 'receiptNumber':
					nextCursor = { sortKey: 'receiptNumber', receiptNumber: (lastRow.receipt_number as string | null) ?? null, createdAt: lastRow.created_at, id: lastRow.id }
					break
				default:
					nextCursor = { sortKey: 'default', createdAt: lastRow.created_at, id: lastRow.id }
					break
			}
		}

		return {
			items: rows.map(rowToPayment),
			total: null,
			limit,
			hasMore,
			nextCursor,
		}
	},

	async count(params: PaymentListParams = {}): Promise<{ total: number }> {
		const { whereClause, values } = buildPaymentListWhere(params)
		const filter = whereClause ? `${whereClause} AND deleted_at IS NULL` : 'WHERE deleted_at IS NULL'
		const result = await db.query(`SELECT COUNT(*)::int AS total FROM payments ${filter}`, values)
		return { total: Number(result.rows[0]?.total ?? 0) }
	},

	async approximateCount(): Promise<number> {
		const result = await db.query(
			`SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'payments'`
		)
		return Number(result.rows[0]?.estimate ?? 0)
	},

	async findById(id: string): Promise<Payment | null> {
		const result = await db.query(
			`SELECT ${LIST_SELECT_COLUMNS} FROM payments WHERE id = $1 AND deleted_at IS NULL`,
			[id]
		)
		return result.rows[0] ? rowToPayment(result.rows[0]) : null
	},

	async create(data: CreatePaymentInput): Promise<Payment> {
		const result = await db.query(
			`INSERT INTO public.payments (
        operation_id, appointment_id, estimate_id, patient_id, patient_name, patient_nid,
        service_id, service_name, price_id, price, amount,
        payment_source, payment_method, receipt_number, receipt_date,
        paid, paid_at, created_by_user_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18
      ) RETURNING ${LIST_SELECT_COLUMNS}`,
			[
				data.operationId ?? null,
				data.appointmentId ?? null,
				data.estimateId ?? null,
				data.patientId,
				data.patientName,
				data.patientNid,
				data.serviceId ?? null,
				data.serviceName,
				data.priceId ?? null,
				data.price ?? null,
				data.amount,
				data.paymentSource ?? null,
				data.paymentMethod ?? null,
				data.receiptNumber ?? null,
				data.receiptDate ?? null,
				data.paid,
				data.paidAt ?? null,
				data.createdByUserId,
			]
		)
		return rowToPayment(result.rows[0])
	},

	async update(id: string, data: UpdatePaymentInput): Promise<PaymentUpdateResult> {
		const fields: string[] = []
		const values: unknown[] = []
		let i = 1

		const fieldMap: Record<string, string> = {
			operationId: 'operation_id',
			appointmentId: 'appointment_id',
			estimateId: 'estimate_id',
			patientId: 'patient_id',
			patientName: 'patient_name',
			patientNid: 'patient_nid',
			serviceId: 'service_id',
			serviceName: 'service_name',
			priceId: 'price_id',
			price: 'price',
			amount: 'amount',
			paymentSource: 'payment_source',
			paymentMethod: 'payment_method',
			receiptNumber: 'receipt_number',
			receiptDate: 'receipt_date',
			paid: 'paid',
			paidAt: 'paid_at',
		}

		for (const [key, col] of Object.entries(fieldMap)) {
			if (key in data) {
				fields.push(`${col} = $${i++}`)
				values.push((data as Record<string, unknown>)[key])
			}
		}

		if ('paid' in data && !('paidAt' in data)) {
			// derive paid_at from the new paid flag when the caller didn't set it explicitly
			fields.push(
				data.paid ? 'paid_at = COALESCE(paid_at, NOW())' : 'paid_at = NULL'
			)
		}

		if (fields.length === 0) {
			const existing = await this.findById(id)
			if (!existing) return { status: 'not_found' }
			return { status: 'updated', payment: existing }
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
			`UPDATE public.payments
       SET ${fields.join(', ')}
       WHERE id = $${idIndex} AND deleted_at IS NULL ${versionCheck}
       RETURNING ${LIST_SELECT_COLUMNS}`,
			values
		)

		if (result.rows[0]) {
			return { status: 'updated', payment: rowToPayment(result.rows[0]) }
		}

		const statusResult = await db.query('SELECT deleted_at, version FROM payments WHERE id = $1', [id])
		if (!statusResult.rows[0] || statusResult.rows[0].deleted_at) return { status: 'not_found' }
		if (clientVersion !== undefined && statusResult.rows[0].version !== clientVersion) {
			return { status: 'conflict' }
		}
		return { status: 'not_found' }
	},

	async delete(id: string): Promise<boolean> {
		const result = await db.query(
			'UPDATE payments SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
			[id]
		)
		return (result.rowCount ?? 0) > 0
	},
}
