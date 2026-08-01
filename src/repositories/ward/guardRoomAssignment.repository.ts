import { db } from '../../db/pool'
import { GuardRoomAssignment } from '../../types/ward'
import { CreateGuardRoomAssignmentInput, UpdateGuardRoomAssignmentInput } from '../../schemas/ward.schema'

export type CreateAssignmentResult =
	| { status: 'created'; assignment: GuardRoomAssignment }
	| { status: 'patient_already_assigned' }

export type DischargeAssignmentResult =
	| { status: 'discharged'; assignment: GuardRoomAssignment }
	| { status: 'not_found' }

export type UpdateAssignmentResult =
	| { status: 'updated'; assignment: GuardRoomAssignment }
	| { status: 'not_found' }
	| { status: 'conflict' }

const SELECT_COLUMNS = `
  id, ward_id, patient_id, triage_level, triage_at, assigned_at, discharged_at,
  assigned_by_user_id, discharged_by_user_id, notes, version
`

const UNIQUE_VIOLATION = '23505'

function rowToAssignment(row: Record<string, unknown>): GuardRoomAssignment {
	return {
		id: row.id as string,
		wardId: row.ward_id as string,
		patientId: row.patient_id as string,
		triageLevel: row.triage_level as number,
		triageAt: row.triage_at as Date,
		assignedAt: row.assigned_at as Date,
		dischargedAt: (row.discharged_at as Date | null) ?? null,
		assignedByUserId: row.assigned_by_user_id as string,
		dischargedByUserId: (row.discharged_by_user_id as string | null) ?? null,
		notes: (row.notes as string | null) ?? null,
		version: row.version as number,
	}
}

export const guardRoomAssignmentRepository = {
	async findById(id: string): Promise<GuardRoomAssignment | null> {
		const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM guard_room_assignments WHERE id = $1`, [id])
		return result.rows[0] ? rowToAssignment(result.rows[0]) : null
	},

	async findActiveByPatientId(patientId: string): Promise<GuardRoomAssignment | null> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM guard_room_assignments WHERE patient_id = $1 AND discharged_at IS NULL`,
			[patientId]
		)
		return result.rows[0] ? rowToAssignment(result.rows[0]) : null
	},

	async findActive(wardId?: string): Promise<GuardRoomAssignment[]> {
		const values: unknown[] = []
		let wardFilter = ''
		if (wardId) {
			values.push(wardId)
			wardFilter = 'AND ward_id = $1'
		}
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM guard_room_assignments
       WHERE discharged_at IS NULL ${wardFilter}
       ORDER BY triage_level ASC, triage_at ASC`,
			values
		)
		return result.rows.map(rowToAssignment)
	},

	async create(data: CreateGuardRoomAssignmentInput): Promise<CreateAssignmentResult> {
		try {
			const result = await db.query(
				`INSERT INTO public.guard_room_assignments (ward_id, patient_id, triage_level, triage_at, assigned_by_user_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${SELECT_COLUMNS}`,
				[data.wardId, data.patientId, data.triageLevel, data.triageAt, data.assignedByUserId, data.notes ?? null]
			)
			return { status: 'created', assignment: rowToAssignment(result.rows[0]) }
		} catch (err) {
			if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
				return { status: 'patient_already_assigned' }
			}
			throw err
		}
	},

	async discharge(id: string, dischargedByUserId: string): Promise<DischargeAssignmentResult> {
		const result = await db.query(
			`UPDATE public.guard_room_assignments
       SET discharged_at = NOW(), discharged_by_user_id = $1, version = version + 1
       WHERE id = $2 AND discharged_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
			[dischargedByUserId, id]
		)
		if (!result.rows[0]) return { status: 'not_found' }
		return { status: 'discharged', assignment: rowToAssignment(result.rows[0]) }
	},

	async update(id: string, data: UpdateGuardRoomAssignmentInput): Promise<UpdateAssignmentResult> {
		const fields: string[] = []
		const values: unknown[] = []
		let i = 1

		if ('triageLevel' in data) {
			fields.push(`triage_level = $${i++}`)
			values.push(data.triageLevel)
		}
		if ('triageAt' in data) {
			fields.push(`triage_at = $${i++}`)
			values.push(data.triageAt)
		}
		if ('notes' in data) {
			fields.push(`notes = $${i++}`)
			values.push(data.notes)
		}

		if (fields.length === 0) {
			const existing = await this.findById(id)
			if (!existing) return { status: 'not_found' }
			return { status: 'updated', assignment: existing }
		}

		fields.push('version = version + 1')

		values.push(id)
		const idIndex = i++

		let versionCheck = ''
		if (data.version !== undefined) {
			values.push(data.version)
			versionCheck = `AND version = $${i++}`
		}

		const result = await db.query(
			`UPDATE public.guard_room_assignments
       SET ${fields.join(', ')}
       WHERE id = $${idIndex} ${versionCheck}
       RETURNING ${SELECT_COLUMNS}`,
			values
		)

		if (result.rows[0]) {
			return { status: 'updated', assignment: rowToAssignment(result.rows[0]) }
		}

		const statusResult = await db.query('SELECT version FROM guard_room_assignments WHERE id = $1', [id])
		if (!statusResult.rows[0]) return { status: 'not_found' }
		if (data.version !== undefined && statusResult.rows[0].version !== data.version) {
			return { status: 'conflict' }
		}
		return { status: 'not_found' }
	},
}
