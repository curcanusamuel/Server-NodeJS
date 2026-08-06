export interface Operation {
  id: string
  priceId: string | null
  patientId: string
  patientName: string
  patientNid: string
  patientCnp: string
  patientBirthDate: Date | null
  patientFamilyDoctor: string
  doctorId: string
  doctorName: string
  companyId: string | null
  companyName: string
  operationDate: Date
  moduleName: string
  categoryName: string
  interventionName: string
  paymentSource: string | null
  price: number
  paid: boolean
  paymentMethod: 'card' | 'cash' | null
  receiptNumber: string | null
  receiptDate: Date | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  version: number
  deletedAt: string | null
}

export type CreateOperationDTO = Omit<Operation, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deletedAt'>
export type UpdateOperationDTO = Partial<CreateOperationDTO>
