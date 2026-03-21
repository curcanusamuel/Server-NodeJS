import { Pool, PoolConfig } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value == null) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return undefined
}

const host = process.env.DB_HOST || 'localhost'
const explicitSsl = parseBooleanEnv(process.env.DB_SSL)
const shouldUseSsl = explicitSsl ?? !isLocalHost(host)
const rejectUnauthorized = parseBooleanEnv(process.env.DB_SSL_REJECT_UNAUTHORIZED) ?? false

const config: PoolConfig = {
  host,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'ids_clinic',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: shouldUseSsl ? { rejectUnauthorized } : undefined,

  max: Number(process.env.DB_POOL_MAX) || 20,
  min: Number(process.env.DB_POOL_MIN) || 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
  statement_timeout: 15_000,  // kill runaway queries
  query_timeout: 15_000,
}

export const db = new Pool(config)

if (process.env.NODE_ENV !== 'production') {
  db.on('connect', () => console.log('[db] new client connected to pool'))
}

db.on('error', (err) => {
  console.error('Unexpected DB pool client error', err)
  // Don't exit — pg will remove the broken client from the pool automatically
})
