import { Router, Request, Response } from 'express'
import { moduleRepository } from '../../repositories/module/module.repository'
import { createModuleSchema, updateModuleSchema } from '../../schemas/module.schema'
import { validate } from '../../middleware/validate'

export const moduleRouter = Router()

function logRequestError(req: Request, err: unknown): void {
  console.error('[request error]', {
    method: req.method,
    path: req.path,
    params: req.params,
    body: req.body,
    error: err,
  })
}

// GET /api/modules
moduleRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const modules = await moduleRepository.findAll()
    res.json(modules)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/modules/:id
moduleRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const module = await moduleRepository.findById(req.params.id)
    if (!module) {
      res.status(404).json({ error: 'Module not found' })
      return
    }
    res.json(module)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/modules
moduleRouter.post(
  '/',
  validate(createModuleSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const module = await moduleRepository.create(req.body)
      res.status(201).json(module)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// PATCH /api/modules/:id
moduleRouter.patch(
  '/:id',
  validate(updateModuleSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await moduleRepository.update(req.params.id, req.body)
      if (result.status === 'not_found') {
        res.status(404).json({ error: 'Module not found' })
        return
      }
      if (result.status === 'conflict') {
        res.status(409).json({ error: 'Modulul a fost modificat de alt utilizator. Reîncarcă pagina și încearcă din nou.' })
        return
      }
      res.json(result.module)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// DELETE /api/modules/:id
moduleRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await moduleRepository.delete(req.params.id)
    if (!deleted) {
      res.status(404).json({ error: 'Module not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})