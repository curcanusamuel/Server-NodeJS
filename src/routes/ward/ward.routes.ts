import { Router, Request, Response } from 'express'
import { wardRepository } from '../../repositories/ward/ward.repository'
import { wardBedRepository } from '../../repositories/ward/wardBed.repository'
import { wardBedAllocationRepository } from '../../repositories/ward/wardBedAllocation.repository'
import { guardRoomAssignmentRepository } from '../../repositories/ward/guardRoomAssignment.repository'
import { wardEventRepository } from '../../repositories/ward/wardEvent.repository'
import {
	createWardSchema, updateWardSchema,
	createWardBedSchema, updateWardBedSchema,
	createWardBedAllocationSchema, releaseWardBedAllocationSchema, updateWardBedAllocationSchema,
	createGuardRoomAssignmentSchema, dischargeGuardRoomAssignmentSchema, updateGuardRoomAssignmentSchema,
	createWardEventSchema, wardEventsQuerySchema, activeGuardRoomAssignmentsQuerySchema,
} from '../../schemas/ward.schema'
import { validate } from '../../middleware/validate'

export const wardRouter = Router()

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

// ── Wards ─────────────────────────────────────────────────────

wardRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
	try {
		res.json(await wardRepository.findAll())
	} catch (err) {
		logRequestError(_req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.post('/', validate(createWardSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const ward = await wardRepository.create(req.body)
		res.status(201).json(ward)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// ── Ward beds (nested under a ward) ──────────────────────────

wardRouter.get('/:wardId/beds', async (req: Request, res: Response): Promise<void> => {
	try {
		res.json(await wardBedRepository.findByWardId(req.params.wardId))
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// bed map: beds plus who's currently occupying each one
wardRouter.get('/:wardId/board', async (req: Request, res: Response): Promise<void> => {
	try {
		res.json(await wardBedRepository.findWithOccupantByWardId(req.params.wardId))
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.post('/:wardId/beds', async (req: Request, res: Response): Promise<void> => {
	const parsed = createWardBedSchema.safeParse({ ...req.body, wardId: req.params.wardId })
	if (!parsed.success) {
		res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
		return
	}
	try {
		const bed = await wardBedRepository.create(parsed.data)
		res.status(201).json(bed)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.patch('/beds/:id', validate(updateWardBedSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const bed = await wardBedRepository.update(req.params.id, req.body)
		if (!bed) {
			res.status(404).json({ error: 'Bed not found' })
			return
		}
		res.json(bed)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.delete('/beds/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const deleted = await wardBedRepository.delete(req.params.id)
		if (!deleted) {
			res.status(404).json({ error: 'Bed not found' })
			return
		}
		res.status(204).send()
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.get('/beds/:bedId/allocations/active', async (req: Request, res: Response): Promise<void> => {
	try {
		const allocation = await wardBedAllocationRepository.findActiveByBedId(req.params.bedId)
		res.json(allocation)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// ── Bed allocations ───────────────────────────────────────────

wardRouter.post('/allocations', validate(createWardBedAllocationSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const result = await wardBedAllocationRepository.create(req.body)
		if (result.status === 'bed_occupied') {
			res.status(409).json({ error: 'Bed already has an active occupant' })
			return
		}
		res.status(201).json(result.allocation)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.patch('/allocations/:id/release', validate(releaseWardBedAllocationSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const result = await wardBedAllocationRepository.release(req.params.id, req.body.releasedByUserId)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Active allocation not found' })
			return
		}
		res.json(result.allocation)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.patch('/allocations/:id', validate(updateWardBedAllocationSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const result = await wardBedAllocationRepository.update(req.params.id, req.body)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Allocation not found' })
			return
		}
		if (result.status === 'conflict') {
			res.status(409).json({ error: 'Allocation was modified by another user. Reload and try again.' })
			return
		}
		res.json(result.allocation)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.get('/allocations/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const allocation = await wardBedAllocationRepository.findById(req.params.id)
		if (!allocation) {
			res.status(404).json({ error: 'Allocation not found' })
			return
		}
		res.json(allocation)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// ── Guard room assignments ────────────────────────────────────

wardRouter.get('/guard-room/assignments/active', async (req: Request, res: Response): Promise<void> => {
	const parsedQuery = activeGuardRoomAssignmentsQuerySchema.safeParse(req.query)
	if (!parsedQuery.success) {
		res.status(400).json({ error: 'Invalid query parameters', details: parsedQuery.error.flatten() })
		return
	}
	try {
		res.json(await guardRoomAssignmentRepository.findActive(parsedQuery.data.wardId))
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.post('/guard-room/assignments', validate(createGuardRoomAssignmentSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const result = await guardRoomAssignmentRepository.create(req.body)
		if (result.status === 'patient_already_assigned') {
			res.status(409).json({ error: 'Patient already has an active guard-room assignment' })
			return
		}
		res.status(201).json(result.assignment)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.patch('/guard-room/assignments/:id/discharge', validate(dischargeGuardRoomAssignmentSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const result = await guardRoomAssignmentRepository.discharge(req.params.id, req.body.dischargedByUserId)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Active assignment not found' })
			return
		}
		res.json(result.assignment)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.patch('/guard-room/assignments/:id', validate(updateGuardRoomAssignmentSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const result = await guardRoomAssignmentRepository.update(req.params.id, req.body)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Assignment not found' })
			return
		}
		if (result.status === 'conflict') {
			res.status(409).json({ error: 'Assignment was modified by another user. Reload and try again.' })
			return
		}
		res.json(result.assignment)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.get('/guard-room/assignments/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const assignment = await guardRoomAssignmentRepository.findById(req.params.id)
		if (!assignment) {
			res.status(404).json({ error: 'Assignment not found' })
			return
		}
		res.json(assignment)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// ── Patient-scoped lookups ─────────────────────────────────────

wardRouter.get('/patients/:patientId/allocations/active', async (req: Request, res: Response): Promise<void> => {
	try {
		res.json(await wardBedAllocationRepository.findActiveByPatientId(req.params.patientId))
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.get('/patients/:patientId/guard-room-assignment/active', async (req: Request, res: Response): Promise<void> => {
	try {
		res.json(await guardRoomAssignmentRepository.findActiveByPatientId(req.params.patientId))
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.get('/patients/:patientId/events', async (req: Request, res: Response): Promise<void> => {
	try {
		res.json(await wardEventRepository.findByPatientId(req.params.patientId))
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// ── Ward events (nested under a ward) ─────────────────────────

wardRouter.get('/:wardId/events', async (req: Request, res: Response): Promise<void> => {
	const parsedQuery = wardEventsQuerySchema.safeParse(req.query)
	if (!parsedQuery.success) {
		res.status(400).json({ error: 'Invalid query parameters', details: parsedQuery.error.flatten() })
		return
	}
	try {
		const events = await wardEventRepository.findByWardId(req.params.wardId, parsedQuery.data.limit)
		res.json(events)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.post('/:wardId/events', async (req: Request, res: Response): Promise<void> => {
	const parsed = createWardEventSchema.safeParse({ ...req.body, wardId: req.params.wardId })
	if (!parsed.success) {
		res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
		return
	}
	try {
		const event = await wardEventRepository.create(parsed.data)
		res.status(201).json(event)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// ── Ward by id (kept last: single dynamic segment, must not shadow the more specific routes above) ──

wardRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const ward = await wardRepository.findById(req.params.id)
		if (!ward) {
			res.status(404).json({ error: 'Ward not found' })
			return
		}
		res.json(ward)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.patch('/:id', validate(updateWardSchema), async (req: Request, res: Response): Promise<void> => {
	try {
		const ward = await wardRepository.update(req.params.id, req.body)
		if (!ward) {
			res.status(404).json({ error: 'Ward not found' })
			return
		}
		res.json(ward)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

wardRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const deleted = await wardRepository.delete(req.params.id)
		if (!deleted) {
			res.status(404).json({ error: 'Ward not found' })
			return
		}
		res.status(204).send()
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})
