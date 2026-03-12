export interface Patient {
  id: string                    // UUID primary key
  nume: string
  prenume: string
  nr: string
  cod: string
  varsta: number
  sex: string
  tipActului: string
  codCNP: string                // unique natural key
  buletinSerie: string
  buletinNr: string
  eliberatDe: string
  valabilPana: Date
  dataNasterii: Date
  cetatenie: string
  cetatenie2: string
  ocupatie: string
  educatie: string
  locMunca: string
  medicInitial: string
  medicCurant: string
 // medicCurantId?: string        // UUID foreign key → doctors table
  dataPrezentare: Date
  varstaPrezentare: number
  pacientOncologic: boolean
  localizareICD: string
  localizareDesc: string
  observatii: string
  dataInregistrare?: Date
  cauzeDeces?: string
  autorFisa: string
  dataIntroducerii: Date
  dataUltimeiModificari: Date
  ultimaModificareFacutaDe: string
  nrPacientiGasiti: number
  pnCode: string
}

export type CreatePatientDTO = Omit<Patient, 'id' | 'dataIntroducerii' | 'dataUltimeiModificari'>
export type UpdatePatientDTO = Partial<Omit<Patient, 'id' | 'dataIntroducerii' | 'dataUltimeiModificari'>>
