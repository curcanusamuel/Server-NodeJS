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
