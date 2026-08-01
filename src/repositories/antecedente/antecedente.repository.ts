import { db } from '../../db/pool'
import { Antecedente } from '../../types/antecedente'
import { CreateAntecedenteInput, UpdateAntecedenteInput } from '../../schemas/antecedente.schema'

export type AntecedenteUpdateResult =
	| { status: 'updated'; record: Antecedente }
	| { status: 'not_found' }
	| { status: 'conflict' }

const SELECT_COLUMNS = `
  id, patient_id, patient_name, patient_nid, doctor_id, doctor_name, antecedente_date,
  heredocolaterale, pregnancies, births, abortions, breastfeeding, hormonal_status,
  menopause_date, physiological_reason, pregnancy_test, pregnancy_test_date, contraception,
  contraception_notes, pathological_history, medication_consumption, infertility_risk_info,
  smoker, smoking_type, average_per_day, years_smoked, smoked_regularly, smoking_stop_date,
  chronic_ethanol_consumer, evolution_date, visit_type, consult_type, rte, ecog,
  normal_field_values, objective_exam_text, clinical_progress_signs, clinical_progression,
  adverse_events_since_last_visit, adverse_events, hypersensitivity_reactions, hypersensitivity,
  ekg_status, ekg_details, emotional_status, emotional_status_other, pain_evaluation,
  pain_intensity, pain_localization, analgesic_medication, analgesic_medication_used,
  analgesic_adverse_effects, constipation, medication_change, medication_changed,
  interactions_discussed, dyspnea, dyspnea_intensity, dyspnea_treatment, dignicap, alopecia,
  followed_oral_chemo, missed_dose, oral_chemo_notes, comments, is_validated, document_date,
  document_name, document_url, document_s3_key, media_item_id, created_by_user_id,
  created_at, updated_at, version, deleted_at
`

