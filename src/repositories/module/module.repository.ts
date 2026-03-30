import { db } from '../../db/pool'
import { Module } from '../../types/module'
import { CreateModuleInput, UpdateModuleInput } from '../../schemas/module.schema'

export type ModuleUpdateResult =
  | { status: 'updated'; module: Module }
  | { status: 'not_found' }
  | { status: 'conflict' }

function rowToModule(row: Record<string, unknown>): Module {
  return {
    id: row.zk_idmodule_p as string,
    numeModul: row.nume_modul as string,
    isDisabled: Boolean(row.is_disabled),
    createdAccount: row.created_account as string,
    createdTimestamp: row.created_timestamp as Date,
    modificationAccount: (row.modification_account as string | null) ?? null,
    modificationTimestamp: (row.modification_timestamp as Date | null) ?? null,
    version: row.version as number,
    deletedAt: (row.deleted_at as string | null) ?? null,
  }
}

export const moduleRepository = {
  async findAll(): Promise<Module[]> {
    const result = await db.query(
      `SELECT * FROM module WHERE is_disabled = FALSE AND deleted_at IS NULL ORDER BY nume_modul ASC`
    )
    return result.rows.map(rowToModule)
  },

  async findById(id: string): Promise<Module | null> {
    const result = await db.query(
      `SELECT * FROM module WHERE zk_idmodule_p = $1 AND deleted_at IS NULL`,
      [id]
    )
    return result.rows[0] ? rowToModule(result.rows[0]) : null
  },

  async create(data: CreateModuleInput): Promise<Module> {
    const result = await db.query(
      `INSERT INTO module (
        nume_modul,
        created_account
      ) VALUES ($1, $2)
      RETURNING *`,
      [
        data.numeModul,
        data.createdAccount,
      ]
    )
    return rowToModule(result.rows[0])
  },

  async update(id: string, data: UpdateModuleInput): Promise<ModuleUpdateResult> {
    const fields: string[] = []
    const values: unknown[] = []
    let i = 1

    const fieldMap: Record<string, string> = {
      numeModul: 'nume_modul',
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
    fields.push(`version = version + 1`)
    values.push(data.modificationAccount)

    const clientVersion = (data as Record<string, unknown>).version
    let versionCheck = ''
    if (clientVersion !== undefined) {
      values.push(clientVersion)
      versionCheck = `AND version = $${i++}`
    }

    values.push(id)
    const result = await db.query(
      `UPDATE module
       SET ${fields.join(', ')}
       WHERE zk_idmodule_p = $${i}
         AND deleted_at IS NULL
         ${versionCheck}
       RETURNING *`,
      values
    )

    if (!result.rows[0]) {
      if (clientVersion !== undefined) return { status: 'conflict' }
      return { status: 'not_found' }
    }
    return { status: 'updated', module: rowToModule(result.rows[0]) }
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query(
      `UPDATE module SET deleted_at = NOW() WHERE zk_idmodule_p = $1 AND deleted_at IS NULL`,
      [id]
    )
    return (result.rowCount ?? 0) > 0
  },
}