import { db } from '../../db/pool'
import { Evolution } from '../../types/evolution'
import { CreateEvolutionInput, UpdateEvolutionInput } from '../../schemas/evolution.schema'

export type EvolutionUpdateResult =
	| { status: 'updated'; record: Evolution }
	| { status: 'not_found' }
	| { status: 'conflict' }

const SELECT_COLUMNS = `
  id, patient_id, patient_name, patient_nid, doctor_id, doctor_name, evolution_date,
  visit_type, consult_type, rte, ecog, normal_field_values, objective_exam_text,
  clinical_progress_signs, clinical_progression, adverse_events_since_last_visit,
  adverse_events, hypersensitivity_reactions, hypersensitivity, ekg_status, ekg_details,
  emotional_status, emotional_status_other, pain_evaluation, pain_intensity, pain_localization,
  analgesic_medication, analgesic_medication_used, analgesic_adverse_effects, constipation,
  medication_change, medication_changed, interactions_discussed, dyspnea, dyspnea_intensity,
  dyspnea_treatment, dignicap, alopecia, followed_oral_chemo, missed_dose, oral_chemo_notes,
  comments, is_validated, document_date, document_name, document_url, document_s3_key,
  media_item_id, created_by_user_id, created_at, updated_at, version, deleted_at
`

const FIELD_MAP: Record<string, string> = {
	patientId: 'patient_id',
	patientName: 'patient_name',
	patientNid: 'patient_nid',
	doctorId: 'doctor_id',
	doctorName: 'doctor_name',
	evolutionDate: 'evolution_date',
	visitType: 'visit_type',
	consultType: 'consult_type',
	rte: 'rte',
	ecog: 'ecog',
	normalFieldValues: 'normal_field_values',
	objectiveExamText: 'objective_exam_text',
	clinicalProgressSigns: 'clinical_progress_signs',
	clinicalProgression: 'clinical_progression',
	adverseEventsSinceLastVisit: 'adverse_events_since_last_visit',
	adverseEvents: 'adverse_events',
	hypersensitivityReactions: 'hypersensitivity_reactions',
	hypersensitivity: 'hypersensitivity',
	ekgStatus: 'ekg_status',
	ekgDetails: 'ekg_details',
	emotionalStatus: 'emotional_status',
	emotionalStatusOther: 'emotional_status_other',
	painEvaluation: 'pain_evaluation',
	painIntensity: 'pain_intensity',
	painLocalization: 'pain_localization',
	analgesicMedication: 'analgesic_medication',
	analgesicMedicationUsed: 'analgesic_medication_used',
	analgesicAdverseEffects: 'analgesic_adverse_effects',
	constipation: 'constipation',
	medicationChange: 'medication_change',
	medicationChanged: 'medication_changed',
	interactionsDiscussed: 'interactions_discussed',
	dyspnea: 'dyspnea',
	dyspneaIntensity: 'dyspnea_intensity',
	dyspneaTreatment: 'dyspnea_treatment',
	dignicap: 'dignicap',
	alopecia: 'alopecia',
	followedOralChemo: 'followed_oral_chemo',
	missedDose: 'missed_dose',
	oralChemoNotes: 'oral_chemo_notes',
	comments: 'comments',
	isValidated: 'is_validated',
	documentDate: 'document_date',
	documentName: 'document_name',
	documentUrl: 'document_url',
	documentS3Key: 'document_s3_key',
	mediaItemId: 'media_item_id',
}

