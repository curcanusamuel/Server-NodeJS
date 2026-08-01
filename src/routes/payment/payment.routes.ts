import { Router, Request, Response } from 'express'
import { paymentRepository, SortCursor } from '../../repositories/payment/payment.repository'
import { createPaymentSchema, paymentListQuerySchema, updatePaymentSchema } from '../../schemas/payment.schema'
import { validate } from '../../middleware/validate'

export const paymentRouter = Router()

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
		case 'amount':
			if (query.cursorAmount !== undefined)
				return { sortKey: 'amount', amount: Number(query.cursorAmount), createdAt, id }
			break
		case 'paymentSource':
			return {
				sortKey: 'paymentSource',
				paymentSource: query.cursorPaymentSource !== undefined ? String(query.cursorPaymentSource) : null,
				createdAt,
				id,
			}
		case 'paymentMethod':
			return {
				sortKey: 'paymentMethod',
				paymentMethod: query.cursorPaymentMethod !== undefined ? String(query.cursorPaymentMethod) : null,
				createdAt,
				id,
			}
		case 'receiptDate':
			return {
				sortKey: 'receiptDate',
				receiptDate: query.cursorReceiptDate !== undefined ? String(query.cursorReceiptDate) : null,
				createdAt,
				id,
			}
		case 'receiptNumber':
			return {
				sortKey: 'receiptNumber',
				receiptNumber: query.cursorReceiptNumber !== undefined ? String(query.cursorReceiptNumber) : null,
				createdAt,
				id,
			}
	}
	return undefined
}

// GET /api/payments
paymentRouter.get('/', async (req: Request, res: Response): Promise<void> => {
	try {
		const parsedQuery = paymentListQuerySchema.safeParse(req.query)
		if (!parsedQuery.success) {
			res.status(400).json({ error: 'Invalid payment list query parameters', details: parsedQuery.error.flatten() })
			return
		}

		const query = parsedQuery.data
		const paginatedPayments = await paymentRepository.list({
			...query,
			cursor: parseCursorFromQuery(req.query as Record<string, unknown>),
		})

		if (query.includeTotal !== false && !query.cursorId) {
			const { total } = await paymentRepository.count(query)
			res.json({ ...paginatedPayments, total })
			return
		}

		res.json(paginatedPayments)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

paymentRouter.get('/count', async (req: Request, res: Response): Promise<void> => {
	try {
		const parsedQuery = paymentListQuerySchema.safeParse(req.query)
		if (!parsedQuery.success) {
			res.status(400).json({ error: 'Invalid payment count query parameters', details: parsedQuery.error.flatten() })
			return
		}
		const countResult = await paymentRepository.count(parsedQuery.data)
		res.json(countResult)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

paymentRouter.get('/count/approximate', async (_req: Request, res: Response): Promise<void> => {
	try {
		const total = await paymentRepository.approximateCount()
		res.json({ total })
	} catch (err) {
		logRequestError(_req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// GET /api/payments/:id
paymentRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const payment = await paymentRepository.findById(req.params.id)
		if (!payment) {
			res.status(404).json({ error: 'Payment not found' })
			return
		}
		res.json(payment)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// POST /api/payments
paymentRouter.post(
	'/',
	validate(createPaymentSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const payment = await paymentRepository.create(req.body)
			res.status(201).json(payment)
		} catch (err) {
			logRequestError(req, err)
			res.status(500).json({ error: 'Internal server error' })
		}
	}
)

async function handleUpdatePayment(req: Request, res: Response): Promise<void> {
	try {
		const result = await paymentRepository.update(req.params.id, req.body)
		if (result.status === 'not_found') {
			res.status(404).json({ error: 'Payment not found' })
			return
		}
		if (result.status === 'conflict') {
			res.status(409).json({ error: 'Payment was modified by another user. Reload and try again.' })
			return
		}
		res.json(result.payment)
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
}

// PATCH /api/payments/:id
paymentRouter.patch('/:id', validate(updatePaymentSchema), handleUpdatePayment)

// PUT /api/payments/:id — compatibility alias for full update clients
paymentRouter.put('/:id', validate(updatePaymentSchema), handleUpdatePayment)

// DELETE /api/payments/:id
paymentRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
	try {
		const deleted = await paymentRepository.delete(req.params.id)
		if (!deleted) {
			res.status(404).json({ error: 'Payment not found' })
			return
		}
		res.status(204).send()
	} catch (err) {
		logRequestError(req, err)
		res.status(500).json({ error: 'Internal server error' })
	}
})
