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

export type SortCursor =
  | { sortKey: 'name'; nume: string; prenume: string; id: string }
  | { sortKey: 'age'; varsta: number; id: string }
  | { sortKey: 'nid'; nid: string; id: string }
  | { sortKey: 'locality'; domiciliuLocalitate: string; id: string }
  | { sortKey: 'emailMobile'; email: string; id: string }
  | { sortKey: 'medicCurant'; medicCurant: string; id: string }
  | { sortKey: 'medicFamilie'; medicFamilieNume: string; id: string }
  | { sortKey: 'status'; isVerified: boolean; id: string }
  | { sortKey: 'createdFrom'; sursaInformare: string; id: string }
  | { sortKey: 'default'; dataIntroducerii: string; id: string }

export interface PatientListParams {
  q?: string
  cnp?: string
  nid?: string
  localitate?: string
  email?: string
  medicCurant?: string
  medicFamilie?: string
  dateStart?: string
  dateEnd?: string
  createdFromAppointmentOnly?: boolean
  sortKey?: 'name' | 'age' | 'nid' | 'locality' | 'emailMobile' | 'medicCurant' | 'medicFamilie' | 'status' | 'createdFrom'
  sortDirection?: 'asc' | 'desc'
  includeTotal?: boolean
  cursor?: SortCursor
  limit?: number
}

export interface PaginatedPatientsResult {
  items: Patient[]
  total: number | null
  limit: number
  hasMore: boolean
  nextCursor: SortCursor | null
}

export interface PatientsCountResult {
  total: number
}

const ORDER_BY = 'ORDER BY data_introducerii ASC, id ASC'
const LIST_SELECT_COLUMNS = `
  id,
  nume,
  prenume,
  cod_cnp,
  varsta,
  nid,
  nr_pacienti_gasiti,
  domiciliu_localitate,
  email,
  mobil,
  medic_curant,
  medic_initial,
  medic_familie_nume,
  medic_familie_email,
  is_verified,
  sursa_informare
`

function logPatientsQuery(label: string, startTime: number, details: Record<string, unknown>): void {
  console.log(
    `[patients] ${label} completed in ${Date.now() - startTime}ms`,
    details
  )
}

function buildSearchFilter(query?: string, startIndex = 1): { whereClause: string; values: unknown[] } {
  const trimmed = query?.trim()
  if (!trimmed) {
    return { whereClause: '', values: [] }
  }

  const placeholder = `$${startIndex}`
  return {
    whereClause: `WHERE nume ILIKE ${placeholder} OR prenume ILIKE ${placeholder} OR cod_cnp ILIKE ${placeholder} OR nid ILIKE ${placeholder}`,
    values: [`%${trimmed}%`],
  }
}

function toContainsPattern(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? `%${trimmed}%` : null
}

function toPrefixPattern(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? `${trimmed}%` : null
}

function buildPatientListWhere(params: PatientListParams, startIndex = 1): { whereClause: string; values: unknown[] } {
  const conditions: string[] = []
  const values: unknown[] = []
  let parameterIndex = startIndex

  const pushCondition = (sql: string, value: unknown): void => {
    conditions.push(sql.split('__PARAM__').join(`$${parameterIndex}`))
    values.push(value)
    parameterIndex += 1
  }

  const trimmedNameQuery = params.q?.trim()
  if (trimmedNameQuery) {
    const tokens = trimmedNameQuery.split(/\s+/).filter(Boolean)

   
if (tokens.length === 1) {
  const qPattern = toPrefixPattern(tokens[0])
  if (qPattern) {
    const p1 = `$${parameterIndex}`
    const p2 = `$${parameterIndex + 1}`
    values.push(qPattern, qPattern)
    parameterIndex += 2
    conditions.push(`(nume ILIKE ${p1} OR prenume ILIKE ${p2})`)
  }
} else {
  const fullPattern = `%${tokens.join(' ')}%`
  const reversePattern = `%${[...tokens].reverse().join(' ')}%`
  const p1 = `$${parameterIndex}`
  const p2 = `$${parameterIndex + 1}`
  values.push(fullPattern, reversePattern)
  parameterIndex += 2
  conditions.push(
    `((coalesce(nume,'') || ' ' || coalesce(prenume,'')) ILIKE ${p1}
     OR (coalesce(prenume,'') || ' ' || coalesce(nume,'')) ILIKE ${p2})`
  )
}
  }

  const cnpPattern = toContainsPattern(params.cnp)
  if (cnpPattern) pushCondition('cod_cnp ILIKE __PARAM__', cnpPattern)

  const nidPattern = toContainsPattern(params.nid)
  if (nidPattern) pushCondition('nid ILIKE __PARAM__', nidPattern)

  const localityPattern = toContainsPattern(params.localitate)
  if (localityPattern) {
    pushCondition('(domiciliu_localitate ILIKE __PARAM__ OR resedinta_localitate ILIKE __PARAM__)', localityPattern)
  }

  const emailPattern = toContainsPattern(params.email)
  if (emailPattern) pushCondition('email ILIKE __PARAM__', emailPattern)

  const medicCurantPattern = toContainsPattern(params.medicCurant)
  if (medicCurantPattern) {
    pushCondition('(medic_curant ILIKE __PARAM__ OR medic_initial ILIKE __PARAM__)', medicCurantPattern)
  }

  const medicFamiliePattern = toContainsPattern(params.medicFamilie)
  if (medicFamiliePattern) pushCondition('medic_familie_nume ILIKE __PARAM__', medicFamiliePattern)

  if (params.dateStart) pushCondition('data_introducerii >= __PARAM__::date', params.dateStart)
  if (params.dateEnd) pushCondition("data_introducerii < (__PARAM__::date + INTERVAL '1 day')", params.dateEnd)

  if (params.createdFromAppointmentOnly) {
    conditions.push("(lower(coalesce(sursa_informare, '')) LIKE '%program%' OR lower(coalesce(sursa_informare, '')) LIKE '%appoint%')")
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  }
}