function rowToEvolution(row: Record<string, unknown>): Evolution {
	return {
		id: row.id as string,
		patientId: row.patient_id as string,
		patientName: row.patient_name as string,
		patientNid: row.patient_nid as string,
		doctorId: row.doctor_id as string,
		doctorName: row.doctor_name as string,
		evolutionDate: row.evolution_date as Date,
		visitType: (row.visit_type as string | null) ?? null,
		consultType: (row.consult_type as string | null) ?? null,
		rte: (row.rte as Evolution['rte']) ?? null,
		ecog: (row.ecog as number | null) ?? null,
		normalFieldValues: (row.normal_field_values as Record<string, string> | null) ?? null,
		objectiveExamText: (row.objective_exam_text as string | null) ?? null,
		clinicalProgressSigns: (row.clinical_progress_signs as string | null) ?? null,
		clinicalProgression: (row.clinical_progression as Evolution['clinicalProgression']) ?? null,
		adverseEventsSinceLastVisit: (row.adverse_events_since_last_visit as string | null) ?? null,
		adverseEvents: (row.adverse_events as Evolution['adverseEvents']) ?? null,
		hypersensitivityReactions: (row.hypersensitivity_reactions as string | null) ?? null,
		hypersensitivity: (row.hypersensitivity as Evolution['hypersensitivity']) ?? null,
		ekgStatus: (row.ekg_status as Evolution['ekgStatus']) ?? null,
		ekgDetails: (row.ekg_details as string | null) ?? null,
		emotionalStatus: (row.emotional_status as number | null) ?? null,
		emotionalStatusOther: (row.emotional_status_other as string | null) ?? null,
		painEvaluation: (row.pain_evaluation as Evolution['painEvaluation']) ?? null,
		painIntensity: (row.pain_intensity as number | null) ?? null,
		painLocalization: (row.pain_localization as string | null) ?? null,
		analgesicMedication: (row.analgesic_medication as string | null) ?? null,
		analgesicMedicationUsed: (row.analgesic_medication_used as Evolution['analgesicMedicationUsed']) ?? null,
		analgesicAdverseEffects: (row.analgesic_adverse_effects as string | null) ?? null,
		constipation: (row.constipation as Evolution['constipation']) ?? null,
		medicationChange: (row.medication_change as string | null) ?? null,
		medicationChanged: (row.medication_changed as Evolution['medicationChanged']) ?? null,
		interactionsDiscussed: (row.interactions_discussed as Evolution['interactionsDiscussed']) ?? null,
		dyspnea: (row.dyspnea as Evolution['dyspnea']) ?? null,
		dyspneaIntensity: (row.dyspnea_intensity as number | null) ?? null,
		dyspneaTreatment: (row.dyspnea_treatment as string | null) ?? null,
		dignicap: (row.dignicap as Evolution['dignicap']) ?? null,
		alopecia: (row.alopecia as Evolution['alopecia']) ?? null,
		followedOralChemo: (row.followed_oral_chemo as Evolution['followedOralChemo']) ?? null,
		missedDose: (row.missed_dose as Evolution['missedDose']) ?? null,
		oralChemoNotes: (row.oral_chemo_notes as string | null) ?? null,
		comments: (row.comments as string | null) ?? null,
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

export const evolutionRepository = {
	async findById(id: string): Promise<Evolution | null> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM evolution WHERE id = $1 AND deleted_at IS NULL`,
			[id]
		)
		return result.rows[0] ? rowToEvolution(result.rows[0]) : null
	},

	async findByPatientId(patientId: string): Promise<Evolution[]> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM evolution
       WHERE patient_id = $1 AND deleted_at IS NULL
       ORDER BY evolution_date DESC, id DESC`,
			[patientId]
		)
		return result.rows.map(rowToEvolution)
	},

	async create(data: CreateEvolutionInput): Promise<Evolution> {
		const columns = Object.keys(FIELD_MAP).filter((key) => key in data)
		const dbColumns = columns.map((key) => FIELD_MAP[key])
		const placeholders = columns.map((_, i) => `$${i + 1}`)
		const values = columns.map((key) => (data as Record<string, unknown>)[key] ?? null)

		const result = await db.query(
			`INSERT INTO public.evolution (${dbColumns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING ${SELECT_COLUMNS}`,
			values
		)
		return rowToEvolution(result.rows[0])
	},

	async update(id: string, data: UpdateEvolutionInput): Promise<EvolutionUpdateResult> {
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
			`UPDATE public.evolution
       SET ${fields.join(', ')}
       WHERE id = $${idIndex} AND deleted_at IS NULL ${versionCheck}
       RETURNING ${SELECT_COLUMNS}`,
			values
		)

		if (result.rows[0]) {
			return { status: 'updated', record: rowToEvolution(result.rows[0]) }
		}

		const statusResult = await db.query('SELECT deleted_at, version FROM evolution WHERE id = $1', [id])
		if (!statusResult.rows[0] || statusResult.rows[0].deleted_at) return { status: 'not_found' }
		if (clientVersion !== undefined && statusResult.rows[0].version !== clientVersion) {
			return { status: 'conflict' }
		}
		return { status: 'not_found' }
	},

	async delete(id: string): Promise<boolean> {
		const result = await db.query(
			'UPDATE evolution SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
			[id]
		)
		return (result.rowCount ?? 0) > 0
	},
}
