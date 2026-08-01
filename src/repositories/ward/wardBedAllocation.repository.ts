import { db } from '../../db/pool'
import { WardBedAllocation } from '../../types/ward'
import { CreateWardBedAllocationInput, UpdateWardBedAllocationInput } from '../../schemas/ward.schema'

export type CreateAllocationResult =
	| { status: 'created'; allocation: WardBedAllocation }
	| { status: 'bed_occupied' }

export type ReleaseAllocationResult =
	| { status: 'released'; allocation: WardBedAllocation }
	| { status: 'not_found' }

export type UpdateAllocationResult =
	| { status: 'updated'; allocation: WardBedAllocation }
	| { status: 'not_found' }
	| { status: 'conflict' }

const SELECT_COLUMNS = `
  id, ward_id, bed_id, patient_id, allocated_at, released_at,
  allocated_by_user_id, released_by_user_id, notes, version
`

const UNIQUE_VIOLATION = '23505'

function rowToAllocation(row: Record<string, unknown>): WardBedAllocation {
	return {
		id: row.id as string,
		wardId: row.ward_id as string,
		bedId: row.bed_id as string,
		patientId: row.patient_id as string,
		allocatedAt: row.allocated_at as Date,
		releasedAt: (row.released_at as Date | null) ?? null,
		allocatedByUserId: row.allocated_by_user_id as string,
		releasedByUserId: (row.released_by_user_id as string | null) ?? null,
		notes: (row.notes as string | null) ?? null,
		version: row.version as number,
	}
}

export const wardBedAllocationRepository = {
	async findById(id: string): Promise<WardBedAllocation | null> {
		const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM ward_bed_allocations WHERE id = $1`, [id])
		return result.rows[0] ? rowToAllocation(result.rows[0]) : null
	},

	async findActiveByBedId(bedId: string): Promise<WardBedAllocation | null> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM ward_bed_allocations WHERE bed_id = $1 AND released_at IS NULL`,
			[bedId]
		)
		return result.rows[0] ? rowToAllocation(result.rows[0]) : null
	},

	async findActiveByPatientId(patientId: string): Promise<WardBedAllocation | null> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM ward_bed_allocations WHERE patient_id = $1 AND released_at IS NULL`,
			[patientId]
		)
		return result.rows[0] ? rowToAllocation(result.rows[0]) : null
	},

	async create(data: CreateWardBedAllocationInput): Promise<CreateAllocationResult> {
		try {
			const result = await db.query(
				`INSERT INTO public.ward_bed_allocations (ward_id, bed_id, patient_id, allocated_by_user_id, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SELECT_COLUMNS}`,
				[data.wardId, data.bedId, data.patientId, data.allocatedByUserId, data.notes ?? null]
			)
			return { status: 'created', allocation: rowToAllocation(result.rows[0]) }
		} catch (err) {
			if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
				return { status: 'bed_occupied' }
			}
			throw err
		}
	},

	async release(id: string, releasedByUserId: string): Promise<ReleaseAllocationResult> {
		const result = await db.query(
			`UPDATE public.ward_bed_allocations
       SET released_at = NOW(), released_by_user_id = $1, version = version + 1
       WHERE id = $2 AND released_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
			[releasedByUserId, id]
		)
		if (!result.rows[0]) return { status: 'not_found' }
		return { status: 'released', allocation: rowToAllocation(result.rows[0]) }
	},

	async update(id: string, data: UpdateWardBedAllocationInput): Promise<UpdateAllocationResult> {
		if (!('notes' in data)) {
			const existing = await this.findById(id)
			if (!existing) return { status: 'not_found' }
			return { status: 'updated', allocation: existing }
		}

		const values: unknown[] = [data.notes, id]
		let versionCheck = ''
		if (data.version !== undefined) {
			values.push(data.version)
			versionCheck = 'AND version = $3'
		}

		const result = await db.query(
			`UPDATE public.ward_bed_allocations
       SET notes = $1, version = version + 1
       WHERE id = $2 ${versionCheck}
       RETURNING ${SELECT_COLUMNS}`,
			values
		)

		if (result.rows[0]) {
			return { status: 'updated', allocation: rowToAllocation(result.rows[0]) }
		}

		const statusResult = await db.query('SELECT version FROM ward_bed_allocations WHERE id = $1', [id])
		if (!statusResult.rows[0]) return { status: 'not_found' }
		if (data.version !== undefined && statusResult.rows[0].version !== data.version) {
			return { status: 'conflict' }
		}
		return { status: 'not_found' }
	},
}
