import { db } from '../../db/pool'
import { Subcategorie } from '../../types/subcategorie'
import { CreateSubcategorieInput, UpdateSubcategorieInput, SubcategorieListQuery } from '../../schemas/subcategorie.schema'

export type SubcategorieUpdateResult =
  | { status: 'updated'; subcategorie: Subcategorie }
  | { status: 'not_found' }

function rowToSubcategorie(row: Record<string, unknown>): Subcategorie {
  return {
    id: row.zk_idsubcategorie_p as string,
    zkIdmoduleF: row.zk_idmodule_f as string,
    numeSubcategorie: row.nume_subcategorie as string,
    isDisabled: Boolean(row.is_disabled),
    createdAccount: row.created_account as string,
    createdTimestamp: row.created_timestamp as Date,
    modificationAccount: (row.modification_account as string | null) ?? null,
    modificationTimestamp: (row.modification_timestamp as Date | null) ?? null,
  }
}

export const subcategorieRepository = {
  async findAll(query: SubcategorieListQuery = {}): Promise<Subcategorie[]> {
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

    if (query.q) {
      conditions.push(`nume_subcategorie ILIKE $${i++}`)
      values.push(`%${query.q.trim()}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await db.query(
      `SELECT * FROM sub_categorie ${whereClause} ORDER BY nume_subcategorie ASC`,
      values
    )
    return result.rows.map(rowToSubcategorie)
  },

  async findById(id: string): Promise<Subcategorie | null> {
    const result = await db.query(
      `SELECT * FROM sub_categorie WHERE zk_idsubcategorie_p = $1`,
      [id]
    )
    return result.rows[0] ? rowToSubcategorie(result.rows[0]) : null
  },

  async create(data: CreateSubcategorieInput): Promise<Subcategorie> {
    const result = await db.query(
      `INSERT INTO sub_categorie (
        zk_idmodule_f,
        nume_subcategorie,
        created_account
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [
        data.zkIdmoduleF,
        data.numeSubcategorie,
        data.createdAccount,
      ]
    )
    return rowToSubcategorie(result.rows[0])
  },

  async update(id: string, data: UpdateSubcategorieInput): Promise<SubcategorieUpdateResult> {
    const fields: string[] = []
    const values: unknown[] = []
    let i = 1

    const fieldMap: Record<string, string> = {
      zkIdmoduleF: 'zk_idmodule_f',
      numeSubcategorie: 'nume_subcategorie',
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
      `UPDATE sub_categorie
       SET ${fields.join(', ')}
       WHERE zk_idsubcategorie_p = $${i}
       RETURNING *`,
      values
    )

    if (!result.rows[0]) return { status: 'not_found' }
    return { status: 'updated', subcategorie: rowToSubcategorie(result.rows[0]) }
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM sub_categorie WHERE zk_idsubcategorie_p = $1`,
      [id]
    )
    return (result.rowCount ?? 0) > 0
  },
}
