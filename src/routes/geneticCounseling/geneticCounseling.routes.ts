import { Router, Request, Response } from 'express'
import { geneticCounselingRepository } from '../../repositories/geneticCounseling/geneticCounseling.repository'
import { createGeneticCounselingSchema, updateGeneticCounselingSchema } from '../../schemas/geneticCounseling.schema'
import { validate } from '../../middleware/validate'

export const geneticCounselingRouter = Router()

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

// GET /api/genetic-counseling/patient/:patientId — patient chart timeline
geneticCounselingRouter.get('/patient/:patientId', async (req: Request, res: Response): Promise<void> => {
	try {
		const records = await geneticCounselingRepository.findByPatientId(req.params.patientId)
		res.json(records)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// GET /api/genetic-counseling/:id
geneticCounselingRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const record = await geneticCounselingRepository.findById(req.params.id)
		if (!record) {
			res.status(404).json({ error: 'Genetic counseling record not found' })
			return
		}
		res.json(record)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// POST /api/genetic-counseling
geneticCounselingRouter.post(
	'/',
	validate(createGeneticCounselingSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const record = await geneticCounselingRepository.create(req.body)
			res.status(201).json(record)
		} catch (err) {
			logRequestError(req, err)
			res.status(500).json({ error: 'Internal server error' })
		}
	}
)

async function handleUpdateGeneticCounseling(req: Request, res: Response): Promise<void> {
	try {
		const result = await geneticCounselingRepository.update(req.params.id, req.body)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Genetic counseling record not found' })
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

// PATCH /api/genetic-counseling/:id
geneticCounselingRouter.patch('/:id', validate(updateGeneticCounselingSchema), handleUpdateGeneticCounseling)

// PUT /api/genetic-counseling/:id — compatibility alias for full update clients
geneticCounselingRouter.put('/:id', validate(updateGeneticCounselingSchema), handleUpdateGeneticCounseling)

// DELETE /api/genetic-counseling/:id
geneticCounselingRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const deleted = await geneticCounselingRepository.delete(req.params.id)
		if (!deleted) {
			res.status(404).json({ error: 'Genetic counseling record not found' })
			return
		}
		res.status(204).send()
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})
