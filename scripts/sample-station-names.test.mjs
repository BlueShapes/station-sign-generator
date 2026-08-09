import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import migrateV051toV052 from "../src/db/migrations/v0.5.1_to_v0.5.2.ts";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);

const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });
const db = new SQL.Database(
  readFileSync(fileURLToPath(new URL("../public/sample.sqlite", import.meta.url))),
);

function station(id) {
  const statement = db.prepare(
    `SELECT secondary_name, tertiary_name, quaternary_name
     FROM stations
     WHERE id = ?`,
  );
  try {
    statement.bind([id]);
    if (!statement.step()) throw new Error(`Missing sample station: ${id}`);
    return statement.getAsObject();
  } finally {
    statement.free();
  }
}

describe("sample station names", () => {
  test("stores the current sample-data version", () => {
    const result = db.exec(
      "SELECT value FROM db_metadata WHERE key = 'version'",
    );
    expect(result[0]?.values[0]?.[0]).toBe("0.7.1");
  });

  test("uses the verified JR East multilingual spellings", () => {
    expect(station("station-jy12")).toMatchObject({
      secondary_name: "Ōtsuka",
      tertiary_name: "오츠카",
    });
    expect(station("station-jy16")).toMatchObject({
      secondary_name: "Shin-Ōkubo",
      tertiary_name: "신 오쿠보",
    });
    expect(station("station-jy22")).toMatchObject({
      tertiary_name: "메구로",
      quaternary_name: "目黑",
    });
    expect(station("station-jy28").tertiary_name).toBe("하마마츠초");
    expect(station("station-jy30").secondary_name).toBe("Yūrakuchō");
    expect(station("station-jk11").quaternary_name).toBe("樱木町");
    expect(station("station-jk12").quaternary_name).toBe("横滨");
    expect(station("station-jk15").tertiary_name).toBe("츠루미");
    expect(station("station-jk35").tertiary_name).toBe("가미 나카자토");
    expect(station("station-jk46")).toMatchObject({
      tertiary_name: "사이타마 신토신",
      quaternary_name: "埼玉新都心",
    });
    expect(station("station-js08").tertiary_name).toBe("기타 카마쿠라");
    expect(station("station-js10").tertiary_name).toBe("도츠카");
    expect(station("station-js11").tertiary_name).toBe("히가시 토츠카");
    expect(station("station-js15").tertiary_name).toBe("무사시 코스기");
    expect(station("station-js16").tertiary_name).toBe("니시 오이");
  });

  test("uses Tokyo Metro's official English station spellings", () => {
    expect(station("station-m02").secondary_name).toBe("Minami-asagaya");
    expect(station("station-m10").secondary_name).toBe(
      "Shinjuku-gyoemmae",
    );
    expect(station("station-m21").secondary_name).toBe("Hongo-sanchome");
    expect(station("station-mb05").secondary_name).toBe("Nakano-shimbashi");
  });
});

describe("v0.5.1 station-name migration", () => {
  test("is idempotent and does not overwrite user-edited values", () => {
    const migrationDb = new SQL.Database();
    migrationDb.run(`
      CREATE TABLE stations (
        id TEXT PRIMARY KEY,
        secondary_name TEXT,
        tertiary_name TEXT,
        quaternary_name TEXT
      );
      INSERT INTO stations VALUES ('station-jy22', 'Meguro', '메지로', '目黒');
      INSERT INTO stations VALUES ('station-jy12', 'My Otsuka', '오쓰카', '大塚');
    `);

    migrateV051toV052(migrationDb);
    migrateV051toV052(migrationDb);

    const rows = migrationDb.exec(
      `SELECT id, secondary_name, tertiary_name, quaternary_name
       FROM stations ORDER BY id`,
    )[0]?.values;
    expect(rows).toEqual([
      ["station-jy12", "My Otsuka", "오츠카", "大塚"],
      ["station-jy22", "Meguro", "메구로", "目黑"],
    ]);
    migrationDb.close();
  });
});
