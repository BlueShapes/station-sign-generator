import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { parse } from "yaml";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales.ts";
import {
  deleteAllLines,
  deleteLine,
} from "../src/db/repositories/lines.ts";
import { deleteCompany } from "../src/db/repositories/companies.ts";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });

let db;

function getIds(table) {
  return (db.exec(`SELECT id FROM ${table} ORDER BY id`)[0]?.values ?? []).map(
    ([id]) => id,
  );
}

beforeEach(() => {
  db = new SQL.Database();
  db.run(`
    CREATE TABLE companies (id TEXT PRIMARY KEY);
    CREATE TABLE lines (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      parent_line_id TEXT
    );
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

    INSERT INTO companies VALUES ('company-a'), ('company-b');
    INSERT INTO lines VALUES
      ('line-a', 'company-a', NULL),
      ('line-b', 'company-b', NULL),
      ('line-child', 'company-b', 'line-a');
    INSERT INTO stations VALUES ('station-a'), ('station-b');
    INSERT INTO station_lines VALUES
      ('sl-a', 'station-a', 'line-a'),
      ('sl-b', 'station-b', 'line-b');
    INSERT INTO station_numbers VALUES
      ('sn-a', 'station-a', 'line-a'),
      ('sn-b', 'station-b', 'line-b');
    INSERT INTO services VALUES
      ('service-a', 'line-a'),
      ('service-b', 'line-b');
    INSERT INTO station_service_stops VALUES
      ('stop-a', 'station-a', 'service-a'),
      ('stop-b', 'station-b', 'service-b');
    INSERT INTO through_routes VALUES
      ('through-b'),
      ('through-empty'),
      ('through-shared');
    INSERT INTO through_route_segments VALUES
      ('segment-b', 'through-b', 'line-b'),
      ('segment-shared-a', 'through-shared', 'line-a'),
      ('segment-shared-b', 'through-shared', 'line-b');
  `);
});

afterEach(() => db.close());

describe("line deletion", () => {
  test("deletes a line, its data, and entire through routes containing it", () => {
    deleteLine(db, "line-a");

    expect(getIds("lines")).toEqual(["line-b", "line-child"]);
    expect(getIds("station_lines")).toEqual(["sl-b"]);
    expect(getIds("station_numbers")).toEqual(["sn-b"]);
    expect(getIds("services")).toEqual(["service-b"]);
    expect(getIds("station_service_stops")).toEqual(["stop-b"]);
    expect(getIds("through_routes")).toEqual(["through-b", "through-empty"]);
    expect(getIds("through_route_segments")).toEqual(["segment-b"]);
    expect(
      db.exec("SELECT parent_line_id FROM lines WHERE id = 'line-child'")[0]
        .values,
    ).toEqual([[null]]);
  });

  test("deleting a company deletes its lines and affected through routes", () => {
    deleteCompany(db, "company-b");

    expect(getIds("companies")).toEqual(["company-a"]);
    expect(getIds("lines")).toEqual(["line-a"]);
    expect(getIds("station_lines")).toEqual(["sl-a"]);
    expect(getIds("station_numbers")).toEqual(["sn-a"]);
    expect(getIds("services")).toEqual(["service-a"]);
    expect(getIds("station_service_stops")).toEqual(["stop-a"]);
    expect(getIds("through_routes")).toEqual(["through-empty"]);
    expect(getIds("through_route_segments")).toEqual([]);
  });

  test("deleting all lines also removes orphaned through routes", () => {
    deleteAllLines(db);

    for (const table of [
      "lines",
      "station_lines",
      "station_numbers",
      "services",
      "station_service_stops",
      "through_routes",
      "through_route_segments",
    ]) {
      expect(getIds(table)).toEqual([]);
    }

    expect(getIds("stations")).toEqual(["station-a", "station-b"]);
    expect(getIds("companies")).toEqual(["company-a", "company-b"]);
  });
});

describe("line deletion translations", () => {
  test("defines the command, warnings, and target-list label in every locale", () => {
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const messages = parse(
        readFileSync(`src/locales/${locale}.yml`, "utf8"),
      ).route;
      expect(messages?.company?.["delete-confirm"]).toBeString();
      expect(messages?.line?.["delete-confirm"]).toBeString();
      expect(messages?.line?.["delete-all"]).toBeString();
      expect(messages?.line?.["delete-all-confirm"]).toBeString();
      expect(messages?.line?.["delete-targets"]).toBeString();
    }
  });
});
