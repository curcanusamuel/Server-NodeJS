import { Pool, PoolConfig } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function sanitizePostgresUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()

  // Fast path: already a valid URL.
  try {
    new URL(trimmed)
    return trimmed
  } catch {
    // Continue with a best-effort sanitize.
  }

  const schemeMatch = trimmed.match(/^(postgres|postgresql):\/\//i)
  if (!schemeMatch) return trimmed

  const scheme = schemeMatch[0]
  const withoutScheme = trimmed.slice(scheme.length)
  const firstSlash = withoutScheme.indexOf('/')
  const authority = firstSlash === -1 ? withoutScheme : withoutScheme.slice(0, firstSlash)
  const pathAndQuery = firstSlash === -1 ? '' : withoutScheme.slice(firstSlash)
  const atIndex = authority.lastIndexOf('@')

  if (atIndex === -1) return trimmed

  const credentials = authority.slice(0, atIndex)
  const hostPart = authority.slice(atIndex)
  const colonIndex = credentials.indexOf(':')

  if (colonIndex === -1) return trimmed

  const rawUser = credentials.slice(0, colonIndex)
  const rawPassword = credentials.slice(colonIndex + 1)
  const user = encodeURIComponent(safeDecode(rawUser))
  const password = encodeURIComponent(safeDecode(rawPassword))

  return `${scheme}${user}:${password}${hostPart}${pathAndQuery}`
}

function buildConfigFromUrl(rawUrl: string): PoolConfig | null {
  const sanitizedUrl = sanitizePostgresUrl(rawUrl)
  let parsed: URL

  try {
    parsed = new URL(sanitizedUrl)
  } catch {
    return null
  }

  const databaseName = parsed.pathname.replace(/^\//, '') || 'postgres'
  const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'

  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 5432,
    database: decodeURIComponent(databaseName),
    user: safeDecode(parsed.username),
    password: safeDecode(parsed.password),
    ssl: { rejectUnauthorized: sslRejectUnauthorized },
  }
}

const mode = process.env.DB_CONNECTION_MODE?.toLowerCase()
const selectedUrlByMode =
  mode === 'pooler'
    ? process.env.DATABASE_URL_POOLER
    : mode === 'direct'
      ? process.env.DATABASE_URL_DIRECT
      : undefined

const rawConnectionString =
  selectedUrlByMode ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.DATABASE_URL_DIRECT ||
  process.env.DATABASE_URL_POOLER

const configFromUrl = rawConnectionString ? buildConfigFromUrl(rawConnectionString) : null

const config: PoolConfig = configFromUrl
  ? configFromUrl
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'ids_clinic',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
    }

export const db = new Pool(config)

db.on('error', (err) => {
  console.error('Unexpected DB error', err)
  process.exit(1)
})
