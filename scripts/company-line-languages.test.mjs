import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { parse } from "yaml";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales.ts";
import migrateV060toV070 from "../src/db/migrations/v0.6.0_to_v0.7.0.ts";
import {
  getAllCompanies,
  upsertCompany,
} from "../src/db/repositories/companies.ts";
import { getAllLines, upsertLine } from "../src/db/repositories/lines.ts";
import {
  getCompanyLanguages,
  getRailwayLanguageLabel,
} from "../src/lib/railwayLanguages.ts";

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
      name TEXT NOT NULL,
      company_color TEXT NOT NULL DEFAULT '#3a9200',
      station_number_style TEXT NOT NULL DEFAULT 'jreast'
    );
    CREATE TABLE lines (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      name TEXT NOT NULL,
      line_color TEXT NOT NULL DEFAULT '#8cc800',
      prefix TEXT NOT NULL,
      priority INTEGER,
      is_loop INTEGER NOT NULL DEFAULT 0,
      parent_line_id TEXT
    );
    INSERT INTO companies VALUES
      ('company-1', 'Company', '#123456', 'jreast');
    INSERT INTO lines VALUES
      ('line-1', 'company-1', '中央線', '#f15a22', 'JC', 1, 0, NULL);
  `);
});

afterEach(() => db.close());

describe("company and line language migration", () => {
  test("adds ordered company languages and multilingual line names idempotently", () => {
    migrateV060toV070(db);
    migrateV060toV070(db);

    expect(getAllCompanies(db)[0]).toMatchObject({
      id: "company-1",
      primary_language: "ja",
      secondary_language: "en",
      tertiary_language: "ko",
      quaternary_language: "zh-CN",
    });
    expect(getAllLines(db)[0]).toMatchObject({
      id: "line-1",
      name: "中央線",
      secondary_name: null,
      tertiary_name: null,
      quaternary_name: null,
    });
  });

  test("round-trips company language order and all four line names", () => {
    migrateV060toV070(db);

    upsertCompany(db, {
      id: "company-1",
      name: "Company",
      company_color: "#123456",
      station_number_style: "jreast",
      primary_language: "en",
      secondary_language: "ja",
      tertiary_language: "zh-TW",
      quaternary_language: "ko",
    });
    upsertLine(db, {
      id: "line-1",
      company_id: "company-1",
      name: "Chuo Line",
      secondary_name: "中央線",
      tertiary_name: "中央線",
      quaternary_name: "주오선",
      line_color: "#f15a22",
      prefix: "JC",
      priority: 1,
      is_loop: 0,
      parent_line_id: null,
    });

    const company = getAllCompanies(db)[0];
    expect(getCompanyLanguages(company)).toEqual(["en", "ja", "zh-TW", "ko"]);
    expect(getRailwayLanguageLabel(company.primary_language)).toBe("English");
    expect(getAllLines(db)[0]).toMatchObject({
      name: "Chuo Line",
      secondary_name: "中央線",
      tertiary_name: "中央線",
      quaternary_name: "주오선",
    });
  });
});

describe("language-aware route editor", () => {
  test("labels station and line name slots from their owning company", () => {
    const editorSource = readFileSync(
      fileURLToPath(
        new URL("../src/components/tabs/EditRoutesTab.tsx", import.meta.url),
      ),
      "utf8",
    );
    expect(editorSource).toContain("getLanguageFieldLabels(currentCompany, t)");
    expect(editorSource).toContain("label={languageFieldLabels[0]}");
    expect(editorSource).not.toContain('label={t("route.station.en")}');
    expect(editorSource).not.toContain('label={t("route.station.ko")}');
    expect(editorSource).not.toContain('label={t("route.station.zh")}');
  });

  test("previews station number 01 while editing a line", () => {
    const editorSource = readFileSync(
      fileURLToPath(
        new URL("../src/components/tabs/EditRoutesTab.tsx", import.meta.url),
      ),
      "utf8",
    );

    expect(editorSource).toContain(
      'const LINE_FORM_STATION_NUMBER_PREVIEW = "01";',
    );
    expect(editorSource).toContain(
      "value={LINE_FORM_STATION_NUMBER_PREVIEW}",
    );
    expect(editorSource).toContain(
      't("route.line.station-number-preview")',
    );

    for (const locale of SUPPORTED_LOCALE_CODES) {
      const messages = parse(
        readFileSync(`src/locales/${locale}.yml`, "utf8"),
      );
      expect(messages.route?.line?.["station-number-preview"]).toBeTruthy();
    }
  });
});
