export interface Patient {
  id: string                    // UUID primary key
  nume: string
  prenume: string
  nr: string
  nid: string
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
  cauzeDeces?: string | null
  autorFisa: string
  dataIntroducerii: Date
  dataUltimeiModificari: Date
  ultimaModificareFacutaDe: string
  nrPacientiGasiti: number
  telefon: string | null
  mobil: string | null
  email: string | null
  domiciliuTara: string | null
  domiciliuJudet: string | null
  domiciliuLocalitate: string | null
  domiciliuAdresa: string | null
  domiciliuNumar: string | null
  domiciliuBloc: string | null
  domiciliuScara: string | null
  domiciliuEtaj: string | null
  domiciliuApartament: string | null
  resedintaTara: string | null
  resedintaJudet: string | null
  resedintaLocalitate: string | null
  resedintaAdresa: string | null
  resedintaNumar: string | null
  resedintaBloc: string | null
  resedintaScara: string | null
  resedintaEtaj: string | null
  resedintaApartament: string | null
  contactNume: string | null
  contactPrenume: string | null
  contactTelefon: string | null
  contactEmail: string | null
  contactRelatie: string | null
  medicFamilieNume: string | null
  medicFamilieEmail: string | null
  nivelNotificari: string | null
  sursaInformare: string | null
  casStatusAsigurare: string | null
  casDenumire: string | null
  casTipAsigurare: string | null
  casNrCardEuropean: string | null
  casCardValabilPana: Date | null
  casEminent: string | null
  casCodEminent: string | null
  casCategorieAsigurat: string | null
  contactRefuzat: boolean
  isVerified: boolean
}

export type CreatePatientDTO = Omit<Patient, 'id' | 'dataIntroducerii' | 'dataUltimeiModificari' | 'isVerified'>
export type UpdatePatientDTO = Partial<Omit<Patient, 'id' | 'dataIntroducerii' | 'dataUltimeiModificari' | 'isVerified'>>
