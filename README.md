# Marine Dashboard

Professional marine fleet management dashboard for vessels, voyages, crew, fuel, maintenance, catch, alerts, reports, users, and vessel position tracking.

## 1. Purpose

Marine Dashboard provides a centralized operational view of a marine fleet. The application supports vessel management, voyage planning and monitoring, crew records, fuel usage, maintenance, catch/production records, alerts, reports, user and role management, and GPS/AIS position ingestion.

This README is also the standard operating procedure (SOP) for local development, testing, Git change management, deployment, and routine verification.

## 2. Technology Stack

* Node.js 20+
* Express
* MySQL 8
* Socket.IO
* HTML/CSS/JavaScript
* Jest and Supertest
* ESLint
* Docker and Docker Compose
* GitHub Actions CI

## 3. Repository Structure

```text
marine-dashboard/
├── database/                 # SQL schema, seed data, and numbered migrations
├── node/                     # Node.js/Express API
│   ├── middleware/           # Authentication and request middleware
│   ├── routes/               # API route modules
│   ├── scripts/              # Migration and operational scripts
│   ├── tests/                # Automated tests
│   ├── package.json
│   └── server.js
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

Local safety snapshots such as `backups/` and `*.before-*` are intentionally ignored by Git and must remain outside the committed source tree.

## 4. Standard Development Workflow

Use this sequence for every material change:

```text
BACKUP → INSPECT → MODIFY → TEST → REVIEW → COMMIT → PUSH → DEPLOY → VERIFY
```

### 4.1 BACKUP

Before modifying an important file, create a local timestamped backup when appropriate:

```bash
cp README.md README.md.before-$(date +%Y%m%d-%H%M%S)
```

For larger changes, use the local `backups/` directory. These files are ignored by Git.

### 4.2 INSPECT

Confirm the repository state before making changes:

```bash
cd ~/projects/marine-dashboard
git status --short
git branch --show-current
git log -1 --oneline
```

Never begin a release change without knowing what is already modified or staged.

### 4.3 MODIFY

Make the smallest coherent change needed. Keep secrets, credentials, API keys, and local configuration out of source control.

### 4.4 TEST

Run the automated test suite and linter after code changes:

```bash
cd ~/projects/marine-dashboard/node
npm test
npm run lint
cd ..
```

### 4.5 REVIEW

Before committing:

```bash
git status --short
git diff --cached --check
git diff --cached --stat
git diff --cached
```

Review database migrations separately from application code.

### 4.6 COMMIT

Use a short, descriptive commit message:

```bash
git add <files>
git commit -m "Describe the change"
```

### 4.7 PUSH

Push the reviewed commit to the main branch:

```bash
git push origin main
```

### 4.8 DEPLOY

Deploy only a reviewed commit. Do not deploy from an uncommitted working tree.

### 4.9 VERIFY

After deployment, verify health, authentication, critical APIs, database connectivity, and the changed feature.

## 5. Prerequisites

Install or make available:

* Git
* Node.js 20 or newer
* npm
* MySQL 8 or a compatible MySQL development environment
* Docker and Docker Compose when using the containerized workflow

The current development environment uses the legacy `docker-compose` executable, so commands in this SOP use `docker-compose` rather than `docker compose`.

## 6. Clone the Repository

```bash
git clone https://github.com/abcent88/marine-dashboard.git
cd marine-dashboard
```

## 7. Environment Configuration

Copy the environment template:

```bash
cp .env.example .env
```

The template currently contains:

```text
APP_ENV=development
APP_NAME="Marine Dashboard"
NODE_PORT=3001
SESSION_SECRET=replace-with-a-long-random-secret
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=marine_dashboard
DB_USER=marine_app
DB_PASS=
```

For local Node development, set a strong local `SESSION_SECRET` and the correct database credentials.

The AIS ingestion key is configured separately through the private environment variable:

```text
AIS_INGEST_API_KEY=<private random key>
```

Never place the real AIS key in `.env.example`, source code, SQL files, README documentation, Git commits, or issue reports.

Check whether the key is configured without displaying it:

```bash
cd ~/projects/marine-dashboard/node
node -e '
require("dotenv").config({ path: "../.env" });
const key = process.env.AIS_INGEST_API_KEY;
console.log("AIS_INGEST_API_KEY configured:", Boolean(key));
console.log("AIS_INGEST_API_KEY length:", key ? key.length : 0);
'
cd ..
```

## 8. Docker Development

Start the development stack:

```bash
docker-compose up -d
```

The Compose services are:

* `mysql` — MySQL 8 database
* `app` — Node.js API

Check service status:

```bash
docker-compose ps
```

View application logs:

```bash
docker-compose logs -f app
```

View database logs:

```bash
docker-compose logs -f mysql
```

The API is exposed at:

```text
http://127.0.0.1:3001
```

The Compose configuration passes `AIS_INGEST_API_KEY` into the application container from the host environment. Do not hard-code the production key in `docker-compose.yml`.

Stop the stack:

```bash
docker-compose down
```

The named `marine_mysql_data` volume preserves the development database unless it is explicitly removed.

## 9. Database Initialization and Migrations

The database files are:

```text
database/001_initial_schema.sql
database/002_seed_demo_data.sql
database/003_add_ais_tracking_support.sql
```

The application migration runner scans numbered SQL files and records applied migrations in the `schema_migrations` table. It also stores a SHA-256 checksum and rejects changes to a migration that has already been applied.

Run migrations from the Node directory with the configured database environment:

```bash
cd node
npm run migrate
```

Do not manually rerun a migration that the migration runner has already recorded as applied.

### AIS Migration

Migration `003_add_ais_tracking_support.sql` adds:

* `vessels.mmsi`
* `vessel_positions.position_source`
* `vessel_positions.source_device_id`
* `vessel_positions.source_timestamp`
* indexes for source/time queries

The supported position sources are:

```text
gps
ais
manual
```

Before applying schema changes to production, back up the database and confirm that existing data satisfies any new constraints.

## 10. Local Node Development

Install dependencies:

```bash
cd ~/projects/marine-dashboard/node
npm ci
```

Start the API:

```bash
npm start
```

Run in development mode:

```bash
npm run dev
```

Available package scripts:

```text
test    jest
start   node server.js
dev     nodemon server.js
lint    eslint .
migrate node scripts/migrate.js
```

## 11. Health Check

Run:

```bash
curl -i http://127.0.0.1:3001/health
```

A healthy API should return HTTP 200 and a JSON response indicating that the service is healthy.

## 12. Authentication

Protected API endpoints require an authenticated application session.

### Persistent session storage

Application login sessions are persisted in the MySQL `sessions` table through the custom `MySQLSessionStore`. This avoids Express's in-memory `MemoryStore` and allows sessions to survive application-container restarts.

The session table is created by migration `004_add_sessions.sql`. Apply database migrations before starting the application:

```bash
cd node
npm run migrate
```

In production, `SESSION_SECRET` must be set to a strong secret. Session cookies are configured with `httpOnly`, `sameSite=lax`, and `secure` when `NODE_ENV=production`.

Do not document or commit working passwords.

Example login flow:

```bash
rm -f /tmp/marine-dashboard-cookies.txt
read -s MARINE_ADMIN_PASSWORD

