import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { DB_VERSION } from "../src/config.ts";
import {
  DEFAULT_DATA,
  DEFAULT_DIRECTION,
} from "../src/db/seed.ts";
import migrateV090toV0100 from "../src/db/migrations/v0.9.0_to_v0.10.0.ts";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });

let db;

beforeEach(() => {
  db = new SQL.Database();
  db.run(`
    CREATE TABLE stations (id TEXT PRIMARY KEY);
    CREATE TABLE current_sign_configurations (
      id         TEXT PRIMARY KEY,
      station_id TEXT REFERENCES stations(id) ON DELETE CASCADE,
      ratio      REAL DEFAULT 4.5,
      direction  TEXT DEFAULT 'left',
      sign_style TEXT
    );
    INSERT INTO current_sign_configurations
      (id, ratio, direction, sign_style)
    VALUES ('existing-sign', 5.5, 'left', 'jreast');
  `);
});

afterEach(() => db.close());

describe("default sign direction", () => {
  test("points new signs to the right", () => {
    expect(DEFAULT_DIRECTION).toBe("right");
    expect(DEFAULT_DATA.direction).toBe(DEFAULT_DIRECTION);
  });

  test("updates the database version and schema snapshot", () => {
    expect(DB_VERSION).toBe("0.10.0");

    const schemaSnapshot = readFileSync(".Codex/output/schema.sql", "utf8");
    expect(schemaSnapshot).toStartWith(
      "-- Station Sign Generator — SQLite Schema (v0.10.0)",
    );
    expect(schemaSnapshot).toContain("direction  TEXT DEFAULT 'right'");

    const sampleDatabaseBuilder = readFileSync(
      "scripts/create-sample-db.py",
      "utf8",
    );
    expect(sampleDatabaseBuilder).toContain("direction  TEXT DEFAULT 'right'");
    expect(sampleDatabaseBuilder).toContain(
      "INSERT INTO db_metadata VALUES ('version', '0.10.0')",
    );
  });

  test("ships the sample database with the current right-facing default", () => {
    const sampleDb = new SQL.Database(readFileSync("public/sample.sqlite"));
    try {
      const directionColumn = sampleDb
        .exec("PRAGMA table_info(current_sign_configurations)")[0]
        .values.find((row) => row[1] === "direction");
      expect(directionColumn[4]).toBe("'right'");
      expect(
        sampleDb.exec(
          "SELECT value FROM db_metadata WHERE key = 'version'",
        )[0].values,
      ).toEqual([[DB_VERSION]]);
    } finally {
      sampleDb.close();
    }
  });

  test("migrates the database default without changing saved directions", () => {
    migrateV090toV0100(db);
    migrateV090toV0100(db);

    const directionColumn = db
      .exec("PRAGMA table_info(current_sign_configurations)")[0]
      .values.find((row) => row[1] === "direction");
    expect(directionColumn[4]).toBe("'right'");

    db.run(
      "INSERT INTO current_sign_configurations (id) VALUES ('new-sign')",
    );
    expect(
      db.exec(
        "SELECT id, direction FROM current_sign_configurations ORDER BY id",
      )[0].values,
    ).toEqual([
      ["existing-sign", "left"],
      ["new-sign", "right"],
    ]);
  });
});
