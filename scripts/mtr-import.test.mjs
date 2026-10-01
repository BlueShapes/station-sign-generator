import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales.ts";
import { MTR_JSON_MAX_BYTES, parseMtrJson } from "../src/lib/mtrImport.ts";
import { fetchMtrMap, getMtrApiUrl } from "../src/lib/mtrMapApi.ts";

// Synthetic fixtures follow the published 4.0.5 / 4.1.0-beta.2 map schema
// and the 3.2.2-hotfix-2 Webserver handler. See docs/mtr-import.md for sources.
export const modern = {
  code: 200, text: "OK", version: 1,
  data: {
    stations: [{ id: "a", name: "中央|Central", color: 0 }, { id: "b", name: "北|North", color: 255 }],
    routes: [{ id: "r", name: "本線|Main||Fourth", number: "M", color: 255, type: "train_normal", hidden: false, circularState: "NONE", stations: [{ id: "b", name: "Platform 2" }, { id: "a", name: "Platform 1" }] }],
    dimensions: ["minecraft:overworld"],
  },
};
export const legacy = [
  { stations: { "-123": { name: "中央|Central", color: 0 }, "456": { name: "北|North", color: 255 } }, routes: [{ name: "本線|Main||北行", number: "", color: 255, type: "train_normal", circular: "", stations: ["456_255", "-123_255"] }] },
  { stations: { "9": { name: "ネザー|Nether", color: 0 } }, routes: [{ name: "ネザー線|Nether Line", color: 0, number: "N", type: "train_normal", circular: "", stations: ["9_0"] }] },
];

describe("MTR format adapters", () => {
  for (const version of ["4.0.5", "4.1.0-beta.2"]) {
    test(`reads ${version} response code, ordered station IDs, multilingual names and RGB`, () => {
      const map = parseMtrJson(JSON.stringify(modern), version);
      expect(map.stations[0].names).toEqual(["中央", "Central"]);
      expect(map.routes[0]).toMatchObject({ names: ["本線", "Main", "", "Fourth"], prefix: "M", color: "#0000ff", isLoop: false, stationIds: ["b", "a"] });
      expect(map.routes[0].names).not.toContain("Platform 1");
    });
  }
  test("selects legacy dimensions and preserves signed IDs without converting them to numbers", () => {
    const map = parseMtrJson(JSON.stringify(legacy), "3.2.2-hotfix-2", 0);
    expect(map.routes[0].stationIds).toEqual(["456", "-123"]);
    const nether = parseMtrJson(JSON.stringify(legacy), "3.2.2-hotfix-2", 1);
    expect(nether.routes[0]).toMatchObject({ names: ["ネザー線", "Nether Line"], color: "#000000", stationIds: ["9"] });
    expect(() => parseMtrJson(JSON.stringify(legacy), "3.2.2-hotfix-2", 2)).toThrow();
  });
  test("normalizes repeated platforms and explicit loop closure, excludes retracing routes", () => {
    const data = structuredClone(modern);
    data.data.routes[0].circularState = "CLOCKWISE";
    data.data.routes[0].stations = [{ id: "a" }, { id: "a" }, { id: "b" }, { id: "a" }];
    data.data.routes.push({ ...data.data.routes[0], id: "retracing", circularState: "NONE" });
    const map = parseMtrJson(JSON.stringify(data), "4.0.5");
    expect(map.routes[0]).toMatchObject({ isLoop: true, stationIds: ["a", "b"] });
    expect(map.routes).toHaveLength(1);
    expect(map.skippedRoutes).toBe(1);
  });
  test("rejects malformed payloads, failed envelopes, duplicate IDs and missing station references", () => {
    for (const data of [null, {}, { ...modern, code: 400 }, { data: { stations: [], routes: [] } }, { ...modern, data: { ...modern.data, stations: [...modern.data.stations, modern.data.stations[0]] } }, { ...modern, data: { ...modern.data, stations: [] } }]) {
      expect(() => parseMtrJson(JSON.stringify(data), "4.0.5")).toThrow();
    }
    expect(() => parseMtrJson("not JSON", "4.0.5")).toThrow();
    expect(() => parseMtrJson(JSON.stringify(modern), "3.2.2-hotfix-2")).toThrow();
    expect(() => parseMtrJson(" ".repeat(MTR_JSON_MAX_BYTES + 1), "4.0.5")).toThrow();
  });
});

