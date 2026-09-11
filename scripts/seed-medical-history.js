#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path')
const readline = require('readline')
const dotenv = require('dotenv')
const { Pool } = require('pg')

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const DEFAULT_EVOLUTION_COUNT = 6000
const DEFAULT_ANTECEDENTE_COUNT = 6000
const DEFAULT_BATCH_SIZE = 250
const DEFAULT_DATE = '2026-09-11'
const SEED_MARKER = '[seed-medical-history]'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const clean = args.includes('--clean')
const evolutionCount = numberArg('--evolutions', DEFAULT_EVOLUTION_COUNT)
const antecedenteCount = numberArg('--antecedente', DEFAULT_ANTECEDENTE_COUNT)
const batchSize = numberArg('--batch-size', DEFAULT_BATCH_SIZE)
const endDate = stringArg('--end-date', process.env.SEED_MEDICAL_HISTORY_END_DATE || DEFAULT_DATE)
const startDate = stringArg('--start-date', `${Number(endDate.slice(0, 4)) - 1}-01-01`)

if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
  throw new Error(`Invalid --start-date value: ${startDate}. Expected YYYY-MM-DD.`)
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
  throw new Error(`Invalid --end-date value: ${endDate}. Expected YYYY-MM-DD.`)
}

if (!Number.isInteger(evolutionCount) || evolutionCount < 0) {
  throw new Error(`Invalid --evolutions value: ${evolutionCount}. Expected a non-negative integer.`)
}

if (!Number.isInteger(antecedenteCount) || antecedenteCount < 0) {
  throw new Error(`Invalid --antecedente value: ${antecedenteCount}. Expected a non-negative integer.`)
}

if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 1000) {
  throw new Error(`Invalid --batch-size value: ${batchSize}. Expected 1..1000.`)
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
  max: 8,
})

function numberArg(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`))
  return Number(arg ? arg.split('=')[1] : fallback)
}

function stringArg(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`))
  return arg ? arg.slice(name.length + 1) : fallback
}

function randomInt(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive)
}

function pick(items) {
  return items[randomInt(items.length)]
}

function addDays(isoDate, deltaDays) {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() + deltaDays)
  return date.toISOString().slice(0, 10)
}

