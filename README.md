# Patient Server

Express + TypeScript REST API for patient CRUD.

## Setup

```bash
npm install
cp .env.example .env
# fill in your DB credentials in .env
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
