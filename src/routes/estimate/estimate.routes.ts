import { Router, Request, Response } from 'express'
import { estimateRepository, SortCursor } from '../../repositories/estimate/estimate.repository'
import { createEstimateSchema, estimateListQuerySchema, updateEstimateSchema } from '../../schemas/estimate.schema'
import { validate } from '../../middleware/validate'

export const estimateRouter = Router()

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
	const createdAt = query.cursorCreatedAt as string | undefined
	if (!sortKey || !id || !createdAt) return undefined

	switch (sortKey) {
		case 'default':
			return { sortKey: 'default', createdAt, id }
		case 'patientName':
			if (query.cursorPatientName !== undefined)
				return { sortKey: 'patientName', patientName: String(query.cursorPatientName), createdAt, id }
			break
		case 'doctorName':
			if (query.cursorDoctorName !== undefined)
				return { sortKey: 'doctorName', doctorName: String(query.cursorDoctorName), createdAt, id }
			break
		case 'moduleName':
			if (query.cursorModuleName !== undefined)
				return { sortKey: 'moduleName', moduleName: String(query.cursorModuleName), createdAt, id }
			break
		case 'serviceName':
			if (query.cursorServiceName !== undefined)
				return { sortKey: 'serviceName', serviceName: String(query.cursorServiceName), createdAt, id }
			break
		case 'categoryName':
			if (query.cursorCategoryName !== undefined)
				return { sortKey: 'categoryName', categoryName: String(query.cursorCategoryName), createdAt, id }
			break
	}
	return undefined
}

// GET /api/estimates
estimateRouter.get('/', async (req: Request, res: Response): Promise<void> => {
	try {
		const parsedQuery = estimateListQuerySchema.safeParse(req.query)
		if (!parsedQuery.success) {
			res.status(400).json({ error: 'Invalid estimate list query parameters', details: parsedQuery.error.flatten() })
			return
		}

		const query = parsedQuery.data
		const paginatedEstimates = await estimateRepository.list({
			...query,
			cursor: parseCursorFromQuery(req.query as Record<string, unknown>),
		})

		if (query.includeTotal !== false && !query.cursorId) {
			const { total } = await estimateRepository.count(query)
			res.json({ ...paginatedEstimates, total })
			return
		}

		res.json(paginatedEstimates)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

estimateRouter.get('/count', async (req: Request, res: Response): Promise<void> => {
	try {
		const parsedQuery = estimateListQuerySchema.safeParse(req.query)
		if (!parsedQuery.success) {
			res.status(400).json({ error: 'Invalid estimate count query parameters', details: parsedQuery.error.flatten() })
			return
		}
		const countResult = await estimateRepository.count(parsedQuery.data)
		res.json(countResult)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

estimateRouter.get('/count/approximate', async (_req: Request, res: Response): Promise<void> => {
	try {
		const total = await estimateRepository.approximateCount()
		res.json({ total })
	} catch (err) {
		logRequestError(_req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// GET /api/estimates/:id
estimateRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const estimate = await estimateRepository.findById(req.params.id)
		if (!estimate) {
			res.status(404).json({ error: 'Estimate not found' })
			return
		}
		res.json(estimate)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// POST /api/estimates
estimateRouter.post(
	'/',
	validate(createEstimateSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const estimate = await estimateRepository.create(req.body)
			res.status(201).json(estimate)
		} catch (err) {
			logRequestError(req, err)
			res.status(500).json({ error: 'Internal server error' })
		}
	}
)

async function handleUpdateEstimate(req: Request, res: Response): Promise<void> {
	try {
		const result = await estimateRepository.update(req.params.id, req.body)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Estimate not found' })
			return
		}
		if (result.status === 'conflict') {
			res.status(409).json({ error: 'Estimate was modified by another user. Reload and try again.' })
			return
		}
		res.json(result.estimate)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
}

// PATCH /api/estimates/:id
estimateRouter.patch('/:id', validate(updateEstimateSchema), handleUpdateEstimate)

// PUT /api/estimates/:id — compatibility alias for full update clients
estimateRouter.put('/:id', validate(updateEstimateSchema), handleUpdateEstimate)

// DELETE /api/estimates/:id
estimateRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const deleted = await estimateRepository.delete(req.params.id)
		if (!deleted) {
			res.status(404).json({ error: 'Estimate not found' })
			return
		}
		res.status(204).send()
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})