curl -sS -c /tmp/marine-dashboard-cookies.txt \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@marine.io\",\"password\":\"$MARINE_ADMIN_PASSWORD\"}" \
  http://127.0.0.1:3001/api/auth/login

unset MARINE_ADMIN_PASSWORD
```

Verify the authenticated session:

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/auth/me
```

Log out when finished:

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  -X POST \
  http://127.0.0.1:3001/api/auth/logout
```

## 13. Roles and User Management

The application supports role-based access control.

Current role identifiers include:

* `super_admin`
* `admin`
* `manager`
* `captain`
* `crew`
* `operator`
* `viewer`

Verify users with:

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/users/
```

Passwords must only be handled through the application's password-hashing workflow. Never store or log plaintext passwords.

## 14. Vessel Management

List vessels:

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/vessels
```

Retrieve the latest position for a vessel:

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/vessels/1/position
```

The latest-position response can include:

* latitude
* longitude
* speed in knots
* heading in degrees
* MMSI
* position source
* source device ID
* source timestamp
* recorded timestamp

## 15. GPS and AIS Position Tracking

The position system supports three provenance values:

* `gps` — position supplied by a GPS source
* `ais` — position supplied by an AIS source
* `manual` — position entered manually or created by a manual workflow

AIS ingestion is separated from normal user-session authentication because external AIS devices/providers do not use application login sessions.

### 15.1 AIS Ingestion Endpoint

External AIS/GPS providers send position updates to:

```text
POST /api/ais/positions
```

The endpoint requires the private AIS ingestion key.

Accepted authentication forms are:

```text
x-ais-api-key: <private key>
```

or:

```text
Authorization: Bearer <private key>
```

The secret must never be logged or returned in an error response.

### 15.2 AIS Payload

Example structure:

```json
{
  "mmsi": "123456789",
  "latitude": 4.8123,
  "longitude": 4.9012,
  "speedKnots": 12.5,
  "headingDegrees": 118,
  "positionSource": "ais",
  "sourceDeviceId": "ais-provider-01",
  "sourceTimestamp": "2026-09-06T11:30:00Z"
}
```

