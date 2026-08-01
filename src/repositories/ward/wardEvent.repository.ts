import { db } from '../../db/pool'
import { WardEvent } from '../../types/ward'
import { CreateWardEventInput } from '../../schemas/ward.schema'

const SELECT_COLUMNS = `
  id, ward_id, bed_id, patient_id, patient_name, user_id, user_name,
  event_type, created_at, description
`

function rowToWardEvent(row: Record<string, unknown>): WardEvent {
	return {
		id: row.id as string,
		wardId: row.ward_id as string,
		bedId: (row.bed_id as string | null) ?? null,
		patientId: (row.patient_id as string | null) ?? null,
		patientName: row.patient_name as string,
		userId: row.user_id as string,
		userName: row.user_name as string,
		eventType: row.event_type as WardEvent['eventType'],
		createdAt: row.created_at as Date,
		description: (row.description as string | null) ?? null,
	}
}

export const wardEventRepository = {
	// append-only log — no update/delete, matches ward_events having no version/deleted_at column
	async findByWardId(wardId: string, limit = 50): Promise<WardEvent[]> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM ward_events
       WHERE ward_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
			[wardId, Math.min(Math.max(limit, 1), 200)]
		)
		return result.rows.map(rowToWardEvent)
	},

	async findByPatientId(patientId: string): Promise<WardEvent[]> {
		const result = await db.query(
			`SELECT ${SELECT_COLUMNS} FROM ward_events
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
			[patientId]
		)
		return result.rows.map(rowToWardEvent)
	},

	async create(data: CreateWardEventInput): Promise<WardEvent> {
		const result = await db.query(
			`INSERT INTO public.ward_events (ward_id, bed_id, patient_id, patient_name, user_id, user_name, event_type, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SELECT_COLUMNS}`,
			[
				data.wardId,
				data.bedId ?? null,
				data.patientId ?? null,
				data.patientName,
				data.userId,
				data.userName,
				data.eventType,
				data.description ?? null,
			]
		)
		return rowToWardEvent(result.rows[0])
	},
}
