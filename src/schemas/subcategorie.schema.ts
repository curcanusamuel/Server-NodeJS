import { z } from 'zod'

export const createSubcategorieSchema = z.object({
  zkIdmoduleF: z.string().uuid(),
  numeSubcategorie: z.string().min(1).max(200),
  createdAccount: z.string().min(1).max(100),
})

export const updateSubcategorieSchema = z.object({
  zkIdmoduleF: z.string().uuid().optional(),
  numeSubcategorie: z.string().min(1).max(200).optional(),
  isDisabled: z.boolean().optional(),
  modificationAccount: z.string().min(1).max(100),
})

export const subcategorieListQuerySchema = z.object({
  moduleId: z.string().uuid().optional(),
  includeDisabled: z.enum(['true', 'false']).optional(),
  q: z.string().optional(),
})

export type CreateSubcategorieInput = z.infer<typeof createSubcategorieSchema>
export type UpdateSubcategorieInput = z.infer<typeof updateSubcategorieSchema>
export type SubcategorieListQuery = z.infer<typeof subcategorieListQuerySchema>