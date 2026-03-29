# IDS-Clinic Server

Backend API for the IDS-Clinic healthcare management system. Handles patient records, doctor management, medical services, file uploads, pricing, and user account administration.

**Stack:** Node.js · Express · TypeScript · PostgreSQL (AWS RDS) · AWS S3 · AWS Secrets Manager

## Prerequisites

- Node.js 18+
- PostgreSQL 17 client (`psql`, `pg_dump`, `pg_restore`)
- Docker (for local database)
- AWS credentials configured (S3 + Secrets Manager)

## Getting Started

```bash
npm install
cp .env.example .env
```

### Environment Variables

```env
PORT=3000
NODE_ENV=dev                  # "dev" = use .env for DB creds, skip Secrets Manager

# AWS
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=

# CORS (frontend origin)
CORS_ORIGIN=http://localhost:5173
```

**Database — split vars:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ids_clinic
DB_USER=postgres
DB_PASSWORD=
DB_SSL=false
```

> **Secrets Manager:** In production (`NODE_ENV != dev`), DB credentials are pulled from `dev/idsclinic/db` and the session secret from `dev/idsclinic/db/session`. In `dev` mode both fall back to `.env`.

## Running the Server

```bash
# Development — hot reload
npm run dev

# Production
npm run build && npm start
```

## Authentication

Session-based auth using `express-session` + PostgreSQL session store.

- **Login:** `POST /auth/login` → sets a `connect.sid` HttpOnly cookie
- **Logout:** `POST /auth/logout` → destroys the session
- **Check session:** `GET /auth/me`

Two roles exist: `ADMIN` and `DOCTOR`. All `/api/*` routes require an active session. Admin-only routes additionally check `role === "ADMIN"`.

## API Reference

All write endpoints (`POST`, `PATCH`, `PUT`, `DELETE`) are rate-limited to **10 req/min**. Read endpoints allow **100 req/min**.

### Patients

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/patients` | List patients — supports cursor pagination, sorting, and multiple filters |
| `GET` | `/api/patients/count` | Filtered patient count |
| `GET` | `/api/patients/count/approximate` | Fast approximate total (no filters) |
| `GET` | `/api/patients/navigation/first` | First patient for cursor-based navigation |
| `GET` | `/api/patients/navigation/:id` | Previous/next patient relative to given ID |
| `GET` | `/api/patients/:id` | Get a single patient |
| `POST` | `/api/patients` | Create patient (validates CNP uniqueness) |
| `PATCH` | `/api/patients/:id` | Partial update (blocked if patient is verified) |
| `PATCH` | `/api/patients/:id/verification` | Toggle verification status |
| `DELETE` | `/api/patients/:id` | Delete patient |

**Patient list query params:** `q`, `cnp`, `nid`, `localitate`, `email`, `medicCurant`, `medicFamilie`, `dateStart`, `dateEnd`, `createdFromAppointmentOnly`, `sortKey`, `sortDirection`, `limit`, `cursor*`

### Doctors

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/doctors` | List all doctors |
| `GET` | `/api/doctors/:id` | Get a doctor |
| `GET` | `/api/doctors/by-user/:userId` | Get doctor linked to a user account |
| `POST` | `/api/doctors` | Create doctor |
| `PATCH` | `/api/doctors/:id` | Update doctor |
| `DELETE` | `/api/doctors/:id` | Delete doctor |

### Media (File Uploads)

Files are uploaded directly from the client to S3 using presigned POST URLs. The server never proxies file data.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/media/patient/:patientId` | List all media for a patient (includes presigned download URLs) |
| `POST` | `/api/media/presign` | Generate a presigned S3 upload URL (max 100MB, expires in 5 min) |
| `POST` | `/api/media` | Register a media record in the DB after a successful S3 upload |
| `PUT` | `/api/media/:id` | Update media metadata |
| `DELETE` | `/api/media/:id` | Delete media record + S3 file |

Supported types: images (jpeg, png, webp, gif), videos (mp4, mov, avi, webm), documents (pdf, docx)

### Services (Servicii)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/servicii` | List services |
| `GET` | `/api/servicii/:id` | Get a service |
| `POST` | `/api/servicii` | Create service (unique `codProcedura` required) |
| `PATCH` | `/api/servicii/:id` | Update service |
| `DELETE` | `/api/servicii/:id` | Delete service |

### Pricing & Discounts (Discounturi)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/discounturi` | List discounts |
| `GET` | `/api/discounturi/active-price` | Get active price for a service on a date — params: `servicuId`, `date`, optional `doctorId` |
| `GET` | `/api/discounturi/:id` | Get a discount |
| `POST` | `/api/discounturi` | Create discount (validates no date-range overlap for same service) |
| `PATCH` | `/api/discounturi/:id` | Update discount |
| `DELETE` | `/api/discounturi/:id` | Delete discount |

### Subcategories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/subcategorie` | List subcategories |
| `GET` | `/api/subcategorie/:id` | Get a subcategory |
| `POST` | `/api/subcategorie` | Create subcategory |
| `PATCH` | `/api/subcategorie/:id` | Update subcategory |
| `DELETE` | `/api/subcategorie/:id` | Delete subcategory |

### Modules

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/modules` | List modules |
| `GET` | `/api/modules/:id` | Get a module |
| `POST` | `/api/modules` | Create module |
| `PATCH` | `/api/modules/:id` | Update module |
| `DELETE` | `/api/modules/:id` | Delete module |

### Admin (ADMIN role only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/accounts/users/getAccounts` | List all users |
| `GET` | `/api/admin/accounts/users/getIDbyName` | Look up user ID by username |
| `GET` | `/api/admin/accounts/count` | Total user count |
| `POST` | `/api/admin/accounts/users` | Create user account |
| `PUT` | `/api/admin/accounts/users/:id` | Update user (username, role, is_active) |
| `PUT` | `/api/admin/accounts/users/:id/password` | Reset a user's password |
| `DELETE` | `/api/admin/accounts/users/:id` | Delete user |
| `GET` | `/api/admin/settings` | Get system settings |
| `POST` | `/api/admin/settings` | Update system settings |
| `POST` | `/api/admin/change-password` | Admin changes own password |

### Client / Doctor Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/client/settings` | Get personal settings (dark mode, etc.) |
| `POST` | `/api/client/settings` | Update personal settings |
| `POST` | `/api/client/change-password` | Change own password (requires current password) |
| `POST` | `/api/client/change-username` | Change own username |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Database health check (no auth required) |

---

## Server Deployment Pipeline

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