Use a real vessel MMSI registered in the `vessels` table.

### 15.3 AIS Validation Rules

The API validates:

* MMSI
* latitude
* longitude
* speed
* heading
* position source
* source timestamp
* vessel existence
* vessel operational status

Unknown vessels are rejected.

Retired/out-of-service vessels are rejected for new AIS position ingestion.

### 15.4 AIS Operational Procedure

1. Register the vessel and MMSI.
2. Confirm the vessel is operational.
3. Generate a strong private AIS ingestion key.
4. Store the key only in secret configuration.
5. Configure the AIS provider/device to send HTTPS POST requests to `/api/ais/positions`.
6. Set `positionSource` to `ais`.
7. Supply a stable `sourceDeviceId`.
8. Preserve the provider's source timestamp.
9. Monitor responses and logs without exposing the secret.
10. Verify the latest position through `/api/vessels/:id/position`.

### 15.5 GPS Integration

GPS integrations use the same position storage model with:

```text
positionSource=gps
```

The source device identifier should identify the tracker or gateway.

### 15.6 Manual Positions

Manual position records use:

```text
positionSource=manual
```

They should be reserved for controlled corrections or testing and should not obscure genuine AIS/GPS provenance.

## 16. Fleet Operations

Dashboard summary:

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/dashboard/summary
```

The dashboard covers:

* fleet/vessel status
* voyages
* crew
* fuel
* maintenance
* catch/production
* alerts
* reports

## 17. Voyages

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/voyages
```

Operational procedure:

1. Confirm vessel availability.
2. Create/select the voyage.
3. Set departure and destination.
4. Assign required resources.
5. Monitor voyage status.
6. Cross-check vessel position when tracking is enabled.
7. Complete the voyage through the supported application workflow.

## 18. Fuel

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/fuel
```

Investigate unusual consumption against voyage distance, catch, and operating conditions.

## 19. Maintenance

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/maintenance
```

Track scheduled, in-progress, and completed maintenance.

## 20. Catch and Production

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/catch
```

Use catch totals and species/vessel breakdowns to monitor production targets.

## 21. Alerts

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/alerts
```

Review critical and warning alerts promptly.

## 22. Crew

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/crew
```

Maintain current vessel assignments and crew status.

## 23. Reports

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/reports/summary
```

Use reports to reconcile operational modules rather than treating a single dashboard metric as authoritative without checking its underlying records.

## 24. Routine API Verification SOP

After a deployment or major backend change:

### Step 1 — Health

```bash
curl -sS -i http://127.0.0.1:3001/health
```

Expected: HTTP 200.

### Step 2 — Authentication

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/auth/me
```

Expected: authenticated user information.

### Step 3 — Dashboard

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/dashboard/summary
```

Expected: fleet and operational summary JSON.

### Step 4 — Vessels

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/vessels
```

Expected: vessel list.

### Step 5 — Position

```bash
curl -sS \
  -b /tmp/marine-dashboard-cookies.txt \
  http://127.0.0.1:3001/api/vessels/1/position
