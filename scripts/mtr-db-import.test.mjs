import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import initSqlJs from "sql.js";
import { importMtrRoutes } from "../src/db/importMtr.ts";

const SQL = await initSqlJs({ wasmBinary: readFileSync(new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url)) });
let db;
beforeEach(() => {
  db = new SQL.Database();
  db.run(readFileSync(new URL("../.Codex/output/schema.sql", import.meta.url), "utf8"));
  db.run("PRAGMA foreign_keys = ON");
  db.run("INSERT INTO companies (id, name) VALUES ('company', 'Company')");
  db.run("INSERT INTO lines (id,name,prefix,priority) VALUES ('existing','Existing','E',7)");
  db.run("INSERT INTO stations (id,primary_name) VALUES ('a','Existing station')");
});
afterEach(() => db.close());
const map = {
  version: "4.0.5", skippedRoutes: 0,
  stations: [
    { id: "a", names: ["中央", "Central", "중앙", "中央", "Fifth"] },
    { id: "b", names: ["同名", "Same name"] },
    { id: "c", names: ["同名", "Same name"] },
  ],
  routes: [
    { id: "r1", names: ["本線", "Main", "Third", "Fourth"], color: "#00ff00", prefix: "M", isLoop: false, stationIds: ["a", "b"] },
    { id: "r2", names: ["環状線"], color: "#000000", prefix: "", isLoop: true, stationIds: ["a", "c"] },
  ],
};
const rows = (sql) => db.exec(sql)[0]?.values ?? [];

test("adds selected routes with shared identities, ordered stations, names, colors and loop state", () => {
  expect(importMtrRoutes(db, map, ["r1", "r2"], "company")).toEqual({ routes: 2, stations: 3 });
  expect(rows("SELECT name,secondary_name,tertiary_name,quaternary_name,line_color,prefix,is_loop,priority FROM lines WHERE id != 'existing' ORDER BY priority")).toEqual([
    ["本線", "Main", "Third", "Fourth", "#00ff00", "M", 0, 8],
    ["環状線", null, null, null, "#000000", "", 1, 9],
  ]);
  expect(rows("SELECT COUNT(*) FROM station_lines WHERE station_id IN (SELECT id FROM stations WHERE primary_name = '中央')")).toEqual([[2]]);
  expect(rows("SELECT primary_name FROM stations JOIN station_lines ON stations.id = station_lines.station_id JOIN lines ON lines.id = station_lines.line_id WHERE lines.name = '本線' ORDER BY station_lines.sort_order")).toEqual([["中央"], ["同名"]]);
  expect(rows("SELECT COUNT(*) FROM stations WHERE primary_name = '同名'")).toEqual([[2]]);
  expect(rows("SELECT primary_name FROM stations WHERE id = 'a'")).toEqual([["Existing station"]]);
  expect(rows("SELECT COUNT(*) FROM station_numbers")).toEqual([[0]]);
});

test("imports only selected routes/stations and does not merge into existing data on a repeat import", () => {
  expect(importMtrRoutes(db, map, ["r1", "r1"], null)).toEqual({ routes: 1, stations: 2 });
  expect(importMtrRoutes(db, map, ["r1"], null)).toEqual({ routes: 1, stations: 2 });
  expect(rows("SELECT COUNT(*) FROM stations")).toEqual([[5]]);
  expect(rows("SELECT COUNT(*) FROM lines WHERE company_id IS NULL")).toEqual([[3]]);
});

test("rejects stale company or route selection without writing", () => {
  expect(() => importMtrRoutes(db, map, ["r1"], "missing")).toThrow();
  expect(() => importMtrRoutes(db, map, ["missing"], null)).toThrow();
  expect(() => importMtrRoutes(db, map, [], null)).toThrow();
  expect(rows("SELECT COUNT(*) FROM lines")).toEqual([[1]]);
});

test("rolls back the entire import if a later insert fails", () => {
  db.run("CREATE TRIGGER fail_import BEFORE INSERT ON lines WHEN NEW.name = '環状線' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  expect(() => importMtrRoutes(db, map, ["r1", "r2"], null)).toThrow();
  expect(rows("SELECT COUNT(*) FROM lines")).toEqual([[1]]);
  expect(rows("SELECT COUNT(*) FROM stations")).toEqual([[1]]);
  expect(rows("SELECT COUNT(*) FROM station_lines")).toEqual([[0]]);
});

test("restores only the imported rows and foreign-key state if persistence fails after export", () => {
  expect(() => importMtrRoutes(db, map, ["r1", "r2"], null, () => {
    db.export();
    throw new Error("QuotaExceededError");
  })).toThrow("QuotaExceededError");
  expect(rows("SELECT COUNT(*) FROM lines")).toEqual([[1]]);
  expect(rows("SELECT COUNT(*) FROM stations")).toEqual([[1]]);
  expect(rows("SELECT COUNT(*) FROM station_lines")).toEqual([[0]]);
  expect(rows("PRAGMA foreign_keys")).toEqual([[1]]);
  expect(importMtrRoutes(db, map, ["r1"], null, () => { db.export(); })).toEqual({ routes: 1, stations: 2 });
  expect(rows("PRAGMA foreign_keys")).toEqual([[1]]);
});
