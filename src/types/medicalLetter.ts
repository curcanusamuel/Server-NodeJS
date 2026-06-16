export interface MedicalLetter {
  id: string
  patientId: string
  patientName: string
  patientNid: string
  doctorId: string
  doctorName: string
  letterDate: string
  birthDate: string | null
  patientAge: number | null
  consultType: string | null
  consultationReason: string | null
  medicalHistory: string | null
  firstHistoCito: string | null
  firstHistoCitoDate: string | null
  diagnosis: string | null
  staging: string | null
  stagingT: string | null
  stagingN: string | null
  stagingM: string | null
  stage: string | null
  icdCode: string | null
  icdLocalization: string | null
  ecog: number | null
  examFieldsJson: Record<string, unknown> | null
  objectiveExamNotes: string | null
  clinicalImagingBiochemistry: string | null
  painIntensity: number | null
  painLocalization: string | null
  analgesicMedication: string | null
  analgesicAdverseEffects: string | null
  dyspneaIntensity: number | null
  dyspneaTreatment: string | null
  interactionsChecked: boolean | null
  treatmentGoal: string | null
  therapeuticConduct: string | null
  treatmentPlan: string | null
  adverseReactionsJson: Record<string, unknown> | null
  adverseReactionsNotes: string | null
  nextAppointmentDate: string | null
  periodicControlInterval: string | null
  periodicControlNotes: string | null
  lifestyleRecommendations: string | null
  otherRecommendedInvestigations: string | null
  geneticCounseling: string | null
  otherRecommendations: string | null
  icdIndication: string | null
  returnAdmission: boolean | null
  returnAdmissionDays: number | null
  prescriptionStatus: boolean | null
  prescriptionSeries: string | null
  prescriptionNumber: string | null
  medicalLeaveStatus: boolean | null
  medicalLeaveSeries: string | null
  medicalLeaveNumber: string | null
  homeCareRecommendation: string | null
  medicalDevicesPrescription: string | null
  transmissionMode: string | null
  validated: boolean
  validatedByUserId: string | null
  validatedAt: Date | null
  documentS3Key: string | null
  documentUrl: string | null
  mediaItemId: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  deletedAt: string | null
  version: number
}
