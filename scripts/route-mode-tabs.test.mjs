import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales";

function loadLocale(locale) {
  return parse(readFileSync(`src/locales/${locale}.yml`, "utf8"));
}

describe("route mode tabs", () => {
  test("defines both line-map labels in every locale", () => {
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const mode = loadLocale(locale).route?.mode;
      expect(mode?.linemap).toBeTruthy();
      expect(mode?.["multiline-linemap"]).toBeTruthy();
    }
  });

  test("uses the requested Japanese labels", () => {
    const mode = loadLocale("ja").route.mode;
    expect(mode.linemap).toBe("路線図（単線・直通）");
    expect(mode["multiline-linemap"]).toBe("路線図（複線）");
  });
});