const FIELD_MAP: Record<string, string> = {
	patientId: 'patient_id',
	patientName: 'patient_name',
	patientNid: 'patient_nid',
	doctorId: 'doctor_id',
	doctorName: 'doctor_name',
	antecedenteDate: 'antecedente_date',
	heredocolaterale: 'heredocolaterale',
	pregnancies: 'pregnancies',
	births: 'births',
	abortions: 'abortions',
	breastfeeding: 'breastfeeding',
	hormonalStatus: 'hormonal_status',
	menopauseDate: 'menopause_date',
	physiologicalReason: 'physiological_reason',
	pregnancyTest: 'pregnancy_test',
	pregnancyTestDate: 'pregnancy_test_date',
	contraception: 'contraception',
	contraceptionNotes: 'contraception_notes',
	pathologicalHistory: 'pathological_history',
	medicationConsumption: 'medication_consumption',
	infertilityRiskInfo: 'infertility_risk_info',
	smoker: 'smoker',
	smokingType: 'smoking_type',
	averagePerDay: 'average_per_day',
	yearsSmoked: 'years_smoked',
	smokedRegularly: 'smoked_regularly',
	smokingStopDate: 'smoking_stop_date',
	chronicEthanolConsumer: 'chronic_ethanol_consumer',
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

function rowToAntecedente(row: Record<string, unknown>): Antecedente {
	return {
		id: row.id as string,
		patientId: row.patient_id as string,
		patientName: row.patient_name as string,
		patientNid: row.patient_nid as string,
		doctorId: row.doctor_id as string,
		doctorName: row.doctor_name as string,
		antecedenteDate: row.antecedente_date as Date,
		heredocolaterale: (row.heredocolaterale as string | null) ?? null,
		pregnancies: (row.pregnancies as number | null) ?? null,
		births: (row.births as number | null) ?? null,
		abortions: (row.abortions as number | null) ?? null,
		breastfeeding: (row.breastfeeding as Antecedente['breastfeeding']) ?? null,
		hormonalStatus: (row.hormonal_status as Antecedente['hormonalStatus']) ?? null,
		menopauseDate: (row.menopause_date as Date | null) ?? null,
		physiologicalReason: (row.physiological_reason as string | null) ?? null,
		pregnancyTest: (row.pregnancy_test as Antecedente['pregnancyTest']) ?? null,
		pregnancyTestDate: (row.pregnancy_test_date as Date | null) ?? null,
		contraception: (row.contraception as Antecedente['contraception']) ?? null,
		contraceptionNotes: (row.contraception_notes as string | null) ?? null,
		pathologicalHistory: (row.pathological_history as string | null) ?? null,
		medicationConsumption: (row.medication_consumption as string | null) ?? null,
		infertilityRiskInfo: (row.infertility_risk_info as Antecedente['infertilityRiskInfo']) ?? null,
		smoker: (row.smoker as Antecedente['smoker']) ?? null,
		smokingType: (row.smoking_type as number | null) ?? null,
		averagePerDay: (row.average_per_day as number | null) ?? null,
		yearsSmoked: (row.years_smoked as number | null) ?? null,
		smokedRegularly: (row.smoked_regularly as Antecedente['smokedRegularly']) ?? null,
		smokingStopDate: (row.smoking_stop_date as Date | null) ?? null,
		chronicEthanolConsumer: (row.chronic_ethanol_consumer as Antecedente['chronicEthanolConsumer']) ?? null,
		evolutionDate: (row.evolution_date as Date | null) ?? null,
		visitType: (row.visit_type as string | null) ?? null,
		consultType: (row.consult_type as string | null) ?? null,
		rte: (row.rte as Antecedente['rte']) ?? null,
		ecog: (row.ecog as number | null) ?? null,
		normalFieldValues: (row.normal_field_values as Record<string, string> | null) ?? null,
		objectiveExamText: (row.objective_exam_text as string | null) ?? null,
		clinicalProgressSigns: (row.clinical_progress_signs as string | null) ?? null,
		clinicalProgression: (row.clinical_progression as Antecedente['clinicalProgression']) ?? null,
		adverseEventsSinceLastVisit: (row.adverse_events_since_last_visit as string | null) ?? null,
		adverseEvents: (row.adverse_events as Antecedente['adverseEvents']) ?? null,
		hypersensitivityReactions: (row.hypersensitivity_reactions as string | null) ?? null,
		hypersensitivity: (row.hypersensitivity as Antecedente['hypersensitivity']) ?? null,
		ekgStatus: (row.ekg_status as Antecedente['ekgStatus']) ?? null,
		ekgDetails: (row.ekg_details as string | null) ?? null,
		emotionalStatus: (row.emotional_status as number | null) ?? null,
		emotionalStatusOther: (row.emotional_status_other as string | null) ?? null,
		painEvaluation: (row.pain_evaluation as Antecedente['painEvaluation']) ?? null,
		painIntensity: (row.pain_intensity as number | null) ?? null,
		painLocalization: (row.pain_localization as string | null) ?? null,
		analgesicMedication: (row.analgesic_medication as string | null) ?? null,
		analgesicMedicationUsed: (row.analgesic_medication_used as Antecedente['analgesicMedicationUsed']) ?? null,
		analgesicAdverseEffects: (row.analgesic_adverse_effects as string | null) ?? null,
		constipation: (row.constipation as Antecedente['constipation']) ?? null,
		medicationChange: (row.medication_change as string | null) ?? null,
		medicationChanged: (row.medication_changed as Antecedente['medicationChanged']) ?? null,
		interactionsDiscussed: (row.interactions_discussed as Antecedente['interactionsDiscussed']) ?? null,
		dyspnea: (row.dyspnea as Antecedente['dyspnea']) ?? null,
		dyspneaIntensity: (row.dyspnea_intensity as number | null) ?? null,
		dyspneaTreatment: (row.dyspnea_treatment as string | null) ?? null,
		dignicap: (row.dignicap as Antecedente['dignicap']) ?? null,
		alopecia: (row.alopecia as Antecedente['alopecia']) ?? null,
		followedOralChemo: (row.followed_oral_chemo as Antecedente['followedOralChemo']) ?? null,
		missedDose: (row.missed_dose as Antecedente['missedDose']) ?? null,
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

export const antecedenteRepository = {
	async findById(id: string): Promise<Antecedente | null> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM antecedente WHERE id = $1 AND deleted_at IS NULL`,
			[id]
		)
		return result.rows[0] ? rowToAntecedente(result.rows[0]) : null
	},

	async findByPatientId(patientId: string): Promise<Antecedente[]> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM antecedente
       WHERE patient_id = $1 AND deleted_at IS NULL
       ORDER BY antecedente_date DESC, id DESC`,
			[patientId]
		)
		return result.rows.map(rowToAntecedente)
	},

	async create(data: CreateAntecedenteInput): Promise<Antecedente> {
		const columns = Object.keys(FIELD_MAP).filter((key) => key in data)
		const dbColumns = columns.map((key) => FIELD_MAP[key])
		const placeholders = columns.map((_, i) => `$${i + 1}`)
		const values = columns.map((key) => (data as Record<string, unknown>)[key] ?? null)

		const result = await db.query(
			`INSERT INTO public.antecedente (${dbColumns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING ${SELECT_COLUMNS}`,
			values
		)
		return rowToAntecedente(result.rows[0])
	},

	async update(id: string, data: UpdateAntecedenteInput): Promise<AntecedenteUpdateResult> {
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
			`UPDATE public.antecedente
       SET ${fields.join(', ')}
       WHERE id = $${idIndex} AND deleted_at IS NULL ${versionCheck}
       RETURNING ${SELECT_COLUMNS}`,
			values
		)

		if (result.rows[0]) {
			return { status: 'updated', record: rowToAntecedente(result.rows[0]) }
		}

		const statusResult = await db.query('SELECT deleted_at, version FROM antecedente WHERE id = $1', [id])
		if (!statusResult.rows[0] || statusResult.rows[0].deleted_at) return { status: 'not_found' }
		if (clientVersion !== undefined && statusResult.rows[0].version !== clientVersion) {
			return { status: 'conflict' }
		}
		return { status: 'not_found' }
	},

	async delete(id: string): Promise<boolean> {
		const result = await db.query(
			'UPDATE antecedente SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
			[id]
		)
		return (result.rowCount ?? 0) > 0
	},
}
