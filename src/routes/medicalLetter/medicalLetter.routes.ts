import { Router, Request, Response } from 'express'
import { medicalLetterRepository } from '../../repositories/medicalLetter/medicalLetter.repository'
import {
  createMedicalLetterSchema,
  updateMedicalLetterSchema,
  validateMedicalLetterSchema,
  medicalLetterListQuerySchema,
} from '../../schemas/medicalLetter.schema'
import { validate } from '../../middleware/validate'

export const medicalLetterRouter = Router()

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

// GET /api/medical-letters
medicalLetterRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const queryResult = medicalLetterListQuerySchema.safeParse(req.query)
    if (!queryResult.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: queryResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      })
      return
    }
    const { items, nextCursor } = await medicalLetterRepository.findAll(queryResult.data)
    res.json({ items, nextCursor })
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/medical-letters/:id
medicalLetterRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const letter = await medicalLetterRepository.findById(req.params.id)
    if (!letter) {
      res.status(404).json({ error: 'Medical letter not found' })
      return
    }
    res.json(letter)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/medical-letters
medicalLetterRouter.post(
  '/',
  validate(createMedicalLetterSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const letter = await medicalLetterRepository.create(req.body)
      res.status(201).json(letter)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// PATCH /api/medical-letters/:id/validate
medicalLetterRouter.patch(
  '/:id/validate',
  validate(validateMedicalLetterSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await medicalLetterRepository.validate(req.params.id, req.body)
      if (result.status === 'not_found') {
        res.status(404).json({ error: 'Medical letter not found' })
        return
      }
      if (result.status === 'conflict') {
        res.status(409).json({ error: 'Scrisoarea a fost modificată de alt utilizator. Reîncarcă pagina și încearcă din nou.' })
        return
      }
      res.json(result.letter)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// PATCH /api/medical-letters/:id
medicalLetterRouter.patch(
  '/:id',
  validate(updateMedicalLetterSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await medicalLetterRepository.update(req.params.id, req.body)
      if (result.status === 'not_found') {
        res.status(404).json({ error: 'Medical letter not found' })
        return
      }
      if (result.status === 'conflict') {
        res.status(409).json({ error: 'Scrisoarea a fost modificată de alt utilizator. Reîncarcă pagina și încearcă din nou.' })
        return
      }
      res.json(result.letter)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// DELETE /api/medical-letters/:id
medicalLetterRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await medicalLetterRepository.delete(req.params.id)
    if (!deleted) {
      res.status(404).json({ error: 'Medical letter not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
