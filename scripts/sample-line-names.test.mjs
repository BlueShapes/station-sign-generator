import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);

const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });
const db = new SQL.Database(
  readFileSync(fileURLToPath(new URL("../public/sample.sqlite", import.meta.url))),
);

describe("sample line languages", () => {
  test("uses Japanese and English as the first two company languages", () => {
    const rows = db.exec(
      `SELECT id, primary_language, secondary_language
       FROM companies
       ORDER BY id`,
    )[0]?.values;

    expect(rows).toEqual([
      ["company-jreast", "ja", "en"],
      ["company-tokyometro", "ja", "en"],
      ["company-toyo-rapid", "ja", "en"],
    ]);
  });

  test("provides an English secondary name for every sample line", () => {
    const rows = db.exec(
      `SELECT id, secondary_name
       FROM lines
       ORDER BY id`,
    )[0]?.values;

    expect(rows).toEqual([
      ["line-chuo-rapid", "Chūō Line (Rapid)"],
      ["line-chuo-sobu-local", "Chūō-Sōbu Line (Local)"],
      ["line-keihin-tohoku", "Keihin-Tōhoku Line / Negishi Line"],
      ["line-marunouchi", "Marunouchi Line"],
      ["line-marunouchi-branch", "Marunouchi Line (Honancho Branch)"],
      ["line-negishi", "Negishi Line"],
      ["line-shonan-shinjuku", "Shōnan-Shinjuku Line"],
      ["line-toyo-rapid", "Toyo Rapid Line"],
      ["line-tozai", "Tozai Line"],
      ["line-yamanote", "Yamanote Line"],
    ]);
  });
});