function buildOrderBy(sortKey?: PatientListParams['sortKey'], sortDirection: PatientListParams['sortDirection'] = 'asc'): string {
  const direction = sortDirection === 'desc' ? 'DESC' : 'ASC'

  switch (sortKey) {
    case 'name':
      return `ORDER BY nume ${direction}, prenume ${direction}, id ${direction}`
    case 'age':
      return `ORDER BY varsta ${direction}, nume ASC, prenume ASC, id ASC`
    case 'nid':
      return `ORDER BY nid ${direction}, nume ASC, prenume ASC, id ASC`
    case 'locality':
      return `ORDER BY domiciliu_localitate ${direction}, resedinta_localitate ${direction}, nume ASC, prenume ASC, id ASC`
    case 'emailMobile':
      return `ORDER BY email ${direction}, mobil ${direction}, nume ASC, prenume ASC, id ASC`
    case 'medicCurant':
      return `ORDER BY medic_curant ${direction}, medic_initial ${direction}, nume ASC, prenume ASC, id ASC`
    case 'medicFamilie':
      return `ORDER BY medic_familie_nume ${direction}, medic_familie_email ${direction}, nume ASC, prenume ASC, id ASC`
    case 'status':
      return `ORDER BY is_verified ${direction}, nume ASC, prenume ASC, id ASC`
    case 'createdFrom':
      return `ORDER BY sursa_informare ${direction}, nume ASC, prenume ASC, id ASC`
    default:
      return ORDER_BY
  }
}

