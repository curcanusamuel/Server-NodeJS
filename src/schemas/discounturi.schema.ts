import { z } from 'zod'

const discountTypeEnum = z.enum(['promotie', 'doctor', 'baza'])

export const createDiscountSchema = z.object({
  zkPretIdF: z.string().uuid(),
  zkDoctorIdF: z.string().uuid().nullable().optional(),
  numelePretului: z.string().min(1).max(200),
  pret: z.number().positive(),
  startDate: z.string().date(),
  endDate: z.string().date().nullable().optional(),
  type: discountTypeEnum,
  createdAccount: z.string().min(1).max(100),
}).refine(
  (data) => data.type === 'doctor' ? data.zkDoctorIdF != null : data.zkDoctorIdF == null,
  {
    message: 'zkDoctorIdF is required for type "doctor" and must be null for other types',
    path: ['zkDoctorIdF'],
  }
).refine(
  (data) => !data.endDate || data.endDate >= data.startDate,
  {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  }
)

export const updateDiscountSchema = z.object({
  zkDoctorIdF: z.string().uuid().nullable().optional(),
  numelePretului: z.string().min(1).max(200).optional(),
  pret: z.number().positive().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().nullable().optional(),
  type: discountTypeEnum.optional(),
  isDisabled: z.boolean().optional(),
  modificationAccount: z.string().min(1).max(100),
  version: z.number().int().positive().optional(),
}).refine(
  (data) => data.type === undefined || data.type === 'doctor' ? true : data.zkDoctorIdF == null || data.zkDoctorIdF === undefined,
  {
    message: 'zkDoctorIdF must be null for non-doctor types',
    path: ['zkDoctorIdF'],
  }
).refine(
  (data) => data.type !== 'doctor' || data.zkDoctorIdF != null,
  {
    message: 'zkDoctorIdF is required for type "doctor"',
    path: ['zkDoctorIdF'],
  }
)

export const discountListQuerySchema = z.object({
  servicuId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  type: discountTypeEnum.optional(),
  activeOn: z.string().date().optional(),
  includeDisabled: z.enum(['true', 'false']).optional(),
})

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>
export type DiscountListQuery = z.infer<typeof discountListQuerySchema>