describe("MTR browser requests", () => {
  test("builds API URLs with deployment prefixes, index.html, existing API paths and dimension", () => {
    expect(getMtrApiUrl("https://example.org/map/index.html#station", "4.0.5", 2)).toBe("https://example.org/map/mtr/api/map/stations-and-routes?dimension=2");
    expect(getMtrApiUrl("https://example.org/map/mtr/api/map/stations-and-routes?dimension=9", "4.1.0-beta.2", 1)).toBe("https://example.org/map/mtr/api/map/stations-and-routes?dimension=1");
    expect(getMtrApiUrl("http://localhost:8888/data", "3.2.2-hotfix-2", 1)).toBe("http://localhost:8888/data?dimension=1");
    expect(getMtrApiUrl("https://example.org/map", "3.2.2-hotfix-2", 0)).toBe("https://example.org/map/data?dimension=0");
    expect(getMtrApiUrl("https://example.org/metadata", "4.0.5", 0)).toBe("https://example.org/metadata/mtr/api/map/stations-and-routes?dimension=0");
  });
  test("rejects non-HTTP schemes, credentials and invalid dimensions", () => {
    for (const url of ["javascript:alert(1)", "file:///data", "https://user:pass@example.org", "example.org"]) expect(() => getMtrApiUrl(url, "4.0.5", 0)).toThrow();
    for (const dimension of [-1, 1.5, NaN, Infinity]) expect(() => getMtrApiUrl("https://example.org", "4.0.5", dimension)).toThrow();
  });
  test("fetches without credentials/referrer and selects the legacy dimension", async () => {
    const previous = globalThis.fetch;
    let options;
    globalThis.fetch = async (_url, init) => { options = init; return new Response(JSON.stringify(legacy)); };
    try {
      const map = await fetchMtrMap("https://example.org/data?dimension=1", "3.2.2-hotfix-2");
      expect(map.routes[0].names[0]).toBe("ネザー線");
      expect(options).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer", method: "GET" });
    } finally { globalThis.fetch = previous; }
  });
  test("limits streamed bodies even without Content-Length and rejects HTTP errors", async () => {
    const previous = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MTR_JSON_MAX_BYTES + 1)); controller.close(); } }));
      await expect(fetchMtrMap("https://example.org/data", "3.2.2-hotfix-2")).rejects.toMatchObject({ code: "too-large" });
      globalThis.fetch = async () => new Response("error", { status: 404 });
      await expect(fetchMtrMap("https://example.org/data", "3.2.2-hotfix-2")).rejects.toMatchObject({ code: "fetch-failed" });
    } finally { globalThis.fetch = previous; }
  });
});

test("all supported locales provide identical MTR keys and interpolation placeholders", () => {
  const flatten = (value, prefix = "") => Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof item === "string" ? [[path, item]] : Object.entries(flatten(item, path));
  }));
  const english = flatten(parse(readFileSync(new URL("../src/locales/en.yml", import.meta.url), "utf8"))["mtr-import"]);
  for (const locale of SUPPORTED_LOCALE_CODES) {
    const messages = flatten(parse(readFileSync(new URL(`../src/locales/${locale}.yml`, import.meta.url), "utf8"))["mtr-import"]);
    expect(Object.keys(messages).sort()).toEqual(Object.keys(english).sort());
    for (const key of Object.keys(english)) expect(messages[key].match(/\{\w+\}/g)?.sort() ?? []).toEqual(english[key].match(/\{\w+\}/g)?.sort() ?? []);
  }
});
