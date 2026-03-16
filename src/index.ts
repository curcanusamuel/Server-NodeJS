import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { patientRouter } from './routes/patient.routes'
import { db } from './db/pool'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '0.0.0.0'

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
const server = app.listen(PORT, HOST, () => {
  const addr = server.address()
  let displayHost = HOST
  if (displayHost === '0.0.0.0') displayHost = 'your-machine-ip-or-localhost'
  console.log(`Server running on http://${displayHost}:${PORT}`)
})

export default app
