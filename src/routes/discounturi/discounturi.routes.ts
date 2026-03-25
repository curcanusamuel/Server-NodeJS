import { Router, Request, Response } from 'express'
import { discounturiRepository } from '../../repositories/discounturi/discounturi.repository'
import { createDiscountSchema, updateDiscountSchema, discountListQuerySchema } from '../../schemas/discounturi.schema'
import { validate } from '../../middleware/validate'

export const discounturiRouter = Router()

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

// GET /api/discounturi
discounturiRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedQuery = discountListQuerySchema.safeParse(req.query)
    if (!parsedQuery.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: parsedQuery.error.flatten(),
      })
      return
    }
    const discounturi = await discounturiRepository.findAll(parsedQuery.data)
    res.json(discounturi)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/discounturi/active-price?servicuId=&doctorId=&date=
discounturiRouter.get('/active-price', async (req: Request, res: Response): Promise<void> => {
  try {
    const { servicuId, doctorId, date } = req.query

    if (!servicuId || !date) {
      res.status(400).json({ error: 'servicuId and date are required' })
      return
    }

    const pret = await discounturiRepository.getActivePrice(
      servicuId as string,
      (doctorId as string) ?? null,
      date as string
    )

    if (pret === null) {
      res.status(404).json({ error: 'No price found for this service' })
      return
    }

    res.json({ pret })
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/discounturi/:id
discounturiRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const discount = await discounturiRepository.findById(req.params.id)
    if (!discount) {
      res.status(404).json({ error: 'Discount not found' })
      return
    }
    res.json(discount)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/discounturi
discounturiRouter.post(
  '/',
  validate(createDiscountSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await discounturiRepository.create(req.body)
      if (result.status === 'overlap') {
        res.status(409).json({
          error: 'Exista deja un discount activ pentru aceasta perioada',
          conflictId: result.conflictId,
        })
        return
      }
      res.status(201).json(result.discount)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// PATCH /api/discounturi/:id
discounturiRouter.patch(
  '/:id',
  validate(updateDiscountSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await discounturiRepository.update(req.params.id, req.body)
      if (result.status === 'not_found') {
        res.status(404).json({ error: 'Discount not found' })
        return
      }
      if (result.status === 'overlap') {
        res.status(409).json({
          error: 'Exista deja un discount activ pentru aceasta perioada',
          conflictId: result.conflictId,
        })
        return
      }
      res.json(result.discount)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// DELETE /api/discounturi/:id
discounturiRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await discounturiRepository.delete(req.params.id)
    if (!deleted) {
      res.status(404).json({ error: 'Discount not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})