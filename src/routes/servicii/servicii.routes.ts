import { Router, Request, Response } from 'express'
import { serviciiRepository } from '../../repositories/servicii/servicii.repository'
import { createServiciuSchema, updateServiciuSchema, serviciuListQuerySchema } from '../../schemas/servicii.schema'
import { validate } from '../../middleware/validate'

export const serviciiRouter = Router()

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

// GET /api/servicii
serviciiRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedQuery = serviciuListQuerySchema.safeParse(req.query)
    if (!parsedQuery.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: parsedQuery.error.flatten(),
      })
      return
    }
    const servicii = await serviciiRepository.findAll(parsedQuery.data)
    res.json(servicii)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/servicii/:id
serviciiRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const serviciu = await serviciiRepository.findById(req.params.id)
    if (!serviciu) {
      res.status(404).json({ error: 'Serviciu not found' })
      return
    }
    res.json(serviciu)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/servicii
serviciiRouter.post(
  '/',
  validate(createServiciuSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (req.body.codProcedura) {
        const existing = await serviciiRepository.findByCodProcedura(req.body.codProcedura)
        if (existing) {
          res.status(409).json({ error: 'Un serviciu cu acest cod de procedura exista deja' })
          return
        }
      }
      const serviciu = await serviciiRepository.create(req.body)
      res.status(201).json(serviciu)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// PATCH /api/servicii/:id
serviciiRouter.patch(
  '/:id',
  validate(updateServiciuSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await serviciiRepository.update(req.params.id, req.body)
      if (result.status === 'not_found') {
        res.status(404).json({ error: 'Serviciu not found' })
        return
      }
      res.json(result.serviciu)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// DELETE /api/servicii/:id
serviciiRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await serviciiRepository.delete(req.params.id)
    if (!deleted) {
      res.status(404).json({ error: 'Serviciu not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})