import { Router, Request, Response } from 'express'
import { patientRepository, SortCursor } from '../repositories/patient.repository'
import { createPatientSchema, patientListQuerySchema, updatePatientSchema, verificationSchema } from '../schemas/patient.schema'
import { validate } from '../middleware/validate'

export const patientRouter = Router()


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
    logRequestError(req, err)
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
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

function parseCursorFromQuery(query: Record<string, unknown>): SortCursor | undefined {
  const sortKey = query.cursorSortKey as string | undefined
  const id = query.cursorId as string | undefined
  if (!sortKey || !id) return undefined

  switch (sortKey) {
    case 'name':
      if (query.cursorNume && query.cursorPrenume)
        return { sortKey: 'name', nume: String(query.cursorNume), prenume: String(query.cursorPrenume), id }
      break
    case 'age':
      if (query.cursorVarsta)
        return { sortKey: 'age', varsta: Number(query.cursorVarsta), id }
      break
    case 'nid':
      if (query.cursorCod !== undefined)
        return { sortKey: 'nid', cod: String(query.cursorCod), pnCode: String(query.cursorPnCode ?? ''), id }
      break
    case 'locality':
      return { sortKey: 'locality', domiciliuLocalitate: query.cursorLocalitate ? String(query.cursorLocalitate) : null, id }
    case 'emailMobile':
      return { sortKey: 'emailMobile', email: query.cursorEmail ? String(query.cursorEmail) : null, id }
    case 'medicCurant':
      if (query.cursorMedicCurant)
        return { sortKey: 'medicCurant', medicCurant: String(query.cursorMedicCurant), id }
      break
    case 'medicFamilie':
      return { sortKey: 'medicFamilie', medicFamilieNume: query.cursorMedicFamilie ? String(query.cursorMedicFamilie) : null, id }
    case 'status':
      return { sortKey: 'status', isVerified: query.cursorIsVerified === 'true', id }
    case 'createdFrom':
      return { sortKey: 'createdFrom', sursaInformare: query.cursorSursaInformare ? String(query.cursorSursaInformare) : null, id }
    case 'default':
      if (query.cursorDate)
        return { sortKey: 'default', dataIntroducerii: String(query.cursorDate), id }
      break
  }
  return undefined
}

// GET /api/patients — list all, or search with ?q=
patientRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const requestStartTime = Date.now()
  try {
    const parsedQuery = patientListQuerySchema.safeParse(req.query)

    if (!parsedQuery.success) {
      res.status(400).json({
        error: 'Invalid patient list query parameters',
        details: parsedQuery.error.flatten(),
      })
      return
    }

    const query = parsedQuery.data
    console.log('[patients] GET /api/patients request', {
      durationMs: Date.now() - requestStartTime,
      query,
    })

    const paginatedPatients = await patientRepository.list({
      ...query,
      cursor: parseCursorFromQuery(req.query),
    })

    console.log('[patients] GET /api/patients response', {
      durationMs: Date.now() - requestStartTime,
      mode: 'paginated',
      itemCount: paginatedPatients.items.length,
      hasMore: paginatedPatients.hasMore,
      limit: paginatedPatients.limit,
      nextCursor: paginatedPatients.nextCursor,
    })

    res.json(paginatedPatients)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

patientRouter.get('/count', async (req: Request, res: Response): Promise<void> => {
  const requestStartTime = Date.now()
  try {
    const parsedQuery = patientListQuerySchema.safeParse(req.query)

    if (!parsedQuery.success) {
      res.status(400).json({
        error: 'Invalid patient count query parameters',
        details: parsedQuery.error.flatten(),
      })
      return
    }

    const query = parsedQuery.data
    console.log('[patients] GET /api/patients/count request', {
      durationMs: Date.now() - requestStartTime,
      query,
    })

    const countResult = await patientRepository.count(query)
    console.log('[patients] GET /api/patients/count response', {
      durationMs: Date.now() - requestStartTime,
      total: countResult.total,
    })

    res.json(countResult)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

patientRouter.get('/count/approximate', async (req: Request, res: Response): Promise<void> => {
  try {
    const total = await patientRepository.approximateCount()
    res.json({ total })
  } catch (err) {
    logRequestError(req, err)
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
    logRequestError(req, err)
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
    logRequestError(req, err)
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
    logRequestError(req, err)
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
      logRequestError(req, err)
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
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
