import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import migrateV080toV090 from "../src/db/migrations/v0.8.0_to_v0.9.0.ts";
import {
  getServicesByLine,
  getServicesByThroughRoute,
  getServiceStopsByThroughRoute,
  upsertService,
  upsertStationServiceStop,
} from "../src/db/repositories/services.ts";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });

let db;

beforeEach(() => {
  db = new SQL.Database();
  db.run(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE lines (id TEXT PRIMARY KEY);
    CREATE TABLE through_routes (id TEXT PRIMARY KEY);
    CREATE TABLE stations (id TEXT PRIMARY KEY);
    CREATE TABLE services (
      id TEXT PRIMARY KEY,
      line_id TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#8cc800',
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE station_service_stops (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'stop'
    );
    INSERT INTO lines VALUES ('line-a');
    INSERT INTO through_routes VALUES ('through-a');
    INSERT INTO stations VALUES ('station-a'), ('station-b');
    INSERT INTO services VALUES
      ('line-local', 'line-a', 'Local', '#888888', 0);
    INSERT INTO station_service_stops VALUES
      ('line-stop-a', 'station-a', 'line-local', 'stop');
  `);
});

afterEach(() => db.close());

describe("through-route service migration", () => {
  test("adds an exclusive through-route owner while preserving line services", () => {
    migrateV080toV090(db);
    migrateV080toV090(db);

    expect(
      db.exec("PRAGMA table_info(services)")[0].values.map((row) => row[1]),
    ).toEqual([
      "id",
      "line_id",
      "through_route_id",
      "name",
      "color",
      "sort_order",
    ]);
    expect(getServicesByLine(db, "line-a")).toEqual([
      {
        id: "line-local",
        line_id: "line-a",
        through_route_id: null,
        name: "Local",
        color: "#888888",
        sort_order: 0,
      },
    ]);
  });
});

describe("through-route services", () => {
  test("stores rapid stopping patterns independently from segment lines", () => {
    migrateV080toV090(db);
    upsertService(db, {
      id: "through-rapid",
      line_id: null,
      through_route_id: "through-a",
      name: "Rapid",
      color: "#ff0000",
      sort_order: 1,
    });
    upsertStationServiceStop(db, {
      id: "rapid-stop-a",
      station_id: "station-a",
      service_id: "through-rapid",
      status: "stop",
    });

    expect(getServicesByThroughRoute(db, "through-a")).toEqual([
      {
        id: "through-rapid",
        line_id: null,
        through_route_id: "through-a",
        name: "Rapid",
        color: "#ff0000",
        sort_order: 1,
      },
    ]);
    expect(getServiceStopsByThroughRoute(db, "through-a")).toEqual([
      {
        id: "rapid-stop-a",
        station_id: "station-a",
        service_id: "through-rapid",
        status: "stop",
      },
    ]);
    expect(getServicesByLine(db, "line-a").map((service) => service.id)).toEqual([
      "line-local",
    ]);
  });
});
