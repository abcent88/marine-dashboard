const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env")
});

const MIGRATIONS_DIR = path.join(__dirname, "../../database");

function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();
}

function getChecksum(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function createMigrationPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "marine_app",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "marine_dashboard",
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    multipleStatements: true
  });
}

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) NOT NULL PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);
}

async function migrate() {
  const pool = createMigrationPool();
  const connection = await pool.getConnection();

  try {
    await ensureMigrationTable(connection);

    const [rows] = await connection.query(
      "SELECT version, checksum FROM schema_migrations"
    );

    const applied = new Map(
      rows.map((row) => [row.version, row.checksum])
    );

    const migrationFiles = getMigrationFiles();

    console.log(`Found ${migrationFiles.length} migration file(s).`);

    for (const file of migrationFiles) {
      const version = path.basename(file, ".sql");
      const filePath = path.join(MIGRATIONS_DIR, file);
      const checksum = getChecksum(filePath);

      if (applied.has(version)) {
        if (applied.get(version) !== checksum) {
          throw new Error(
            `Checksum mismatch for applied migration "${version}".`
          );
        }

        console.log(`SKIP  ${version} (already applied)`);
        continue;
      }

      console.log(`APPLY ${version}`);

      const sql = fs.readFileSync(filePath, "utf8");

      await connection.query(sql);

      await connection.query(
        `INSERT INTO schema_migrations (version, checksum)
         VALUES (?, ?)`,
        [version, checksum]
      );

      console.log(`DONE  ${version}`);
    }

    console.log("Migration check completed successfully.");
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
