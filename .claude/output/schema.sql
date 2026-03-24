-- Station Sign Generator — SQLite Schema (v0.4.0)
-- All data is browser-only (sql.js / WebAssembly). No server storage.

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
  id                    TEXT PRIMARY KEY,
  primary_name          TEXT NOT NULL DEFAULT '',
  primary_name_furigana TEXT,
  secondary_name        TEXT,
  tertiary_name         TEXT,
  quaternary_name       TEXT,
  quinary_name          TEXT,
  note                  TEXT,
  three_letter_code     TEXT,
  sort_order            INTEGER
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

CREATE TABLE IF NOT EXISTS services (
  id         TEXT PRIMARY KEY,
  line_id    TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#8cc800',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS station_service_stops (
  id         TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'stop'
);
