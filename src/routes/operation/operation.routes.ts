import { Router, Request, Response } from 'express'
import { operationRepository, SortCursor } from '../../repositories/operation/operation.repository'
import { createOperationSchema, operationListQuerySchema, updateOperationSchema } from '../../schemas/operation.schema'
import { validate } from '../../middleware/validate'

export const operationRouter = Router()

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
	const operationDate = query.cursorOperationDate as string | undefined
	if (!sortKey || !id || !operationDate) return undefined

	switch (sortKey) {
		case 'date':
			return { sortKey: 'date', operationDate, id }
		case 'patientName':
			if (query.cursorPatientName !== undefined)
				return { sortKey: 'patientName', patientName: String(query.cursorPatientName), operationDate, id }
			break
		case 'module':
			if (query.cursorModuleName !== undefined)
				return { sortKey: 'module', moduleName: String(query.cursorModuleName), operationDate, id }
			break
		case 'intervention':
			if (query.cursorInterventionName !== undefined)
				return { sortKey: 'intervention', interventionName: String(query.cursorInterventionName), operationDate, id }
			break
		case 'doctor':
			if (query.cursorDoctorName !== undefined)
				return { sortKey: 'doctor', doctorName: String(query.cursorDoctorName), operationDate, id }
			break
		case 'paymentSource':
			return {
				sortKey: 'paymentSource',
				paymentSource: query.cursorPaymentSource !== undefined ? String(query.cursorPaymentSource) : null,
				operationDate,
				id,
			}
		case 'price':
			if (query.cursorPrice !== undefined)
				return { sortKey: 'price', price: Number(query.cursorPrice), operationDate, id }
			break
		case 'receiptDate':
			return {
				sortKey: 'receiptDate',
				receiptDate: query.cursorReceiptDate !== undefined ? String(query.cursorReceiptDate) : null,
				operationDate,
				id,
			}
		case 'status':
			if (query.cursorPaid !== undefined)
				return { sortKey: 'status', paid: query.cursorPaid === 'true', operationDate, id }
			break
	}
	return undefined
}

// GET /api/operations
operationRouter.get('/', async (req: Request, res: Response): Promise<void> => {
	try {
		const parsedQuery = operationListQuerySchema.safeParse(req.query)
		if (!parsedQuery.success) {
			res.status(400).json({ error: 'Invalid operation list query parameters', details: parsedQuery.error.flatten() })
			return
		}

		const query = parsedQuery.data
		const paginatedOperations = await operationRepository.list({
			...query,
			cursor: parseCursorFromQuery(req.query as Record<string, unknown>),
		})

		if (query.includeTotal !== false && !query.cursorId) {
			const { total } = await operationRepository.count(query)
			res.json({ ...paginatedOperations, total })
			return
		}

		res.json(paginatedOperations)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

operationRouter.get('/count', async (req: Request, res: Response): Promise<void> => {
	try {
		const parsedQuery = operationListQuerySchema.safeParse(req.query)
		if (!parsedQuery.success) {
			res.status(400).json({ error: 'Invalid operation count query parameters', details: parsedQuery.error.flatten() })
			return
		}
		const countResult = await operationRepository.count(parsedQuery.data)
		res.json(countResult)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

operationRouter.get('/summary', async (req: Request, res: Response): Promise<void> => {
	try {
		const parsedQuery = operationListQuerySchema.safeParse(req.query)
		if (!parsedQuery.success) {
			res.status(400).json({ error: 'Invalid operation summary query parameters', details: parsedQuery.error.flatten() })
			return
		}
		const summary = await operationRepository.summary(parsedQuery.data)
		res.json(summary)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

operationRouter.get('/count/approximate', async (_req: Request, res: Response): Promise<void> => {
	try {
		const total = await operationRepository.approximateCount()
		res.json({ total })
	} catch (err) {
		logRequestError(_req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// GET /api/operations/:id
operationRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const operation = await operationRepository.findById(req.params.id)
		if (!operation) {
			res.status(404).json({ error: 'Operation not found' })
			return
		}
		res.json(operation)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// POST /api/operations
operationRouter.post(
	'/',
	validate(createOperationSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const operation = await operationRepository.create(req.body)
			res.status(201).json(operation)
		} catch (err) {
			logRequestError(req, err)
			res.status(500).json({ error: 'Internal server error' })
		}
	}
)

async function handleUpdateOperation(req: Request, res: Response): Promise<void> {
	try {
		const result = await operationRepository.update(req.params.id, req.body)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Operation not found' })
			return
		}
		if (result.status === 'conflict') {
			res.status(409).json({ error: 'Operation was modified by another user. Reload and try again.' })
			return
		}
		res.json(result.operation)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
}

// PATCH /api/operations/:id
operationRouter.patch('/:id', validate(updateOperationSchema), handleUpdateOperation)

// PUT /api/operations/:id — compatibility alias for full update clients
operationRouter.put('/:id', validate(updateOperationSchema), handleUpdateOperation)

// DELETE /api/operations/:id
operationRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const deleted = await operationRepository.delete(req.params.id)
		if (!deleted) {
			res.status(404).json({ error: 'Operation not found' })
			return
		}
		res.status(204).send()
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})
