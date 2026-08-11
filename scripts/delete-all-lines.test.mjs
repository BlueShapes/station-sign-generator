import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { parse } from "yaml";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales.ts";
import { deleteAllLines } from "../src/db/repositories/lines.ts";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });

let db;

beforeEach(() => {
  db = new SQL.Database();
  db.run(`
    CREATE TABLE lines (id TEXT PRIMARY KEY);
    CREATE TABLE stations (id TEXT PRIMARY KEY);
    CREATE TABLE station_lines (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      line_id TEXT NOT NULL
    );
    CREATE TABLE station_numbers (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      line_id TEXT
    );
    CREATE TABLE services (
      id TEXT PRIMARY KEY,
      line_id TEXT NOT NULL
    );
    CREATE TABLE station_service_stops (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      service_id TEXT NOT NULL
    );
    CREATE TABLE through_routes (id TEXT PRIMARY KEY);
    CREATE TABLE through_route_segments (
      id TEXT PRIMARY KEY,
      through_route_id TEXT NOT NULL,
      line_id TEXT NOT NULL
    );

    INSERT INTO lines VALUES ('line-a'), ('line-b');
    INSERT INTO stations VALUES ('station-a');
    INSERT INTO station_lines VALUES ('sl-a', 'station-a', 'line-a');
    INSERT INTO station_numbers VALUES ('sn-a', 'station-a', 'line-a');
    INSERT INTO services VALUES ('service-a', 'line-a');
    INSERT INTO station_service_stops VALUES
      ('stop-a', 'station-a', 'service-a');
    INSERT INTO through_routes VALUES ('through-a');
    INSERT INTO through_route_segments VALUES
      ('segment-a', 'through-a', 'line-a');
  `);
});

afterEach(() => db.close());

describe("deleteAllLines", () => {
  test("deletes every line and line-dependent record without deleting reusable data", () => {
    deleteAllLines(db);

    for (const table of [
      "lines",
      "station_lines",
      "station_numbers",
      "services",
      "station_service_stops",
      "through_route_segments",
    ]) {
      expect(db.exec(`SELECT * FROM ${table}`)).toEqual([]);
    }

    expect(db.exec("SELECT id FROM stations")[0].values).toEqual([
      ["station-a"],
    ]);
    expect(db.exec("SELECT id FROM through_routes")[0].values).toEqual([
      ["through-a"],
    ]);
  });
});

describe("delete-all line translations", () => {
  test("defines the command and warning in every supported locale", () => {
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const messages = parse(
        readFileSync(`src/locales/${locale}.yml`, "utf8"),
      ).route?.line;
      expect(messages?.["delete-all"]).toBeString();
      expect(messages?.["delete-all-confirm"]).toBeString();
    }
  });
});
