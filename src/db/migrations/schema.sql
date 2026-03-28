--
-- PostgreSQL database dump
--

\restrict rQoMDgdiPOyrjDBvUNDCNQxNM1gl9e2wkvreyOp4g6WckhMPNkLpdYdcfCTrntd

-- Dumped from database version 17.9 (Debian 17.9-1.pgdg13+1)
-- Dumped by pg_dump version 18.3 (Ubuntu 18.3-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: discount_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.discount_type AS ENUM (
    'promotie',
    'doctor',
    'baza'
);


ALTER TYPE public.discount_type OWNER TO postgres;

--
-- Name: media_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.media_type_enum AS ENUM (
    'image',
    'video',
    'document'
);


ALTER TYPE public.media_type_enum OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'ADMIN',
    'DOCTOR'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: patients_approx_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.patients_approx_count() RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
  SELECT reltuples::bigint
  FROM pg_class
  WHERE relname = 'patients';
$$;


ALTER FUNCTION public.patients_approx_count() OWNER TO postgres;

--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.data_ultimei_modificari = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_modified_column() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: app_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_user (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(50) NOT NULL,
    password_hash text NOT NULL,
    role public.user_role DEFAULT 'DOCTOR'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone
);


ALTER TABLE public.app_user OWNER TO postgres;

--
-- Name: client_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_settings (
    user_id uuid NOT NULL,
    dark_mode boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_settings OWNER TO postgres;

--
-- Name: discounturi; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discounturi (
    zk_pret_variabil_id_p uuid DEFAULT gen_random_uuid() NOT NULL,
    zk_pret_id_f uuid NOT NULL,
    zk_doctor_id_f uuid,
    numele_pretului character varying(200) NOT NULL,
    pret numeric(10,2) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    type public.discount_type NOT NULL,
    is_disabled boolean DEFAULT false NOT NULL,
    created_account character varying(100) NOT NULL,
    created_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    modification_account character varying(100),
    modification_timestamp timestamp with time zone,
    CONSTRAINT chk_discounturi_dates CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT chk_discounturi_doctor_type CHECK ((((type = 'doctor'::public.discount_type) AND (zk_doctor_id_f IS NOT NULL)) OR ((type <> 'doctor'::public.discount_type) AND (zk_doctor_id_f IS NULL))))
);


ALTER TABLE public.discounturi OWNER TO postgres;

--
-- Name: doctor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor (
    zk_doctor_id_p uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nume_doctor character varying(200) NOT NULL,
    is_disabled boolean DEFAULT false NOT NULL,
    created_account character varying(100) NOT NULL,
    created_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    modification_account character varying(100),
    modification_timestamp timestamp with time zone
);


ALTER TABLE public.doctor OWNER TO postgres;

--
-- Name: istoricmedia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.istoricmedia (
    zk_istoricmedia_p uuid DEFAULT gen_random_uuid() NOT NULL,
    medianame text NOT NULL,
    mediaurl text NOT NULL,
    mediatype public.media_type_enum NOT NULL,
    datadocument timestamp without time zone NOT NULL,
    notite text,
    createdaccount text NOT NULL,
    createdtimestamp timestamp without time zone DEFAULT now() NOT NULL,
    modificationaccount text,
    modificationtimestamp timestamp without time zone,
    zk_idmodul_f uuid,
    zk_idpacient_f uuid NOT NULL,
    zk_operatieid_f uuid
);


ALTER TABLE public.istoricmedia OWNER TO postgres;

--
-- Name: module; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.module (
    zk_idmodule_p uuid DEFAULT gen_random_uuid() NOT NULL,
    nume_modul character varying(100) NOT NULL,
    is_disabled boolean DEFAULT false NOT NULL,
    created_account character varying(100) NOT NULL,
    created_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    modification_account character varying(100),
    modification_timestamp timestamp with time zone
);


ALTER TABLE public.module OWNER TO postgres;

--
-- Name: patients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nume character varying(100) NOT NULL,
    prenume character varying(100) NOT NULL,
    nr character varying(50) DEFAULT ''::character varying NOT NULL,
    nid character varying(50) DEFAULT ''::character varying NOT NULL,
    varsta smallint NOT NULL,
    sex character varying(20) NOT NULL,
    tip_actului character varying(20) NOT NULL,
    cod_cnp character varying(13) NOT NULL,
    buletin_serie character varying(10) DEFAULT ''::character varying NOT NULL,
    buletin_nr character varying(20) DEFAULT ''::character varying NOT NULL,
    eliberat_de character varying(100) DEFAULT ''::character varying NOT NULL,
    valabil_pana date,
    data_nasterii date NOT NULL,
    cetatenie character varying(50) DEFAULT 'RO'::character varying NOT NULL,
    cetatenie2 character varying(50) DEFAULT ''::character varying NOT NULL,
    ocupatie character varying(100) DEFAULT ''::character varying NOT NULL,
    educatie character varying(100) DEFAULT ''::character varying NOT NULL,
    loc_munca character varying(200) DEFAULT ''::character varying NOT NULL,
    medic_initial character varying(100) DEFAULT ''::character varying NOT NULL,
    medic_curant character varying(100) DEFAULT ''::character varying NOT NULL,
    data_prezentare date NOT NULL,
    varsta_prezentare smallint NOT NULL,
    pacient_oncologic boolean DEFAULT false NOT NULL,
    localizare_icd character varying(20) DEFAULT ''::character varying NOT NULL,
    localizare_desc character varying(200) DEFAULT ''::character varying NOT NULL,
    observatii text DEFAULT ''::text NOT NULL,
    data_inregistrare date,
    cauze_deces text,
    autor_fisa character varying(100) DEFAULT ''::character varying NOT NULL,
    data_introducerii timestamp with time zone DEFAULT now() NOT NULL,
    data_ultimei_modificari timestamp with time zone DEFAULT now() NOT NULL,
    ultima_modificare_facuta_de character varying(100) DEFAULT ''::character varying NOT NULL,
    nr_pacienti_gasiti integer DEFAULT 0 NOT NULL,
    telefon character varying(20),
    mobil character varying(20) DEFAULT ''::character varying NOT NULL,
    email character varying(255) DEFAULT ''::character varying NOT NULL,
    domiciliu_tara character varying(100),
    domiciliu_judet character varying(100),
    domiciliu_localitate character varying(120) DEFAULT ''::character varying NOT NULL,
    domiciliu_adresa character varying(200),
    domiciliu_numar character varying(20),
    domiciliu_bloc character varying(20),
    domiciliu_scara character varying(20),
    domiciliu_etaj character varying(20),
    domiciliu_apartament character varying(20),
    resedinta_tara character varying(100),
    resedinta_judet character varying(100),
    resedinta_localitate character varying(120),
    resedinta_adresa character varying(200),
    resedinta_numar character varying(20),
    resedinta_bloc character varying(20),
    resedinta_scara character varying(20),
    resedinta_etaj character varying(20),
    resedinta_apartament character varying(20),
    contact_nume character varying(100),
    contact_prenume character varying(100),
    contact_telefon character varying(50),
    contact_email character varying(255),
    contact_relatie character varying(100),
    medic_familie_nume character varying(150) DEFAULT ''::character varying NOT NULL,
    medic_familie_email character varying(255) DEFAULT ''::character varying NOT NULL,
    nivel_notificari character varying(100),
    sursa_informare character varying(100) DEFAULT ''::character varying NOT NULL,
    cas_status_asigurare character varying(100),
    cas_denumire character varying(120),
    cas_tip_asigurare character varying(100),
    cas_nr_card_european character varying(50),
    cas_card_valabil_pana date,
    cas_eminent character varying(50),
    cas_cod_eminent character varying(50),
    cas_categorie_asigurat text,
    is_verified boolean DEFAULT false NOT NULL,
    nume_complet character varying(200) GENERATED ALWAYS AS ((((nume)::text || ' '::text) || (prenume)::text)) STORED,
    contact_refuzat boolean DEFAULT false NOT NULL,
    CONSTRAINT patients_varsta_check CHECK (((varsta >= 0) AND (varsta <= 150))),
    CONSTRAINT patients_varsta_prezentare_check CHECK ((varsta_prezentare >= 0))
);


ALTER TABLE public.patients OWNER TO postgres;

--
-- Name: servicii; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servicii (
    zk_preturi_id_p uuid DEFAULT gen_random_uuid() NOT NULL,
    zk_idmodule_f uuid NOT NULL,
    cod_procedura character varying(50),
    nume character varying(200) NOT NULL,
    pret_baza numeric(10,2) NOT NULL,
    perioada character varying(50),
    sursa_plata character varying(100),
    firma character varying(200),
    is_cas boolean DEFAULT false NOT NULL,
    is_disabled boolean DEFAULT false NOT NULL,
    created_account character varying(100) NOT NULL,
    created_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    modification_account character varying(100),
    modification_timestamp timestamp with time zone,
    zk_idsubcategorie_f uuid NOT NULL
);


ALTER TABLE public.servicii OWNER TO postgres;

--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: sub_categorie; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sub_categorie (
    zk_idsubcategorie_p uuid DEFAULT gen_random_uuid() NOT NULL,
    zk_idmodule_f uuid NOT NULL,
    nume_subcategorie character varying(100) NOT NULL,
    is_disabled boolean DEFAULT false NOT NULL,
    created_account character varying(100) NOT NULL,
    created_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    modification_account character varying(100),
    modification_timestamp timestamp with time zone
);


ALTER TABLE public.sub_categorie OWNER TO postgres;

--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- Name: app_user app_user_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_username_key UNIQUE (username);


--
-- Name: client_settings client_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_settings
    ADD CONSTRAINT client_settings_pkey PRIMARY KEY (user_id);


--
-- Name: istoricmedia istoricmedia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.istoricmedia
    ADD CONSTRAINT istoricmedia_pkey PRIMARY KEY (zk_istoricmedia_p);


--
-- Name: patients patients_cod_cnp_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_cod_cnp_key UNIQUE (cod_cnp);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: discounturi pk_discounturi; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discounturi
    ADD CONSTRAINT pk_discounturi PRIMARY KEY (zk_pret_variabil_id_p);


--
-- Name: doctor pk_doctor; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor
    ADD CONSTRAINT pk_doctor PRIMARY KEY (zk_doctor_id_p);


--
-- Name: module pk_module; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.module
    ADD CONSTRAINT pk_module PRIMARY KEY (zk_idmodule_p);


--
-- Name: servicii pk_servicii; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicii
    ADD CONSTRAINT pk_servicii PRIMARY KEY (zk_preturi_id_p);


--
-- Name: sub_categorie pk_sub_categorie; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sub_categorie
    ADD CONSTRAINT pk_sub_categorie PRIMARY KEY (zk_idsubcategorie_p);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: doctor uq_doctor_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor
    ADD CONSTRAINT uq_doctor_user UNIQUE (user_id);


--
-- Name: idx_istoricmedia_data_document; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_istoricmedia_data_document ON public.istoricmedia USING btree (datadocument);


--
-- Name: idx_istoricmedia_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_istoricmedia_name_trgm ON public.istoricmedia USING gin (medianame public.gin_trgm_ops);


--
-- Name: idx_istoricmedia_pacient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_istoricmedia_pacient ON public.istoricmedia USING btree (zk_idpacient_f);


--
-- Name: idx_istoricmedia_pacient_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_istoricmedia_pacient_type ON public.istoricmedia USING btree (zk_idpacient_f, mediatype);


--
-- Name: idx_patients_cod_cnp_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_cod_cnp_trgm ON public.patients USING gin (cod_cnp public.gin_trgm_ops);


--
-- Name: idx_patients_email_asc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_email_asc ON public.patients USING btree (email, mobil, nume, prenume, id);


--
-- Name: idx_patients_email_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_email_desc ON public.patients USING btree (email DESC, mobil DESC, nume, prenume, id);


--
-- Name: idx_patients_email_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_email_trgm ON public.patients USING gin (email public.gin_trgm_ops);


--
-- Name: idx_patients_is_verified_asc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_is_verified_asc ON public.patients USING btree (is_verified, nume, prenume, id);


--
-- Name: idx_patients_is_verified_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_is_verified_desc ON public.patients USING btree (is_verified DESC, nume, prenume, id);


--
-- Name: idx_patients_list_default; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_list_default ON public.patients USING btree (data_introducerii, id) INCLUDE (nume, prenume, cod_cnp, varsta, nid, domiciliu_localitate, email, mobil, medic_curant, medic_initial, medic_familie_nume, medic_familie_email, is_verified, sursa_informare, nr_pacienti_gasiti);


--
-- Name: idx_patients_localitate_asc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_localitate_asc ON public.patients USING btree (domiciliu_localitate, nume, prenume, id);


--
-- Name: idx_patients_localitate_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_localitate_desc ON public.patients USING btree (domiciliu_localitate DESC, nume, prenume, id);


--
-- Name: idx_patients_localitate_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_localitate_trgm ON public.patients USING gin (domiciliu_localitate public.gin_trgm_ops);


--
-- Name: idx_patients_medic_curant_asc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_medic_curant_asc ON public.patients USING btree (medic_curant, medic_initial, nume, prenume, id);


--
-- Name: idx_patients_medic_curant_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_medic_curant_desc ON public.patients USING btree (medic_curant DESC, medic_initial DESC, nume, prenume, id);


--
-- Name: idx_patients_medic_curant_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_medic_curant_trgm ON public.patients USING gin (medic_curant public.gin_trgm_ops);


--
-- Name: idx_patients_medic_familie_asc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_medic_familie_asc ON public.patients USING btree (medic_familie_nume, medic_familie_email, nume, prenume, id);


--
-- Name: idx_patients_medic_familie_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_medic_familie_desc ON public.patients USING btree (medic_familie_nume DESC, medic_familie_email DESC, nume, prenume, id);


--
-- Name: idx_patients_medic_familie_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_medic_familie_trgm ON public.patients USING gin (medic_familie_nume public.gin_trgm_ops);


--
-- Name: idx_patients_nid_asc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_nid_asc ON public.patients USING btree (nid, nume, prenume, id);


--
-- Name: idx_patients_nid_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_nid_desc ON public.patients USING btree (nid DESC, nume, prenume, id);


--
-- Name: idx_patients_nid_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_nid_trgm ON public.patients USING gin (nid public.gin_trgm_ops);


--
-- Name: idx_patients_nume_asc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_nume_asc ON public.patients USING btree (nume, prenume, id);


--
-- Name: idx_patients_nume_complet_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_nume_complet_trgm ON public.patients USING gin (nume_complet public.gin_trgm_ops);


--
-- Name: idx_patients_nume_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_nume_desc ON public.patients USING btree (nume DESC, prenume DESC, id DESC);


--
-- Name: idx_patients_nume_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_nume_trgm ON public.patients USING gin (nume public.gin_trgm_ops);


--
-- Name: idx_patients_prenume_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_prenume_trgm ON public.patients USING gin (prenume public.gin_trgm_ops);


--
-- Name: idx_patients_sursa_informare_asc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_sursa_informare_asc ON public.patients USING btree (sursa_informare, nume, prenume, id);


--
-- Name: idx_patients_sursa_informare_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_sursa_informare_desc ON public.patients USING btree (sursa_informare DESC, nume, prenume, id);


--
-- Name: idx_patients_varsta_asc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_varsta_asc ON public.patients USING btree (varsta, nume, prenume, id);


--
-- Name: idx_patients_varsta_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_patients_varsta_desc ON public.patients USING btree (varsta DESC, nume, prenume, id);


--
-- Name: idx_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_expire ON public.session USING btree (expire);


--
-- Name: ix_discounturi_doctor_pret; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_discounturi_doctor_pret ON public.discounturi USING btree (zk_doctor_id_f, zk_pret_id_f, start_date, end_date) WHERE ((type = 'doctor'::public.discount_type) AND (is_disabled = false));


--
-- Name: ix_discounturi_overlap_baza; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_discounturi_overlap_baza ON public.discounturi USING btree (zk_pret_id_f, start_date, end_date) WHERE ((type = 'baza'::public.discount_type) AND (is_disabled = false));


--
-- Name: ix_discounturi_overlap_doctor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_discounturi_overlap_doctor ON public.discounturi USING btree (zk_pret_id_f, zk_doctor_id_f, start_date, end_date) WHERE ((type = 'doctor'::public.discount_type) AND (is_disabled = false));


--
-- Name: ix_discounturi_overlap_promotie; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_discounturi_overlap_promotie ON public.discounturi USING btree (zk_pret_id_f, start_date, end_date) WHERE ((type = 'promotie'::public.discount_type) AND (is_disabled = false));


--
-- Name: ix_discounturi_pret_type_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_discounturi_pret_type_dates ON public.discounturi USING btree (zk_pret_id_f, type, start_date, end_date) INCLUDE (pret, zk_doctor_id_f, is_disabled) WHERE (is_disabled = false);


--
-- Name: ix_servicii_cod_procedura; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_servicii_cod_procedura ON public.servicii USING btree (cod_procedura) WHERE ((cod_procedura IS NOT NULL) AND (is_disabled = false));


--
-- Name: ix_servicii_subcategorie; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_servicii_subcategorie ON public.servicii USING btree (zk_idsubcategorie_f) INCLUDE (nume, pret_baza, is_disabled) WHERE (is_disabled = false);


--
-- Name: ix_sub_categorie_module; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_sub_categorie_module ON public.sub_categorie USING btree (zk_idmodule_f) WHERE (is_disabled = false);


--
-- Name: patients set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: app_user update_app_user_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_app_user_updated_at BEFORE UPDATE ON public.app_user FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: client_settings update_client_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_client_settings_updated_at BEFORE UPDATE ON public.client_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: client_settings client_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_settings
    ADD CONSTRAINT client_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE CASCADE;


--
-- Name: doctor doctor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor
    ADD CONSTRAINT doctor_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);


