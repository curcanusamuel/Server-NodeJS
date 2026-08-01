export interface Estimate {
  id: string
  appointmentId: string | null
  patientId: string
  patientName: string
  patientNid: string
  doctorId: string
  doctorName: string
  moduleId: string
  moduleName: string
  categoryId: string
  categoryName: string
  serviceId: string
  serviceName: string
  priceId: string | null
  price: number
  paymentSource: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  version: number
  deletedAt: string | null
}

export type CreateEstimateDTO = Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deletedAt'>
export type UpdateEstimateDTO = Partial<CreateEstimateDTO>
