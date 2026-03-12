-- Run this once to create the patients table
-- psql -d ids_clinic -f src/db/migrations/001_create_patients.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS patients (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nume                      VARCHAR(100)  NOT NULL,
  prenume                   VARCHAR(100)  NOT NULL,
  nr                        VARCHAR(50)   NOT NULL DEFAULT '',
  cod                       VARCHAR(50)   NOT NULL DEFAULT '',
  varsta                    SMALLINT      NOT NULL CHECK (varsta >= 0 AND varsta <= 150),
  sex                       VARCHAR(20)   NOT NULL,
  tip_actului               VARCHAR(20)   NOT NULL,
  cod_cnp                   VARCHAR(13)   NOT NULL UNIQUE,
  buletin_serie             VARCHAR(10)   NOT NULL DEFAULT '',
  buletin_nr                VARCHAR(20)   NOT NULL DEFAULT '',
  eliberat_de               VARCHAR(100)  NOT NULL DEFAULT '',
  valabil_pana              DATE,
  data_nasterii             DATE          NOT NULL,
  cetatenie                 VARCHAR(50)   NOT NULL DEFAULT 'Romania',
  cetatenie2                VARCHAR(50)   NOT NULL DEFAULT '',
  ocupatie                  VARCHAR(100)  NOT NULL DEFAULT '',
  educatie                  VARCHAR(100)  NOT NULL DEFAULT '',
  loc_munca                 VARCHAR(200)  NOT NULL DEFAULT '',
  medic_initial             VARCHAR(100)  NOT NULL DEFAULT '',
  medic_curant              VARCHAR(100)  NOT NULL DEFAULT '',
  --medic_curant_id           UUID          REFERENCES doctors(id) ON DELETE SET NULL,
  data_prezentare           DATE          NOT NULL,
  varsta_prezentare         SMALLINT      NOT NULL CHECK (varsta_prezentare >= 0),
  pacient_oncologic         BOOLEAN       NOT NULL DEFAULT FALSE,
  localizare_icd            VARCHAR(20)   NOT NULL DEFAULT '',
  localizare_desc           VARCHAR(200)  NOT NULL DEFAULT '',
  observatii                TEXT          NOT NULL DEFAULT '',
  data_inregistrare         DATE,
  cauze_deces               TEXT,
  autor_fisa                VARCHAR(100)  NOT NULL DEFAULT '',
  data_introducerii         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  data_ultimei_modificari   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ultima_modificare_facuta_de VARCHAR(100) NOT NULL DEFAULT '',
  nr_pacienti_gasiti        INTEGER       NOT NULL DEFAULT 0,
  pn_code                   VARCHAR(50)   NOT NULL DEFAULT ''
);

-- Auto-update data_ultimei_modificari on every UPDATE
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_ultimei_modificari = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();
