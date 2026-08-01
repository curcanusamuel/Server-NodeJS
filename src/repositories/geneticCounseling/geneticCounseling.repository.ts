import { db } from '../../db/pool'
import { GeneticCounseling } from '../../types/geneticCounseling'
import { CreateGeneticCounselingInput, UpdateGeneticCounselingInput } from '../../schemas/geneticCounseling.schema'

export type GeneticCounselingUpdateResult =
	| { status: 'updated'; record: GeneticCounseling }
	| { status: 'not_found' }
	| { status: 'conflict' }

const SELECT_COLUMNS = `
  id, patient_id, patient_name, patient_nid, doctor_id, doctor_name, genetic_counseling_date,
  consultation_location, referred_by, referral_reason, personal_history, family_history,
  cancer_and_genetics_education, hereditary_cancer_risk_assessment, genetic_testing_implications,
  familial_risk, psychosocial_recommendations, genetic_testing_result, other_observations,
  is_validated, document_date, document_name, document_url, document_s3_key, media_item_id,
  created_by_user_id, created_at, updated_at, version, deleted_at
`

const FIELD_MAP: Record<string, string> = {
	patientId: 'patient_id',
	patientName: 'patient_name',
	patientNid: 'patient_nid',
	doctorId: 'doctor_id',
	doctorName: 'doctor_name',
	geneticCounselingDate: 'genetic_counseling_date',
	consultationLocation: 'consultation_location',
	referredBy: 'referred_by',
	referralReason: 'referral_reason',
	personalHistory: 'personal_history',
	familyHistory: 'family_history',
	cancerAndGeneticsEducation: 'cancer_and_genetics_education',
	hereditaryCancerRiskAssessment: 'hereditary_cancer_risk_assessment',
	geneticTestingImplications: 'genetic_testing_implications',
	familialRisk: 'familial_risk',
	psychosocialRecommendations: 'psychosocial_recommendations',
	geneticTestingResult: 'genetic_testing_result',
	otherObservations: 'other_observations',
	isValidated: 'is_validated',
	documentDate: 'document_date',
	documentName: 'document_name',
	documentUrl: 'document_url',
	documentS3Key: 'document_s3_key',
	mediaItemId: 'media_item_id',
}

function rowToGeneticCounseling(row: Record<string, unknown>): GeneticCounseling {
	return {
		id: row.id as string,
		patientId: row.patient_id as string,
		patientName: row.patient_name as string,
		patientNid: row.patient_nid as string,
		doctorId: row.doctor_id as string,
		doctorName: row.doctor_name as string,
		geneticCounselingDate: row.genetic_counseling_date as Date,
		consultationLocation: (row.consultation_location as GeneticCounseling['consultationLocation']) ?? null,
		referredBy: (row.referred_by as string | null) ?? null,
		referralReason: (row.referral_reason as string | null) ?? null,
		personalHistory: (row.personal_history as string | null) ?? null,
		familyHistory: (row.family_history as string | null) ?? null,
		cancerAndGeneticsEducation: (row.cancer_and_genetics_education as string | null) ?? null,
		hereditaryCancerRiskAssessment: (row.hereditary_cancer_risk_assessment as string | null) ?? null,
		geneticTestingImplications: (row.genetic_testing_implications as string | null) ?? null,
		familialRisk: (row.familial_risk as string | null) ?? null,
		psychosocialRecommendations: (row.psychosocial_recommendations as string | null) ?? null,
		geneticTestingResult: (row.genetic_testing_result as string | null) ?? null,
		otherObservations: (row.other_observations as string | null) ?? null,
		isValidated: Boolean(row.is_validated),
		documentDate: (row.document_date as Date | null) ?? null,
		documentName: (row.document_name as string | null) ?? null,
		documentUrl: (row.document_url as string | null) ?? null,
		documentS3Key: (row.document_s3_key as string | null) ?? null,
		mediaItemId: (row.media_item_id as string | null) ?? null,
		createdByUserId: row.created_by_user_id as string,
		createdAt: row.created_at as Date,
		updatedAt: row.updated_at as Date,
		version: row.version as number,
		deletedAt: (row.deleted_at as string | null) ?? null,
	}
}

export const geneticCounselingRepository = {
	async findById(id: string): Promise<GeneticCounseling | null> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM genetic_counseling WHERE id = $1 AND deleted_at IS NULL`,
			[id]
		)
		return result.rows[0] ? rowToGeneticCounseling(result.rows[0]) : null
	},

	async findByPatientId(patientId: string): Promise<GeneticCounseling[]> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM genetic_counseling
       WHERE patient_id = $1 AND deleted_at IS NULL
       ORDER BY genetic_counseling_date DESC, id DESC`,
			[patientId]
		)
		return result.rows.map(rowToGeneticCounseling)
	},

	async create(data: CreateGeneticCounselingInput): Promise<GeneticCounseling> {
		const columns = Object.keys(FIELD_MAP).filter((key) => key in data)
		const dbColumns = columns.map((key) => FIELD_MAP[key])
		const placeholders = columns.map((_, i) => `$${i + 1}`)
		const values = columns.map((key) => (data as Record<string, unknown>)[key] ?? null)

		const result = await db.query(
			`INSERT INTO public.genetic_counseling (${dbColumns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING ${SELECT_COLUMNS}`,
			values
		)
		return rowToGeneticCounseling(result.rows[0])
	},

	async update(id: string, data: UpdateGeneticCounselingInput): Promise<GeneticCounselingUpdateResult> {
		const fields: string[] = []
		const values: unknown[] = []
		let i = 1

		for (const [key, col] of Object.entries(FIELD_MAP)) {
			if (key in data) {
				fields.push(`${col} = $${i++}`)
				values.push((data as Record<string, unknown>)[key])
			}
		}

		if (fields.length === 0) {
			const existing = await this.findById(id)
			if (!existing) return { status: 'not_found' }
			return { status: 'updated', record: existing }
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
			`UPDATE public.genetic_counseling
       SET ${fields.join(', ')}
       WHERE id = $${idIndex} AND deleted_at IS NULL ${versionCheck}
       RETURNING ${SELECT_COLUMNS}`,
			values
		)

		if (result.rows[0]) {
			return { status: 'updated', record: rowToGeneticCounseling(result.rows[0]) }
		}

		const statusResult = await db.query('SELECT deleted_at, version FROM genetic_counseling WHERE id = $1', [id])
		if (!statusResult.rows[0] || statusResult.rows[0].deleted_at) return { status: 'not_found' }
		if (clientVersion !== undefined && statusResult.rows[0].version !== clientVersion) {
			return { status: 'conflict' }
		}
		return { status: 'not_found' }
	},

	async delete(id: string): Promise<boolean> {
		const result = await db.query(
			'UPDATE genetic_counseling SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
			[id]
		)
		return (result.rowCount ?? 0) > 0
	},
}
