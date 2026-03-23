import rateLimit from 'express-rate-limit'

// 15 minutes
const WINDOW_15_MIN = 15 * 60 * 1000

// 60 minutes
const WINDOW_1_HOUR = 60 * 60 * 1000

// 1 minute
const WINDOW_1_MIN = 60 * 1000

export const apiLimiter = rateLimit({
  windowMs: WINDOW_15_MIN,
  max: 100,              // 100 requests per 15 min — general API
  standardHeaders: true,
  legacyHeaders: false,
})

export const authLimiter = rateLimit({
  windowMs: WINDOW_15_MIN,
  max: 10,               // 10 attempts per 15 min — login/register
  standardHeaders: true,
  legacyHeaders: false,
})

export const adminLimiter = rateLimit({
  windowMs: WINDOW_1_HOUR,
  max: 50,               // 50 requests per hour — admin panel
  standardHeaders: true,
  legacyHeaders: false,
})

export const searchLimiter = rateLimit({
  windowMs: WINDOW_1_MIN,
  max: 60,               // 60 requests per minute — live search, ~1 per keystroke
  standardHeaders: true,
  legacyHeaders: false,
})

// rateLimiter.ts
export const limiter = {
  api: apiLimiter,
  auth: authLimiter,
  admin: adminLimiter,
  search: searchLimiter,
}