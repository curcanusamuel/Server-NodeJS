import { db } from '../../db/pool'
import { MedicalLetter } from '../../types/medicalLetter'
import {
  CreateMedicalLetterInput,
  UpdateMedicalLetterInput,
  ValidateMedicalLetterInput,
  MedicalLetterListQuery,
} from '../../schemas/medicalLetter.schema'

export type MedicalLetterUpdateResult =
  | { status: 'updated'; letter: MedicalLetter }
  | { status: 'not_found' }
  | { status: 'conflict' }

function toDateStr(val: unknown): string {
  if (val instanceof Date) return val.toISOString().split('T')[0]
  return String(val).slice(0, 10)
}

function toDateStrOrNull(val: unknown): string | null {
  if (val === null || val === undefined) return null
  return toDateStr(val)
}

function rowToMedicalLetter(row: Record<string, unknown>): MedicalLetter {
  return {
    id: row.id as string,
    patientId: row.patient_id as string,
    patientName: row.patient_name as string,
    patientNid: row.patient_nid as string,
    doctorId: row.doctor_id as string,
    doctorName: row.doctor_name as string,
    letterDate: toDateStr(row.letter_date),
    birthDate: toDateStrOrNull(row.birth_date),
    patientAge: (row.patient_age as number | null) ?? null,
    consultType: (row.consult_type as string | null) ?? null,
    consultationReason: (row.consultation_reason as string | null) ?? null,
    medicalHistory: (row.medical_history as string | null) ?? null,
    firstHistoCito: (row.first_histo_cito as string | null) ?? null,
    firstHistoCitoDate: toDateStrOrNull(row.first_histo_cito_date),
    diagnosis: (row.diagnosis as string | null) ?? null,
    staging: (row.staging as string | null) ?? null,
    stagingT: (row.staging_t as string | null) ?? null,
    stagingN: (row.staging_n as string | null) ?? null,
    stagingM: (row.staging_m as string | null) ?? null,
    stage: (row.stage as string | null) ?? null,
    icdCode: (row.icd_code as string | null) ?? null,
    icdLocalization: (row.icd_localization as string | null) ?? null,
    ecog: (row.ecog as number | null) ?? null,
    examFieldsJson: (row.exam_fields_json as Record<string, unknown> | null) ?? null,
    objectiveExamNotes: (row.objective_exam_notes as string | null) ?? null,
    clinicalImagingBiochemistry: (row.clinical_imaging_biochemistry as string | null) ?? null,
    painIntensity: (row.pain_intensity as number | null) ?? null,
    painLocalization: (row.pain_localization as string | null) ?? null,
    analgesicMedication: (row.analgesic_medication as string | null) ?? null,
    analgesicAdverseEffects: (row.analgesic_adverse_effects as string | null) ?? null,
    dyspneaIntensity: (row.dyspnea_intensity as number | null) ?? null,
    dyspneaTreatment: (row.dyspnea_treatment as string | null) ?? null,
    interactionsChecked: (row.interactions_checked as boolean | null) ?? null,
    treatmentGoal: (row.treatment_goal as string | null) ?? null,
    therapeuticConduct: (row.therapeutic_conduct as string | null) ?? null,
    treatmentPlan: (row.treatment_plan as string | null) ?? null,
    adverseReactionsJson: (row.adverse_reactions_json as Record<string, unknown> | null) ?? null,
    adverseReactionsNotes: (row.adverse_reactions_notes as string | null) ?? null,
    nextAppointmentDate: toDateStrOrNull(row.next_appointment_date),
    periodicControlInterval: (row.periodic_control_interval as string | null) ?? null,
    periodicControlNotes: (row.periodic_control_notes as string | null) ?? null,
    lifestyleRecommendations: (row.lifestyle_recommendations as string | null) ?? null,
    otherRecommendedInvestigations: (row.other_recommended_investigations as string | null) ?? null,
    geneticCounseling: (row.genetic_counseling as string | null) ?? null,
    otherRecommendations: (row.other_recommendations as string | null) ?? null,
    icdIndication: (row.icd_indication as string | null) ?? null,
    returnAdmission: (row.return_admission as boolean | null) ?? null,
    returnAdmissionDays: (row.return_admission_days as number | null) ?? null,
    prescriptionStatus: (row.prescription_status as boolean | null) ?? null,
    prescriptionSeries: (row.prescription_series as string | null) ?? null,
    prescriptionNumber: (row.prescription_number as string | null) ?? null,
    medicalLeaveStatus: (row.medical_leave_status as boolean | null) ?? null,
    medicalLeaveSeries: (row.medical_leave_series as string | null) ?? null,
    medicalLeaveNumber: (row.medical_leave_number as string | null) ?? null,
    homeCareRecommendation: (row.home_care_recommendation as string | null) ?? null,
    medicalDevicesPrescription: (row.medical_devices_prescription as string | null) ?? null,
    transmissionMode: (row.transmission_mode as string | null) ?? null,
    validated: Boolean(row.validated),
    validatedByUserId: (row.validated_by_user_id as string | null) ?? null,
    validatedAt: (row.validated_at as Date | null) ?? null,
    documentS3Key: (row.document_s3_key as string | null) ?? null,
    documentUrl: (row.document_url as string | null) ?? null,
    mediaItemId: (row.media_item_id as string | null) ?? null,
    createdByUserId: row.created_by_user_id as string,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    deletedAt: (row.deleted_at as string | null) ?? null,
    version: row.version as number,
  }
}

