const path = require("path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config({
  path: path.resolve(__dirname, "../../.env")
});

const REQUIRED_TABLES = [
  "users",
  "ports",
  "vessels",
  "crew_members",
  "voyages",
  "vessel_positions",
  "vessel_fuel_logs",
  "maintenance_records",
  "catch_records",
  "alerts",
  "daily_metrics",
  "audit_logs",
  "schema_migrations",
  "sessions"
];

const REQUIRED_COLUMNS = {
  vessels: [
    "id",
    "vessel_code",
    "name",
    "vessel_type",
    "flag_country",
    "imo_number",
    "call_sign",
    "mmsi",
    "capacity_tons",
    "status",
    "home_port_id"
  ],

  vessel_positions: [
    "id",
    "vessel_id",
    "latitude",
    "longitude",
    "speed_knots",
    "heading_degrees",
    "position_source",
    "source_device_id",
    "source_timestamp",
    "recorded_at"
  ],

  users: [
    "id",
    "full_name",
    "email",
    "password_hash",
    "role",
    "status"
  ],

  voyages: [
    "id",
    "vessel_id",
    "voyage_number",
    "departure_port_id",
    "destination_port_id",
    "status"
  ],

  catch_records: [
    "id",
    "vessel_id",
    "voyage_id",
    "species",
    "quantity_kg",
    "recorded_at"
  ],

  sessions: [
    "session_id",
    "expires_at",
    "data"
  ]
};

const MIGRATIONS_DIR = path.resolve(__dirname, "../../database");

function getExpectedMigrations() {
  return require("fs")
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .map((file) => file.replace(/\.sql$/, ""))
    .sort();
}

async function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "marine_app",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "marine_dashboard"
  });
}

async function verifyTables(db) {
  const [rows] = await db.query(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
    `
  );

  const actual = new Set(rows.map((row) => row.TABLE_NAME));

  for (const table of REQUIRED_TABLES) {
    if (!actual.has(table)) {
      throw new Error(`Missing required table: ${table}`);
    }
  }

  console.log(`PASS tables: ${REQUIRED_TABLES.length} required tables present`);
}

async function verifyColumns(db) {
  const [rows] = await db.query(
    `
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
    `
  );

  const actual = new Set(
    rows.map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`)
  );

  let checked = 0;

  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    for (const column of columns) {
      checked += 1;

      if (!actual.has(`${table}.${column}`)) {
        throw new Error(
          `Missing required column: ${table}.${column}`
        );
      }
    }
  }

  console.log(`PASS columns: ${checked} required columns present`);
}

async function verifyMigrations(db) {
  const [rows] = await db.query(
    `
      SELECT version
      FROM schema_migrations
      ORDER BY version
    `
  );

  const actual = rows.map((row) => row.version);
  const expected = getExpectedMigrations();

  if (
    actual.length !== expected.length ||
    actual.some((version, index) => version !== expected[index])
  ) {
    throw new Error(
      `Migration history mismatch. Expected: ${expected.join(", ")}; ` +
      `found: ${actual.join(", ")}`
    );
  }

  console.log(
    `PASS migrations: ${expected.length} migrations recorded`
  );
}

async function verifyDataIntegrity(db) {
  const checks = [
    {
      name: "orphan vessel positions",
      sql: `
        SELECT COUNT(*) AS count
        FROM vessel_positions vp
        LEFT JOIN vessels v ON v.id = vp.vessel_id
        WHERE v.id IS NULL
      `
    },
    {
      name: "orphan voyages",
      sql: `
        SELECT COUNT(*) AS count
        FROM voyages vo
        LEFT JOIN vessels v ON v.id = vo.vessel_id
        WHERE v.id IS NULL
      `
    },
    {
      name: "orphan catch records",
      sql: `
        SELECT COUNT(*) AS count
        FROM catch_records cr
        LEFT JOIN vessels v ON v.id = cr.vessel_id
        WHERE v.id IS NULL
      `
    },
    {
      name: "invalid vessel coordinates",
      sql: `
        SELECT COUNT(*) AS count
        FROM vessel_positions
        WHERE latitude NOT BETWEEN -90 AND 90
           OR longitude NOT BETWEEN -180 AND 180
      `
    },
    {
      name: "negative catch quantities",
      sql: `
        SELECT COUNT(*) AS count
        FROM catch_records
        WHERE quantity_kg < 0
      `
    },
    {
      name: "negative fuel quantities",
      sql: `
        SELECT COUNT(*) AS count
        FROM vessel_fuel_logs
        WHERE quantity_liters < 0
      `
    }
  ];

  for (const check of checks) {
    const [rows] = await db.query(check.sql);
    const count = Number(rows[0].count);

    if (count !== 0) {
      throw new Error(
        `Data integrity check failed: ${check.name} (${count} invalid row(s))`
      );
    }

    console.log(`PASS integrity: ${check.name}`);
  }
}

async function main() {
  const db = await createConnection();

  try {
    console.log("===== MARINE DASHBOARD SCHEMA VERIFICATION =====");

    await verifyTables(db);
    await verifyColumns(db);
    await verifyMigrations(db);
    await verifyDataIntegrity(db);

    console.log("\nSchema verification completed successfully.");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("\nSchema verification FAILED:");
  console.error(error.message);
  process.exit(1);
});
