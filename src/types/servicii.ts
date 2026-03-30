export interface Serviciu {
  id: string
  zkIdmoduleF: string
  zkIdsubcategorieF: string
  codProcedura: string | null
  nume: string
  pretBaza: number
  perioada: string | null
  sursaPlata: string | null
  firma: string | null
  isCas: boolean
  isDisabled: boolean
  createdAccount: string
  createdTimestamp: Date
  modificationAccount: string | null
  modificationTimestamp: Date | null
  version: number
  deletedAt: string | null
}
