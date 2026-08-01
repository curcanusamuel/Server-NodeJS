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

export const createEstimateSchema = z.object({
	appointmentId: z.string().uuid().nullable().optional(),
	patientId: z.string().uuid(),
	patientName: z.string().default(''),
	patientNid: z.string().default(''),
	doctorId: z.string().uuid(),
	doctorName: z.string().default(''),
	moduleId: z.string().uuid(),
	moduleName: z.string().default(''),
	categoryId: z.string().uuid(),
	categoryName: z.string().default(''),
	serviceId: z.string().uuid(),
	serviceName: z.string().default(''),
	priceId: z.string().uuid().nullable().optional(),
	price: z.number().nonnegative(),
	paymentSource: nullableString,
	createdByUserId: z.string().uuid(),
})

export const updateEstimateSchema = createEstimateSchema.partial().extend({
	version: z.number().int().positive().optional(),
})

export const estimateListQuerySchema = z.object({
	q: optionalQueryString,
	doctorId: optionalQueryString,
	moduleId: optionalQueryString,
	categoryId: optionalQueryString,
	appointmentId: optionalQueryString,
	dateStart: optionalQueryDateString,
	dateEnd: optionalQueryDateString,
	sortKey: z.preprocess(
		(value) => Array.isArray(value) ? value[0] : value,
		z.enum(['patientName', 'doctorName', 'moduleName', 'serviceName', 'categoryName']).optional()
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
	cursorDoctorName: optionalQueryString,
	cursorModuleName: optionalQueryString,
	cursorServiceName: optionalQueryString,
	cursorCategoryName: optionalQueryString,
}).strict()

export type CreateEstimateInput = z.infer<typeof createEstimateSchema>
export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>
export type EstimateListQueryInput = z.infer<typeof estimateListQuerySchema>
