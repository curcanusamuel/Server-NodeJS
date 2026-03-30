export type DiscountType = 'promotie' | 'doctor' | 'baza'

export interface Discount {
  id: string
  zkPretIdF: string
  zkDoctorIdF: string | null
  numelePretului: string
  pret: number
  startDate: string
  endDate: string | null
  type: DiscountType
  isDisabled: boolean
  createdAccount: string
  createdTimestamp: Date
  modificationAccount: string | null
  modificationTimestamp: Date | null
  version: number
  deletedAt: string | null
}