import { db } from '../db/pool'
import { Patient } from '../types/patient'
import { CreatePatientInput, UpdatePatientInput } from '../schemas/patient.schema'

interface PatientNavigationResult {
  patient: Patient | null
  previousId: string | null
  nextId: string | null
  totalCount: number
}

const ORDER_BY = 'ORDER BY data_introducerii ASC, id ASC'

function buildSearchFilter(query?: string, startIndex = 1): { whereClause: string; values: unknown[] } {
  const trimmed = query?.trim()
  if (!trimmed) {
    return { whereClause: '', values: [] }
  }

  const placeholder = `$${startIndex}`
  return {
    whereClause: `WHERE nume ILIKE ${placeholder} OR prenume ILIKE ${placeholder} OR cod_cnp ILIKE ${placeholder} OR cod ILIKE ${placeholder}`,
    values: [`%${trimmed}%`],
  }
}

// Map snake_case DB row -> camelCase Patient
function rowToPatient(row: Record<string, unknown>): Patient {
  return {
    id: row.id as string,
    nume: row.nume as string,
    prenume: row.prenume as string,
    nr: row.nr as string,
    cod: row.cod as string,
    varsta: row.varsta as number,
    sex: row.sex as string,
    tipActului: row.tip_actului as string,
    codCNP: row.cod_cnp as string,
    buletinSerie: row.buletin_serie as string,
    buletinNr: row.buletin_nr as string,
    eliberatDe: row.eliberat_de as string,
    valabilPana: row.valabil_pana as Date,
    dataNasterii: row.data_nasterii as Date,
    cetatenie: row.cetatenie as string,
    cetatenie2: row.cetatenie2 as string,
    ocupatie: row.ocupatie as string,
    educatie: row.educatie as string,
    locMunca: row.loc_munca as string,
    medicInitial: row.medic_initial as string,
    medicCurant: row.medic_curant as string,
    // medicCurantId: row.medic_curant_id as string | undefined, // TODO: add back when doctors table exists
    dataPrezentare: row.data_prezentare as Date,
    varstaPrezentare: row.varsta_prezentare as number,
    pacientOncologic: row.pacient_oncologic as boolean,
    localizareICD: row.localizare_icd as string,
    localizareDesc: row.localizare_desc as string,
    observatii: row.observatii as string,
    dataInregistrare: row.data_inregistrare as Date | undefined,
    cauzeDeces: row.cauze_deces as string | undefined,
    autorFisa: row.autor_fisa as string,
    dataIntroducerii: row.data_introducerii as Date,
    dataUltimeiModificari: row.data_ultimei_modificari as Date,
    ultimaModificareFacutaDe: row.ultima_modificare_facuta_de as string,
    nrPacientiGasiti: row.nr_pacienti_gasiti as number,
    pnCode: row.pn_code as string,
  }
}

function rowToNavigation(row: Record<string, unknown>): PatientNavigationResult {
  return {
    patient: rowToPatient(row),
    previousId: (row.previous_id as string | null) ?? null,
    nextId: (row.next_id as string | null) ?? null,
    totalCount: Number(row.total_count ?? 0),
  }
}

