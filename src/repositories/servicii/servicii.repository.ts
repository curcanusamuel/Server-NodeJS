import { db } from '../../db/pool'
import { Serviciu } from '../../types/servicii'
import { CreateServiciuInput, UpdateServiciuInput, ServiciuListQuery } from '../../schemas/servicii.schema'

export type ServiciuUpdateResult =
  | { status: 'updated'; serviciu: Serviciu }
  | { status: 'not_found' }

function rowToServiciu(row: Record<string, unknown>): Serviciu {
  return {
    id: row.zk_preturi_id_p as string,
    zkIdmoduleF: row.zk_idmodule_f as string,
    zkIdsubcategorieF: row.zk_idsubcategorie_f as string,
    codProcedura: (row.cod_procedura as string | null) ?? null,
    nume: row.nume as string,
    pretBaza: Number(row.pret_baza),
    perioada: (row.perioada as string | null) ?? null,
    sursaPlata: (row.sursa_plata as string | null) ?? null,
    firma: (row.firma as string | null) ?? null,
    isCas: Boolean(row.is_cas),
    isDisabled: Boolean(row.is_disabled),
    createdAccount: row.created_account as string,
    createdTimestamp: row.created_timestamp as Date,
    modificationAccount: (row.modification_account as string | null) ?? null,
    modificationTimestamp: (row.modification_timestamp as Date | null) ?? null,
  }
}

export const serviciiRepository = {
  async findAll(query: ServiciuListQuery = {}): Promise<Serviciu[]> {
    const conditions: string[] = []
    const values: unknown[] = []
    let i = 1

    if (query.includeDisabled !== 'true') {
      conditions.push(`is_disabled = FALSE`)
    }

    if (query.moduleId) {
      conditions.push(`zk_idmodule_f = $${i++}`)
      values.push(query.moduleId)
    }

    if (query.isCas !== undefined) {
      conditions.push(`is_cas = $${i++}`)
      values.push(query.isCas === 'true')
    }

    if (query.q) {
      const pattern = `%${query.q.trim()}%`
      conditions.push(`(nume ILIKE $${i} OR cod_procedura ILIKE $${i})`)
      values.push(pattern)
      i++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await db.query(
      `SELECT * FROM servicii ${whereClause} ORDER BY nume ASC`,
      values
    )
    return result.rows.map(rowToServiciu)
  },

  async findById(id: string): Promise<Serviciu | null> {
    const result = await db.query(
      `SELECT * FROM servicii WHERE zk_preturi_id_p = $1`,
      [id]
    )
    return result.rows[0] ? rowToServiciu(result.rows[0]) : null
  },

  async findByCodProcedura(codProcedura: string): Promise<Serviciu | null> {
    const result = await db.query(
      `SELECT * FROM servicii WHERE cod_procedura = $1 AND is_disabled = FALSE`,
      [codProcedura]
    )
    return result.rows[0] ? rowToServiciu(result.rows[0]) : null
  },

  async create(data: CreateServiciuInput): Promise<Serviciu> {
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      const serviciiResult = await client.query(
        `INSERT INTO servicii (
          zk_idmodule_f,
          zk_idsubcategorie_f,
          cod_procedura,
          nume,
          pret_baza,
          perioada,
          sursa_plata,
          firma,
          is_cas,
          created_account
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          data.zkIdmoduleF,
          data.zkIdsubcategorieF,
          data.codProcedura ?? null,
          data.nume,
          data.pretBaza,
          data.perioada ?? null,
          data.sursaPlata ?? null,
          data.firma ?? null,
          data.isCas ?? false,
          data.createdAccount,
        ]
      )

      const serviciu = rowToServiciu(serviciiResult.rows[0])

      await client.query(
        `INSERT INTO discounturi (
          zk_pret_id_f,
          zk_doctor_id_f,
          numele_pretului,
          pret,
          start_date,
          end_date,
          type,
          created_account
        ) VALUES ($1, $2, $3, $4, CURRENT_DATE, NULL, 'baza', $5)`,
        [
          serviciu.id,
          null,
          data.nume,
          data.pretBaza,
          data.createdAccount,
        ]
      )

      await client.query('COMMIT')
      return serviciu
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  async update(id: string, data: UpdateServiciuInput): Promise<ServiciuUpdateResult> {
    const fields: string[] = []
    const values: unknown[] = []
    let i = 1

    const fieldMap: Record<string, string> = {
      zkIdmoduleF: 'zk_idmodule_f',
      zkIdsubcategorieF: 'zk_idsubcategorie_f',
      codProcedura: 'cod_procedura',
      nume: 'nume',
      pretBaza: 'pret_baza',
      perioada: 'perioada',
      sursaPlata: 'sursa_plata',
      firma: 'firma',
      isCas: 'is_cas',
      isDisabled: 'is_disabled',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data) {
        fields.push(`${col} = $${i++}`)
        values.push((data as Record<string, unknown>)[key])
      }
    }

    fields.push(`modification_account = $${i++}`)
    fields.push(`modification_timestamp = NOW()`)
    values.push(data.modificationAccount)

    values.push(id)
    const result = await db.query(
      `UPDATE servicii
       SET ${fields.join(', ')}
       WHERE zk_preturi_id_p = $${i}
       RETURNING *`,
      values
    )

    if (!result.rows[0]) return { status: 'not_found' }
    return { status: 'updated', serviciu: rowToServiciu(result.rows[0]) }
  },

  async delete(id: string): Promise<boolean> {
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      await client.query(
        `DELETE FROM discounturi WHERE zk_pret_id_f = $1`,
        [id]
      )

      const result = await client.query(
        `DELETE FROM servicii WHERE zk_preturi_id_p = $1`,
        [id]
      )

      await client.query('COMMIT')
      return (result.rowCount ?? 0) > 0
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },
}