--
-- Name: discounturi fk_discounturi_doctor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discounturi
    ADD CONSTRAINT fk_discounturi_doctor FOREIGN KEY (zk_doctor_id_f) REFERENCES public.doctor(zk_doctor_id_p);


--
-- Name: discounturi fk_discounturi_servicii; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discounturi
    ADD CONSTRAINT fk_discounturi_servicii FOREIGN KEY (zk_pret_id_f) REFERENCES public.servicii(zk_preturi_id_p);


--
-- Name: servicii fk_servicii_module; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicii
    ADD CONSTRAINT fk_servicii_module FOREIGN KEY (zk_idmodule_f) REFERENCES public.module(zk_idmodule_p);


--
-- Name: sub_categorie fk_sub_categorie_module; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sub_categorie
    ADD CONSTRAINT fk_sub_categorie_module FOREIGN KEY (zk_idmodule_f) REFERENCES public.module(zk_idmodule_p);


--
-- Name: servicii servicii_zk_idsubcategorie_f_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servicii
    ADD CONSTRAINT servicii_zk_idsubcategorie_f_fkey FOREIGN KEY (zk_idsubcategorie_f) REFERENCES public.sub_categorie(zk_idsubcategorie_p);


--
-- PostgreSQL database dump complete
--

\unrestrict rQoMDgdiPOyrjDBvUNDCNQxNM1gl9e2wkvreyOp4g6WckhMPNkLpdYdcfCTrntd
