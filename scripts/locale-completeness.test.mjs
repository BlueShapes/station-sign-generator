import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import {
  SUPPORTED_LOCALE_CODES,
  getLocaleDirection,
  getLocaleFromPathname,
  getLocalePath,
  getManifestPath,
  getOpenGraphLocale,
} from "../src/i18n/locales";
import { getRailwayLanguageOptions } from "../src/lib/railwayLanguages";

const expectedLocales = [
  "ja", "en", "zh-CN", "zh-TW", "zh-HK", "hi", "es", "fr", "de",
  "pt-BR", "pt-PT", "ru", "ar", "id", "ko", "vi", "tr", "it",
  "pl", "cs", "ms", "ro",
];
const localeDirectory = new URL("../src/locales/", import.meta.url);

function flatten(messages, prefix = "") {
  return Object.fromEntries(Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(flatten(value, path))
      : [[path, value]];
  }));
}

function loadLocale(locale) {
  return flatten(parse(readFileSync(new URL(`${locale}.yml`, localeDirectory), "utf8")));
}

describe("first and second language scopes", () => {
  test("registers exactly the requested languages, with a translation file for each", () => {
    expect([...SUPPORTED_LOCALE_CODES].sort()).toEqual([...expectedLocales].sort());
    expect(readdirSync(localeDirectory).filter((file) => file.endsWith(".yml")).sort())
      .toEqual(expectedLocales.map((locale) => `${locale}.yml`).sort());
  });

  test("offers every supported language for railway names", () => {
    expect(getRailwayLanguageOptions().map(({ value }) => value).sort())
      .toEqual([...expectedLocales].sort());
  });

  test.each(expectedLocales)("%s has complete, nonempty translations and matching placeholders", (locale) => {
    const reference = loadLocale("en");
    const messages = loadLocale(locale);
    expect(Object.keys(messages).sort()).toEqual(Object.keys(reference).sort());
    expect(messages["input.direct.ren"]).not.toBe(messages["input.direct.rread"]);
    for (const [key, value] of Object.entries(messages)) {
      expect(typeof value, `${locale}: ${key}`).toBe("string");
      expect(value.trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
      expect(value.match(/\{\w+\}/g)?.sort() ?? [], `${locale}: ${key}`)
        .toEqual(reference[key].match(/\{\w+\}/g)?.sort() ?? []);
    }
  });

  test.each(expectedLocales)("%s resolves its routes, metadata and writing direction", (locale) => {
    const path = getLocalePath(locale);
    expect(getLocaleFromPathname(path)).toBe(locale);
    expect(getManifestPath(locale)).toBe(`/manifests/${locale}.webmanifest`);
    expect(getOpenGraphLocale(locale)).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    expect(getLocaleDirection(locale)).toBe(locale === "ar" ? "rtl" : "ltr");
  });

  test("defaults unknown writing directions to left to right", () => {
    expect(getLocaleDirection("unsupported")).toBe("ltr");
  });
});
