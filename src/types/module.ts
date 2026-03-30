export interface Module {
  id: string
  numeModul: string
  isDisabled: boolean
  createdAccount: string
  createdTimestamp: Date
  modificationAccount: string | null
  modificationTimestamp: Date | null
  version: number
  deletedAt: string | null
}