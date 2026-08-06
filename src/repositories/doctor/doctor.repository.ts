import { db } from '../../db/pool'
import { Doctor } from '../../types/doctor'
import { CreateDoctorInput, UpdateDoctorInput } from '../../schemas/doctor.schema'

export type DoctorUpdateResult =
  | { status: 'updated'; doctor: Doctor }
  | { status: 'not_found' }
  | { status: 'conflict' }
  | { status: 'user_taken' }

function rowToDoctor(row: Record<string, unknown>): Doctor {
  return {
    id: row.zk_doctor_id_p as string,
    userId: (row.user_id as string | null) ?? null,
    numeDoctor: row.nume_doctor as string,
    isDisabled: Boolean(row.is_disabled),
    createdAccount: row.created_account as string,
    createdTimestamp: row.created_timestamp as Date,
    modificationAccount: (row.modification_account as string | null) ?? null,
    modificationTimestamp: (row.modification_timestamp as Date | null) ?? null,
    version: row.version as number,
    deletedAt: (row.deleted_at as string | null) ?? null,
  }
}

type DoctorAccountSeed = {
  userId: string
  username: string
}

async function findDoctorAccountSeeds(): Promise<DoctorAccountSeed[]> {
  const result = await db.query(
    `SELECT u.id AS user_id, u.username
     FROM app_user u
     LEFT JOIN doctor d
       ON d.user_id = u.id
      AND d.deleted_at IS NULL
     WHERE u.role = 'DOCTOR'
       AND u.is_active = TRUE
       AND d.zk_doctor_id_p IS NULL
     ORDER BY u.username ASC`
  )

  return result.rows.map((row) => ({
    userId: row.user_id as string,
    username: row.username as string,
  }))
}

async function ensureDoctorRowsForAccounts(): Promise<void> {
  const missingDoctors = await findDoctorAccountSeeds()
  if (missingDoctors.length === 0) return

  for (const account of missingDoctors) {
    await db.query(
      `INSERT INTO doctor (
        user_id,
        nume_doctor,
        created_account
      ) VALUES ($1, $2, $3)`,
      [account.userId, account.username, 'system-sync']
    )
  }
}

export const doctorRepository = {
  async findAll(): Promise<Doctor[]> {
    await ensureDoctorRowsForAccounts()
    const result = await db.query(
      `SELECT d.*
       FROM doctor d
       JOIN app_user u
         ON u.id = d.user_id
       WHERE d.is_disabled = FALSE
         AND d.deleted_at IS NULL
         AND u.role = 'DOCTOR'
         AND u.is_active = TRUE
       ORDER BY d.nume_doctor ASC`
    )
    return result.rows.map(rowToDoctor)
  },

  async findById(id: string): Promise<Doctor | null> {
    const result = await db.query(
      `SELECT * FROM doctor WHERE zk_doctor_id_p = $1 AND deleted_at IS NULL`,
      [id]
    )
    return result.rows[0] ? rowToDoctor(result.rows[0]) : null
  },

  async findByUserId(userId: string): Promise<Doctor | null> {
    let result = await db.query(
      `SELECT * FROM doctor WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    )

    if (result.rows[0]) {
      return rowToDoctor(result.rows[0])
    }

    const accountResult = await db.query(
      `SELECT id, username
       FROM app_user
       WHERE id = $1
         AND role = 'DOCTOR'
         AND is_active = TRUE`,
      [userId]
    )

    const account = accountResult.rows[0]
    if (!account) return null

    result = await db.query(
      `INSERT INTO doctor (
        user_id,
        nume_doctor,
        created_account
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [account.id, account.username, 'system-sync']
    )

    return rowToDoctor(result.rows[0])
  },

  async create(data: CreateDoctorInput): Promise<Doctor> {
    const result = await db.query(
      `INSERT INTO doctor (
        user_id,
        nume_doctor,
        created_account
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [
        data.userId ?? null,
        data.numeDoctor,
        data.createdAccount,
      ]
    )
    return rowToDoctor(result.rows[0])
  },

  async update(id: string, data: UpdateDoctorInput): Promise<DoctorUpdateResult> {
    // If linking a user_id, make sure it's not already taken by another doctor
    if (data.userId) {
      const existing = await this.findByUserId(data.userId)
      if (existing && existing.id !== id) {
        return { status: 'user_taken' }
      }
    }

    const fields: string[] = []
    const values: unknown[] = []
    let i = 1

    const fieldMap: Record<string, string> = {
      numeDoctor: 'nume_doctor',
      userId: 'user_id',
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
      `UPDATE doctor
       SET ${fields.join(', ')}
       WHERE zk_doctor_id_p = $${i}
         AND deleted_at IS NULL
         ${versionCheck}
       RETURNING *`,
      values
    )

    if (!result.rows[0]) {
      if (clientVersion !== undefined) return { status: 'conflict' }
      return { status: 'not_found' }
    }
    return { status: 'updated', doctor: rowToDoctor(result.rows[0]) }
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query(
      `UPDATE doctor SET deleted_at = NOW() WHERE zk_doctor_id_p = $1 AND deleted_at IS NULL`,
      [id]
    )
    return (result.rowCount ?? 0) > 0
  },
}
