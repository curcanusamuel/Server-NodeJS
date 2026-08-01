import { Router, Request, Response } from 'express'
import { appointmentRepository, SortCursor } from '../../repositories/appointment/appointment.repository'
import { createAppointmentSchema, appointmentListQuerySchema, updateAppointmentSchema } from '../../schemas/appointment.schema'
import { validate } from '../../middleware/validate'

export const appointmentRouter = Router()

function logRequestError(req: Request, err: unknown): void {
	console.error('[request error]', {
		method: req.method,
		path: req.path,
		params: req.params,
		query: req.query,
		body: req.body,
		error: err,
	})
}

function parseCursorFromQuery(query: Record<string, unknown>): SortCursor | undefined {
	const sortKey = query.cursorSortKey as string | undefined
	const id = query.cursorId as string | undefined
	const appointmentDate = query.cursorAppointmentDate as string | undefined
	if (!sortKey || !id || !appointmentDate) return undefined

	switch (sortKey) {
		case 'date':
			if (query.cursorStartTime !== undefined)
				return { sortKey: 'date', appointmentDate, startTime: String(query.cursorStartTime), id }
			break
		case 'time':
			if (query.cursorStartTime !== undefined)
				return { sortKey: 'time', startTime: String(query.cursorStartTime), appointmentDate, id }
			break
		case 'patientNid':
			if (query.cursorPatientNid !== undefined)
				return { sortKey: 'patientNid', patientNid: String(query.cursorPatientNid), appointmentDate, id }
			break
		case 'patientName':
			if (query.cursorPatientName !== undefined)
				return { sortKey: 'patientName', patientName: String(query.cursorPatientName), appointmentDate, id }
			break
		case 'doctor':
			if (query.cursorDoctorName !== undefined)
				return { sortKey: 'doctor', doctorName: String(query.cursorDoctorName), appointmentDate, id }
			break
		case 'intervention':
			if (query.cursorServiceName !== undefined)
				return { sortKey: 'intervention', serviceName: String(query.cursorServiceName), appointmentDate, id }
			break
		case 'status':
			if (query.cursorStatus !== undefined)
				return { sortKey: 'status', status: String(query.cursorStatus), appointmentDate, id }
			break
	}
	return undefined
}

// GET /api/appointments
appointmentRouter.get('/', async (req: Request, res: Response): Promise<void> => {
	try {
		const parsedQuery = appointmentListQuerySchema.safeParse(req.query)
		if (!parsedQuery.success) {
			res.status(400).json({ error: 'Invalid appointment list query parameters', details: parsedQuery.error.flatten() })
			return
		}

		const query = parsedQuery.data
		const paginatedAppointments = await appointmentRepository.list({
			...query,
			cursor: parseCursorFromQuery(req.query as Record<string, unknown>),
		})

		if (query.includeTotal !== false && !query.cursorId) {
			const { total } = await appointmentRepository.count(query)
			res.json({ ...paginatedAppointments, total })
			return
		}

		res.json(paginatedAppointments)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

appointmentRouter.get('/count', async (req: Request, res: Response): Promise<void> => {
	try {
		const parsedQuery = appointmentListQuerySchema.safeParse(req.query)
		if (!parsedQuery.success) {
			res.status(400).json({ error: 'Invalid appointment count query parameters', details: parsedQuery.error.flatten() })
			return
		}
		const countResult = await appointmentRepository.count(parsedQuery.data)
		res.json(countResult)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

appointmentRouter.get('/count/approximate', async (_req: Request, res: Response): Promise<void> => {
	try {
		const total = await appointmentRepository.approximateCount()
		res.json({ total })
	} catch (err) {
		logRequestError(_req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// GET /api/appointments/:id
appointmentRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const appointment = await appointmentRepository.findById(req.params.id)
		if (!appointment) {
			res.status(404).json({ error: 'Appointment not found' })
			return
		}
		res.json(appointment)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// POST /api/appointments
appointmentRouter.post(
	'/',
	validate(createAppointmentSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const appointment = await appointmentRepository.create(req.body)
			res.status(201).json(appointment)
		} catch (err) {
			logRequestError(req, err)
			res.status(500).json({ error: 'Internal server error' })
		}
	}
)

async function handleUpdateAppointment(req: Request, res: Response): Promise<void> {
	try {
		const result = await appointmentRepository.update(req.params.id, req.body)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Appointment not found' })
			return
		}
		if (result.status === 'conflict') {
			res.status(409).json({ error: 'Appointment was modified by another user. Reload and try again.' })
			return
		}
		res.json(result.appointment)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
}

// PATCH /api/appointments/:id
appointmentRouter.patch('/:id', validate(updateAppointmentSchema), handleUpdateAppointment)

// PUT /api/appointments/:id — compatibility alias for full update clients
appointmentRouter.put('/:id', validate(updateAppointmentSchema), handleUpdateAppointment)

// DELETE /api/appointments/:id
appointmentRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const deleted = await appointmentRepository.delete(req.params.id)
		if (!deleted) {
			res.status(404).json({ error: 'Appointment not found' })
			return
		}
		res.status(204).send()
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})
