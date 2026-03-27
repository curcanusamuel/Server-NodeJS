# Patient Server

Express + TypeScript REST API for patient CRUD.

## Setup

```bash
npm install
cp .env.example .env # or create .env manually
```

Add DB settings to `.env`.

Preferred (Supabase URI):

```env
# Select connection by mode
DB_CONNECTION_MODE=direct

# IPv6 direct host
DATABASE_URL_DIRECT=postgresql://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres

# IPv4-friendly pooler
DATABASE_URL_POOLER=postgresql://postgres.<project-ref>:<PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres

# Optional TLS verification (default false, works with Supabase cert chain in this setup)
DB_SSL_REJECT_UNAUTHORIZED=false
```

Notes:
- Your machine (Linux): set `DB_CONNECTION_MODE=direct`.
- macOS/Windows machines: set `DB_CONNECTION_MODE=pooler`.
- If password has reserved URL characters (`#`, `@`, `/`, `?`), they must be URL-encoded in raw URIs.  
  Example: `abc#123` becomes `abc%23123`.
- Do not append `sslmode` in URL query params; TLS is controlled by `DB_SSL_REJECT_UNAUTHORIZED`.
- Legacy `SUPABASE_URL` is still accepted.

Fallback (legacy split vars, still supported):

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ids_clinic
DB_USER=postgres
DB_PASSWORD=
```

## Database

Create the DB and run the migration:

```bash
createdb ids_clinic
psql -d ids_clinic -f src/db/migrations/001_create_patients.sql
```

## Run

```bash
# development (hot reload)
npm run dev

# production
npm run build
npm start
```

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | /api/patients | List all patients |
| GET | /api/patients?q=ion | Search by name / CNP / cod |
| GET | /api/patients/:id | Get one patient |
| POST | /api/patients | Create patient |
| PATCH | /api/patients/:id | Partial update |
| DELETE | /api/patients/:id | Delete patient |
| GET | /health | DB health check |

## Example Requests

**Create patient:**
```bash
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -d '{
    "nume": "Popescu",
    "prenume": "Ion",
    "varsta": 45,
    "sex": "Masculin",
    "tipActului": "C.I",
    "codCNP": "1780312270619",
    "dataNasterii": "1978-03-12",
    "dataPrezentare": "2024-01-15",
    "varstaPrezentare": 45,
    "pacientOncologic": false,
    "autorFisa": "admin"
  }'
```

**Search:**
```bash
curl http://localhost:3000/api/patients?q=popescu
```

**Partial update:**
```bash
curl -X PATCH http://localhost:3000/api/patients/<uuid> \
  -H "Content-Type: application/json" \
  -d '{ "varsta": 46, "observatii": "Control anual" }'
```


**Server Deployment Pipeline**

# Deployment steps (manual)

git pull

npm install

npm run build

sudo systemctl restart idsclinic.service

# Check status
sudo systemctl status idsclinic.service

# Optional: check logs
journalctl -u idsclinic.service -n 50 --no-pager

#NODE_ENV="dev" uses .env variables now not the aws secret!!!

## Database Setup & Sync

### Prerequisites
```bash
# Install PostgreSQL 17 client
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc
sudo apt-get update
sudo apt-get install postgresql-client-17
```

---

### Create Local Docker Database (first time)
```bash
sudo docker run -d \
  --name postgres-clinic \
  --memory=4g \
  --memory-swap=4g \
  -e POSTGRES_DB=ids_clinic \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:17 \
  -c shared_buffers=1GB \
  -c effective_cache_size=3GB \
  -c work_mem=32MB \
  -c maintenance_work_mem=256MB \
  -c random_page_cost=1.1
```

Update `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ids_clinic
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_SSL=false
```

---

### Start/Stop Local Database
```bash
# Start
sudo docker start postgres-clinic

# Stop
sudo docker stop postgres-clinic

# Check if running
sudo docker ps
```

---

### Sync RDS → Local Docker (pull production data locally)

First make sure your RDS security group allows inbound PostgreSQL from your IP:
- AWS Console → RDS → Security Group → Edit inbound rules
- Add: Type=PostgreSQL, Port=5432, Source=My IP
```bash
# 1. Dump from RDS
pg_dump -h your-rds-endpoint.eu-central-1.rds.amazonaws.com \
  -U postgres \
  -d ids_clinic \
  -F c \
  -f ids_clinic_backup.dump

# 2. Wipe and recreate local Docker container
sudo docker stop postgres-clinic
sudo docker rm postgres-clinic
sudo docker volume rm postgres_data

sudo docker run -d \
  --name postgres-clinic \
  --memory=4g \
  --memory-swap=4g \
  -e POSTGRES_DB=ids_clinic \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:17 \
  -c shared_buffers=1GB \
  -c effective_cache_size=3GB \
  -c work_mem=32MB \
  -c maintenance_work_mem=256MB \
  -c random_page_cost=1.1

# Wait 5 seconds for PostgreSQL to start
sleep 5

# 3. Restore into Docker
pg_restore -h localhost \
  -U postgres \
  -d ids_clinic \
  --no-owner \
  -F c \
  ids_clinic_backup.dump

# 4. Remove public access from RDS security group after you're done
```

---

### Sync Local Docker → RDS (push local changes to production)

⚠️ This overwrites production data. Be careful.

First make sure RDS security group allows your IP (same as above).
```bash
# 1. Dump from local Docker
pg_dump -h localhost \
  -U postgres \
  -d ids_clinic \
  -F c \
  -f ids_clinic_local.dump

# 2. Restore into RDS
pg_restore -h your-rds-endpoint.eu-central-1.rds.amazonaws.com \
  -U postgres \
  -d ids_clinic \
  --no-owner \
  --clean \
  -F c \
  ids_clinic_local.dump

# 3. Remove public access from RDS security group after you're done
```

---

### Warm Up Database Cache (run before demos or first morning use)
```sql
SELECT count(*) FROM patients;
SELECT min(nume), max(nume) FROM patients;
SELECT min(varsta), max(varsta) FROM patients;
SELECT min(domiciliu_localitate), max(domiciliu_localitate) FROM patients;
SELECT min(email), max(email) FROM patients;
SELECT min(medic_curant), max(medic_curant) FROM patients;
SELECT min(sursa_informare), max(sursa_informare) FROM patients;
SELECT min(is_verified::int), max(is_verified::int) FROM patients;
```

---

### Notes
- Always remove the RDS inbound rule for port 5432 after syncing — don't leave it open permanently
- The dump file can be large — make sure you have enough disk space
- pg_dump shows no progress output, just wait for the terminal prompt to return (2-5 minutes for 100k rows over network)
- Local Docker data persists in the postgres_data volume across container restarts