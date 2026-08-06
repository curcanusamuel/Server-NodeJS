#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path')
const dotenv = require('dotenv')
const { Pool } = require('pg')

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const TARGET_DATE = process.env.SEED_APPOINTMENT_DATE || '2026-08-06'
const DEFAULT_DAYS = 30
const DEFAULT_COUNT = 6000
const countArg = process.argv.find((arg) => arg.startsWith('--count='))
const dateArg = process.argv.find((arg) => arg.startsWith('--date='))
const daysArg = process.argv.find((arg) => arg.startsWith('--days='))
const dryRun = process.argv.includes('--dry-run')
const totalAppointments = Number(countArg ? countArg.split('=')[1] : DEFAULT_COUNT)
const targetDate = dateArg ? dateArg.split('=')[1] : TARGET_DATE
const totalDays = Number(daysArg ? daysArg.split('=')[1] : DEFAULT_DAYS)

if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
  throw new Error(`Invalid --date value: ${targetDate}. Expected YYYY-MM-DD.`)
}

if (!Number.isInteger(totalAppointments) || totalAppointments <= 0) {
  throw new Error(`Invalid --count value: ${totalAppointments}. Expected a positive integer.`)
}

if (!Number.isInteger(totalDays) || totalDays <= 0) {
  throw new Error(`Invalid --days value: ${totalDays}. Expected a positive integer.`)
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
  max: 10,
})

function addMinutes(hhmm, delta) {
  const [hour, minute] = hhmm.split(':').map(Number)
  const total = hour * 60 + minute + delta
  const normalized = ((total % 1440) + 1440) % 1440
  const nextHour = String(Math.floor(normalized / 60)).padStart(2, '0')
  const nextMinute = String(normalized % 60).padStart(2, '0')
  return `${nextHour}:${nextMinute}:00`
}

function addDays(isoDate, deltaDays) {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() + deltaDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

function receiptNumberForIndex(index, appointmentDate) {
  const normalizedDate = appointmentDate.replace(/-/g, '')
  return `R-${normalizedDate}-${String(index + 1).padStart(6, '0')}`
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
    `SELECT id, nume, prenume, nid, COALESCE(mobil, telefon, '') AS phone
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
            d.user_id,
            d.nume_doctor,
            u.username
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

async function main() {
  const client = await pool.connect()
  try {
    const creator = await fetchCreator(client)
    const patients = await fetchPatients(client)
    const doctors = await fetchDoctors(client)
    const services = await fetchServices(client)

    console.log(`Preparing ${totalAppointments} appointments from ${targetDate} across ${totalDays} days`)
    console.log(`Patients: ${patients.length}, Doctors: ${doctors.length}, Services: ${services.length}`)

    if (dryRun) {
      const samplePatient = patients[0]
      const sampleDoctor = doctors[0]
      const sampleService = services[0]
      const samplePrice = await resolvePrice(client, sampleService.service_id, sampleDoctor.id, targetDate)
      console.log({
        creator: creator.username,
        samplePatient: `${samplePatient.nume} ${samplePatient.prenume}`.trim(),
        sampleDoctor: sampleDoctor.nume_doctor,
        sampleService: sampleService.service_name,
        samplePrice,
      })
      return
    }

    await client.query('BEGIN')

    for (let index = 0; index < totalAppointments; index += 1) {
      const patient = patients[index % patients.length]
      const doctor = doctors[index % doctors.length]
      const service = services[index % services.length]
      const dayOffset = index % totalDays
      const appointmentDate = addDays(targetDate, dayOffset)
      const startMinutes = (index * 5) % (12 * 60)
      const startTime = addMinutes('08:00', startMinutes)
      const endTime = addMinutes(startTime.slice(0, 5), 5)
      const status = index % 5 === 0 ? 'no_answer' : 'confirmed'
      const resolvedPrice = await resolvePrice(client, service.service_id, doctor.id, appointmentDate)
      const paymentSource = firstPaymentSource(service)
      const operationPaid = paymentSource !== 'CAS' && index % 4 !== 0
      const paymentMethod = operationPaid ? paymentMethodForIndex(index) : null
      const receiptDate = operationPaid ? appointmentDate : null
      const receiptNumber = operationPaid ? receiptNumberForIndex(index, appointmentDate) : null

      const appointmentResult = await client.query(
        `INSERT INTO appointments (
          patient_id, patient_name, patient_nid, patient_phone,
          doctor_id, doctor_name, module_id, module_name,
          category_id, category_name, service_id, service_name,
          appointment_date, start_time, end_time, duration_minutes,
          status, notes, created_by_user_id, created_by_user_name
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20
        ) RETURNING id`,
        [
          patient.id,
          `${patient.nume} ${patient.prenume}`.trim(),
          patient.nid || '',
          patient.phone || '',
          doctor.id,
          doctor.nume_doctor,
          service.module_id,
          service.module_name,
          service.category_id,
          service.category_name,
          service.service_id,
          service.service_name,
          appointmentDate,
          startTime,
          endTime,
          5,
          status,
          `Seed ${targetDate} #${index + 1}`,
          creator.id,
          creator.username,
        ]
      )

      await client.query(
        `INSERT INTO estimates (
          appointment_id, patient_id, patient_name, patient_nid,
          doctor_id, doctor_name, module_id, module_name,
          category_id, category_name, service_id, service_name,
          price_id, price, payment_source, created_by_user_id
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16
        )`,
        [
          appointmentResult.rows[0].id,
          patient.id,
          `${patient.nume} ${patient.prenume}`.trim(),
          patient.nid || '',
          doctor.id,
          doctor.nume_doctor,
          service.module_id,
          service.module_name,
          service.category_id,
          service.category_name,
          service.service_id,
          service.service_name,
          resolvedPrice.priceId,
          resolvedPrice.price,
          paymentSource,
          creator.id,
        ]
      )

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
          appointmentDate,
          service.module_name,
          service.category_name,
          service.service_name,
          paymentSource,
          resolvedPrice.price,
          operationPaid,
          paymentMethod,
          receiptNumber,
          receiptDate,
          creator.id,
        ]
      )

      if (operationPaid) {
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
            appointmentResult.rows[0].id,
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
            `${appointmentDate}T12:00:00`,
            creator.id,
          ]
        )
      }

      if ((index + 1) % 500 === 0) {
        console.log(`Inserted ${index + 1}/${totalAppointments}`)
      }
    }

    await client.query('COMMIT')
    console.log(
      `Done. Inserted ${totalAppointments} appointments, ${totalAppointments} estimates, ${totalAppointments} operations and payments for paid operations from ${targetDate} across ${totalDays} days.`
    )
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
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
