import { z } from 'zod'

const nullableString = z.string().nullable().optional()
const nullableDate = z.coerce.date().nullable().optional()
const optionalQueryString = z.preprocess(
	(value) => {
		const normalized = Array.isArray(value) ? value[0] : value
		if (typeof normalized !== 'string') return undefined
		const trimmed = normalized.trim()
		return trimmed === '' ? undefined : trimmed
	},
	z.string().optional()
)

const yesNoNa = z.enum(['yes', 'no', 'na']).nullable().optional()
const yesNoPast = z.enum(['yes', 'no', 'past']).nullable().optional()

export const createAntecedenteSchema = z.object({
	patientId: z.string().uuid(),
	patientName: z.string().default(''),
	patientNid: z.string().default(''),
	doctorId: z.string().uuid(),
	doctorName: z.string().default(''),
	antecedenteDate: z.coerce.date(),
	heredocolaterale: nullableString,
	pregnancies: z.number().int().min(0).nullable().optional(),
	births: z.number().int().min(0).nullable().optional(),
	abortions: z.number().int().min(0).nullable().optional(),
	breastfeeding: yesNoNa,
	hormonalStatus: z.enum(['premenopauza', 'perimenopauza', 'postmenopauza']).nullable().optional(),
	menopauseDate: nullableDate,
	physiologicalReason: nullableString,
	pregnancyTest: yesNoNa,
	pregnancyTestDate: nullableDate,
	contraception: yesNoNa,
	contraceptionNotes: nullableString,
	pathologicalHistory: nullableString,
	medicationConsumption: nullableString,
	infertilityRiskInfo: yesNoNa,
	smoker: yesNoPast,
	smokingType: z.number().int().min(1).max(3).nullable().optional(),
	averagePerDay: z.number().int().min(0).nullable().optional(),
	yearsSmoked: z.number().int().min(0).nullable().optional(),
	smokedRegularly: yesNoPast,
	smokingStopDate: nullableDate,
	chronicEthanolConsumer: yesNoPast,
	evolutionDate: nullableDate,
	visitType: nullableString,
	consultType: nullableString,
	rte: yesNoNa,
	ecog: z.number().int().min(0).max(5).nullable().optional(),
	normalFieldValues: z.record(z.string(), z.string()).nullable().optional(),
	objectiveExamText: nullableString,
	clinicalProgressSigns: nullableString,
	clinicalProgression: yesNoNa,
	adverseEventsSinceLastVisit: nullableString,
	adverseEvents: yesNoNa,
	hypersensitivityReactions: nullableString,
	hypersensitivity: yesNoNa,
	ekgStatus: z.enum(['normal', 'patologic']).nullable().optional(),
	ekgDetails: nullableString,
	emotionalStatus: z.number().int().min(1).max(6).nullable().optional(),
	emotionalStatusOther: nullableString,
	painEvaluation: yesNoNa,
	painIntensity: z.number().int().min(0).max(10).nullable().optional(),
	painLocalization: nullableString,
	analgesicMedication: nullableString,
	analgesicMedicationUsed: yesNoNa,
	analgesicAdverseEffects: nullableString,
	constipation: yesNoNa,
	medicationChange: nullableString,
	medicationChanged: yesNoNa,
	interactionsDiscussed: yesNoNa,
	dyspnea: yesNoNa,
	dyspneaIntensity: z.number().int().min(0).max(10).nullable().optional(),
	dyspneaTreatment: nullableString,
	dignicap: yesNoNa,
	alopecia: yesNoNa,
	followedOralChemo: yesNoNa,
	missedDose: yesNoNa,
	oralChemoNotes: nullableString,
	comments: nullableString,
	isValidated: z.boolean().default(false),
	documentDate: nullableDate,
	documentName: nullableString,
	documentUrl: nullableString,
	documentS3Key: nullableString,
	mediaItemId: z.string().uuid().nullable().optional(),
	createdByUserId: z.string().uuid(),
})

export const updateAntecedenteSchema = createAntecedenteSchema.partial().extend({
	version: z.number().int().positive().optional(),
})

export const antecedenteListQuerySchema = z.object({
	patientId: optionalQueryString,
}).strict()

export type CreateAntecedenteInput = z.infer<typeof createAntecedenteSchema>
export type UpdateAntecedenteInput = z.infer<typeof updateAntecedenteSchema>
export type AntecedenteListQueryInput = z.infer<typeof antecedenteListQuerySchema>
