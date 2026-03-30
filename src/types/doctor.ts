export interface Doctor {
  id: string
  userId: string | null
  numeDoctor: string
  isDisabled: boolean
  createdAccount: string
  createdTimestamp: Date
  modificationAccount: string | null
  modificationTimestamp: Date | null
  version: number
  deletedAt: string | null
}