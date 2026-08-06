#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path')
const readline = require('readline')
const dotenv = require('dotenv')
const { Pool } = require('pg')

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const CURRENT_DATE = process.env.SEED_OPERATION_DATE || '2026-08-06'
const DEFAULT_COUNT = 10000
const DEFAULT_CURRENT_YEAR_COUNT = 7000
const DEFAULT_PREVIOUS_YEAR_COUNT = 3000
const DEFAULT_CONCURRENCY = 12
const SESSION_MODE_MAX_CLIENTS = 15
const RESERVED_CONNECTION_SLOTS = 3
const EFFECTIVE_MAX_CONCURRENCY = Math.max(1, SESSION_MODE_MAX_CLIENTS - RESERVED_CONNECTION_SLOTS)
const countArg = process.argv.find((arg) => arg.startsWith('--count='))
const dateArg = process.argv.find((arg) => arg.startsWith('--date='))
const currentYearCountArg = process.argv.find((arg) => arg.startsWith('--current-year-count='))
const previousYearCountArg = process.argv.find((arg) => arg.startsWith('--previous-year-count='))
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='))
const dryRun = process.argv.includes('--dry-run')
const totalOperations = Number(countArg ? countArg.split('=')[1] : DEFAULT_COUNT)
const currentDate = dateArg ? dateArg.split('=')[1] : CURRENT_DATE
const currentYearTarget = Number(currentYearCountArg ? currentYearCountArg.split('=')[1] : DEFAULT_CURRENT_YEAR_COUNT)
const previousYearTarget = Number(previousYearCountArg ? previousYearCountArg.split('=')[1] : DEFAULT_PREVIOUS_YEAR_COUNT)
const requestedConcurrency = Number(concurrencyArg ? concurrencyArg.split('=')[1] : DEFAULT_CONCURRENCY)
const concurrency = Math.min(requestedConcurrency, EFFECTIVE_MAX_CONCURRENCY)

if (!/^\d{4}-\d{2}-\d{2}$/.test(currentDate)) {
  throw new Error(`Invalid --date value: ${currentDate}. Expected YYYY-MM-DD.`)
}

if (!Number.isInteger(totalOperations) || totalOperations <= 0) {
  throw new Error(`Invalid --count value: ${totalOperations}. Expected a positive integer.`)
}

if (!Number.isInteger(currentYearTarget) || currentYearTarget < 0) {
  throw new Error(`Invalid --current-year-count value: ${currentYearTarget}. Expected a non-negative integer.`)
}

if (!Number.isInteger(previousYearTarget) || previousYearTarget < 0) {
  throw new Error(`Invalid --previous-year-count value: ${previousYearTarget}. Expected a non-negative integer.`)
}

if (currentYearTarget + previousYearTarget !== totalOperations) {
  throw new Error(
    `Current-year (${currentYearTarget}) + previous-year (${previousYearTarget}) must equal total count (${totalOperations}).`
  )
}

if (!Number.isInteger(requestedConcurrency) || requestedConcurrency <= 0) {
  throw new Error("Invalid --concurrency value: " + requestedConcurrency + ". Expected a positive integer.")
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
    : undefined,
  max: SESSION_MODE_MAX_CLIENTS,
})

function addDays(isoDate, deltaDays) {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() + deltaDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function diffDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
}

function randomInt(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive)
}

function randomDateBetween(startDate, endDate) {
  const dayCount = diffDaysInclusive(startDate, endDate)
  return addDays(startDate, randomInt(dayCount))
}

function firstPaymentSource(service) {
  if (service.sursa_plata && typeof service.sursa_plata === 'string') {
    const token = service.sursa_plata
      .split(/[;,|/]+/)
      .map((item) => item.trim())
      .filter(Boolean)[0]
    if (token) return token
  }
  return service.is_cas ? 'CAS' : 'Privat'
}

function paymentMethodForIndex(index) {
  return index % 2 === 0 ? 'card' : 'cash'
}