function diffDaysInclusive(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${toDate}T00:00:00`)
  return Math.floor((to.getTime() - from.getTime()) / 86400000) + 1
}

function randomDateBetween(fromDate, toDate) {
  return addDays(fromDate, randomInt(diffDaysInclusive(fromDate, toDate)))
}

function patientName(patient) {
  return `${patient.nume || ''} ${patient.prenume || ''}`.trim() || 'Pacient'
}

function generatedNote(index, text) {
  return `${SEED_MARKER} ${String(index + 1).padStart(5, '0')} ${text}`
}

async function fetchCreator(client) {
  const result = await client.query(
    `SELECT id, username
     FROM app_user
     WHERE is_active = TRUE
     ORDER BY CASE WHEN role = 'ADMIN' THEN 0 WHEN role = 'DOCTOR' THEN 1 ELSE 2 END, created_at ASC
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

function buildEvolution(index, patients, doctors, creator) {
  const patient = patients[index % patients.length]
  const doctor = doctors[(index + randomInt(doctors.length)) % doctors.length]
  const evolutionDate = randomDateBetween(startDate, endDate)
  const ecog = randomInt(4)
  const hasPain = index % 5 === 0
  const hasDyspnea = index % 7 === 0

  return {
    patient_id: patient.id,
    patient_name: patientName(patient),
    patient_nid: patient.nid || '',
    doctor_id: doctor.id,
    doctor_name: doctor.nume_doctor,
    evolution_date: evolutionDate,
    visit_type: pick(['Control periodic', 'Consultatie oncologica', 'Evaluare tratament', 'Monitorizare post-terapie']),
    consult_type: pick(['ambulator', 'control', 'reevaluare']),
    rte: pick(['yes', 'no', 'na']),
    ecog,
    normal_field_values: JSON.stringify({
      stareGenerala: 'stabila',
      tegumente: 'normal colorate',
      abdomen: 'suplu',
    }),
    objective_exam_text: pick([
      'Stare generala buna, constient, cooperant, afebril.',
      'Pacient stabil hemodinamic, fara semne clinice de urgenta.',
      'Examen obiectiv fara modificari semnificative fata de evaluarea anterioara.',
    ]),
    clinical_progress_signs: pick([
      'Fara semne clinice de progresie.',
      'Simptomatologie stationara sub tratamentul actual.',
      'Evolutie clinica favorabila, toleranta buna.',
    ]),
    clinical_progression: index % 11 === 0 ? 'yes' : 'no',
    adverse_events_since_last_visit: index % 6 === 0 ? 'Astenie usoara, greata ocazionala.' : null,
    adverse_events: index % 6 === 0 ? 'yes' : 'no',
    hypersensitivity_reactions: null,
    hypersensitivity: 'no',
    ekg_status: index % 9 === 0 ? 'patologic' : 'normal',
    ekg_details: index % 9 === 0 ? 'Modificari nespecifice, recomandata monitorizare.' : null,
    emotional_status: (index % 6) + 1,
    emotional_status_other: null,
    pain_evaluation: hasPain ? 'yes' : 'no',
    pain_intensity: hasPain ? (index % 6) + 1 : null,
    pain_localization: hasPain ? pick(['lombar', 'toracic', 'abdominal', 'articular']) : null,
    analgesic_medication: hasPain ? 'Paracetamol la nevoie' : null,
    analgesic_medication_used: hasPain ? 'yes' : 'na',
    analgesic_adverse_effects: null,
    constipation: index % 8 === 0 ? 'yes' : 'no',
    medication_change: index % 10 === 0 ? 'Ajustare simptomatica recomandata.' : null,
    medication_changed: index % 10 === 0 ? 'yes' : 'no',
    interactions_discussed: 'yes',
    dyspnea: hasDyspnea ? 'yes' : 'no',
    dyspnea_intensity: hasDyspnea ? (index % 5) + 1 : null,
    dyspnea_treatment: hasDyspnea ? 'Recomandata monitorizare si tratament simptomatic.' : null,
    dignicap: 'na',
    alopecia: index % 4 === 0 ? 'yes' : 'no',
    followed_oral_chemo: index % 3 === 0 ? 'yes' : 'na',
    missed_dose: index % 13 === 0 ? 'yes' : 'no',
    oral_chemo_notes: index % 3 === 0 ? 'Pacient instruit privind administrarea corecta.' : null,
    comments: generatedNote(index, 'Evolutie generata pentru testare cu pacient si medic real.'),
    is_validated: false,
    document_date: null,
    document_name: null,
    document_url: null,
    document_s3_key: null,
    media_item_id: null,
    created_by_user_id: creator.id,
  }
}

function buildAntecedente(index, patients, doctors, creator) {
  const patient = patients[(index * 3) % patients.length]
  const doctor = doctors[(index + randomInt(doctors.length)) % doctors.length]
  const antecedenteDate = randomDateBetween(startDate, endDate)
  const smoker = pick(['no', 'yes', 'past'])
  const hormonalStatus = pick(['premenopauza', 'perimenopauza', 'postmenopauza'])

  return {
    patient_id: patient.id,
    patient_name: patientName(patient),
    patient_nid: patient.nid || '',
    doctor_id: doctor.id,
    doctor_name: doctor.nume_doctor,
    antecedente_date: antecedenteDate,
    heredocolaterale: pick([
      'Fara antecedente heredocolaterale oncologice cunoscute.',
      'Antecedente familiale cardiovasculare mentionate.',
      'Istoric familial neconcludent, pacientul nu detine informatii complete.',
    ]),
    pregnancies: randomInt(4),
    births: randomInt(3),
    abortions: randomInt(2),
    breastfeeding: pick(['yes', 'no', 'na']),
    hormonal_status: hormonalStatus,
    menopause_date: hormonalStatus === 'postmenopauza' ? randomDateBetween('2010-01-01', '2024-12-31') : null,
    physiological_reason: pick([
      'Menstre regulate in antecedente.',
      'Fara acuze ginecologice actuale.',
      'Date fiziologice declarate de pacienta.',
    ]),
    pregnancy_test: 'na',
    pregnancy_test_date: null,
    contraception: pick(['no', 'yes', 'na']),
    contraception_notes: pick([null, 'Contraceptie declarata de pacienta.', 'Nu utilizeaza metode contraceptive.']),
    pathological_history: pick([
      'HTA esentiala in tratament.',
      'Fara antecedente patologice personale semnificative.',
      'Interventie chirurgicala in antecedente, fara complicatii declarate.',
      'Alergii medicamentoase negate.',
    ]),
    medication_consumption: pick([
      'Tratament cronic conform recomandarii medicului curant.',
      'Nu declara consum medicamentos cronic.',
      'Administrare ocazionala de antiinflamatoare.',
    ]),
    infertility_risk_info: pick(['yes', 'no', 'na']),
    smoker,
    smoking_type: smoker === 'no' ? null : randomInt(3) + 1,
    average_per_day: smoker === 'no' ? null : randomInt(15) + 1,
    years_smoked: smoker === 'no' ? null : randomInt(30) + 1,
    smoked_regularly: smoker,
    smoking_stop_date: smoker === 'past' ? randomDateBetween('2015-01-01', endDate) : null,
    chronic_ethanol_consumer: pick(['no', 'no', 'no', 'past', 'yes']),
    evolution_date: null,
    visit_type: null,
    consult_type: null,
    rte: null,
    ecog: null,
    normal_field_values: null,
    objective_exam_text: null,
    clinical_progress_signs: null,
    clinical_progression: null,
    adverse_events_since_last_visit: null,
    adverse_events: null,
    hypersensitivity_reactions: null,
    hypersensitivity: null,
    ekg_status: null,
    ekg_details: null,
    emotional_status: null,
    emotional_status_other: null,
    pain_evaluation: null,
    pain_intensity: null,
    pain_localization: null,
    analgesic_medication: null,
    analgesic_medication_used: null,
    analgesic_adverse_effects: null,
    constipation: null,
    medication_change: null,
    medication_changed: null,
    interactions_discussed: null,
    dyspnea: null,
    dyspnea_intensity: null,
    dyspnea_treatment: null,
    dignicap: null,
    alopecia: null,
    followed_oral_chemo: null,
    missed_dose: null,
    oral_chemo_notes: null,
    comments: generatedNote(index, 'Antecedente generate pentru testare cu pacient si medic real.'),
    is_validated: false,
    document_date: null,
    document_name: null,
    document_url: null,
    document_s3_key: null,
    media_item_id: null,
    created_by_user_id: creator.id,
  }
}

async function insertRows(client, tableName, rows) {
  if (rows.length === 0) return
  const columns = Object.keys(rows[0])
  const values = []
  const tuples = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column, columnIndex) => {
      values.push(row[column])
      return `$${rowIndex * columns.length + columnIndex + 1}`
    })
    return `(${placeholders.join(', ')})`
  })

  await client.query(
    `INSERT INTO public.${tableName} (${columns.join(', ')})
     VALUES ${tuples.join(', ')}`,
    values
  )
}

