import { db } from '../db/pool'
import { Patient } from '../types/patient'
import { CreatePatientInput, UpdatePatientInput } from '../schemas/patient.schema'

interface PatientNavigationResult {
  patient: Patient | null
  previousId: string | null
  nextId: string | null
  totalCount: number
}

export type PatientUpdateResult =
  | { status: 'updated'; patient: Patient }
  | { status: 'not_found' }
  | { status: 'verified' }

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
    telefon: (row.telefon as string | null) ?? null,
    mobil: (row.mobil as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    domiciliuTara: (row.domiciliu_tara as string | null) ?? null,
    domiciliuJudet: (row.domiciliu_judet as string | null) ?? null,
    domiciliuLocalitate: (row.domiciliu_localitate as string | null) ?? null,
    domiciliuAdresa: (row.domiciliu_adresa as string | null) ?? null,
    domiciliuNumar: (row.domiciliu_numar as string | null) ?? null,
    domiciliuBloc: (row.domiciliu_bloc as string | null) ?? null,
    domiciliuScara: (row.domiciliu_scara as string | null) ?? null,
    domiciliuEtaj: (row.domiciliu_etaj as string | null) ?? null,
    domiciliuApartament: (row.domiciliu_apartament as string | null) ?? null,
    resedintaTara: (row.resedinta_tara as string | null) ?? null,
    resedintaJudet: (row.resedinta_judet as string | null) ?? null,
    resedintaLocalitate: (row.resedinta_localitate as string | null) ?? null,
    resedintaAdresa: (row.resedinta_adresa as string | null) ?? null,
    resedintaNumar: (row.resedinta_numar as string | null) ?? null,
    resedintaBloc: (row.resedinta_bloc as string | null) ?? null,
    resedintaScara: (row.resedinta_scara as string | null) ?? null,
    resedintaEtaj: (row.resedinta_etaj as string | null) ?? null,
    resedintaApartament: (row.resedinta_apartament as string | null) ?? null,
    contactNume: (row.contact_nume as string | null) ?? null,
    contactPrenume: (row.contact_prenume as string | null) ?? null,
    contactTelefon: (row.contact_telefon as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    contactRelatie: (row.contact_relatie as string | null) ?? null,
    medicFamilieNume: (row.medic_familie_nume as string | null) ?? null,
    medicFamilieEmail: (row.medic_familie_email as string | null) ?? null,
    nivelNotificari: (row.nivel_notificari as string | null) ?? null,
    sursaInformare: (row.sursa_informare as string | null) ?? null,
    casStatusAsigurare: (row.cas_status_asigurare as string | null) ?? null,
    casDenumire: (row.cas_denumire as string | null) ?? null,
    casTipAsigurare: (row.cas_tip_asigurare as string | null) ?? null,
    casNrCardEuropean: (row.cas_nr_card_european as string | null) ?? null,
    casCardValabilPana: (row.cas_card_valabil_pana as Date | null) ?? null,
    casEminent: (row.cas_eminent as string | null) ?? null,
    casCodEminent: (row.cas_cod_eminent as string | null) ?? null,
    casCategorieAsigurat: (row.cas_categorie_asigurat as string | null) ?? null,
    isVerified: Boolean(row.is_verified),
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
        ultima_modificare_facuta_de, nr_pacienti_gasiti, pn_code,
        telefon, mobil, email,
        domiciliu_tara, domiciliu_judet, domiciliu_localitate, domiciliu_adresa, domiciliu_numar, domiciliu_bloc, domiciliu_scara, domiciliu_etaj, domiciliu_apartament,
        resedinta_tara, resedinta_judet, resedinta_localitate, resedinta_adresa, resedinta_numar, resedinta_bloc, resedinta_scara, resedinta_etaj, resedinta_apartament,
        contact_nume, contact_prenume, contact_telefon, contact_email, contact_relatie,
        medic_familie_nume, medic_familie_email,
        nivel_notificari, sursa_informare,
        cas_status_asigurare, cas_denumire, cas_tip_asigurare, cas_nr_card_european, cas_card_valabil_pana, cas_eminent, cas_cod_eminent, cas_categorie_asigurat
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,
        $19,$20,
        $21,$22,$23,
        $24,$25,$26,
        $27,$28,$29,
        $30,$31,$32,
        $33,$34,$35,
        $36,$37,$38,$39,$40,$41,$42,$43,$44,
        $45,$46,$47,$48,$49,$50,$51,$52,$53,
        $54,$55,$56,$57,$58,
        $59,$60,
        $61,$62,
        $63,$64,$65,$66,$67,$68,$69,$70
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
        data.telefon ?? null,
        data.mobil ?? null,
        data.email ?? null,
        data.domiciliuTara ?? null,
        data.domiciliuJudet ?? null,
        data.domiciliuLocalitate ?? null,
        data.domiciliuAdresa ?? null,
        data.domiciliuNumar ?? null,
        data.domiciliuBloc ?? null,
        data.domiciliuScara ?? null,
        data.domiciliuEtaj ?? null,
        data.domiciliuApartament ?? null,
        data.resedintaTara ?? null,
        data.resedintaJudet ?? null,
        data.resedintaLocalitate ?? null,
        data.resedintaAdresa ?? null,
        data.resedintaNumar ?? null,
        data.resedintaBloc ?? null,
        data.resedintaScara ?? null,
        data.resedintaEtaj ?? null,
        data.resedintaApartament ?? null,
        data.contactNume ?? null,
        data.contactPrenume ?? null,
        data.contactTelefon ?? null,
        data.contactEmail ?? null,
        data.contactRelatie ?? null,
        data.medicFamilieNume ?? null,
        data.medicFamilieEmail ?? null,
        data.nivelNotificari ?? null,
        data.sursaInformare ?? null,
        data.casStatusAsigurare ?? null,
        data.casDenumire ?? null,
        data.casTipAsigurare ?? null,
        data.casNrCardEuropean ?? null,
        data.casCardValabilPana ?? null,
        data.casEminent ?? null,
        data.casCodEminent ?? null,
        data.casCategorieAsigurat ?? null,
      ]
    )
    return rowToPatient(result.rows[0])
  },

  async update(id: string, data: UpdatePatientInput): Promise<PatientUpdateResult> {
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
      telefon: 'telefon', mobil: 'mobil', email: 'email',
      domiciliuTara: 'domiciliu_tara', domiciliuJudet: 'domiciliu_judet', domiciliuLocalitate: 'domiciliu_localitate',
      domiciliuAdresa: 'domiciliu_adresa', domiciliuNumar: 'domiciliu_numar', domiciliuBloc: 'domiciliu_bloc',
      domiciliuScara: 'domiciliu_scara', domiciliuEtaj: 'domiciliu_etaj', domiciliuApartament: 'domiciliu_apartament',
      resedintaTara: 'resedinta_tara', resedintaJudet: 'resedinta_judet', resedintaLocalitate: 'resedinta_localitate',
      resedintaAdresa: 'resedinta_adresa', resedintaNumar: 'resedinta_numar', resedintaBloc: 'resedinta_bloc',
      resedintaScara: 'resedinta_scara', resedintaEtaj: 'resedinta_etaj', resedintaApartament: 'resedinta_apartament',
      contactNume: 'contact_nume', contactPrenume: 'contact_prenume', contactTelefon: 'contact_telefon',
      contactEmail: 'contact_email', contactRelatie: 'contact_relatie',
      medicFamilieNume: 'medic_familie_nume', medicFamilieEmail: 'medic_familie_email',
      nivelNotificari: 'nivel_notificari', sursaInformare: 'sursa_informare',
      casStatusAsigurare: 'cas_status_asigurare', casDenumire: 'cas_denumire', casTipAsigurare: 'cas_tip_asigurare',
      casNrCardEuropean: 'cas_nr_card_european', casCardValabilPana: 'cas_card_valabil_pana',
      casEminent: 'cas_eminent', casCodEminent: 'cas_cod_eminent', casCategorieAsigurat: 'cas_categorie_asigurat',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data) {
        fields.push(`${col} = $${i++}`)
        values.push((data as Record<string, unknown>)[key])
      }
    }

    if (fields.length === 0) {
      const existingPatient = await this.findById(id)
      if (!existingPatient) return { status: 'not_found' }
      if (existingPatient.isVerified) return { status: 'verified' }
      return { status: 'updated', patient: existingPatient }
    }

    values.push(id)
    const result = await db.query(
      `UPDATE patients
       SET ${fields.join(', ')}
       WHERE id = $${i} AND is_verified = false
       RETURNING *`,
      values
    )
    if (result.rows[0]) {
      return { status: 'updated', patient: rowToPatient(result.rows[0]) }
    }

    const statusResult = await db.query(
      'SELECT is_verified FROM patients WHERE id = $1',
      [id]
    )
    if (!statusResult.rows[0]) {
      return { status: 'not_found' }
    }

    return statusResult.rows[0].is_verified
      ? { status: 'verified' }
      : { status: 'not_found' }
  },

  async updateVerification(id: string, isVerified: boolean): Promise<Patient | null> {
    const result = await db.query(
      'UPDATE patients SET is_verified = $1 WHERE id = $2 RETURNING *',
      [isVerified, id]
    )
    return result.rows[0] ? rowToPatient(result.rows[0]) : null
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query('DELETE FROM patients WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  },
}
