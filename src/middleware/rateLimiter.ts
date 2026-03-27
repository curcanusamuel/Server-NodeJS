import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { Request, Response, NextFunction } from 'express'

const WINDOW_15_MIN = 15 * 60 * 1000
const WINDOW_10_MIN = 10 * 60 * 1000
const WINDOW_1_HOUR = 60 * 60 * 1000
const WINDOW_1_MIN  = 60 * 1000

// Per-resource limiter: GET 100/min, write (POST/PUT/PATCH) 10/min, DELETE 10/min
// Each resource gets its own MemoryStore instances so counters are fully isolated.
function makeResourceLimiter(resource: string) {
  const getLimiter = rateLimit({
    windowMs: WINDOW_1_MIN,
    max: 100,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${resource}:get`,
    standardHeaders: true,
    legacyHeaders: false,
  })

  const writeLimiter = rateLimit({
    windowMs: WINDOW_1_MIN,
    max: 10,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${resource}:write`,
    standardHeaders: true,
    legacyHeaders: false,
  })

  const deleteLimiter = rateLimit({
    windowMs: WINDOW_1_MIN,
    max: 10,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${resource}:delete`,
    standardHeaders: true,
    legacyHeaders: false,
  })

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET')    return getLimiter(req, res, next)
    if (req.method === 'DELETE') return deleteLimiter(req, res, next)
    return writeLimiter(req, res, next)
  }
}

export const limiter = {
  auth:        rateLimit({ windowMs: WINDOW_10_MIN, max: 10, standardHeaders: true, legacyHeaders: false }),
  admin:       rateLimit({ windowMs: WINDOW_1_HOUR, max: 100, standardHeaders: true, legacyHeaders: false }),
  patients:    makeResourceLimiter('patients'),
  media:       makeResourceLimiter('media'),
  modules:     makeResourceLimiter('modules'),
  doctors:     makeResourceLimiter('doctors'),
  servicii:    makeResourceLimiter('servicii'),
  discounturi: makeResourceLimiter('discounturi'),
  subcategorie: makeResourceLimiter('subcategorie'),
  client:      makeResourceLimiter('client'),
}
