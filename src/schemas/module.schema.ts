import { z } from 'zod'

export const createModuleSchema = z.object({
  numeModul: z.string().min(1).max(100),
  createdAccount: z.string().min(1).max(100),
})

export const updateModuleSchema = z.object({
  numeModul: z.string().min(1).max(100).optional(),
  isDisabled: z.boolean().optional(),
  modificationAccount: z.string().min(1).max(100),
})

export type CreateModuleInput = z.infer<typeof createModuleSchema>
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>