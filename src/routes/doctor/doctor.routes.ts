import { Router, Request, Response } from 'express'
import { doctorRepository } from '../../repositories/doctor/doctor.repository'
import { createDoctorSchema, updateDoctorSchema } from '../../schemas/doctor.schema'
import { validate } from '../../middleware/validate'

export const doctorRouter = Router()

function logRequestError(req: Request, err: unknown): void {
  console.error('[request error]', {
    method: req.method,
    path: req.path,
    params: req.params,
    body: req.body,
    error: err,
  })
}

// GET /api/doctors
doctorRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const doctors = await doctorRepository.findAll()
    res.json(doctors)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/doctors/by-user/:userId
doctorRouter.get('/by-user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doctor = await doctorRepository.findByUserId(req.params.userId)
    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found for this user' })
      return
    }
    res.json(doctor)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/doctors/:id
doctorRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doctor = await doctorRepository.findById(req.params.id)
    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found' })
      return
    }
    res.json(doctor)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/doctors
doctorRouter.post(
  '/',
  validate(createDoctorSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // If a userId is provided, make sure it's not already linked to a doctor
      if (req.body.userId) {
        const existing = await doctorRepository.findByUserId(req.body.userId)
        if (existing) {
          res.status(409).json({ error: 'This user is already linked to a doctor' })
          return
        }
      }
      const doctor = await doctorRepository.create(req.body)
      res.status(201).json(doctor)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// PATCH /api/doctors/:id
doctorRouter.patch(
  '/:id',
  validate(updateDoctorSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await doctorRepository.update(req.params.id, req.body)
      if (result.status === 'not_found') {
        res.status(404).json({ error: 'Doctor not found' })
        return
      }
      if (result.status === 'user_taken') {
        res.status(409).json({ error: 'This user is already linked to another doctor' })
        return
      }
      res.json(result.doctor)
    } catch (err) {
      logRequestError(req, err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// DELETE /api/doctors/:id
doctorRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await doctorRepository.delete(req.params.id)
    if (!deleted) {
      res.status(404).json({ error: 'Doctor not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})