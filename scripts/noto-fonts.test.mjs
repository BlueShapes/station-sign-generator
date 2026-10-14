import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  BUILTIN_FONTS,
  getRecommendedNotoFont,
  loadBuiltinFont,
} from "../src/lib/fontCatalog";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales";
import { CANVAS_FONT_SPECS, JR_EAST_FONT_SPECS } from "../src/lib/fonts";

const originalFontFace = globalThis.FontFace;
afterEach(() => {
  if (originalFontFace === undefined) delete globalThis.FontFace;
  else globalThis.FontFace = originalFontFace;
});

describe("Noto Sans recommendations", () => {
  test("matches every supported locale to a registered family", () => {
    const scriptFamilies = {
      ja: "NotoSansJP", "zh-CN": "NotoSansSC", "zh-TW": "NotoSansTC",
      "zh-HK": "NotoSansHK", ko: "NotoSansKR", hi: "NotoSansDevanagari",
      ar: "NotoSansArabic",
    };
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const font = getRecommendedNotoFont(locale);
      expect(font?.family, locale).toBe(scriptFamilies[locale] ?? "NotoSans");
      expect(BUILTIN_FONTS).toContain(font);
    }
    expect(getRecommendedNotoFont("unsupported")).toBeUndefined();
    expect(getRecommendedNotoFont("__proto__")).toBeUndefined();
  });

  test("keeps additional language fonts outside automatic canvas loading", () => {
    const optionalFonts = BUILTIN_FONTS.filter((font) => font.optional);
    expect(optionalFonts).toHaveLength(4);
    for (const font of optionalFonts) {
      expect(font.sample).toBeTruthy();
      expect(CANVAS_FONT_SPECS.some((spec) => spec.endsWith(` ${font.family}`))).toBe(false);
      expect(JR_EAST_FONT_SPECS.some((spec) => spec.endsWith(` ${font.family}`))).toBe(false);
    }
  });

  test("bundles authentic font bytes, sizes, CSS faces and upstream licenses", () => {
    const sources = JSON.parse(readFileSync("src/fonts/noto-sans-sources.json", "utf8"));
    const css = readFileSync("src/styles/global.css", "utf8");
    expect(sources).toHaveLength(4);
    for (const source of sources) {
      const data = readFileSync(`src/fonts/${source.file}`);
      expect(data.readUInt32BE(0)).toBe(0x00010000);
      expect(data.length).toBe(source.bytes);
      expect(createHash("sha256").update(data).digest("hex")).toBe(source.sha256);
      expect(source.source).toMatch(/^https:\/\/raw\.githubusercontent\.com\/google\/fonts\/[a-f0-9]{40}\/ofl\//);
      expect(css).toContain(`../fonts/${source.file}`);
      expect(readFileSync(`src/fonts/${source.license}`, "utf8"))
        .toContain("SIL OPEN FONT LICENSE Version 1.1");
      const font = BUILTIN_FONTS.find((font) => font.family === source.file.replace("-Variable.ttf", ""));
      expect(font?.sizeApprox).toBe(data.length);
      expect(font?.license?.url).toContain(source.license);
    }
  });

  test("loads an existing CSS-only font with its requested sample", async () => {
    const font = { id: "legacy", family: "Legacy", spec: "400 1em Legacy", sample: "文字" };
    let request;
    await loadBuiltinFont(font, { load: async (...args) => {
      request = args;
      return [{ status: "loaded" }];
    } });
    expect(request).toEqual(["400 1em Legacy", "文字"]);
  });

  test("rejects missing faces, incomplete loads and failed downloads", async () => {
    const font = { family: "Legacy", spec: "400 1em Legacy" };
    await expect(loadBuiltinFont(font, { load: async () => [] })).rejects.toThrow("unavailable");
    await expect(loadBuiltinFont(font, { load: async () => [{ status: "error" }] })).rejects.toThrow("unavailable");
    await expect(loadBuiltinFont(font, { load: async () => { throw new Error("Network error"); } }))
      .rejects.toThrow("Network error");
  });

  test("uses fresh variable faces so a failed Noto load can be retried", async () => {
    let attempts = 0;
    const registered = new Set();
    const created = [];
    globalThis.FontFace = class {
      constructor(family, source, descriptors) {
        this.family = family;
        this.source = source;
        this.descriptors = descriptors;
        this.status = "unloaded";
        created.push(this);
      }
      async load() {
        attempts++;
        if (attempts === 1) {
          this.status = "error";
          throw new Error("Offline");
        }
        this.status = "loaded";
        return this;
      }
    };
    const fontSet = {
      add: (face) => { registered.add(face); return fontSet; },
      delete: (face) => registered.delete(face),
      load: () => { throw new Error("Must not reuse a failed CSS face"); },
    };
    const font = getRecommendedNotoFont("ar");
    await expect(loadBuiltinFont(font, fontSet)).rejects.toThrow("Offline");
    expect(registered.size).toBe(0);
    await loadBuiltinFont(font, fontSet);
    expect(attempts).toBe(2);
    expect(registered.size).toBe(1);
    expect(created[0]).not.toBe(created[1]);
    expect(created[1].family).toBe("NotoSansArabic");
    expect(created[1].source).toContain(font.sourceUrl);
    expect(created[1].descriptors.weight).toBe("100 900");
  });
});
