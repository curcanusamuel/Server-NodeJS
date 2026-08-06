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

const statusEnum = z.enum(['confirmed', 'unconfirmed', 'no_answer', 'canceled'])

export const createAppointmentSchema = z.object({
	patientId: z.string().uuid(),
	patientName: z.string().default(''),
	patientNid: z.string().default(''),
	patientPhone: z.string().default(''),
	doctorId: z.string().uuid(),
	doctorName: z.string().default(''),
	moduleId: z.string().uuid(),
	moduleName: z.string().default(''),
	categoryId: z.string().uuid(),
	categoryName: z.string().default(''),
	serviceId: z.string().uuid(),
	serviceName: z.string().default(''),
	appointmentDate: z.coerce.date(),
	startTime: z.string().min(1),
	endTime: nullableString,
	durationMinutes: z.number().int().positive().nullable().optional(),
	status: statusEnum.default('unconfirmed'),
	notes: nullableString,
	createdByUserId: z.string().uuid(),
	createdByUserName: z.string().default(''),
})

export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
	version: z.number().int().positive().optional(),
})

export const appointmentListQuerySchema = z.object({
	q: optionalQueryString,
	patientNid: optionalQueryString,
	patientName: optionalQueryString,
	patientPhone: optionalQueryString,
	patientCnp: optionalQueryString,
	familyDoctor: optionalQueryString,
	birthDateStart: optionalQueryDateString,
	birthDateEnd: optionalQueryDateString,
	dateStart: optionalQueryDateString,
	dateEnd: optionalQueryDateString,
	doctorId: optionalQueryString,
	moduleId: optionalQueryString,
	categoryId: optionalQueryString,
	createdByUserId: optionalQueryString,
	createdByUserName: optionalQueryString,
	status: z.preprocess(
		(value) => Array.isArray(value) ? value[0] : value,
		statusEnum.optional()
	),
	showCanceled: optionalQueryBoolean,
	sortKey: z.preprocess(
		(value) => Array.isArray(value) ? value[0] : value,
		z.enum(['date', 'time', 'patientNid', 'patientName', 'doctor', 'intervention', 'status']).optional()
	),
	sortDirection: z.preprocess(
		(value) => Array.isArray(value) ? value[0] : value,
		z.enum(['asc', 'desc']).optional()
	),
	includeTotal: optionalQueryBoolean,
	limit: optionalQueryInt,
	cursorSortKey: optionalQueryString,
	cursorId: optionalQueryString,
	cursorAppointmentDate: optionalQueryString,
	cursorStartTime: optionalQueryString,
	cursorPatientNid: optionalQueryString,
	cursorPatientName: optionalQueryString,
	cursorDoctorName: optionalQueryString,
	cursorServiceName: optionalQueryString,
	cursorStatus: optionalQueryString,
}).strict()

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>
export type AppointmentListQueryInput = z.infer<typeof appointmentListQuerySchema>
