# Database Documentation

The Marine Dashboard database uses versioned SQL migrations stored in this
directory. Migrations are applied by the Node.js migration runner and tracked
in the `schema_migrations` table.

## Database Overview

The database stores the core operational data for the Marine Dashboard,
including:

- Users and authentication roles
- Ports
- Vessels
- Crew members
- Voyages
- Vessel positions
- Vessel fuel records
- Maintenance records
- Catch records
- Alerts
- Daily operational metrics
- Audit logs
- Migration history

The application uses MySQL through `mysql2`.

## Migration Files

Migration files follow this naming convention:

    NNN_description.sql

The numeric prefix determines execution order.

Current migrations:

| Migration | Purpose |
|---|---|
| `001_initial_schema.sql` | Creates the initial Marine Dashboard database schema |
| `002_seed_demo_data.sql` | Adds development/demo records |
| `003_add_ais_tracking_support.sql` | Adds AIS vessel identification and position-source tracking |

Migrations are executed in ascending numeric order.

## Migration Tracking

Applied migrations are recorded in:

    schema_migrations

Each migration records:

- Migration version
- SHA-256 checksum
- Application timestamp

The migration runner compares the stored checksum with the current SQL
file. If an already-applied migration has been modified, migration execution
fails instead of silently changing database history.

## Idempotency

Running the migration command repeatedly is safe.

From the Node.js directory:

    cd node
    npm run migrate

An already-applied migration is reported as:

    SKIP  migration_name (already applied)

CI deliberately runs the migration command twice to verify this behavior.

Do not manually rerun an old migration against an existing database.

## Existing Database Baseline

Migrations `001` and `002` were created before the migration tracking system
was introduced and had already been applied to the existing development
database.

Their exact SQL checksums were therefore recorded in `schema_migrations` as a
baseline.

This preserves the existing database and prevents the migration runner from
attempting to recreate tables or duplicate seed data.

Migration `003` was subsequently applied normally through the migration
runner.

The migration history is now:

    001_initial_schema
    002_seed_demo_data
    003_add_ais_tracking_support

## Adding a New Migration

Never modify an already-applied migration.

Instead, create a new numbered migration:

    004_description.sql

For example:

    database/004_add_vessel_documents.sql

Then apply it with:

    cd node
    npm run migrate

After making a schema change, update the schema verification script when
appropriate:

    npm run verify-schema

## Schema Verification

The project includes an automated database verification script:

    cd node
    npm run verify-schema

The verifier checks required tables, required columns, migration history, and
important data-integrity rules.

### Required Tables

The required application tables include:

- `users`
- `ports`
- `vessels`
- `crew_members`
- `voyages`
- `vessel_positions`
- `vessel_fuel_logs`
- `maintenance_records`
- `catch_records`
- `alerts`
- `daily_metrics`
- `audit_logs`
- `schema_migrations`

### Required Columns

Important columns across vessels, positions, users, voyages, and catch
records are verified.

### Migration History

The expected migration sequence must be present:

    001_initial_schema
    002_seed_demo_data
    003_add_ais_tracking_support

### Data Integrity

The verifier checks for:

- Orphan vessel positions
- Orphan voyages
- Orphan catch records
- Invalid vessel coordinates
- Negative catch quantities
- Negative fuel quantities

A failed check exits with a non-zero status so CI can detect the problem.

## AIS Tracking Data

AIS support was introduced by:

    003_add_ais_tracking_support.sql

The migration adds:

- `vessels.mmsi`
- `vessel_positions.position_source`
- `vessel_positions.source_device_id`
- `vessel_positions.source_timestamp`

Supported position sources are:

    gps
    ais
    manual

AIS ingestion is handled by the Node.js API and is protected separately from
normal user authentication.

## Development Database

Local database credentials are configured through the root `.env` file.

The repository should not contain real database passwords or API secrets.

Use `.env.example` as the template for local configuration.

Never commit:

    .env

or production credentials.

## CI Database

GitHub Actions starts a temporary MySQL 8.0 service for every CI run.

CI performs the following sequence:

    Install dependencies
            ↓
    Apply migrations
            ↓
    Run migrations again
            ↓
    Verify schema and data integrity
            ↓
    Run ESLint
            ↓
    Run Jest with coverage

This ensures database changes are reproducible on a clean environment and
that migrations remain idempotent.

## Production Guidance

Production databases should be backed up before applying schema changes.

Production migration execution should use controlled deployment procedures
and production credentials supplied through the deployment environment.

Do not store production passwords, API keys, or other secrets in SQL files,
source code, or Git history.

## Database Change Checklist

Before committing a database change:

- [ ] Create a new numbered migration.
- [ ] Do not modify an already-applied migration.
- [ ] Test the migration locally.
- [ ] Run the migration a second time.
- [ ] Run `npm run verify-schema`.
- [ ] Update verification requirements if the schema changed.
- [ ] Run `npm run lint`.
- [ ] Run `npm test -- --runInBand`.
- [ ] Confirm GitHub Actions passes.
- [ ] Document important data-model changes.
