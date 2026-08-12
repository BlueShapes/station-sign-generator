import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { parse } from "yaml";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales.ts";
import migrateV071toV080 from "../src/db/migrations/v0.7.1_to_v0.8.0.ts";
import {
  deleteStationTransfer,
  getAllStationTransfers,
  getConnectingStations,
  hasStationTransfer,
  getTransferLineIds,
  upsertStationTransfer,
} from "../src/db/repositories/station-transfers.ts";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });

let db;

beforeEach(() => {
  db = new SQL.Database();
  db.run(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE stations (
      id TEXT PRIMARY KEY,
      primary_name TEXT NOT NULL,
      primary_name_furigana TEXT,
      secondary_name TEXT,
      tertiary_name TEXT,
      quaternary_name TEXT,
      quinary_name TEXT,
      note TEXT,
      three_letter_code TEXT,
      sort_order INTEGER
    );
    CREATE TABLE lines (id TEXT PRIMARY KEY);
    CREATE TABLE station_lines (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      line_id TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL
    );
    INSERT INTO stations (id, primary_name) VALUES
      ('tsudanuma', '津田沼'),
      ('keisei-tsudanuma', '京成津田沼'),
      ('other', 'その他');
    INSERT INTO lines (id) VALUES ('sobu'), ('keisei'), ('other-line');
    INSERT INTO station_lines VALUES
      ('sl-tsudanuma', 'tsudanuma', 'sobu', 1),
      ('sl-keisei', 'keisei-tsudanuma', 'keisei', 1),
      ('sl-other', 'other', 'other-line', 1);
  `);
  migrateV071toV080(db);
});

afterEach(() => db.close());

describe("station transfer migration", () => {
  test("creates the symmetric transfer table idempotently", () => {
    migrateV071toV080(db);

    const columns = db.exec("PRAGMA table_info(station_transfers)")[0].values.map(
      (row) => row[1],
    );
    expect(columns).toEqual(["id", "station_a_id", "station_b_id"]);
  });
});

describe("station transfer repository", () => {
  test("stores one normalized relation and resolves it in both directions", () => {
    upsertStationTransfer(
      db,
      "transfer-1",
      "tsudanuma",
      "keisei-tsudanuma",
    );
    upsertStationTransfer(
      db,
      "duplicate-id",
      "keisei-tsudanuma",
      "tsudanuma",
    );

    expect(getAllStationTransfers(db)).toEqual([
      {
        id: "transfer-1",
        station_a_id: "keisei-tsudanuma",
        station_b_id: "tsudanuma",
      },
    ]);
    expect(getConnectingStations(db, "tsudanuma").map((station) => station.id)).toEqual([
      "keisei-tsudanuma",
    ]);
    expect(
      getConnectingStations(db, "keisei-tsudanuma").map(
        (station) => station.id,
      ),
    ).toEqual(["tsudanuma"]);
    expect(getTransferLineIds(db, "tsudanuma")).toEqual(["keisei"]);
    expect(getTransferLineIds(db, "keisei-tsudanuma")).toEqual(["sobu"]);
    expect(
      hasStationTransfer(db, "tsudanuma", "keisei-tsudanuma"),
    ).toBeTrue();
    expect(hasStationTransfer(db, "tsudanuma", "other")).toBeFalse();
  });

  test("does not infer transfers without an explicit relation", () => {
    expect(getTransferLineIds(db, "tsudanuma")).toEqual([]);
  });

  test("deletes a relation regardless of station order", () => {
    upsertStationTransfer(
      db,
      "transfer-1",
      "tsudanuma",
      "keisei-tsudanuma",
    );

    deleteStationTransfer(db, "tsudanuma", "keisei-tsudanuma");

    expect(getAllStationTransfers(db)).toEqual([]);
  });

  test("rejects a self-transfer", () => {
    expect(() =>
      upsertStationTransfer(db, "transfer-1", "tsudanuma", "tsudanuma"),
    ).toThrow("A station cannot transfer to itself");
  });
});

describe("station transfer translations", () => {
  test("defines every editor label in every supported locale", () => {
    const expectedKeys = [
      "transfer-title",
      "transfer-manage",
      "transfer-line-select",
      "transfer-select",
      "transfer-empty",
      "same-id-lines",
      "same-id-lines-help",
      "same-id-lines-empty",
      "explicit-transfers",
      "explicit-transfers-help",
    ];
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const messages = parse(
        readFileSync(`src/locales/${locale}.yml`, "utf8"),
      ).route?.station;
      for (const key of expectedKeys) {
        expect(messages?.[key]).toBeString();
      }
      expect(messages["transfer-title"]).toContain("{name}");
    }
  });
});

describe("sample station transfers", () => {
  test("models Marunouchi interchanges as explicit cross-station relations", () => {
    const sampleDb = new SQL.Database(readFileSync("public/sample.sqlite"));
    try {
      expect(getAllStationTransfers(sampleDb)).toEqual([
        {
          id: "transfer-yotsuya-m-jr",
          station_a_id: "station-jc04",
          station_b_id: "station-m12",
        },
        {
          id: "transfer-ogikubo-m-jr",
          station_a_id: "station-jc09",
          station_b_id: "station-m01",
        },
        {
          id: "transfer-ochanomizu-m-jr",
          station_a_id: "station-jc03",
          station_b_id: "station-m20",
        },
        {
          id: "transfer-shinjuku-m-jr",
          station_a_id: "station-jy17",
          station_b_id: "station-m08",
        },
        {
          id: "transfer-tokyo-m-jr",
          station_a_id: "station-jy01",
          station_b_id: "station-m17",
        },
        {
          id: "transfer-ikebukuro-m-jr",
          station_a_id: "station-jy13",
          station_b_id: "station-m25",
        },
        {
          id: "transfer-otemachi-m-t",
          station_a_id: "station-m18",
          station_b_id: "station-t09",
        },
      ].sort((first, second) =>
        `${first.station_a_id}:${first.station_b_id}`.localeCompare(
          `${second.station_a_id}:${second.station_b_id}`,
        ),
      ));
      expect(getTransferLineIds(sampleDb, "station-m01")).toEqual([
        "line-chuo-rapid",
        "line-chuo-sobu-local",
      ]);
      expect(getTransferLineIds(sampleDb, "station-m18")).toEqual([
        "line-tozai",
      ]);

      const sharedOutsideBranch = sampleDb.exec(`
        SELECT station_line.station_id
        FROM station_lines station_line
        JOIN station_lines other
          ON other.station_id = station_line.station_id
         AND other.line_id NOT IN (
           'line-marunouchi',
           'line-marunouchi-branch'
         )
        WHERE station_line.line_id = 'line-marunouchi'
      `);
      expect(sharedOutsideBranch[0]?.values ?? []).toEqual([]);
    } finally {
      sampleDb.close();
    }
  });
});