function renderProgress(label, inserted, total) {
  const percent = total > 0 ? ((inserted / total) * 100).toFixed(1) : '100.0'
  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)
  process.stdout.write(`${label}: ${inserted}/${total} (${percent}%)`)
}

async function seedTable(client, tableName, total, buildRow, patients, doctors, creator) {
  let inserted = 0
  renderProgress(tableName, 0, total)

  while (inserted < total) {
    const currentBatchSize = Math.min(batchSize, total - inserted)
    const rows = Array.from({ length: currentBatchSize }, (_item, offset) =>
      buildRow(inserted + offset, patients, doctors, creator)
    )
    await insertRows(client, tableName, rows)
    inserted += rows.length
    renderProgress(tableName, inserted, total)
  }

  process.stdout.write('\n')
}

async function cleanGeneratedRows(client) {
  const evolutionResult = await client.query(
    `UPDATE public.evolution
     SET deleted_at = NOW()
     WHERE comments LIKE $1
       AND deleted_at IS NULL`,
    [`${SEED_MARKER}%`]
  )
  const antecedenteResult = await client.query(
    `UPDATE public.antecedente
     SET deleted_at = NOW()
     WHERE comments LIKE $1
       AND deleted_at IS NULL`,
    [`${SEED_MARKER}%`]
  )
  console.log(`Cleaned generated rows: evolution=${evolutionResult.rowCount}, antecedente=${antecedenteResult.rowCount}`)
}

async function main() {
  const client = await pool.connect()

  try {
    if (clean) {
      await cleanGeneratedRows(client)
      return
    }

    const creator = await fetchCreator(client)
    const patients = await fetchPatients(client)
    const doctors = await fetchDoctors(client)

    console.log(`Patients: ${patients.length}`)
    console.log(`Doctors: ${doctors.length}`)
    console.log(`Creator: ${creator.username} (${creator.id})`)
    console.log(`Date range: ${startDate}..${endDate}`)
    console.log(`Planned: ${evolutionCount} evolution, ${antecedenteCount} antecedente`)

    if (dryRun) {
      console.log('Sample evolution:', buildEvolution(0, patients, doctors, creator))
      console.log('Sample antecedente:', buildAntecedente(0, patients, doctors, creator))
      return
    }

    await client.query('BEGIN')
    await seedTable(client, 'evolution', evolutionCount, buildEvolution, patients, doctors, creator)
    await seedTable(client, 'antecedente', antecedenteCount, buildAntecedente, patients, doctors, creator)
    await client.query('COMMIT')

    console.log(`Done. Inserted ${evolutionCount} evolution and ${antecedenteCount} antecedente records.`)
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
