import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { DB_VERSION } from "../src/config.ts";
import migrateV0100toV0110 from "../src/db/migrations/v0.10.0_to_v0.11.0.ts";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });
let db;

beforeEach(() => {
  db = new SQL.Database();
  db.run(`
    CREATE TABLE companies (
      id TEXT PRIMARY KEY,
      station_number_style TEXT NOT NULL DEFAULT 'jreast'
    );
    INSERT INTO companies VALUES ('metro', 'tokyometro');
  `);
});

afterEach(() => db.close());

describe("custom route badge migration", () => {
  test("adds an independent route badge style and preserves the prior appearance", () => {
    migrateV0100toV0110(db);
    migrateV0100toV0110(db);

    expect(
      db.exec("SELECT station_number_style, route_badge_style FROM companies")[0]
        .values,
    ).toEqual([["tokyometro", "tokyometro"]]);
  });

  test("updates the current schema version and snapshot", () => {
    expect(DB_VERSION).toBe("0.11.0");
    expect(readFileSync(".Codex/output/schema.sql", "utf8")).toStartWith(
      "-- Station Sign Generator — SQLite Schema (v0.11.0)",
    );
  });
});