```

Expected: latest position with provenance fields when available.

### Step 6 — Core Modules

Verify:

```text
/api/voyages
/api/fuel
/api/maintenance
/api/alerts
/api/crew
/api/catch
/api/reports/summary
/api/users/
```

Expected: successful authenticated JSON responses.

### Step 7 — AIS Read Verification

Confirm that a vessel with an existing AIS/GPS position exposes the expected source and timestamp through its latest-position endpoint.

Do not send a production AIS write request merely to test connectivity. AIS POST tests should use a controlled test vessel/database or an explicitly approved test record.

## 25. Automated Testing

For a complete local quality gate, run:

```bash
cd ~/projects/marine-dashboard
./scripts/verify-local.sh
```

This runs, in order:

1. ESLint
2. Jest tests with enforced coverage thresholds
3. Database migrations
4. Schema and database integrity verification


Run:

```bash
cd ~/projects/marine-dashboard/node
npm test
```

Then:

```bash
npm run lint
```

Both should pass before commit unless a documented exception has been reviewed.

## 26. Git Change Management SOP

Check repository state:

```bash
cd ~/projects/marine-dashboard
git status --short
```

Review:

```bash
git diff --stat
git diff
```

Stage only intended files:

```bash
git add <files>
```

Review staged changes:

```bash
git diff --cached --check
git diff --cached --stat
git diff --cached
```

Confirm `.env` is not tracked:

```bash
git ls-files .env
git status --short --ignored .env
```

`git ls-files .env` should produce no output.

## 27. Commit Procedure

Before committing:

* tests pass
* lint passes
* no secrets are staged
* no local backup files are staged
* migrations are reviewed
* README matches the implementation
* staged diff contains only the intended change

For the AIS tracking feature:

```bash
git commit -m "Add AIS vessel tracking ingestion"
```

## 28. Push to GitHub

Confirm:

```bash
git branch --show-current
```

Push:

```bash
git push origin main
```

Verify:

```bash
git status --short
git log -1 --oneline
```

The working tree should be clean apart from intentionally ignored local files.

## 29. Deployment SOP

Before production deployment:

1. Confirm the target commit on `main`.
2. Back up the production database.
3. Confirm production environment variables and secrets.
4. Deploy the exact reviewed commit.
5. Install production dependencies.
6. Apply pending database migrations.
7. Restart the application.
8. Check application logs.
9. Run the health check.
10. Authenticate and verify critical APIs.
11. Verify the changed feature.
12. Monitor for errors after release.

Never copy local development passwords or secrets into production.

## 30. Production Security

Production must use:

* HTTPS
* strong unique secrets
* strong session secrets
* restricted database access
* least-privilege database credentials
* protected AIS ingestion credentials
* secure cookie/session settings appropriate for HTTPS
* controlled administrator access
* secure database backups
* reviewed role permissions
* log monitoring without credential leakage

Never commit:

* `.env`
* passwords
* API keys
* session secrets
* private keys
* sensitive production database dumps
* authentication cookies

## 31. Database Backup SOP

Before production schema changes or major releases:

```bash
mysqldump \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p \
  "$DB_NAME" > marine_dashboard_backup_$(date +%Y%m%d-%H%M%S).sql
```

Store production backups in an approved secure location.

Never commit database dumps to Git.

## 32. Troubleshooting

### API refuses connection

```bash
docker-compose ps
docker-compose logs --tail=100 app
```

For local Node development, check the process and port 3001.

### Database connection failure

```bash
docker-compose ps mysql
docker-compose logs --tail=100 mysql
```

Verify:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASS
```

### Migration failure

Do not manually modify an already-applied migration.

Run:

```bash
cd ~/projects/marine-dashboard/node
npm run migrate
```

If a checksum mismatch is reported, stop and review the migration history.

### AIS request returns 503

`AIS_INGEST_API_KEY` is not configured in the application's environment.

### AIS request returns 401

The AIS key is missing or invalid.

### AIS request returns 404

The submitted MMSI does not match a registered vessel.

### AIS request returns 409

The matched vessel is retired/out of service.

### Position endpoint returns no position

Confirm that the vessel has a recorded position in `vessel_positions` and that the application is connected to the expected database.

## 33. Release Checklist

Before every release:

* [ ] Working tree inspected
* [ ] Local backup created where appropriate
* [ ] Feature implemented
* [ ] Database migration reviewed
* [ ] Environment variables reviewed
* [ ] No secrets in source or documentation
* [ ] `npm test` passes
* [ ] `npm run lint` passes
* [ ] `git diff --cached --check` passes
* [ ] Staged diff reviewed
* [ ] `.env` is not tracked
* [ ] Commit created
* [ ] Commit pushed to GitHub
* [ ] Deployment completed from reviewed commit
* [ ] Health check passes
* [ ] Authentication check passes
* [ ] Dashboard check passes
* [ ] Vessel and position checks pass
* [ ] Changed feature verified
* [ ] Logs checked for errors

## 34. Development Backup Policy

Local backups are for recovery during development only.

The repository ignores:

```text
backups/
*.before-*
```

This prevents timestamped safety copies from being accidentally committed.

Ignored local backups are not a substitute for Git history or production database backups.

## 35. Current System Status

The implementation includes:

* authentication and session handling
* role-based access control
* user management
* vessel management
* latest vessel position retrieval
* GPS/AIS position provenance
* authenticated AIS/GPS ingestion
* voyages
* crew
* fuel
* maintenance
* catch/production
* alerts
* reports
* automated route tests
* ESLint
* GitHub Actions CI
* Docker development
* numbered database migrations with checksums

The AIS tracking change adds the database support, dedicated AIS authentication middleware, AIS ingestion route, and enriched latest-position response needed for external GPS/AIS integration.

## 36. Change Management Principle

Keep operational data, application code, configuration, and secrets clearly separated.

Every production change should be:

```text
BACKED UP → REVIEWED → TESTED → COMMITTED → PUSHED → DEPLOYED → VERIFIED
```

If a change affects the database, authentication, vessel tracking, or production security, stop and review the complete change before deployment.