function receiptNumberForIndex(index, operationDate) {
  const normalizedDate = operationDate.replace(/-/g, '')
  return `OP-${normalizedDate}-${String(index + 1).padStart(6, '0')}`
}

async function fetchCreator(client) {
  const result = await client.query(
    `SELECT id, username
     FROM app_user
     WHERE is_active = TRUE
     ORDER BY CASE WHEN role = 'ADMIN' THEN 0 ELSE 1 END, created_at ASC
     LIMIT 1`
  )
  if (!result.rows[0]) throw new Error('No active app_user found to use as creator.')
  return result.rows[0]
}

async function fetchPatients(client) {
  const result = await client.query(
    `SELECT id, nume, prenume, nid
     FROM patients
     WHERE deleted_at IS NULL
     ORDER BY data_introducerii ASC, id ASC`
  )
  if (result.rows.length === 0) throw new Error('No patients found.')
  return result.rows
}

async function fetchDoctors(client) {
  const result = await client.query(
    `SELECT d.zk_doctor_id_p AS id,
            d.nume_doctor,
            d.user_id
     FROM doctor d
     JOIN app_user u
       ON u.id = d.user_id
     WHERE d.deleted_at IS NULL
       AND d.is_disabled = FALSE
       AND u.role = 'DOCTOR'
       AND u.is_active = TRUE
     ORDER BY d.nume_doctor ASC`
  )
  if (result.rows.length === 0) throw new Error('No active doctors linked to active DOCTOR accounts found.')
  return result.rows
}

async function fetchServices(client) {
  const result = await client.query(
    `SELECT s.zk_preturi_id_p AS service_id,
            s.nume AS service_name,
            s.zk_idmodule_f AS module_id,
            m.nume_modul AS module_name,
            s.zk_idsubcategorie_f AS category_id,
            c.nume_subcategorie AS category_name,
            s.firma,
            s.pret_baza,
            s.sursa_plata,
            s.is_cas
     FROM servicii s
     JOIN module m
       ON m.zk_idmodule_p = s.zk_idmodule_f
      AND m.deleted_at IS NULL
      AND m.is_disabled = FALSE
     JOIN sub_categorie c
       ON c.zk_idsubcategorie_p = s.zk_idsubcategorie_f
      AND c.deleted_at IS NULL
      AND c.is_disabled = FALSE
     WHERE s.deleted_at IS NULL
       AND s.is_disabled = FALSE
     ORDER BY m.nume_modul ASC, c.nume_subcategorie ASC, s.nume ASC`
  )
  if (result.rows.length === 0) throw new Error('No active services found.')
  return result.rows
}

async function resolvePrice(client, serviceId, doctorId, date) {
  let result = await client.query(
    `SELECT zk_pret_variabil_id_p AS price_id, pret
     FROM discounturi
     WHERE zk_pret_id_f = $1
       AND type = 'promotie'
       AND is_disabled = FALSE
       AND deleted_at IS NULL
       AND start_date <= $2::date
       AND (end_date IS NULL OR end_date >= $2::date)
     ORDER BY start_date DESC
     LIMIT 1`,
    [serviceId, date]
  )
  if (result.rows[0]) return { priceId: result.rows[0].price_id, price: Number(result.rows[0].pret) }

  result = await client.query(
    `SELECT zk_pret_variabil_id_p AS price_id, pret
     FROM discounturi
     WHERE zk_pret_id_f = $1
       AND zk_doctor_id_f = $2
       AND type = 'doctor'
       AND is_disabled = FALSE
       AND deleted_at IS NULL
       AND start_date <= $3::date
       AND (end_date IS NULL OR end_date >= $3::date)
     ORDER BY start_date DESC
     LIMIT 1`,
    [serviceId, doctorId, date]
  )
  if (result.rows[0]) return { priceId: result.rows[0].price_id, price: Number(result.rows[0].pret) }

  result = await client.query(
    `SELECT zk_pret_variabil_id_p AS price_id, pret
     FROM discounturi
     WHERE zk_pret_id_f = $1
       AND type = 'baza'
       AND is_disabled = FALSE
       AND deleted_at IS NULL
       AND start_date <= $2::date
       AND (end_date IS NULL OR end_date >= $2::date)
     ORDER BY start_date DESC
     LIMIT 1`,
    [serviceId, date]
  )
  if (result.rows[0]) return { priceId: result.rows[0].price_id, price: Number(result.rows[0].pret) }

  result = await client.query(
    `SELECT zk_pret_variabil_id_p AS price_id, pret
     FROM discounturi
     WHERE zk_pret_id_f = $1
       AND type = 'baza'
       AND is_disabled = FALSE
       AND deleted_at IS NULL
     ORDER BY ABS(start_date - $2::date)
     LIMIT 1`,
    [serviceId, date]
  )
  if (result.rows[0]) return { priceId: result.rows[0].price_id, price: Number(result.rows[0].pret) }

  result = await client.query(
    `SELECT pret_baza
     FROM servicii
     WHERE zk_preturi_id_p = $1`,
    [serviceId]
  )
  return { priceId: null, price: result.rows[0] ? Number(result.rows[0].pret_baza) : 0 }
}

