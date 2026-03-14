import { z } from 'zod'

const nullableString = z.string().nullable().optional()
const nullableEmail = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().email('Email invalid').nullable().optional()
)
const nullableDate = z.preprocess(
  (value) => (value === '' ? null : value),
  z.union([z.coerce.date(), z.null()]).optional()
)

export const createPatientSchema = z.object({
  nume: z.string().min(1, 'Numele este obligatoriu'),
  prenume: z.string().min(1, 'Prenumele este obligatoriu'),
  nr: z.string().default(''),
  cod: z.string().default(''),
  varsta: z.number().int().min(0).max(150),
  sex: z.enum(['Masculin', 'Feminin', 'Altul']),
  tipActului: z.enum(['BI', 'CI', 'Pasaport', 'Sedere']),
  codCNP: z.string().length(13, 'CNP trebuie să aibă 13 caractere'),
  buletinSerie: z.string().default(''),
  buletinNr: z.string().default(''),
  eliberatDe: z.string().default(''),
  valabilPana: z.coerce.date(),
  dataNasterii: z.coerce.date(),
  cetatenie: z.string().default('Romania'),
  cetatenie2: z.string().default(''),
  ocupatie: z.string().default(''),
  educatie: z.string().default(''),
  locMunca: z.string().default(''),
  medicInitial: z.string().default(''),
  medicCurant: z.string().default(''),
  //medicCurantId: z.string().uuid().optional(),
  dataPrezentare: z.coerce.date(),
  varstaPrezentare: z.number().int().min(0).max(150),
  pacientOncologic: z.boolean().default(false),
  localizareICD: z.string().default(''),
  localizareDesc: z.string().default(''),
  observatii: z.string().default(''),
  dataInregistrare: z.coerce.date().optional(),
  cauzeDeces: z.string().optional(),
  autorFisa: z.string().default(''),
  ultimaModificareFacutaDe: z.string().default(''),
  nrPacientiGasiti: z.number().int().min(0).default(0),
  pnCode: z.string().default(''),
  telefon: nullableString,
  mobil: nullableString,
  email: nullableEmail,
  domiciliuTara: nullableString,
  domiciliuJudet: nullableString,
  domiciliuLocalitate: nullableString,
  domiciliuAdresa: nullableString,
  domiciliuNumar: nullableString,
  domiciliuBloc: nullableString,
  domiciliuScara: nullableString,
  domiciliuEtaj: nullableString,
  domiciliuApartament: nullableString,
  resedintaTara: nullableString,
  resedintaJudet: nullableString,
  resedintaLocalitate: nullableString,
  resedintaAdresa: nullableString,
  resedintaNumar: nullableString,
  resedintaBloc: nullableString,
  resedintaScara: nullableString,
  resedintaEtaj: nullableString,
  resedintaApartament: nullableString,
  contactNume: nullableString,
  contactPrenume: nullableString,
  contactTelefon: nullableString,
  contactEmail: nullableEmail,
  contactRelatie: nullableString,
  medicFamilieNume: nullableString,
  medicFamilieEmail: nullableEmail,
  nivelNotificari: nullableString,
  sursaInformare: nullableString,
  casStatusAsigurare: nullableString,
  casDenumire: nullableString,
  casTipAsigurare: nullableString,
  casNrCardEuropean: nullableString,
  casCardValabilPana: nullableDate,
  casEminent: nullableString,
  casCodEminent: nullableString,
  casCategorieAsigurat: nullableString,
  isVerified: z.never().optional(),
})

export const updatePatientSchema = createPatientSchema.partial()
export const verificationSchema = z.object({
  isVerified: z.boolean(),
}).strict()

export type CreatePatientInput = z.infer<typeof createPatientSchema>
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>
export type VerificationInput = z.infer<typeof verificationSchema>