export const medicalLetterRepository = {
  async findAll(
    query: MedicalLetterListQuery = {}
  ): Promise<{ items: MedicalLetter[]; nextCursor: string | null }> {
    const conditions: string[] = ['deleted_at IS NULL']
    const values: unknown[] = []
    let i = 1

    if (query.patientId) {
      conditions.push(`patient_id = $${i++}`)
      values.push(query.patientId)
    }

    if (query.doctorId) {
      conditions.push(`doctor_id = $${i++}`)
      values.push(query.doctorId)
    }

    if (query.validated !== undefined) {
      conditions.push(`validated = $${i++}`)
      values.push(query.validated === 'true')
    }

    if (query.letterDateFrom) {
      conditions.push(`letter_date >= $${i++}::date`)
      values.push(query.letterDateFrom)
    }

    if (query.letterDateTo) {
      conditions.push(`letter_date <= $${i++}::date`)
      values.push(query.letterDateTo)
    }

    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf8')
        ) as { letterDate: string; id: string }
        conditions.push(`(letter_date, id) < ($${i}::date, $${i + 1}::uuid)`)
        values.push(decoded.letterDate, decoded.id)
        i += 2
      } catch {
        // ignore malformed cursor
      }
    }

    const limit = Math.min(parseInt(query.limit ?? '20', 10) || 20, 100)
    values.push(limit + 1)

    const result = await db.query(
      `SELECT * FROM medical_letters
       WHERE ${conditions.join(' AND ')}
       ORDER BY letter_date DESC, id DESC
       LIMIT $${i}`,
      values
    )

    const hasNext = result.rows.length > limit
    const rows = hasNext ? result.rows.slice(0, limit) : result.rows
    const items = rows.map(rowToMedicalLetter)

    let nextCursor: string | null = null
    if (hasNext && rows.length > 0) {
      const last = rows[rows.length - 1]
      nextCursor = Buffer.from(
        JSON.stringify({
          letterDate: toDateStr(last.letter_date),
          id: last.id as string,
        })
      ).toString('base64')
    }

    return { items, nextCursor }
  },

  async findById(id: string): Promise<MedicalLetter | null> {
    const result = await db.query(
      `SELECT * FROM medical_letters WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    )
    return result.rows[0] ? rowToMedicalLetter(result.rows[0]) : null
  },

  async create(data: CreateMedicalLetterInput): Promise<MedicalLetter> {
    const result = await db.query(
      `INSERT INTO medical_letters (
        patient_id, patient_name, patient_nid,
        doctor_id, doctor_name,
        letter_date, birth_date, patient_age,
        consult_type, consultation_reason, medical_history,
        first_histo_cito, first_histo_cito_date,
        diagnosis, staging, staging_t, staging_n, staging_m, stage,
        icd_code, icd_localization, ecog,
        exam_fields_json, objective_exam_notes, clinical_imaging_biochemistry,
        pain_intensity, pain_localization,
        analgesic_medication, analgesic_adverse_effects,
        dyspnea_intensity, dyspnea_treatment,
        interactions_checked,
        treatment_goal, therapeutic_conduct, treatment_plan,
        adverse_reactions_json, adverse_reactions_notes,
        next_appointment_date, periodic_control_interval, periodic_control_notes,
        lifestyle_recommendations, other_recommended_investigations,
        genetic_counseling, other_recommendations,
        icd_indication,
        return_admission, return_admission_days,
        prescription_status, prescription_series, prescription_number,
        medical_leave_status, medical_leave_series, medical_leave_number,
        home_care_recommendation, medical_devices_prescription,
        transmission_mode,
        document_s3_key, document_url, media_item_id,
        created_by_user_id
      ) VALUES (
        $1,  $2,  $3,
        $4,  $5,
        $6,  $7,  $8,
        $9,  $10, $11,
        $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22,
        $23, $24, $25,
        $26, $27,
        $28, $29,
        $30, $31,
        $32,
        $33, $34, $35,
        $36, $37,
        $38, $39, $40,
        $41, $42,
        $43, $44,
        $45,
        $46, $47,
        $48, $49, $50,
        $51, $52, $53,
        $54, $55,
        $56,
        $57, $58, $59,
        $60
      )
      RETURNING *`,
      [
        data.patientId,        data.patientName,       data.patientNid,
        data.doctorId,         data.doctorName,
        data.letterDate,       data.birthDate ?? null,  data.patientAge ?? null,
        data.consultType ?? null, data.consultationReason ?? null, data.medicalHistory ?? null,
        data.firstHistoCito ?? null, data.firstHistoCitoDate ?? null,
        data.diagnosis ?? null, data.staging ?? null, data.stagingT ?? null,
        data.stagingN ?? null,  data.stagingM ?? null,  data.stage ?? null,
        data.icdCode ?? null,  data.icdLocalization ?? null, data.ecog ?? null,
        data.examFieldsJson ?? null, data.objectiveExamNotes ?? null, data.clinicalImagingBiochemistry ?? null,
        data.painIntensity ?? null, data.painLocalization ?? null,
        data.analgesicMedication ?? null, data.analgesicAdverseEffects ?? null,
        data.dyspneaIntensity ?? null, data.dyspneaTreatment ?? null,
        data.interactionsChecked ?? null,
        data.treatmentGoal ?? null, data.therapeuticConduct ?? null, data.treatmentPlan ?? null,
        data.adverseReactionsJson ?? null, data.adverseReactionsNotes ?? null,
        data.nextAppointmentDate ?? null, data.periodicControlInterval ?? null, data.periodicControlNotes ?? null,
        data.lifestyleRecommendations ?? null, data.otherRecommendedInvestigations ?? null,
        data.geneticCounseling ?? null, data.otherRecommendations ?? null,
        data.icdIndication ?? null,
        data.returnAdmission ?? null, data.returnAdmissionDays ?? null,
        data.prescriptionStatus ?? null, data.prescriptionSeries ?? null, data.prescriptionNumber ?? null,
        data.medicalLeaveStatus ?? null, data.medicalLeaveSeries ?? null, data.medicalLeaveNumber ?? null,
        data.homeCareRecommendation ?? null, data.medicalDevicesPrescription ?? null,
        data.transmissionMode ?? null,
        data.documentS3Key ?? null, data.documentUrl ?? null, data.mediaItemId ?? null,
        data.createdByUserId,
      ]
    )
    return rowToMedicalLetter(result.rows[0])
  },

  async update(id: string, data: UpdateMedicalLetterInput): Promise<MedicalLetterUpdateResult> {
    const fields: string[] = []
    const values: unknown[] = []
    let i = 1

    const fieldMap: Record<string, string> = {
      patientName: 'patient_name',
      patientNid: 'patient_nid',
      doctorId: 'doctor_id',
      doctorName: 'doctor_name',
      letterDate: 'letter_date',
      birthDate: 'birth_date',
      patientAge: 'patient_age',
      consultType: 'consult_type',
      consultationReason: 'consultation_reason',
      medicalHistory: 'medical_history',
      firstHistoCito: 'first_histo_cito',
      firstHistoCitoDate: 'first_histo_cito_date',
      diagnosis: 'diagnosis',
      staging: 'staging',
      stagingT: 'staging_t',
      stagingN: 'staging_n',
      stagingM: 'staging_m',
      stage: 'stage',
      icdCode: 'icd_code',
      icdLocalization: 'icd_localization',
      ecog: 'ecog',
      examFieldsJson: 'exam_fields_json',
      objectiveExamNotes: 'objective_exam_notes',
      clinicalImagingBiochemistry: 'clinical_imaging_biochemistry',
      painIntensity: 'pain_intensity',
      painLocalization: 'pain_localization',
      analgesicMedication: 'analgesic_medication',
      analgesicAdverseEffects: 'analgesic_adverse_effects',
      dyspneaIntensity: 'dyspnea_intensity',
      dyspneaTreatment: 'dyspnea_treatment',
      interactionsChecked: 'interactions_checked',
      treatmentGoal: 'treatment_goal',
      therapeuticConduct: 'therapeutic_conduct',
      treatmentPlan: 'treatment_plan',
      adverseReactionsJson: 'adverse_reactions_json',
      adverseReactionsNotes: 'adverse_reactions_notes',
      nextAppointmentDate: 'next_appointment_date',
      periodicControlInterval: 'periodic_control_interval',
      periodicControlNotes: 'periodic_control_notes',
      lifestyleRecommendations: 'lifestyle_recommendations',
      otherRecommendedInvestigations: 'other_recommended_investigations',
      geneticCounseling: 'genetic_counseling',
      otherRecommendations: 'other_recommendations',
      icdIndication: 'icd_indication',
      returnAdmission: 'return_admission',
      returnAdmissionDays: 'return_admission_days',
      prescriptionStatus: 'prescription_status',
      prescriptionSeries: 'prescription_series',
      prescriptionNumber: 'prescription_number',
      medicalLeaveStatus: 'medical_leave_status',
      medicalLeaveSeries: 'medical_leave_series',
      medicalLeaveNumber: 'medical_leave_number',
      homeCareRecommendation: 'home_care_recommendation',
      medicalDevicesPrescription: 'medical_devices_prescription',
      transmissionMode: 'transmission_mode',
      documentS3Key: 'document_s3_key',
      documentUrl: 'document_url',
      mediaItemId: 'media_item_id',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        fields.push(`${col} = $${i++}`)
        values.push((data as Record<string, unknown>)[key] ?? null)
      }
    }

    if (fields.length === 0) {
      const existing = await this.findById(id)
      if (!existing) return { status: 'not_found' }
      return { status: 'updated', letter: existing }
    }

    fields.push(`version = version + 1`)

    const clientVersion = (data as Record<string, unknown>).version
    let versionCheck = ''
    if (clientVersion !== undefined) {
      values.push(clientVersion)
      versionCheck = `AND version = $${i++}`
    }

    values.push(id)
    const result = await db.query(
      `UPDATE medical_letters
       SET ${fields.join(', ')}
       WHERE id = $${i}
         AND deleted_at IS NULL
         ${versionCheck}
       RETURNING *`,
      values
    )

    if (!result.rows[0]) {
      if (clientVersion !== undefined) return { status: 'conflict' }
      return { status: 'not_found' }
    }
    return { status: 'updated', letter: rowToMedicalLetter(result.rows[0]) }
  },

  async validate(id: string, data: ValidateMedicalLetterInput): Promise<MedicalLetterUpdateResult> {
    const clientVersion = data.version
    let versionCheck = ''
    const values: unknown[] = [data.validatedByUserId, id]
    let i = 3

    if (clientVersion !== undefined) {
      values.push(clientVersion)
      versionCheck = `AND version = $${i++}`
    }

    const result = await db.query(
      `UPDATE medical_letters
       SET validated = TRUE,
           validated_by_user_id = $1,
           validated_at = NOW(),
           version = version + 1
       WHERE id = $2
         AND deleted_at IS NULL
         ${versionCheck}
       RETURNING *`,
      values
    )

    if (!result.rows[0]) {
      if (clientVersion !== undefined) return { status: 'conflict' }
      return { status: 'not_found' }
    }
    return { status: 'updated', letter: rowToMedicalLetter(result.rows[0]) }
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query(
      `UPDATE medical_letters SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    )
    return (result.rowCount ?? 0) > 0
  },
}
