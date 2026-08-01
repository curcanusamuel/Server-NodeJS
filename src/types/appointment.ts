export type AppointmentStatus = 'confirmed' | 'unconfirmed' | 'no_answer' | 'canceled'

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  patientNid: string
  patientPhone: string
  doctorId: string
  doctorName: string
  moduleId: string
  moduleName: string
  categoryId: string
  categoryName: string
  serviceId: string
  serviceName: string
  appointmentDate: Date
  startTime: string
  endTime: string | null
  durationMinutes: number | null
  status: AppointmentStatus
  notes: string | null
  createdByUserId: string
  createdByUserName: string
  createdAt: Date
  updatedAt: Date
  canceledAt: Date | null
  version: number
  deletedAt: string | null
}

export type CreateAppointmentDTO = Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'canceledAt' | 'version' | 'deletedAt'>
export type UpdateAppointmentDTO = Partial<CreateAppointmentDTO>
