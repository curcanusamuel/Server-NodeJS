import { Router, Request, Response } from 'express'
import { evolutionRepository } from '../../repositories/evolution/evolution.repository'
import { createEvolutionSchema, updateEvolutionSchema } from '../../schemas/evolution.schema'
import { validate } from '../../middleware/validate'

export const evolutionRouter = Router()

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

// GET /api/evolution - global evolution list
evolutionRouter.get('/', async (req: Request, res: Response): Promise<void> => {
	try {
		const records = await evolutionRepository.list({
			patient: typeof req.query.patient === 'string' ? req.query.patient : undefined,
			nid: typeof req.query.nid === 'string' ? req.query.nid : undefined,
			doctor: typeof req.query.doctor === 'string' ? req.query.doctor : undefined,
			currentDoctor: typeof req.query.currentDoctor === 'string' ? req.query.currentDoctor : undefined,
			dateStart: typeof req.query.dateStart === 'string' ? req.query.dateStart : undefined,
			dateEnd: typeof req.query.dateEnd === 'string' ? req.query.dateEnd : undefined,
			validOnly: req.query.validOnly === 'true',
			limit: req.query.limit ? Number(req.query.limit) : undefined,
			offset: req.query.offset ? Number(req.query.offset) : undefined,
		})
		res.json(records)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// GET /api/evolution/patient/:patientId — patient chart timeline
evolutionRouter.get('/patient/:patientId', async (req: Request, res: Response): Promise<void> => {
	try {
		const records = await evolutionRepository.findByPatientId(req.params.patientId)
		res.json(records)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// GET /api/evolution/:id
evolutionRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const record = await evolutionRepository.findById(req.params.id)
		if (!record) {
			res.status(404).json({ error: 'Evolution record not found' })
			return
		}
		res.json(record)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// POST /api/evolution
evolutionRouter.post(
	'/',
	validate(createEvolutionSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const record = await evolutionRepository.create(req.body)
			res.status(201).json(record)
		} catch (err) {
			logRequestError(req, err)
			res.status(500).json({ error: 'Internal server error' })
		}
	}
)

async function handleUpdateEvolution(req: Request, res: Response): Promise<void> {
	try {
		const result = await evolutionRepository.update(req.params.id, req.body)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Evolution record not found' })
			return
		}
		if (result.status === 'conflict') {
			res.status(409).json({ error: 'Record was modified by another user. Reload and try again.' })
			return
		}
		res.json(result.record)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
}

// PATCH /api/evolution/:id
evolutionRouter.patch('/:id', validate(updateEvolutionSchema), handleUpdateEvolution)

// PUT /api/evolution/:id — compatibility alias for full update clients
evolutionRouter.put('/:id', validate(updateEvolutionSchema), handleUpdateEvolution)

// DELETE /api/evolution/:id
evolutionRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const deleted = await evolutionRepository.delete(req.params.id)
		if (!deleted) {
			res.status(404).json({ error: 'Evolution record not found' })
			return
		}
		res.status(204).send()
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})
