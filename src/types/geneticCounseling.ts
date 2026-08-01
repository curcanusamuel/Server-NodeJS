export type ConsultationLocation = 'fizic' | 'online'

export interface GeneticCounseling {
  id: string
  patientId: string
  patientName: string
  patientNid: string
  doctorId: string
  doctorName: string
  geneticCounselingDate: Date
  consultationLocation: ConsultationLocation | null
  referredBy: string | null
  referralReason: string | null
  personalHistory: string | null
  familyHistory: string | null
  cancerAndGeneticsEducation: string | null
  hereditaryCancerRiskAssessment: string | null
  geneticTestingImplications: string | null
  familialRisk: string | null
  psychosocialRecommendations: string | null
  geneticTestingResult: string | null
  otherObservations: string | null
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

export type CreateGeneticCounselingDTO = Omit<GeneticCounseling, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deletedAt'>
export type UpdateGeneticCounselingDTO = Partial<CreateGeneticCounselingDTO>
