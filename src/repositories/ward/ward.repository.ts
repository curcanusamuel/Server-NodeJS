import { db } from '../../db/pool'
import { Ward } from '../../types/ward'
import { CreateWardInput, UpdateWardInput } from '../../schemas/ward.schema'

const SELECT_COLUMNS = 'id, name, type, unit, floor, sort_order, active'

const FIELD_MAP: Record<string, string> = {
	name: 'name',
	type: 'type',
	unit: 'unit',
	floor: 'floor',
	sortOrder: 'sort_order',
	active: 'active',
}

function rowToWard(row: Record<string, unknown>): Ward {
	return {
		id: row.id as string,
		name: row.name as string,
		type: row.type as Ward['type'],
		unit: (row.unit as string | null) ?? null,
		floor: (row.floor as string | null) ?? null,
		sortOrder: row.sort_order as number,
		active: Boolean(row.active),
	}
}

export const wardRepository = {
	async findAll(): Promise<Ward[]> {
		const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM wards ORDER BY sort_order ASC, name ASC`)
		return result.rows.map(rowToWard)
	},

	async findById(id: string): Promise<Ward | null> {
		const result = await db.query(`SELECT ${SELECT_COLUMNS} FROM wards WHERE id = $1`, [id])
		return result.rows[0] ? rowToWard(result.rows[0]) : null
	},

	async create(data: CreateWardInput): Promise<Ward> {
		const result = await db.query(
			`INSERT INTO public.wards (name, type, unit, floor, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLUMNS}`,
			[data.name, data.type, data.unit ?? null, data.floor ?? null, data.sortOrder, data.active]
		)
		return rowToWard(result.rows[0])
	},

	async update(id: string, data: UpdateWardInput): Promise<Ward | null> {
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
			`UPDATE public.wards SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SELECT_COLUMNS}`,
			values
		)
		return result.rows[0] ? rowToWard(result.rows[0]) : null
	},

	async delete(id: string): Promise<boolean> {
		const result = await db.query('DELETE FROM wards WHERE id = $1', [id])
		return (result.rowCount ?? 0) > 0
	},
}
