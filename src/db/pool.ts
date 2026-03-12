import { Pool, PoolConfig } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL?.trim()

const config: PoolConfig = connectionString
  ? {
      connectionString,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'ids_clinic',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: { rejectUnauthorized: false },
    }

export const db = new Pool(config)

db.on('error', (err) => {
  console.error('Unexpected DB error', err)
  process.exit(1)
})