// Map snake_case DB row -> camelCase Patient
function rowToPatient(row: Record<string, unknown>): Patient {
  return {
    id: row.id as string,
    nume: row.nume as string,
    prenume: row.prenume as string,
    nr: row.nr as string,
    nid: row.nid as string,
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

async list(params: PatientListParams = {}): Promise<PaginatedPatientsResult> {
  const t0 = Date.now()
  const { whereClause, values } = buildPatientListWhere(params)
  const t1 = Date.now()
  const sortKey = params.sortKey
  const direction = params.sortDirection === 'desc' ? 'DESC' : 'ASC'
  const orderBy = buildOrderBy(sortKey, params.sortDirection)
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100)
  const allValues = [...values]
  let cursorClause = ''

  const t2 = Date.now()

  if (params.cursor) {
    const c = params.cursor
    const op = direction === 'ASC' ? '>' : '<'
    const opNulls = direction === 'ASC' ? 'IS NOT NULL' : 'IS NULL'

    const addCursor = (clause: string, ...cursorValues: unknown[]) => {
      // Replace __P1__, __P2__ etc with sequential parameter indices.
      // Use replaceAll so placeholders that appear more than once (e.g. __P1__
      // used twice in an OR condition) all map to the same $N.
      let result = clause
      cursorValues.forEach((val, i) => {
        const idx = allValues.length + 1
        result = result.split(`__P${i + 1}__`).join(`$${idx}`)
        allValues.push(val)
      })
      cursorClause = result
    }

    switch (c.sortKey) {
      case 'default':
        addCursor(
          `AND (data_introducerii, id) ${op} (__P1__::timestamptz, __P2__::uuid)`,
          c.dataIntroducerii, c.id
        )
        break

      case 'name':
        addCursor(
          `AND (nume, prenume, id) ${op} (__P1__, __P2__, __P3__::uuid)`,
          c.nume, c.prenume, c.id
        )
        break

      case 'age':
        // age tiebreaker is always ASC regardless of direction
        addCursor(
          `AND (varsta, id) ${op} (__P1__::smallint, __P2__::uuid)`,
          c.varsta, c.id
        )
        break

      case 'nid':
        addCursor(
          `AND (nid, id) ${op} (__P1__, __P2__::uuid)`,
          c.nid, c.id
        )
        break

      case 'locality':
        addCursor(
          `AND (domiciliu_localitate ${op} __P1__ OR (domiciliu_localitate = __P1__ AND id ${op} __P2__::uuid))`,
          c.domiciliuLocalitate, c.id
        )
        break

      case 'emailMobile':
        addCursor(
          `AND (email ${op} __P1__ OR (email = __P1__ AND id ${op} __P2__::uuid))`,
          c.email, c.id
        )
        break

      case 'medicCurant':
        addCursor(
          `AND (medic_curant, id) ${op} (__P1__, __P2__::uuid)`,
          c.medicCurant, c.id
        )
        break

      case 'medicFamilie':
        addCursor(
          `AND (medic_familie_nume ${op} __P1__ OR (medic_familie_nume = __P1__ AND id ${op} __P2__::uuid))`,
          c.medicFamilieNume, c.id
        )
        break

      case 'status':
        // boolean: false < true
        addCursor(
          `AND (is_verified::int, id) ${op} (__P1__::int, __P2__::uuid)`,
          c.isVerified ? 1 : 0, c.id
        )
        break

      case 'createdFrom':
        addCursor(
          `AND (sursa_informare ${op} __P1__ OR (sursa_informare = __P1__ AND id ${op} __P2__::uuid))`,
          c.sursaInformare, c.id
        )
        break
    }
  }

  const whereWithCursor = whereClause
    ? `${whereClause} ${cursorClause}`
    : cursorClause ? `WHERE 1=1 ${cursorClause}` : ''

  const sql = `
    SELECT ${LIST_SELECT_COLUMNS}
    FROM patients
    ${whereWithCursor}
    ${orderBy}
    LIMIT $${allValues.length + 1}
  `
  allValues.push(limit + 1)

  const result = await db.query(sql, allValues)
   const t3 = Date.now()
  const rows = result.rows.slice(0, limit)
  const hasMore = result.rows.length > limit
  const lastRow = rows[rows.length - 1]

  // Build next cursor from last row based on current sort
  let nextCursor: SortCursor | null = null
  if (hasMore && lastRow) {
    const effectiveSortKey = sortKey ?? 'default'
    switch (effectiveSortKey) {
      case 'name':
        nextCursor = { sortKey: 'name', nume: lastRow.nume, prenume: lastRow.prenume, id: lastRow.id }
        break
      case 'age':
        nextCursor = { sortKey: 'age', varsta: lastRow.varsta, id: lastRow.id }
        break
      case 'nid':
        nextCursor = { sortKey: 'nid', nid: lastRow.nid, id: lastRow.id }
        break
      case 'locality':
        nextCursor = { sortKey: 'locality', domiciliuLocalitate: lastRow.domiciliu_localitate as string, id: lastRow.id }
        break
      case 'emailMobile':
        nextCursor = { sortKey: 'emailMobile', email: lastRow.email as string, id: lastRow.id }
        break
      case 'medicCurant':
        nextCursor = { sortKey: 'medicCurant', medicCurant: lastRow.medic_curant, id: lastRow.id }
        break
      case 'medicFamilie':
        nextCursor = { sortKey: 'medicFamilie', medicFamilieNume: lastRow.medic_familie_nume as string, id: lastRow.id }
        break
      case 'status':
        nextCursor = { sortKey: 'status', isVerified: Boolean(lastRow.is_verified), id: lastRow.id }
        break
      case 'createdFrom':
        nextCursor = { sortKey: 'createdFrom', sursaInformare: lastRow.sursa_informare as string, id: lastRow.id }
        break
      default:
        nextCursor = { sortKey: 'default', dataIntroducerii: lastRow.data_introducerii, id: lastRow.id }
        break
    }
  }
  const t4 = Date.now()
    console.log('[patients] list timing', {
    buildWhere: t1 - t0,
    buildCursor: t2 - t1,
    dbQuery: t3 - t2,
    buildResult: t4 - t3,
    total: t4 - t0,
  })

  return {
    items: rows.map(rowToPatient),
    total: null,
    limit,
    hasMore,
    nextCursor,
  }
},

  async count(params: PatientListParams = {}): Promise<PatientsCountResult> {
    const { whereClause, values } = buildPatientListWhere(params)
    const countStartTime = Date.now()
    const countSql = `SELECT COUNT(*)::int AS total
       FROM patients
       ${whereClause}`

    console.log('[patients] filtered COUNT sql', {
      sql: countSql,
      values,
    })

    const result = await db.query(countSql, values)
    const total = Number(result.rows[0]?.total ?? 0)

    logPatientsQuery('filtered COUNT', countStartTime, {
      filtersCount: values.length,
      total,
    })

    return { total }
  },

  async approximateCount(): Promise<number> {
  const result = await db.query(
    `SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'patients'`
  )
  return Number(result.rows[0]?.estimate ?? 0)
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
    // Avoid window functions over the full table — the first row always has
    // previous_id = NULL, so we only need: the first row, the second row's id,
    // and a plain count. Each can use an index on (data_introducerii, id).
    const result = await db.query(
      `SELECT
         p.*,
         NULL AS previous_id,
         (SELECT id FROM patients ${whereClause} ${ORDER_BY} OFFSET 1 LIMIT 1) AS next_id,
         (SELECT COUNT(*)::int FROM patients ${whereClause}) AS total_count
       FROM patients p
       ${whereClause}
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
    // Build a clause we can append AND conditions to for prev/next subqueries
    const filterAnd = whereClause ? `${whereClause} AND` : 'WHERE'

    // Avoid window functions over the full table.
    // Instead: fetch the current row, then find its neighbours by comparing
    // (data_introducerii, id) against the sort key of the current patient.
    // Each subquery can use an index on (data_introducerii, id).
    const result = await db.query(
      `WITH current_patient AS (
         SELECT * FROM patients WHERE id = $${idIndex}
       )
       SELECT
         cp.*,
         (SELECT id FROM patients
          ${filterAnd} (data_introducerii, id) < (cp.data_introducerii, cp.id)
          ORDER BY data_introducerii DESC, id DESC LIMIT 1) AS previous_id,
         (SELECT id FROM patients
          ${filterAnd} (data_introducerii, id) > (cp.data_introducerii, cp.id)
          ORDER BY data_introducerii ASC, id ASC LIMIT 1) AS next_id,
         (SELECT COUNT(*)::int FROM patients ${whereClause}) AS total_count
       FROM current_patient cp`,
      [...values, id]
    )

    return result.rows[0] ? rowToNavigation(result.rows[0]) : null
  },

  async create(data: CreatePatientInput): Promise<Patient> {
    const result = await db.query(
      `INSERT INTO public.patients (
        nume, prenume, nr, nid, varsta, sex, tip_actului, cod_cnp,
        buletin_serie, buletin_nr, eliberat_de, valabil_pana, data_nasterii,
        cetatenie, cetatenie2, ocupatie, educatie, loc_munca,
        medic_initial, medic_curant,
        data_prezentare, varsta_prezentare, pacient_oncologic,
        localizare_icd, localizare_desc, observatii,
        data_inregistrare, cauze_deces, autor_fisa,
        ultima_modificare_facuta_de, nr_pacienti_gasiti,
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
        $30,$31,
        $32,$33,$34,
        $35,$36,$37,$38,$39,$40,$41,$42,$43,
        $44,$45,$46,$47,$48,$49,$50,$51,$52,
        $53,$54,$55,$56,$57,
        $58,$59,
        $60,$61,
        $62,$63,$64,$65,$66,$67,$68,$69
      ) RETURNING *`,
      [
        data.nume,
        data.prenume,
        data.nr,
        data.nid,
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
        data.telefon ?? null,
        data.mobil ?? '',
        data.email ?? '',
        data.domiciliuTara ?? null,
        data.domiciliuJudet ?? null,
        data.domiciliuLocalitate ?? '',
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
        data.medicFamilieNume ?? '',
        data.medicFamilieEmail ?? '',
        data.nivelNotificari ?? null,
        data.sursaInformare ?? '',
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
      nume: 'nume', prenume: 'prenume', nr: 'nr', nid: 'nid',
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
      nrPacientiGasiti: 'nr_pacienti_gasiti',
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
      `UPDATE public.patients
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
      'UPDATE public.patients SET is_verified = $1 WHERE id = $2 RETURNING *',
      [isVerified, id]
    )
    return result.rows[0] ? rowToPatient(result.rows[0]) : null
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query('DELETE FROM patients WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  },
}
