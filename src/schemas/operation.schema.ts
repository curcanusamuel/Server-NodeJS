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

export const createOperationSchema = z.object({
	priceId: z.string().uuid().nullable().optional(),
	patientId: z.string().uuid(),
	patientName: z.string().default(''),
	patientNid: z.string().default(''),
	doctorId: z.string().uuid(),
	doctorName: z.string().default(''),
	companyId: z.string().uuid().nullable().optional(),
	companyName: z.string().default(''),
	operationDate: z.coerce.date(),
	moduleName: z.string().default(''),
	categoryName: z.string().default(''),
	interventionName: z.string().default(''),
	paymentSource: nullableString,
	price: z.number().nonnegative(),
	paid: z.boolean().default(false),
	paymentMethod: z.enum(['card', 'cash']).nullable().optional(),
	receiptNumber: nullableString,
	receiptDate: z.coerce.date().nullable().optional(),
	createdByUserId: z.string().uuid(),
})

export const updateOperationSchema = createOperationSchema.partial().extend({
	version: z.number().int().positive().optional(),
})

export const operationListQuerySchema = z.object({
	q: optionalQueryString,
	doctorId: optionalQueryString,
	paid: optionalQueryBoolean,
	dateStart: optionalQueryDateString,
	dateEnd: optionalQueryDateString,
	sortKey: z.preprocess(
		(value) => Array.isArray(value) ? value[0] : value,
		z.enum(['date', 'patientName', 'module', 'intervention', 'doctor', 'paymentSource', 'price', 'receiptDate', 'status']).optional()
	),
	sortDirection: z.preprocess(
		(value) => Array.isArray(value) ? value[0] : value,
		z.enum(['asc', 'desc']).optional()
	),
	includeTotal: optionalQueryBoolean,
	limit: optionalQueryInt,
	cursorSortKey: optionalQueryString,
	cursorId: optionalQueryString,
	cursorOperationDate: optionalQueryString,
	cursorPatientName: optionalQueryString,
	cursorModuleName: optionalQueryString,
	cursorInterventionName: optionalQueryString,
	cursorDoctorName: optionalQueryString,
	cursorPaymentSource: optionalQueryString,
	cursorPrice: optionalQueryString,
	cursorReceiptDate: optionalQueryString,
	cursorPaid: optionalQueryString,
}).strict()

export type CreateOperationInput = z.infer<typeof createOperationSchema>
export type UpdateOperationInput = z.infer<typeof updateOperationSchema>
export type OperationListQueryInput = z.infer<typeof operationListQuerySchema>
