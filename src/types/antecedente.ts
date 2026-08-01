export type YesNoNa = 'yes' | 'no' | 'na'
export type YesNoPast = 'yes' | 'no' | 'past'
export type HormonalStatus = 'premenopauza' | 'perimenopauza' | 'postmenopauza'
export type EkgStatus = 'normal' | 'patologic'

export interface Antecedente {
  id: string
  patientId: string
  patientName: string
  patientNid: string
  doctorId: string
  doctorName: string
  antecedenteDate: Date
  heredocolaterale: string | null
  pregnancies: number | null
  births: number | null
  abortions: number | null
  breastfeeding: YesNoNa | null
  hormonalStatus: HormonalStatus | null
  menopauseDate: Date | null
  physiologicalReason: string | null
  pregnancyTest: YesNoNa | null
  pregnancyTestDate: Date | null
  contraception: YesNoNa | null
  contraceptionNotes: string | null
  pathologicalHistory: string | null
  medicationConsumption: string | null
  infertilityRiskInfo: YesNoNa | null
  smoker: YesNoPast | null
  smokingType: number | null
  averagePerDay: number | null
  yearsSmoked: number | null
  smokedRegularly: YesNoPast | null
  smokingStopDate: Date | null
  chronicEthanolConsumer: YesNoPast | null
  evolutionDate: Date | null
  visitType: string | null
  consultType: string | null
  rte: YesNoNa | null
  ecog: number | null
  normalFieldValues: Record<string, string> | null
  objectiveExamText: string | null
  clinicalProgressSigns: string | null
  clinicalProgression: YesNoNa | null
  adverseEventsSinceLastVisit: string | null
  adverseEvents: YesNoNa | null
  hypersensitivityReactions: string | null
  hypersensitivity: YesNoNa | null
  ekgStatus: EkgStatus | null
  ekgDetails: string | null
  emotionalStatus: number | null
  emotionalStatusOther: string | null
  painEvaluation: YesNoNa | null
  painIntensity: number | null
  painLocalization: string | null
  analgesicMedication: string | null
  analgesicMedicationUsed: YesNoNa | null
  analgesicAdverseEffects: string | null
  constipation: YesNoNa | null
  medicationChange: string | null
  medicationChanged: YesNoNa | null
  interactionsDiscussed: YesNoNa | null
  dyspnea: YesNoNa | null
  dyspneaIntensity: number | null
  dyspneaTreatment: string | null
  dignicap: YesNoNa | null
  alopecia: YesNoNa | null
  followedOralChemo: YesNoNa | null
  missedDose: YesNoNa | null
  oralChemoNotes: string | null
  comments: string | null
  isValidated: boolean
  documentDate: Date | null
  documentName: string | null
  documentUrl: string | null
  documentS3Key: string | null
  mediaItemId: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  version: number
  deletedAt: string | null
}

export type CreateAntecedenteDTO = Omit<Antecedente, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deletedAt'>
export type UpdateAntecedenteDTO = Partial<CreateAntecedenteDTO>
