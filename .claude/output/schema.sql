-- Station Sign Generator — SQLite Schema
-- All data is browser-only (sql.js / WebAssembly). No server storage.
-- Default session uses well-known IDs: station-current, station-left, station-right, config=default

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
