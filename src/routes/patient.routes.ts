import { Router, Request, Response } from 'express'
import { patientRepository } from '../repositories/patient.repository'
import { createPatientSchema, updatePatientSchema, verificationSchema } from '../schemas/patient.schema'
import { validate } from '../middleware/validate'

export const patientRouter = Router()

async function handleUpdatePatient(req: Request, res: Response): Promise<void> {
  try {
    const result = await patientRepository.update(req.params.id, req.body)
    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Patient not found' })
      return
    }
    if (result.status === 'verified') {
      res.status(403).json({ error: 'Pacientii validati nu pot fi modificati' })
      return
    }
    res.json(result.patient)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleUpdatePatientVerification(req: Request, res: Response): Promise<void> {
  try {
    const patient = await patientRepository.updateVerification(req.params.id, req.body.isVerified)
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' })
      return
    }
    res.json(patient)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/patients — list all, or search with ?q=
patientRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string | undefined
    const patients = query
      ? await patientRepository.search(query)
      : await patientRepository.findAll()
    res.json(patients)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/patients/navigation/first?q=
patientRouter.get('/navigation/first', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string | undefined
    const navigation = await patientRepository.findFirstNavigation(query)
    res.json(navigation)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/patients/navigation/:id?q=
patientRouter.get('/navigation/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string | undefined
    const navigation = await patientRepository.findNavigationById(req.params.id, query)
    if (!navigation || !navigation.patient) {
      res.status(404).json({ error: 'Patient not found' })
      return
    }
    res.json(navigation)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/patients/:id
patientRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const patient = await patientRepository.findById(req.params.id)
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' })
      return
    }
    res.json(patient)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/patients — create
patientRouter.post(
  '/',
  validate(createPatientSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Check for duplicate CNP
      const existing = await patientRepository.findByCNP(req.body.codCNP)
      if (existing) {
        res.status(409).json({ error: 'Un pacient cu acest CNP există deja' })
        return
      }
      const patient = await patientRepository.create(req.body)
      res.status(201).json(patient)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// PATCH /api/patients/:id — partial update
patientRouter.patch(
  '/:id',
  validate(updatePatientSchema),
  handleUpdatePatient
)

// PUT /api/patients/:id — compatibility alias for full update clients
patientRouter.put(
  '/:id',
  validate(updatePatientSchema),
  handleUpdatePatient
)

// PATCH /api/patients/:id/verification — toggle verification
patientRouter.patch(
  '/:id/verification',
  validate(verificationSchema),
  handleUpdatePatientVerification
)

// DELETE /api/patients/:id
patientRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await patientRepository.delete(req.params.id)
    if (!deleted) {
      res.status(404).json({ error: 'Patient not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
