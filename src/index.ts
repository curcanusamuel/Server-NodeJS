import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { patientRouter } from './routes/patient.routes'
import { db } from './db/pool'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// ── Middleware ──────────────────────────────────────────────
app.use(helmet())
app.use(cors())
app.use(express.json())

// ── Routes ──────────────────────────────────────────────────
app.use('/api/patients', patientRouter)

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await db.query('SELECT 1')
    res.json({ status: 'ok', db: 'connected' })
  } catch (err) {
    const error = err as Error
    res.status(503).json({ status: 'error', db: 'disconnected', message: error.message })
  }
})

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' })
})

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

export default app
