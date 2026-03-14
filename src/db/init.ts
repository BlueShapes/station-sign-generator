import initSqlJs from "sql.js";
import type { SqlJsStatic, Database } from "sql.js";

const STORAGE_KEY = "station-sign-db-v2";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  company_color TEXT NOT NULL DEFAULT '#36ab33'
);

CREATE TABLE IF NOT EXISTS lines (
  id         TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  line_color TEXT NOT NULL DEFAULT '#89ff12',
  prefix     TEXT NOT NULL,
  priority   INTEGER
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

CREATE TABLE IF NOT EXISTS station_areas (
  id         TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  is_white   INTEGER DEFAULT 0,
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
      // Run schema to add any new tables from migrations
      db.run(SCHEMA_SQL);
    } catch {
      console.warn("Failed to load saved database, creating fresh one");
      db = null;
    }
  }

  if (!db) {
    db = new SQL.Database();
    db.run(SCHEMA_SQL);
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
