import { z } from 'zod'

export const createServiciuSchema = z.object({
  zkIdmoduleF: z.string().uuid(),
  zkIdsubcategorieF: z.string().uuid(),
  codProcedura: z.string().max(50).nullable().optional(),
  nume: z.string().min(1).max(200),
  pretBaza: z.number().positive(),
  perioada: z.string().max(50).nullable().optional(),
  sursaPlata: z.string().max(100).nullable().optional(),
  firma: z.string().max(200).nullable().optional(),
  isCas: z.boolean().optional(),
  createdAccount: z.string().min(1).max(100),
})

export const updateServiciuSchema = z.object({
  zkIdmoduleF: z.string().uuid().optional(),
  zkIdsubcategorieF: z.string().uuid().optional(),
  codProcedura: z.string().max(50).nullable().optional(),
  nume: z.string().min(1).max(200).optional(),
  pretBaza: z.number().positive().optional(),
  perioada: z.string().max(50).nullable().optional(),
  sursaPlata: z.string().max(100).nullable().optional(),
  firma: z.string().max(200).nullable().optional(),
  isCas: z.boolean().optional(),
  isDisabled: z.boolean().optional(),
  modificationAccount: z.string().min(1).max(100),
  version: z.number().int().positive().optional(),
})

export const serviciuListQuerySchema = z.object({
  moduleId: z.string().uuid().optional(),
  isCas: z.enum(['true', 'false']).optional(),
  includeDisabled: z.enum(['true', 'false']).optional(),
  q: z.string().optional(),
})

export type CreateServiciuInput = z.infer<typeof createServiciuSchema>
export type UpdateServiciuInput = z.infer<typeof updateServiciuSchema>
export type ServiciuListQuery = z.infer<typeof serviciuListQuerySchema>
