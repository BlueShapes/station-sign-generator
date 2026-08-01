import { describe, expect, test } from "bun:test";
import {
  SHARE_SERVICES_BY_LOCALE,
  getShareServices,
} from "../src/config/shareServices";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales";

describe("locale-specific share services", () => {
  test("defines a share-service list for every supported locale", () => {
    expect(Object.keys(SHARE_SERVICES_BY_LOCALE).sort()).toEqual(
      [...SUPPORTED_LOCALE_CODES].sort(),
    );
  });

  test("keeps copy first and does not contain duplicate services", () => {
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const services = getShareServices(locale);
      expect(services[0]).toBe("copy");
      expect(new Set(services).size).toBe(services.length);
    }
  });

  test("preserves the existing Japanese menu", () => {
    expect(getShareServices("ja")).toEqual([
      "copy",
      "twitter",
      "x",
      "misskey",
      "mastodon",
      "reddit",
      "line",
    ]);
  });

  test("uses copy only for Simplified Chinese", () => {
    expect(getShareServices("zh-CN")).toEqual(["copy"]);
  });
});
