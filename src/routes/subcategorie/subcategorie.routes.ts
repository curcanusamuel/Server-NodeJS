import { Router, Request, Response } from 'express'
import { subcategorieRepository } from '../../repositories/subcategorie/subcategorie.repository'
import { createSubcategorieSchema, updateSubcategorieSchema, subcategorieListQuerySchema } from '../../schemas/subcategorie.schema'
import { validate } from '../../middleware/validate'

export const subcategorieRouter = Router()

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

// GET /api/subcategorie
subcategorieRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedQuery = subcategorieListQuerySchema.safeParse(req.query)
    if (!parsedQuery.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: parsedQuery.error.flatten(),
      })
      return
    }
    const subcategorii = await subcategorieRepository.findAll(parsedQuery.data)
    res.json(subcategorii)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/subcategorie/:id
subcategorieRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const subcategorie = await subcategorieRepository.findById(req.params.id)
    if (!subcategorie) {
      res.status(404).json({ error: 'Subcategorie not found' })
      return
    }
    res.json(subcategorie)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/subcategorie
subcategorieRouter.post(
  '/',
  validate(createSubcategorieSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const subcategorie = await subcategorieRepository.create(req.body)
      res.status(201).json(subcategorie)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// PATCH /api/subcategorie/:id
subcategorieRouter.patch(
  '/:id',
  validate(updateSubcategorieSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await subcategorieRepository.update(req.params.id, req.body)
      if (result.status === 'not_found') {
        res.status(404).json({ error: 'Subcategorie not found' })
        return
      }
      if (result.status === 'conflict') {
        res.status(409).json({ error: 'Subcategoria a fost modificat de alt utilizator. Reîncarcă pagina și încearcă din nou.' })
        return
      }
      res.json(result.subcategorie)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// DELETE /api/subcategorie/:id
subcategorieRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await subcategorieRepository.delete(req.params.id)
    if (!deleted) {
      res.status(404).json({ error: 'Subcategorie not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
