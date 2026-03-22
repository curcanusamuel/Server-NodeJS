import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { db, initDb, sessionSecret } from './db/pool'
import { loadSettingsFromDb, getSettings } from './settingsService'
import { patientRouter } from './routes/patient.routes'
import authRoutes from './routes/auth/authRoutes'
import adminSettingsRoutes from './routes/admin/adminSettingsRoutes'
import adminAccountRoutes from './routes/admin/adminAccountsRoutes'
import clientSettingsRoutes from './routes/client/clientSettingsRoutes'

dotenv.config()

const PgSession = connectPgSimple(session)

const app = express()
const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '0.0.0.0'

// ── Middleware ──────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

// ── Start ────────────────────────────────────────────────────
initDb()
  .then(async () => {
    await loadSettingsFromDb().catch((err: Error) =>
      console.warn('[settings] could not load from DB, using defaults:', err.message)
    )

    // Session middleware (must be before routes)
    app.use(
      session({
        store: new PgSession({
          pool: db,
          tableName: 'session',
          createTableIfMissing: true,
        }),
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: getSettings().sessionTimeoutMinutes * 60 * 1000,
        },
      })
    )

    // Refresh cookie maxAge on every request
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.session) {
        req.session.cookie.maxAge = getSettings().sessionTimeoutMinutes * 60 * 1000
      }
      next()
    })

    // ── Routes ──────────────────────────────────────────────
    app.use('/auth', authRoutes)
    app.use('/api/admin', adminSettingsRoutes)
    app.use('/api/admin/accounts', adminAccountRoutes)
    app.use('/api/client', clientSettingsRoutes)
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

    app.listen(PORT, HOST, () => {
      let displayHost = HOST
      if (displayHost === '0.0.0.0') displayHost = 'your-machine-ip-or-localhost'
      console.log(`Server running on http://${displayHost}:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err)
    process.exit(1)
  })

export default app
