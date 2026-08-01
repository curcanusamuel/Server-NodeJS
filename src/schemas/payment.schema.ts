import { z } from 'zod'

const nullableString = z.string().nullable().optional()
const optionalQueryString = z.preprocess(
	(value) => {
		const normalized = Array.isArray(value) ? value[0] : value
		if (typeof normalized !== 'string') return undefined
		const trimmed = normalized.trim()
		return trimmed === '' ? undefined : trimmed
	},
	z.string().optional()
)
const optionalQueryInt = z.preprocess(
	(value) => {
		const normalized = Array.isArray(value) ? value[0] : value
		if (normalized === undefined || normalized === null || normalized === '') return undefined
		return Number(normalized)
	},
	z.number().int().nonnegative().optional()
)
const optionalQueryBoolean = z.preprocess(
	(value) => {
		const normalized = Array.isArray(value) ? value[0] : value
		if (normalized === undefined || normalized === null || normalized === '') return undefined
		if (typeof normalized === 'boolean') return normalized
		if (typeof normalized === 'string') {
			const lower = normalized.toLowerCase()
			if (lower === 'true') return true
			if (lower === 'false') return false
		}
		return normalized
	},
	z.boolean().optional()
)
const optionalQueryDateString = z.preprocess(
	(value) => {
		const normalized = Array.isArray(value) ? value[0] : value
		if (typeof normalized !== 'string') return undefined
		const trimmed = normalized.trim()
		return trimmed === '' ? undefined : trimmed
	},
	z.string().date().optional()
)

export const createPaymentSchema = z.object({
	operationId: z.string().uuid().nullable().optional(),
	appointmentId: z.string().uuid().nullable().optional(),
	estimateId: z.string().uuid().nullable().optional(),
	patientId: z.string().uuid(),
	patientName: z.string().default(''),
	patientNid: z.string().default(''),
	serviceId: z.string().uuid().nullable().optional(),
	serviceName: z.string().default(''),
	priceId: z.string().uuid().nullable().optional(),
	price: z.number().nonnegative().nullable().optional(),
	amount: z.number().nonnegative(),
	paymentSource: nullableString,
	paymentMethod: z.enum(['card', 'cash']).nullable().optional(),
	receiptNumber: nullableString,
	receiptDate: z.coerce.date().nullable().optional(),
	paid: z.boolean().default(false),
	paidAt: z.coerce.date().nullable().optional(),
	createdByUserId: z.string().uuid(),
})

export const updatePaymentSchema = createPaymentSchema.partial().extend({
	version: z.number().int().positive().optional(),
})

export const paymentListQuerySchema = z.object({
	q: optionalQueryString,
	operationId: optionalQueryString,
	appointmentId: optionalQueryString,
	estimateId: optionalQueryString,
	paid: optionalQueryBoolean,
	dateStart: optionalQueryDateString,
	dateEnd: optionalQueryDateString,
	sortKey: z.preprocess(
		(value) => Array.isArray(value) ? value[0] : value,
		z.enum(['patientName', 'amount', 'paymentSource', 'paymentMethod', 'receiptDate', 'receiptNumber']).optional()
	),
	sortDirection: z.preprocess(
		(value) => Array.isArray(value) ? value[0] : value,
		z.enum(['asc', 'desc']).optional()
	),
	includeTotal: optionalQueryBoolean,
	limit: optionalQueryInt,
	cursorSortKey: optionalQueryString,
	cursorId: optionalQueryString,
	cursorCreatedAt: optionalQueryString,
	cursorPatientName: optionalQueryString,
	cursorAmount: optionalQueryString,
	cursorPaymentSource: optionalQueryString,
	cursorPaymentMethod: optionalQueryString,
	cursorReceiptDate: optionalQueryString,
	cursorReceiptNumber: optionalQueryString,
}).strict()

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>
export type PaymentListQueryInput = z.infer<typeof paymentListQuerySchema>
