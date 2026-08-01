import { z } from 'zod'

const nullableString = z.string().nullable().optional()
const optionalQueryInt = z.preprocess(
	(value) => {
		const normalized = Array.isArray(value) ? value[0] : value
		if (normalized === undefined || normalized === null || normalized === '') return undefined
		return Number(normalized)
	},
	z.number().int().positive().optional()
)
const optionalQueryString = z.preprocess(
	(value) => {
		const normalized = Array.isArray(value) ? value[0] : value
		if (typeof normalized !== 'string') return undefined
		const trimmed = normalized.trim()
		return trimmed === '' ? undefined : trimmed
	},
	z.string().optional()
)

export const createWardSchema = z.object({
	name: z.string().min(1),
	type: z.enum(['salon', 'guard_room']),
	unit: nullableString,
	floor: nullableString,
	sortOrder: z.number().int().default(0),
	active: z.boolean().default(true),
})
export const updateWardSchema = createWardSchema.partial()

export const createWardBedSchema = z.object({
	wardId: z.string().uuid(),
	label: z.string().min(1),
	x: z.number().nullable().optional(),
	y: z.number().nullable().optional(),
	rotation: z.number().default(0),
	active: z.boolean().default(true),
})
export const updateWardBedSchema = createWardBedSchema.partial()

export const createWardBedAllocationSchema = z.object({
	wardId: z.string().uuid(),
	bedId: z.string().uuid(),
	patientId: z.string().uuid(),
	allocatedByUserId: z.string().uuid(),
	notes: nullableString,
})
export const releaseWardBedAllocationSchema = z.object({
	releasedByUserId: z.string().uuid(),
})
export const updateWardBedAllocationSchema = z.object({
	notes: nullableString,
	version: z.number().int().positive().optional(),
})

export const createGuardRoomAssignmentSchema = z.object({
	wardId: z.string().uuid(),
	patientId: z.string().uuid(),
	triageLevel: z.number().int().min(1).max(6),
	triageAt: z.coerce.date(),
	assignedByUserId: z.string().uuid(),
	notes: nullableString,
})
export const dischargeGuardRoomAssignmentSchema = z.object({
	dischargedByUserId: z.string().uuid(),
})
export const updateGuardRoomAssignmentSchema = z.object({
	triageLevel: z.number().int().min(1).max(6).optional(),
	triageAt: z.coerce.date().optional(),
	notes: nullableString,
	version: z.number().int().positive().optional(),
})

export const createWardEventSchema = z.object({
	wardId: z.string().uuid(),
	bedId: z.string().uuid().nullable().optional(),
	patientId: z.string().uuid().nullable().optional(),
	patientName: z.string().default(''),
	userId: z.string().uuid(),
	userName: z.string().default(''),
	eventType: z.enum(['allocate', 'deallocate', 'manual', 'guard_allocate', 'guard_discharge', 'triage_modification']),
	description: nullableString,
})

export const wardEventsQuerySchema = z.object({
	limit: optionalQueryInt,
}).strict()

export const activeGuardRoomAssignmentsQuerySchema = z.object({
	wardId: optionalQueryString,
}).strict()

export type CreateWardInput = z.infer<typeof createWardSchema>
export type UpdateWardInput = z.infer<typeof updateWardSchema>
export type CreateWardBedInput = z.infer<typeof createWardBedSchema>
export type UpdateWardBedInput = z.infer<typeof updateWardBedSchema>
export type CreateWardBedAllocationInput = z.infer<typeof createWardBedAllocationSchema>
export type ReleaseWardBedAllocationInput = z.infer<typeof releaseWardBedAllocationSchema>
export type UpdateWardBedAllocationInput = z.infer<typeof updateWardBedAllocationSchema>
export type CreateGuardRoomAssignmentInput = z.infer<typeof createGuardRoomAssignmentSchema>
export type DischargeGuardRoomAssignmentInput = z.infer<typeof dischargeGuardRoomAssignmentSchema>
export type UpdateGuardRoomAssignmentInput = z.infer<typeof updateGuardRoomAssignmentSchema>
export type CreateWardEventInput = z.infer<typeof createWardEventSchema>
export type WardEventsQueryInput = z.infer<typeof wardEventsQuerySchema>
export type ActiveGuardRoomAssignmentsQueryInput = z.infer<typeof activeGuardRoomAssignmentsQuerySchema>