export const patientRepository = {
  async findAll(): Promise<Patient[]> {
    const result = await db.query(`SELECT * FROM patients ${ORDER_BY}`)
    return result.rows.map(rowToPatient)
  },

  async findById(id: string): Promise<Patient | null> {
    const result = await db.query('SELECT * FROM patients WHERE id = $1', [id])
    return result.rows[0] ? rowToPatient(result.rows[0]) : null
  },

  async findByCNP(codCNP: string): Promise<Patient | null> {
    const result = await db.query('SELECT * FROM patients WHERE cod_cnp = $1', [codCNP])
    return result.rows[0] ? rowToPatient(result.rows[0]) : null
  },

  async search(query: string): Promise<Patient[]> {
    const { whereClause, values } = buildSearchFilter(query)
    if (!whereClause) {
      return this.findAll()
    }

    const result = await db.query(`SELECT * FROM patients ${whereClause} ${ORDER_BY}`, values)
    return result.rows.map(rowToPatient)
  },

  async findFirstNavigation(query?: string): Promise<PatientNavigationResult> {
    const { whereClause, values } = buildSearchFilter(query)
    const result = await db.query(
      `WITH filtered AS (
         SELECT * FROM patients
         ${whereClause}
       ),
       ordered AS (
         SELECT
           *,
           lag(id) OVER (${ORDER_BY}) AS previous_id,
           lead(id) OVER (${ORDER_BY}) AS next_id,
           COUNT(*) OVER ()::int AS total_count
         FROM filtered
       )
       SELECT *
       FROM ordered
       ${ORDER_BY}
       LIMIT 1`,
      values
    )

    if (!result.rows[0]) {
      return {
        patient: null,
        previousId: null,
        nextId: null,
        totalCount: 0,
      }
    }

    return rowToNavigation(result.rows[0])
  },

  async findNavigationById(id: string, query?: string): Promise<PatientNavigationResult | null> {
    const { whereClause, values } = buildSearchFilter(query)
    const idIndex = values.length + 1

    const result = await db.query(
      `WITH filtered AS (
         SELECT * FROM patients
         ${whereClause}
       ),
       ordered AS (
         SELECT
           *,
           lag(id) OVER (${ORDER_BY}) AS previous_id,
           lead(id) OVER (${ORDER_BY}) AS next_id,
           COUNT(*) OVER ()::int AS total_count
         FROM filtered
       )
       SELECT *
       FROM ordered
       WHERE id = $${idIndex}
       LIMIT 1`,
      [...values, id]
    )

    return result.rows[0] ? rowToNavigation(result.rows[0]) : null
  },

  async create(data: CreatePatientInput): Promise<Patient> {
    const result = await db.query(
      `INSERT INTO patients (
        nume, prenume, nr, cod, varsta, sex, tip_actului, cod_cnp,
        buletin_serie, buletin_nr, eliberat_de, valabil_pana, data_nasterii,
        cetatenie, cetatenie2, ocupatie, educatie, loc_munca,
        medic_initial, medic_curant,
        data_prezentare, varsta_prezentare, pacient_oncologic,
        localizare_icd, localizare_desc, observatii,
        data_inregistrare, cauze_deces, autor_fisa,
        ultima_modificare_facuta_de, nr_pacienti_gasiti, pn_code
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,
        $19,$20,
        $21,$22,$23,
        $24,$25,$26,
        $27,$28,$29,
        $30,$31,$32
      ) RETURNING *`,
      [
        data.nume,
        data.prenume,
        data.nr,
        data.cod,
        data.varsta,
        data.sex,
        data.tipActului,
        data.codCNP,
        data.buletinSerie,
        data.buletinNr,
        data.eliberatDe,
        data.valabilPana,
        data.dataNasterii,
        data.cetatenie,
        data.cetatenie2,
        data.ocupatie,
        data.educatie,
        data.locMunca,
        data.medicInitial,
        data.medicCurant,
        // data.medicCurantId ?? null, // TODO: add back when doctors table exists
        data.dataPrezentare,
        data.varstaPrezentare,
        data.pacientOncologic,
        data.localizareICD,
        data.localizareDesc,
        data.observatii,
        data.dataInregistrare ?? null,
        data.cauzeDeces ?? null,
        data.autorFisa,
        data.ultimaModificareFacutaDe,
        data.nrPacientiGasiti,
        data.pnCode,
      ]
    )
    return rowToPatient(result.rows[0])
  },

  async update(id: string, data: UpdatePatientInput): Promise<Patient | null> {
    const fields: string[] = []
    const values: unknown[] = []
    let i = 1

    const fieldMap: Record<string, string> = {
      nume: 'nume', prenume: 'prenume', nr: 'nr', cod: 'cod',
      varsta: 'varsta', sex: 'sex', tipActului: 'tip_actului', codCNP: 'cod_cnp',
      buletinSerie: 'buletin_serie', buletinNr: 'buletin_nr', eliberatDe: 'eliberat_de',
      valabilPana: 'valabil_pana', dataNasterii: 'data_nasterii',
      cetatenie: 'cetatenie', cetatenie2: 'cetatenie2',
      ocupatie: 'ocupatie', educatie: 'educatie', locMunca: 'loc_munca',
      medicInitial: 'medic_initial', medicCurant: 'medic_curant',
      // medicCurantId: 'medic_curant_id', // TODO: add back when doctors table exists
      dataPrezentare: 'data_prezentare', varstaPrezentare: 'varsta_prezentare',
      pacientOncologic: 'pacient_oncologic', localizareICD: 'localizare_icd',
      localizareDesc: 'localizare_desc', observatii: 'observatii',
      dataInregistrare: 'data_inregistrare', cauzeDeces: 'cauze_deces',
      autorFisa: 'autor_fisa', ultimaModificareFacutaDe: 'ultima_modificare_facuta_de',
      nrPacientiGasiti: 'nr_pacienti_gasiti', pnCode: 'pn_code',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data) {
        fields.push(`${col} = $${i++}`)
        values.push((data as Record<string, unknown>)[key])
      }
    }

    if (fields.length === 0) return this.findById(id)

    values.push(id)
    const result = await db.query(
      `UPDATE patients SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    )
    return result.rows[0] ? rowToPatient(result.rows[0]) : null
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query('DELETE FROM patients WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  },
}
