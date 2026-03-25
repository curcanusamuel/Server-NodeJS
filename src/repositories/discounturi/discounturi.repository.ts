import { db } from '../../db/pool'
import { Discount } from '../../types/discounturi'
import { CreateDiscountInput, UpdateDiscountInput, DiscountListQuery } from '../../schemas/discounturi.schema'

export type DiscountUpdateResult =
  | { status: 'updated'; discount: Discount }
  | { status: 'not_found' }
  | { status: 'overlap'; conflictId: string }

export type DiscountCreateResult =
  | { status: 'created'; discount: Discount }
  | { status: 'overlap'; conflictId: string }

function rowToDiscount(row: Record<string, unknown>): Discount {
  return {
    id: row.zk_pret_variabil_id_p as string,
    zkPretIdF: row.zk_pret_id_f as string,
    zkDoctorIdF: (row.zk_doctor_id_f as string | null) ?? null,
    numelePretului: row.numele_pretului as string,
    pret: Number(row.pret),
    startDate: (row.start_date as Date).toISOString().split('T')[0],
    endDate: row.end_date ? (row.end_date as Date).toISOString().split('T')[0] : null,
    type: row.type as Discount['type'],
    isDisabled: Boolean(row.is_disabled),
    createdAccount: row.created_account as string,
    createdTimestamp: row.created_timestamp as Date,
    modificationAccount: (row.modification_account as string | null) ?? null,
    modificationTimestamp: (row.modification_timestamp as Date | null) ?? null,
  }
}

async function checkOverlap(
  servicuId: string,
  doctorId: string | null | undefined,
  type: string,
  startDate: string,
  endDate: string | null | undefined,
  excludeId?: string
): Promise<string | null> {
  const result = await db.query(
    `SELECT zk_pret_variabil_id_p
     FROM discounturi
     WHERE zk_pret_id_f  = $1
       AND type          = $2
       AND is_disabled   = FALSE
       AND ($3::uuid IS NULL OR zk_pret_variabil_id_p <> $3::uuid)
       AND (
             ($2 = 'doctor' AND zk_doctor_id_f = $4::uuid)
             OR $2 <> 'doctor'
           )
       AND start_date <= COALESCE($5::date, 'infinity'::date)
       AND COALESCE(end_date, 'infinity'::date) >= $6::date
     LIMIT 1`,
    [
      servicuId,
      type,
      excludeId ?? null,
      doctorId ?? null,
      endDate ?? null,
      startDate,
    ]
  )
  return (result.rows[0]?.zk_pret_variabil_id_p as string) ?? null
}

