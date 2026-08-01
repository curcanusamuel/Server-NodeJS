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

export const createGeneticCounselingSchema = z.object({
	patientId: z.string().uuid(),
	patientName: z.string().default(''),
	patientNid: z.string().default(''),
	doctorId: z.string().uuid(),
	doctorName: z.string().default(''),
	geneticCounselingDate: z.coerce.date(),
	consultationLocation: z.enum(['fizic', 'online']).nullable().optional(),
	referredBy: nullableString,
	referralReason: nullableString,
	personalHistory: nullableString,
	familyHistory: nullableString,
	cancerAndGeneticsEducation: nullableString,
	hereditaryCancerRiskAssessment: nullableString,
	geneticTestingImplications: nullableString,
	familialRisk: nullableString,
	psychosocialRecommendations: nullableString,
	geneticTestingResult: nullableString,
	otherObservations: nullableString,
	isValidated: z.boolean().default(false),
	documentDate: z.coerce.date().nullable().optional(),
	documentName: nullableString,
	documentUrl: nullableString,
	documentS3Key: nullableString,
	mediaItemId: z.string().uuid().nullable().optional(),
	createdByUserId: z.string().uuid(),
})

export const updateGeneticCounselingSchema = createGeneticCounselingSchema.partial().extend({
	version: z.number().int().positive().optional(),
})

export const geneticCounselingListQuerySchema = z.object({
	patientId: optionalQueryString,
}).strict()

export type CreateGeneticCounselingInput = z.infer<typeof createGeneticCounselingSchema>
export type UpdateGeneticCounselingInput = z.infer<typeof updateGeneticCounselingSchema>
export type GeneticCounselingListQueryInput = z.infer<typeof geneticCounselingListQuerySchema>
