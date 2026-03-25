import { db } from '../../db/pool'
import { Doctor } from '../../types/doctor'
import { CreateDoctorInput, UpdateDoctorInput } from '../../schemas/doctor.schema'

export type DoctorUpdateResult =
  | { status: 'updated'; doctor: Doctor }
  | { status: 'not_found' }
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
  }
}

export const doctorRepository = {
  async findAll(): Promise<Doctor[]> {
    const result = await db.query(
      `SELECT * FROM doctor WHERE is_disabled = FALSE ORDER BY nume_doctor ASC`
    )
    return result.rows.map(rowToDoctor)
  },

  async findById(id: string): Promise<Doctor | null> {
    const result = await db.query(
      `SELECT * FROM doctor WHERE zk_doctor_id_p = $1`,
      [id]
    )
    return result.rows[0] ? rowToDoctor(result.rows[0]) : null
  },

  async findByUserId(userId: string): Promise<Doctor | null> {
    const result = await db.query(
      `SELECT * FROM doctor WHERE user_id = $1`,
      [userId]
    )
    return result.rows[0] ? rowToDoctor(result.rows[0]) : null
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
    values.push(data.modificationAccount)

    values.push(id)
    const result = await db.query(
      `UPDATE doctor
       SET ${fields.join(', ')}
       WHERE zk_doctor_id_p = $${i}
       RETURNING *`,
      values
    )

    if (!result.rows[0]) return { status: 'not_found' }
    return { status: 'updated', doctor: rowToDoctor(result.rows[0]) }
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM doctor WHERE zk_doctor_id_p = $1`,
      [id]
    )
    return (result.rowCount ?? 0) > 0
  },
}