export const discounturiRepository = {
  async findAll(query: DiscountListQuery = {}): Promise<Discount[]> {
    const conditions: string[] = []
    const values: unknown[] = []
    let i = 1

    if (query.includeDisabled !== 'true') {
      conditions.push(`is_disabled = FALSE`)
    }

    if (query.servicuId) {
      conditions.push(`zk_pret_id_f = $${i++}`)
      values.push(query.servicuId)
    }

    if (query.doctorId) {
      conditions.push(`zk_doctor_id_f = $${i++}`)
      values.push(query.doctorId)
    }

    if (query.type) {
      conditions.push(`type = $${i++}`)
      values.push(query.type)
    }

    if (query.activeOn) {
      conditions.push(`start_date <= $${i}::date AND (end_date IS NULL OR end_date >= $${i}::date)`)
      values.push(query.activeOn)
      i++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await db.query(
      `SELECT * FROM discounturi ${whereClause} ORDER BY start_date DESC`,
      values
    )
    return result.rows.map(rowToDiscount)
  },

  async findById(id: string): Promise<Discount | null> {
    const result = await db.query(
      `SELECT * FROM discounturi WHERE zk_pret_variabil_id_p = $1`,
      [id]
    )
    return result.rows[0] ? rowToDiscount(result.rows[0]) : null
  },

  async getActivePrice(servicuId: string, doctorId: string | null, date: string): Promise<number | null> {
    let result = await db.query(
      `SELECT pret FROM discounturi
       WHERE zk_pret_id_f = $1
         AND type         = 'promotie'
         AND is_disabled  = FALSE
         AND start_date  <= $2::date
         AND (end_date IS NULL OR end_date >= $2::date)
       ORDER BY start_date DESC
       LIMIT 1`,
      [servicuId, date]
    )
    if (result.rows[0]) return Number(result.rows[0].pret)

    if (doctorId) {
      result = await db.query(
        `SELECT pret FROM discounturi
         WHERE zk_pret_id_f   = $1
           AND zk_doctor_id_f = $2
           AND type           = 'doctor'
           AND is_disabled    = FALSE
           AND start_date    <= $3::date
           AND (end_date IS NULL OR end_date >= $3::date)
         ORDER BY start_date DESC
         LIMIT 1`,
        [servicuId, doctorId, date]
      )
      if (result.rows[0]) return Number(result.rows[0].pret)
    }

    result = await db.query(
      `SELECT pret FROM discounturi
       WHERE zk_pret_id_f = $1
         AND type         = 'baza'
         AND is_disabled  = FALSE
         AND start_date  <= $2::date
         AND (end_date IS NULL OR end_date >= $2::date)
       ORDER BY start_date DESC
       LIMIT 1`,
      [servicuId, date]
    )
    if (result.rows[0]) return Number(result.rows[0].pret)

    result = await db.query(
      `SELECT pret FROM discounturi
       WHERE zk_pret_id_f = $1
         AND type         = 'baza'
         AND is_disabled  = FALSE
       ORDER BY ABS(start_date - $2::date)
       LIMIT 1`,
      [servicuId, date]
    )
    if (result.rows[0]) return Number(result.rows[0].pret)

    result = await db.query(
      `SELECT pret_baza FROM servicii WHERE zk_preturi_id_p = $1`,
      [servicuId]
    )
    return result.rows[0] ? Number(result.rows[0].pret_baza) : null
  },

  async create(data: CreateDiscountInput): Promise<DiscountCreateResult> {
    const conflictId = await checkOverlap(
      data.zkPretIdF,
      data.zkDoctorIdF,
      data.type,
      data.startDate,
      data.endDate
    )

    if (conflictId) return { status: 'overlap', conflictId }

    const result = await db.query(
      `INSERT INTO discounturi (
        zk_pret_id_f,
        zk_doctor_id_f,
        numele_pretului,
        pret,
        start_date,
        end_date,
        type,
        created_account
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.zkPretIdF,
        data.zkDoctorIdF ?? null,
        data.numelePretului,
        data.pret,
        data.startDate,
        data.endDate ?? null,
        data.type,
        data.createdAccount,
      ]
    )
    return { status: 'created', discount: rowToDiscount(result.rows[0]) }
  },

  async update(id: string, data: UpdateDiscountInput): Promise<DiscountUpdateResult> {
    const existing = await this.findById(id)
    if (!existing) return { status: 'not_found' }

    const nextType = data.type ?? existing.type
    const nextDoctorId = Object.prototype.hasOwnProperty.call(data, 'zkDoctorIdF') ? (data.zkDoctorIdF ?? null) : existing.zkDoctorIdF
    const newStartDate = data.startDate ?? existing.startDate
    const newEndDate = Object.prototype.hasOwnProperty.call(data, 'endDate') ? (data.endDate ?? null) : existing.endDate

    const conflictId = await checkOverlap(
      existing.zkPretIdF,
      nextDoctorId,
      nextType,
      newStartDate,
      newEndDate,
      id
    )
    if (conflictId) return { status: 'overlap', conflictId }

    const fields: string[] = []
    const values: unknown[] = []
    let i = 1

    const fieldMap: Record<string, string> = {
      zkDoctorIdF: 'zk_doctor_id_f',
      numelePretului: 'numele_pretului',
      pret: 'pret',
      startDate: 'start_date',
      endDate: 'end_date',
      type: 'type',
      isDisabled: 'is_disabled',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        fields.push(`${col} = $${i++}`)
        values.push((data as Record<string, unknown>)[key] ?? null)
      }
    }

    fields.push(`modification_account = $${i++}`)
    fields.push(`modification_timestamp = NOW()`)
    values.push(data.modificationAccount)

    values.push(id)
    const result = await db.query(
      `UPDATE discounturi
       SET ${fields.join(', ')}
       WHERE zk_pret_variabil_id_p = $${i}
       RETURNING *`,
      values
    )

    if (!result.rows[0]) return { status: 'not_found' }
    return { status: 'updated', discount: rowToDiscount(result.rows[0]) }
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM discounturi WHERE zk_pret_variabil_id_p = $1`,
      [id]
    )
    return (result.rowCount ?? 0) > 0
  },
}
