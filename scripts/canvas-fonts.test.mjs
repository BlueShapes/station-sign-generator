import { afterEach, describe, expect, test } from "bun:test";
import {
  CANVAS_FONT_SPECS,
  JR_CENTRAL_BADGE_FONT_SPECS,
  JR_CENTRAL_FONT_SPECS,
  JR_EAST_FONT_SPECS,
  LINE_MAP_FONT_SPECS,
  METRO_LONG_FONT_SPECS,
  getStationSignFontSpecs,
  getLineMapFontSpecs,
  waitForCanvasFonts,
} from "../src/lib/fonts.ts";
import { BUILTIN_FONTS } from "../src/db/useFontStore.ts";

const originalDocument = globalThis.document;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

afterEach(() => {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;

  if (originalRequestAnimationFrame === undefined) {
    delete globalThis.requestAnimationFrame;
  } else {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }
});

describe("canvas font loading", () => {
  test("offers Zen Maru Gothic as a licensed pre-installed font", () => {
    const font = BUILTIN_FONTS.find((candidate) =>
      candidate.id === "zen-maru-gothic"
    );

    expect(font).toMatchObject({
      name: "Zen Maru Gothic",
      family: "ZenMaruGothic",
      spec: "700 1em ZenMaruGothic",
      license: { name: "SIL Open Font License 1.1" },
    });
    expect(font?.license?.url).toContain("ZenMaruGothic-OFL.txt");
  });

  test("preloads every font family used by sign renderers", () => {
    expect(CANVAS_FONT_SPECS).toContain("500 1em Jost");
    expect(CANVAS_FONT_SPECS).toContain("600 1em Jost");
    expect(CANVAS_FONT_SPECS).toContain("700 1em JostTrispaceHybrid");
  });

  test("groups fonts by preview type", () => {
    expect(JR_CENTRAL_FONT_SPECS).toEqual([
      "700 1em ZenMaruGothic",
      "400 1em PublicSans",
      "700 1em PublicSans",
    ]);
    expect(JR_CENTRAL_BADGE_FONT_SPECS).toEqual([
      "700 1em PublicSans",
    ]);
    expect(getStationSignFontSpecs("jrcentral")).toBe(
      JR_CENTRAL_FONT_SPECS,
    );
    expect(CANVAS_FONT_SPECS).not.toContain("700 1em ZenMaruGothic");
    expect(JR_EAST_FONT_SPECS).toContain("400 1em NotoSansTC");
    expect(JR_EAST_FONT_SPECS).toContain("400 1em NotoSansKR");
    expect(JR_EAST_FONT_SPECS).not.toContain("500 1em Jost");
    expect(METRO_LONG_FONT_SPECS).toContain("500 1em Jost");
    expect(METRO_LONG_FONT_SPECS).not.toContain("400 1em NotoSansTC");
    for (const style of [
      "metrolong",
      "metroforeign",
      "metromedium",
      "toeimedium",
      "toeilarge",
    ]) {
      expect(getStationSignFontSpecs(style)).toBe(METRO_LONG_FONT_SPECS);
    }
    expect(LINE_MAP_FONT_SPECS).toContain("600 1em HindSemiBold");
    expect(LINE_MAP_FONT_SPECS).toContain("700 1em JostTrispaceHybrid");
    expect(getLineMapFontSpecs(["jreast"])).toBe(LINE_MAP_FONT_SPECS);
    expect(getLineMapFontSpecs(["jrcentral"])).toContain(
      "700 1em PublicSans",
    );
    expect(getStationSignFontSpecs("jreast", "tokyometro")).toContain(
      "700 1em JostTrispaceHybrid",
    );
  });

  test("waits for the remaining fonts when one load fails", async () => {
    let releaseSlowFont;
    const slowFont = new Promise((resolve) => {
      releaseSlowFont = resolve;
    });

    globalThis.document = {
      fonts: {
        load: (spec) =>
          spec === "broken"
            ? Promise.reject(new Error("font failed"))
            : slowFont,
        ready: Promise.resolve(),
      },
    };
    globalThis.requestAnimationFrame = (callback) => {
      queueMicrotask(() => callback(0));
      return 1;
    };

    let settled = false;
    const result = waitForCanvasFonts(["broken", "slow"]).then(
      () => ({ status: "fulfilled" }),
      (error) => ({ status: "rejected", error }),
    );
    result.finally(() => {
      settled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    releaseSlowFont([]);
    const outcome = await result;
    expect(outcome.status).toBe("rejected");
    expect(outcome.error).toBeInstanceOf(AggregateError);
  });

  test("reuses a completed font load", async () => {
    let loadCount = 0;
    globalThis.document = {
      fonts: {
        load: async () => {
          loadCount += 1;
          return [];
        },
        ready: Promise.resolve(),
      },
    };
    globalThis.requestAnimationFrame = (callback) => {
      queueMicrotask(() => callback(0));
      return 1;
    };

    await waitForCanvasFonts(["memoized-test-font"]);
    await waitForCanvasFonts(["memoized-test-font"]);

    expect(loadCount).toBe(1);
  });
});
