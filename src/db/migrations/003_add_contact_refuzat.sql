-- Add contact_refuzat flag to patients table
-- psql -d ids_clinic -f src/db/migrations/003_add_contact_refuzat.sql

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS contact_refuzat BOOLEAN NOT NULL DEFAULT FALSE;
