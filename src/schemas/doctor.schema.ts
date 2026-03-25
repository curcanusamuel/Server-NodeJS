import { z } from 'zod'

export const createDoctorSchema = z.object({
  numeDoctor: z.string().min(1).max(200),
  userId: z.string().uuid().nullable().optional(),
  createdAccount: z.string().min(1).max(100),
})

export const updateDoctorSchema = z.object({
  numeDoctor: z.string().min(1).max(200).optional(),
  userId: z.string().uuid().nullable().optional(),
  isDisabled: z.boolean().optional(),
  modificationAccount: z.string().min(1).max(100),
})

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>