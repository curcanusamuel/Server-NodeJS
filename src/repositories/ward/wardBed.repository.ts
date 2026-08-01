import { db } from '../../db/pool'
import { WardBed, WardBedWithOccupant } from '../../types/ward'
import { CreateWardBedInput, UpdateWardBedInput } from '../../schemas/ward.schema'

const SELECT_COLUMNS = 'id, ward_id, label, x, y, rotation, active'

const FIELD_MAP: Record<string, string> = {
	wardId: 'ward_id',
	label: 'label',
	x: 'x',
	y: 'y',
	rotation: 'rotation',
	active: 'active',
}

function rowToWardBed(row: Record<string, unknown>): WardBed {
	return {
		id: row.id as string,
		wardId: row.ward_id as string,
		label: row.label as string,
		x: row.x !== null && row.x !== undefined ? Number(row.x) : null,
		y: row.y !== null && row.y !== undefined ? Number(row.y) : null,
		rotation: Number(row.rotation),
		active: Boolean(row.active),
	}
}

function rowToWardBedWithOccupant(row: Record<string, unknown>): WardBedWithOccupant {
	return {
		...rowToWardBed(row),
		activeAllocation: row.allocation_id
			? {
				id: row.allocation_id as string,
				patientId: row.allocation_patient_id as string,
				allocatedAt: row.allocation_allocated_at as Date,
			}
			: null,
	}
}

export const wardBedRepository = {
	async findByWardId(wardId: string): Promise<WardBed[]> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM ward_beds WHERE ward_id = $1 ORDER BY label ASC`,
			[wardId]
		)
		return result.rows.map(rowToWardBed)
	},

	async findWithOccupantByWardId(wardId: string): Promise<WardBedWithOccupant[]> {
		const result = await db.query(
			`SELECT
         wb.id, wb.ward_id, wb.label, wb.x, wb.y, wb.rotation, wb.active,
         wba.id AS allocation_id, wba.patient_id AS allocation_patient_id, wba.allocated_at AS allocation_allocated_at
       FROM ward_beds wb
       LEFT JOIN ward_bed_allocations wba ON wba.bed_id = wb.id AND wba.released_at IS NULL
       WHERE wb.ward_id = $1
       ORDER BY wb.label ASC`,
			[wardId]
		)
		return result.rows.map(rowToWardBedWithOccupant)
	},

	async findById(id: string): Promise<WardBed | null> {
		const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM ward_beds WHERE id = $1`, [id])
		return result.rows[0] ? rowToWardBed(result.rows[0]) : null
	},

	async create(data: CreateWardBedInput): Promise<WardBed> {
		const result = await db.query(
			`INSERT INTO public.ward_beds (ward_id, label, x, y, rotation, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLUMNS}`,
			[data.wardId, data.label, data.x ?? null, data.y ?? null, data.rotation, data.active]
		)
		return rowToWardBed(result.rows[0])
	},

	async update(id: string, data: UpdateWardBedInput): Promise<WardBed | null> {
		const fields: string[] = []
		const values: unknown[] = []
		let i = 1

		for (const [key, col] of Object.entries(FIELD_MAP)) {
			if (key in data) {
				fields.push(`${col} = $${i++}`)
				values.push((data as Record<string, unknown>)[key])
			}
		}

		if (fields.length === 0) return this.findById(id)

		values.push(id)
		const result = await db.query(
			`UPDATE public.ward_beds SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SELECT_COLUMNS}`,
			values
		)
		return result.rows[0] ? rowToWardBed(result.rows[0]) : null
	},

	async delete(id: string): Promise<boolean> {
		const result = await db.query('DELETE FROM ward_beds WHERE id = $1', [id])
		return (result.rowCount ?? 0) > 0
	},
}
