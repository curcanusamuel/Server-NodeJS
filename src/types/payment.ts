export interface Payment {
  id: string
  operationId: string | null
  appointmentId: string | null
  estimateId: string | null
  patientId: string
  patientName: string
  patientNid: string
  serviceId: string | null
  serviceName: string
  priceId: string | null
  price: number | null
  amount: number
  paymentSource: string | null
  paymentMethod: 'card' | 'cash' | null
  receiptNumber: string | null
  receiptDate: Date | null
  paid: boolean
  paidAt: Date | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  version: number
  deletedAt: string | null
}

export type CreatePaymentDTO = Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deletedAt'>
export type UpdatePaymentDTO = Partial<CreatePaymentDTO>