function buildOperationPlan({
  patients,
  doctors,
  services,
  currentYearCount,
  previousYearCount,
  currentDate,
}) {
  const plan = []
  const currentYearStart = `${currentDate.slice(0, 4)}-01-01`
  const previousYear = String(Number(currentDate.slice(0, 4)) - 1)
  const previousYearStart = `${previousYear}-01-01`
  const previousYearEnd = `${previousYear}-12-31`

  for (let index = 0; index < currentYearCount; index += 1) {
    plan.push({
      globalIndex: index,
      patient: patients[index % patients.length],
      doctor: doctors[index % doctors.length],
      service: services[index % services.length],
      operationDate: randomDateBetween(currentYearStart, currentDate),
    })
  }

  for (let index = 0; index < previousYearCount; index += 1) {
    const globalIndex = currentYearCount + index
    plan.push({
      globalIndex,
      patient: patients[globalIndex % patients.length],
      doctor: doctors[globalIndex % doctors.length],
      service: services[globalIndex % services.length],
      operationDate: randomDateBetween(previousYearStart, previousYearEnd),
    })
  }

  for (let index = plan.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    const current = plan[index]
    plan[index] = plan[swapIndex]
    plan[swapIndex] = current
  }

  return plan
}

async function insertOperationWithOptionalPayment(client, creator, planItem) {
  const { globalIndex, patient, doctor, service, operationDate } = planItem
  const resolvedPrice = await resolvePrice(client, service.service_id, doctor.id, operationDate)
  const paymentSource = firstPaymentSource(service)
  const paid = paymentSource !== 'CAS' && globalIndex % 4 !== 0
  const paymentMethod = paid ? paymentMethodForIndex(globalIndex) : null
  const receiptDate = paid ? operationDate : null
  const receiptNumber = paid ? receiptNumberForIndex(globalIndex, operationDate) : null

  const operationResult = await client.query(
    `INSERT INTO operations (
      price_id, patient_id, patient_name, patient_nid,
      doctor_id, doctor_name, company_id, company_name,
      operation_date, module_name, category_name, intervention_name,
      payment_source, price, paid, payment_method,
      receipt_number, receipt_date, created_by_user_id
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15, $16,
      $17, $18, $19
    ) RETURNING id`,
    [
      resolvedPrice.priceId,
      patient.id,
      `${patient.nume} ${patient.prenume}`.trim(),
      patient.nid || '',
      doctor.id,
      doctor.nume_doctor,
      null,
      service.firma || '',
      operationDate,
      service.module_name,
      service.category_name,
      service.service_name,
      paymentSource,
      resolvedPrice.price,
      paid,
      paymentMethod,
      receiptNumber,
      receiptDate,
      creator.id,
    ]
  )

  if (!paid) return { paid: false }

  await client.query(
    `INSERT INTO payments (
      operation_id, appointment_id, estimate_id, patient_id,
      patient_name, patient_nid, service_id, service_name,
      price_id, price, amount, payment_source,
      payment_method, receipt_number, receipt_date, paid,
      paid_at, created_by_user_id
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15, $16,
      $17, $18
    )`,
    [
      operationResult.rows[0].id,
      null,
      null,
      patient.id,
      `${patient.nume} ${patient.prenume}`.trim(),
      patient.nid || '',
      service.service_id,
      service.service_name,
      resolvedPrice.priceId,
      resolvedPrice.price,
      resolvedPrice.price,
      paymentSource,
      paymentMethod,
      receiptNumber,
      receiptDate,
      true,
      `${operationDate}T12:00:00`,
      creator.id,
    ]
  )

  return { paid: true }
}

