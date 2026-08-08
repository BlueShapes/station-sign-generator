import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const samplePath = fileURLToPath(
  new URL("../public/sample.sqlite", import.meta.url),
);

const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });
const db = new SQL.Database(readFileSync(samplePath));

function route(lineId) {
  const statement = db.prepare(
    `SELECT l.name, l.prefix, l.line_color,
            COUNT(sl.id) AS station_count,
            MIN(sl.sort_order) AS first_number,
            MAX(sl.sort_order) AS last_number
     FROM lines l
     JOIN station_lines sl ON sl.line_id = l.id
     WHERE l.id = ?
     GROUP BY l.id`,
  );
  try {
    statement.bind([lineId]);
    if (!statement.step()) throw new Error(`Missing sample line: ${lineId}`);
    return statement.getAsObject();
  } finally {
    statement.free();
  }
}

function numberedLinesForStation(stationId) {
  const statement = db.prepare(
    `SELECT l.prefix, sn.value
     FROM station_lines sl
     JOIN lines l ON l.id = sl.line_id
     JOIN station_numbers sn
       ON sn.station_id = sl.station_id AND sn.line_id = sl.line_id
     WHERE sl.station_id = ?
     ORDER BY l.prefix`,
  );
  try {
    statement.bind([stationId]);
    const lines = [];
    while (statement.step()) lines.push(statement.getAsObject());
    return lines;
  } finally {
    statement.free();
  }
}

describe("through-service sample routes", () => {
  test("contains the four requested complete lines", () => {
    expect(route("line-chuo-rapid")).toMatchObject({
      name: "中央線快速",
      prefix: "JC",
      line_color: "#f15a22",
      station_count: 24,
      first_number: 1,
      last_number: 24,
    });
    expect(route("line-chuo-sobu-local")).toMatchObject({
      name: "中央・総武線各駅停車",
      prefix: "JB",
      line_color: "#ffd400",
      station_count: 39,
      first_number: 1,
      last_number: 39,
    });
    expect(route("line-tozai")).toMatchObject({
      name: "東西線",
      prefix: "T",
      line_color: "#00a7db",
      station_count: 23,
      first_number: 1,
      last_number: 23,
    });
    expect(route("line-toyo-rapid")).toMatchObject({
      name: "東葉高速線",
      prefix: "TR",
      line_color: "#e95513",
      station_count: 9,
      first_number: 1,
      last_number: 9,
    });
  });

  test("reuses Nakano as the western connection point", () => {
    expect(numberedLinesForStation("station-jc06")).toEqual([
      { prefix: "JB", value: "07" },
      { prefix: "JC", value: "06" },
      { prefix: "T", value: "01" },
    ]);
  });

  test("reuses Nishi-funabashi as the eastern branch point", () => {
    expect(numberedLinesForStation("station-jb30")).toEqual([
      { prefix: "JB", value: "30" },
      { prefix: "T", value: "23" },
      { prefix: "TR", value: "01" },
    ]);
  });
});
