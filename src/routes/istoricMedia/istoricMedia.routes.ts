import { Router, Request, Response } from 'express'
import { mediaRepository, MediaType } from '../../repositories/istoricMedia/istoricMedia.repository'
import { s3Service } from '../../services/s3.service'

export const mediaRouter = Router()

const VALID_MEDIA_TYPES: MediaType[] = ['image', 'video', 'document']

function isValidMediaType(value: unknown): value is MediaType {
  return VALID_MEDIA_TYPES.includes(value as MediaType)
}

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

// GET /api/media/patient/:patientId
mediaRouter.get('/patient/:patientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { patientId } = req.params
    const { mediaType } = req.query

    if (mediaType !== undefined && !isValidMediaType(mediaType)) {
      res.status(400).json({ error: `Invalid mediaType. Must be one of: ${VALID_MEDIA_TYPES.join(', ')}` })
      return
    }

    const items = await mediaRepository.findByPatient(patientId, mediaType as MediaType | undefined)

    const itemsWithUrls = await Promise.all(
      items.map(async (item) => ({
        ...item,
        downloadUrl: await s3Service.getPresignedDownloadUrl(item.mediaURL),
      }))
    )

    res.json({ items: itemsWithUrls })
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/media/presign — must be before POST / to avoid route conflicts
mediaRouter.post('/presign', async (req: Request, res: Response): Promise<void> => {
  try {
    const { patientId, mediaType, fileName, contentType } = req.body

    if (!patientId || !mediaType || !fileName || !contentType) {
      res.status(400).json({ error: 'Missing required fields: patientId, mediaType, fileName, contentType' })
      return
    }

    if (!isValidMediaType(mediaType)) {
      res.status(400).json({ error: `Invalid mediaType. Must be one of: ${VALID_MEDIA_TYPES.join(', ')}` })
      return
    }

    const result = await s3Service.getPresignedUploadUrl(patientId, mediaType, fileName, contentType)
    res.json(result)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Invalid content type')) {
      res.status(400).json({ error: err.message })
      return
    }
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/media
mediaRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { mediaName, mediaURL, mediaType, dataDocument, notite, createdAccount, zkIDPacientF } = req.body

    if (!mediaName || !mediaURL || !mediaType || !dataDocument || !createdAccount || !zkIDPacientF) {
      res.status(400).json({ error: 'Missing required fields: mediaName, mediaURL, mediaType, dataDocument, createdAccount, zkIDPacientF' })
      return
    }

    if (!isValidMediaType(mediaType)) {
      res.status(400).json({ error: `Invalid mediaType. Must be one of: ${VALID_MEDIA_TYPES.join(', ')}` })
      return
    }

    const media = await mediaRepository.create(req.body)

    // Attach downloadUrl so the frontend can display immediately after upload
    const mediaWithUrl = {
      ...media,
      downloadUrl: await s3Service.getPresignedDownloadUrl(media.mediaURL),
    }

    res.status(201).json(mediaWithUrl)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/media/:id
mediaRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { mediaType } = req.body

    if (mediaType !== undefined && !isValidMediaType(mediaType)) {
      res.status(400).json({ error: `Invalid mediaType. Must be one of: ${VALID_MEDIA_TYPES.join(', ')}` })
      return
    }

    if (!req.body.modificationAccount) {
      res.status(400).json({ error: 'modificationAccount is required for updates' })
      return
    }

    const media = await mediaRepository.update(req.params.id, req.body)
    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    const mediaWithUrl = {
      ...media,
      downloadUrl: await s3Service.getPresignedDownloadUrl(media.mediaURL),
    }

    res.json(mediaWithUrl)
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/media/:id
mediaRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const media = await mediaRepository.findById(req.params.id)
    if (!media) {
      res.status(404).json({ error: 'Media not found' })
      return
    }

    await s3Service.deleteFile(media.mediaURL)

    const deleted = await mediaRepository.delete(req.params.id)
    if (!deleted) {
      res.status(404).json({ error: 'Media not found' })
      return
    }
    res.status(204).send()
  } catch (err) {
    logRequestError(req, err)
    res.status(500).json({ error: 'Internal server error' })
  }
})