import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { getResolvedStationNumber } from "../src/db/repositories/stations.ts";

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
      station_number_style TEXT NOT NULL
    );
    CREATE TABLE lines (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      prefix TEXT,
      line_color TEXT,
      parent_line_id TEXT
    );
    CREATE TABLE station_numbers (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      line_id TEXT,
      value TEXT NOT NULL
    );
  `);
});

afterEach(() => db.close());

describe("resolved station-number appearance", () => {
  test("comes from an inherited number's source line, not the selected line", () => {
    db.run(
      "INSERT INTO companies VALUES (?, ?), (?, ?)",
      ["selected-company", "tokyometro", "source-company", "jrcentral"],
    );
    db.run(
      "INSERT INTO lines VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      [
        "source-line",
        "source-company",
        "CA",
        "#f15a22",
        null,
        "selected-line",
        "selected-company",
        "M",
        "#dd3839",
        "source-line",
      ],
    );
    db.run("INSERT INTO station_numbers VALUES (?, ?, ?, ?)", [
      "number-1",
      "station-1",
      "source-line",
      "01",
    ]);

    expect(
      getResolvedStationNumber(db, "station-1", "selected-line"),
    ).toMatchObject({
      line_id: "source-line",
      prefix: "CA",
      value: "01",
      line_color: "#f15a22",
      station_number_style: "jrcentral",
    });
  });
});
