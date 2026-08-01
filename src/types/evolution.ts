import { YesNoNa, EkgStatus } from './antecedente'

export interface Evolution {
  id: string
  patientId: string
  patientName: string
  patientNid: string
  doctorId: string
  doctorName: string
  evolutionDate: Date
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

export type CreateEvolutionDTO = Omit<Evolution, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deletedAt'>
export type UpdateEvolutionDTO = Partial<CreateEvolutionDTO>
