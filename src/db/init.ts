import initSqlJs from "sql.js";
import type { SqlJsStatic, Database } from "sql.js";

const STORAGE_KEY = "station-sign-db-v2";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS db_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  company_color TEXT NOT NULL DEFAULT '#36ab33'
);

CREATE TABLE IF NOT EXISTS lines (
  id         TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  line_color TEXT NOT NULL DEFAULT '#9fff00',
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
 * Migrate a database from v0.0.1 to v0.0.2:
 * - Adds is_loop column to lines (if missing)
 * - Migrates station_areas from (name, is_white) to (zone_id) via new special_zones table
 * - Sets db_metadata version to 0.0.2
 */
function migrateDatabase(database: Database): void {
  // Add is_loop to lines if missing
  try {
    const linesCols = database.exec(`PRAGMA table_info(lines)`);
    const linesColNames = linesCols.length
      ? (linesCols[0].values.map((r) => r[1]) as string[])
      : [];
    if (!linesColNames.includes("is_loop")) {
      database.run(
        `ALTER TABLE lines ADD COLUMN is_loop INTEGER NOT NULL DEFAULT 0`,
      );
    }
  } catch {
    /* ignore */
  }

  // Migrate station_areas from old schema (name/is_white) to new (zone_id)
  try {
    const areasCols = database.exec(`PRAGMA table_info(station_areas)`);
    const areasColNames = areasCols.length
      ? (areasCols[0].values.map((r) => r[1]) as string[])
      : [];

    if (
      areasColNames.includes("name") &&
      !areasColNames.includes("zone_id")
    ) {
      // Collect distinct (name, is_white) pairs and create special zones
      const distinctZones = database.exec(
        `SELECT DISTINCT name, is_white FROM station_areas`,
      );
      const zoneMap: Record<string, string> = {};

      if (distinctZones.length && distinctZones[0].values.length) {
        for (const row of distinctZones[0].values) {
          const [name, is_white] = row as [string, number];
          const safeKey = String(name).replace(/[^a-zA-Z0-9\u3000-\u9FFF]/g, "_");
          const zoneId = `mig-${safeKey}-${is_white}`;
          const abbreviation = String(name).charAt(0);
          const is_black = is_white === 1 ? 0 : 1;
          database.run(
            `INSERT OR IGNORE INTO special_zones (id, name, abbreviation, is_black) VALUES (?, ?, ?, ?)`,
            [zoneId, String(name), abbreviation, is_black],
          );
          zoneMap[`${name}|${is_white}`] = zoneId;
        }
      }

      // Fetch old rows
      const oldData = database.exec(
        `SELECT id, station_id, name, is_white, sort_order FROM station_areas`,
      );

      // Recreate station_areas with new schema
      database.run(`DROP TABLE station_areas`);
      database.run(`
        CREATE TABLE station_areas (
          id         TEXT PRIMARY KEY,
          station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
          zone_id    TEXT NOT NULL REFERENCES special_zones(id) ON DELETE CASCADE,
          sort_order INTEGER DEFAULT 0
        )
      `);

      if (oldData.length && oldData[0].values.length) {
        for (const row of oldData[0].values) {
          const [id, station_id, name, is_white, sort_order] = row as [
            string,
            string,
            string,
            number,
            number,
          ];
          const zone_id = zoneMap[`${name}|${is_white}`];
          if (zone_id) {
            database.run(
              `INSERT INTO station_areas (id, station_id, zone_id, sort_order) VALUES (?, ?, ?, ?)`,
              [id, station_id, zone_id, sort_order],
            );
          }
        }
      }
    }
  } catch {
    /* ignore migration errors on already-new schema */
  }

  // Set version
  database.run(
    `INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('version', '0.0.2')`,
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
  companies: ["id", "name", "company_color"],
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
      `INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('version', '0.0.2')`,
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
