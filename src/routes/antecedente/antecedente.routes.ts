import { Router, Request, Response } from 'express'
import { antecedenteRepository } from '../../repositories/antecedente/antecedente.repository'
import { createAntecedenteSchema, updateAntecedenteSchema } from '../../schemas/antecedente.schema'
import { validate } from '../../middleware/validate'

export const antecedenteRouter = Router()

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

// GET /api/antecedente/patient/:patientId — patient chart timeline
antecedenteRouter.get('/patient/:patientId', async (req: Request, res: Response): Promise<void> => {
	try {
		const records = await antecedenteRepository.findByPatientId(req.params.patientId)
		res.json(records)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// GET /api/antecedente/:id
antecedenteRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const record = await antecedenteRepository.findById(req.params.id)
		if (!record) {
			res.status(404).json({ error: 'Antecedente record not found' })
			return
		}
		res.json(record)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// POST /api/antecedente
antecedenteRouter.post(
	'/',
	validate(createAntecedenteSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const record = await antecedenteRepository.create(req.body)
			res.status(201).json(record)
		} catch (err) {
			logRequestError(req, err)
			res.status(500).json({ error: 'Internal server error' })
		}
	}
)

async function handleUpdateAntecedente(req: Request, res: Response): Promise<void> {
	try {
		const result = await antecedenteRepository.update(req.params.id, req.body)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Antecedente record not found' })
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

// PATCH /api/antecedente/:id
antecedenteRouter.patch('/:id', validate(updateAntecedenteSchema), handleUpdateAntecedente)

// PUT /api/antecedente/:id — compatibility alias for full update clients
antecedenteRouter.put('/:id', validate(updateAntecedenteSchema), handleUpdateAntecedente)

// DELETE /api/antecedente/:id
antecedenteRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const deleted = await antecedenteRepository.delete(req.params.id)
		if (!deleted) {
			res.status(404).json({ error: 'Antecedente record not found' })
			return
		}
		res.status(204).send()
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})
