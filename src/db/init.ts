import initSqlJs from "sql.js";
import type { SqlJsStatic, Database } from "sql.js";

const STORAGE_KEY = "station-sign-db-v1";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS lines (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  color  TEXT NOT NULL,
  prefix TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stations (
  id                TEXT PRIMARY KEY,
  line_id           TEXT REFERENCES lines(id),
  name              TEXT NOT NULL DEFAULT '',
  name_furigana     TEXT,
  name_english      TEXT,
  name_korean       TEXT,
  name_chinese      TEXT,
  note              TEXT,
  three_letter_code TEXT,
  sort_order        INTEGER
);

CREATE TABLE IF NOT EXISTS station_numbers (
  id         TEXT    PRIMARY KEY,
  station_id TEXT    NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  value      TEXT    NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS station_areas (
  id         TEXT    PRIMARY KEY,
  station_id TEXT    NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  is_white   INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS adjacent_stations (
  id                  TEXT PRIMARY KEY,
  station_id          TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  adjacent_station_id TEXT NOT NULL REFERENCES stations(id),
  direction           TEXT NOT NULL CHECK(direction IN ('left', 'right')),
  UNIQUE(station_id, direction)
);

CREATE TABLE IF NOT EXISTS sign_configurations (
  id         TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  line_color TEXT NOT NULL DEFAULT '#89ff12',
  base_color TEXT NOT NULL DEFAULT '#36ab33',
  ratio      REAL NOT NULL DEFAULT 4.5,
  direction  TEXT NOT NULL DEFAULT 'left'
             CHECK(direction IN ('left', 'right', 'both')),
  sign_style TEXT NOT NULL DEFAULT 'jreast'
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