async function processOperation(poolInstance, creator, item) {
  const client = await poolInstance.connect()

  try {
    await client.query('BEGIN')

    const result = await insertOperationWithOptionalPayment(client, creator, item)

    await client.query('COMMIT')
    return { insertedOperations: 1, insertedPayments: result.paid ? 1 : 0 }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

function renderProgress(insertedOperations, totalOps, insertedPayments) {
  const percent = totalOps > 0 ? ((insertedOperations / totalOps) * 100).toFixed(1) : '0.0'
  const line = `Progress: ${insertedOperations}/${totalOps} operations (${percent}%) | payments: ${insertedPayments}`
  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)
  process.stdout.write(line)
}

async function runWithConcurrency(items, workerCount, iterator) {
  let currentIndex = 0

  async function workerLoop(workerId) {
    while (currentIndex < items.length) {
      const nextIndex = currentIndex
      currentIndex += 1
      await iterator(items[nextIndex], workerId)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(workerCount, items.length) }, (_item, index) => workerLoop(index + 1))
  )
}

async function main() {
  const client = await pool.connect()
  try {
    const creator = await fetchCreator(client)
    const patients = await fetchPatients(client)
    const doctors = await fetchDoctors(client)
    const services = await fetchServices(client)

    const plan = buildOperationPlan({
      patients,
      doctors,
      services,
      currentYearCount: currentYearTarget,
      previousYearCount: previousYearTarget,
      currentDate,
    })
    console.log(`Preparing ${totalOperations} operations`)
    console.log(`Current year through ${currentDate}: ${currentYearTarget}`)
    console.log(`Previous year random dates: ${previousYearTarget}`)
    console.log(`Patients: ${patients.length}, Doctors: ${doctors.length}, Services: ${services.length}`)
    console.log("Concurrency: " + concurrency + " (requested: " + requestedConcurrency + ", DB cap: " + EFFECTIVE_MAX_CONCURRENCY + "), Insert mode: individual operations")

    if (dryRun) {
      const sample = plan[0]
      const samplePrice = await resolvePrice(client, sample.service.service_id, sample.doctor.id, sample.operationDate)
      console.log({
        creator: creator.username,
        samplePatient: `${sample.patient.nume} ${sample.patient.prenume}`.trim(),
        sampleDoctor: sample.doctor.nume_doctor,
        sampleService: sample.service.service_name,
        sampleOperationDate: sample.operationDate,
        samplePrice,
      })
      return
    }

    let insertedOperations = 0
    let insertedPayments = 0
    renderProgress(0, totalOperations, 0)

    await runWithConcurrency(plan, concurrency, async (item) => {
      const result = await processOperation(pool, creator, item)
      insertedOperations += result.insertedOperations
      insertedPayments += result.insertedPayments
      renderProgress(insertedOperations, totalOperations, insertedPayments)
    })

    process.stdout.write('\n')
    console.log(`Done. Inserted ${insertedOperations} operations and ${insertedPayments} payments.`)
  } catch (error) {
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
