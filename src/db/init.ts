import initSqlJs from "sql.js";
import type { SqlJsStatic, Database } from "sql.js";
import { DB_VERSION } from "../config";
import migrateV001toV010 from "./migrations/v0.0.1_to_v0.1.0";
import migrateV010toV020 from "./migrations/v0.1.0_to_v0.2.0";

const STORAGE_KEY = "station-sign-db-v2";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS db_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  company_color        TEXT NOT NULL DEFAULT '#3a9200',
  station_number_style TEXT NOT NULL DEFAULT 'jreast'
);

CREATE TABLE IF NOT EXISTS lines (
  id         TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  line_color TEXT NOT NULL DEFAULT '#8cc800',
  prefix     TEXT NOT NULL,
  priority   INTEGER,
  is_loop    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stations (
  id                   TEXT PRIMARY KEY,
  primary_name         TEXT NOT NULL DEFAULT '',
  primary_name_furigana TEXT,
  secondary_name       TEXT,
  tertiary_name        TEXT,
  quaternary_name      TEXT,
  quinary_name         TEXT,
  note                 TEXT,
  three_letter_code    TEXT,
  sort_order           INTEGER
);

CREATE TABLE IF NOT EXISTS station_lines (
  id         TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  line_id    TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_numbers (
  id         TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  line_id    TEXT REFERENCES lines(id) ON DELETE CASCADE,
  value      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS special_zones (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  is_black     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_areas (
  id         TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  zone_id    TEXT NOT NULL REFERENCES special_zones(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS current_sign_configurations (
  id         TEXT PRIMARY KEY,
  station_id TEXT REFERENCES stations(id) ON DELETE CASCADE,
  ratio      REAL DEFAULT 4.5,
  direction  TEXT DEFAULT 'left',
  sign_style TEXT
);
`;

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

/**
 * Run all registered migrations in order, then stamp the current DB_VERSION.
 * To add a new migration: import its function above and add it to the array.
 */
function migrateDatabase(database: Database): void {
  // Migrations run in order; each is idempotent (safe to re-run)
  const migrations = [migrateV001toV010, migrateV010toV020];

  for (const migrate of migrations) {
    migrate(database);
  }

  // Stamp the final version
  database.run(
    `INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('version', '${DB_VERSION}')`,
  );
}

export async function getDatabase(): Promise<Database> {
  if (db) return db;

  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const binary = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
      db = new SQL.Database(binary);
      // Run schema to add any new tables, then migrate
      db.run(SCHEMA_SQL);
      migrateDatabase(db);
    } catch {
      console.warn("Failed to load saved database, creating fresh one");
      db = null;
    }
  }

  if (!db) {
    db = new SQL.Database();
    db.run(SCHEMA_SQL);
    migrateDatabase(db);
  }

  return db;
}

export function persistDatabase(database: Database): void {
  try {
    const binary = database.export();
    const base64 = btoa(
      Array.from(binary)
        .map((b) => String.fromCharCode(b))
        .join(""),
    );
    localStorage.setItem(STORAGE_KEY, base64);
  } catch (e) {
    console.error("Failed to persist database to localStorage:", e);
  }
}

// Minimum required columns per table (subset that the app actively reads/writes)
const REQUIRED_SCHEMA: Record<string, string[]> = {
  companies: ["id", "name", "company_color", "station_number_style"],
  lines: ["id", "name", "line_color", "prefix"],
  stations: ["id", "primary_name"],
  station_lines: ["id", "station_id", "line_id", "sort_order"],
  station_numbers: ["id", "station_id", "line_id", "value"],
  special_zones: ["id", "name", "abbreviation", "is_black"],
  station_areas: ["id", "station_id", "zone_id", "sort_order"],
};

export type ValidationResult =
  | { valid: true }
  | {
    valid: false;
    reason: "invalid-file" | "missing-table" | "missing-column";
    detail?: string;
  };

/**
 * Migrate an imported binary database to the current schema.
 * Returns the migrated binary so callers can use it for import.
 * Throws if the binary is not a valid SQLite file.
 */
export async function migrateImportedDatabase(
  binary: Uint8Array,
): Promise<Uint8Array> {
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  }
  const tempDb = new SQL.Database(binary);
  try {
    // Ensure all tables exist (CREATE IF NOT EXISTS), then run migrations
    tempDb.run(SCHEMA_SQL);
    migrateDatabase(tempDb);
    return tempDb.export();
  } finally {
    tempDb.close();
  }
}

export async function validateImportDatabase(
  binary: Uint8Array,
): Promise<ValidationResult> {
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  }

  // One outer try/catch: `new Database(binary)` may succeed on invalid files
  // but the first exec ("file is not a database") will throw — catch both here.
  let tempDb: Database | null = null;
  try {
    tempDb = new SQL.Database(binary);
    // Apply schema + migrations so older databases pass validation
    tempDb.run(SCHEMA_SQL);
    migrateDatabase(tempDb);

    for (const [table, requiredCols] of Object.entries(REQUIRED_SCHEMA)) {
      const tableCheck = tempDb.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`,
      );
      if (!tableCheck.length || !tableCheck[0].values.length) {
        return { valid: false, reason: "missing-table", detail: table };
      }

      const colResult = tempDb.exec(`PRAGMA table_info(${table})`);
      const existingCols = colResult.length
        ? (colResult[0].values.map((r) => r[1]) as string[])
        : [];

      for (const col of requiredCols) {
        if (!existingCols.includes(col)) {
          return {
            valid: false,
            reason: "missing-column",
            detail: `${table}.${col}`,
          };
        }
      }
    }
    return { valid: true };
  } catch {
    // sql.js throws "file is not a database" on invalid files — treat as invalid
    return { valid: false, reason: "invalid-file" };
  } finally {
    try {
      tempDb?.close();
    } catch {
      /* ignore close errors on invalid db */
    }
  }
}

const MERGE_TABLES = [
  "companies",
  "lines",
  "stations",
  "station_lines",
  "station_numbers",
  "special_zones",
  "station_areas",
] as const;

/**
 * Overwrite the CURRENT db instance in-place by deleting all rows and
 * re-inserting from the imported binary.  The db object reference never
 * changes, so React state holding the reference stays valid throughout.
 */
export async function overwriteDatabaseInPlace(
  binary: Uint8Array,
  currentDb: Database,
): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  }
  const importDb = new SQL.Database(binary);
  // Migrate imported database to current schema before reading
  importDb.run(SCHEMA_SQL);
  migrateDatabase(importDb);
  try {
    // Clear existing rows (reverse dependency order to avoid FK issues)
    for (const table of [...MERGE_TABLES].reverse()) {
      try {
        currentDb.run(`DELETE FROM ${table}`);
      } catch {
        /* ignore */
      }
    }
    // Re-insert from import
    for (const table of MERGE_TABLES) {
      try {
        const results = importDb.exec(`SELECT * FROM ${table}`);
        if (!results.length || !results[0].values.length) continue;
        const { columns, values } = results[0];
        const placeholders = columns.map(() => "?").join(", ");
        const stmt = currentDb.prepare(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
        );
        for (const row of values) {
          stmt.run(row as (string | number | null)[]);
        }
        stmt.free();
      } catch {
        /* skip tables missing from import */
      }
    }
    // Ensure schema version is current after overwrite
    currentDb.run(
      `INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('version', '${DB_VERSION}')`,
    );
  } finally {
    importDb.close();
  }
}

export async function mergeDatabase(binary: Uint8Array): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  }
  if (!db) {
    db = await getDatabase();
  }
  const importDb = new SQL.Database(binary);
  // Migrate imported database to current schema before reading
  importDb.run(SCHEMA_SQL);
  migrateDatabase(importDb);
  for (const table of MERGE_TABLES) {
    try {
      const results = importDb.exec(`SELECT * FROM ${table}`);
      if (!results.length || !results[0].values.length) continue;
      const { columns, values } = results[0];
      const placeholders = columns.map(() => "?").join(", ");
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      );
      for (const row of values) {
        stmt.run(row as (string | number | null)[]);
      }
      stmt.free();
    } catch {
      // table may not exist in older exports — skip
    }
  }
  importDb.close();
}

export function downloadDatabase(
  database: Database,
  filename = "station-signs.sqlite",
): void {
  const binary = database.export();
  const blob = new Blob([binary as unknown as BlobPart], {
    type: "application/x-sqlite3",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
