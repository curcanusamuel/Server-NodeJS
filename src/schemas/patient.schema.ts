import { z } from 'zod'

export const createPatientSchema = z.object({
  nume: z.string().min(1, 'Numele este obligatoriu'),
  prenume: z.string().min(1, 'Prenumele este obligatoriu'),
  nr: z.string().default(''),
  cod: z.string().default(''),
  varsta: z.number().int().min(0).max(150),
  sex: z.enum(['Masculin', 'Feminin', 'Altul']),
  tipActului: z.enum(['B.I', 'C.I', 'Pasaport', 'Sedere']),
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
})

export const updatePatientSchema = createPatientSchema.partial()

export type CreatePatientInput = z.infer<typeof createPatientSchema>
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>
