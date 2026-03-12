import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

console.log('Connecting to DB with:')
console.log('  host:', process.env.DB_HOST)
console.log('  port:', process.env.DB_PORT)
console.log('  db:  ', process.env.DB_NAME)
console.log('  user:', process.env.DB_USER)
console.log('  pass:', process.env.DB_PASSWORD ? '**set**' : 'NOT SET')

export const db = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'ids_clinic',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: { rejectUnauthorized: false },
})

db.on('error', (err) => {
  console.error('Unexpected DB error', err)
  process.exit(1)
})