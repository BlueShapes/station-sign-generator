import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { moveAdjacentStationId } from "../src/components/tabs/adjacentStationOrder.ts";
import { SIGN_STYLE_FIELDS } from "../src/components/signs/signStyles.ts";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales.ts";

describe("route-input adjacent station order", () => {
  test("limits only the JR East branch style to three adjacent stations", () => {
    for (const [style, fields] of Object.entries(SIGN_STYLE_FIELDS)) {
      expect(fields.maxAdjacentCount).toBe(style === "jreastbranch" ? 3 : 2);
    }
  });

  test("interpolates the adjacent-station limit in every locale", () => {
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const messages = parse(
        readFileSync(`src/locales/${locale}.yml`, "utf8"),
      );
      expect(messages.route.sign["adjacent-select"]).toContain("{count}");
      expect(messages.route.sign["adjacent-move-up"]).toBeTruthy();
      expect(messages.route.sign["adjacent-move-down"]).toBeTruthy();
    }
  });

  test("can reorder two stations without changing the selection", () => {
    expect(moveAdjacentStationId(["outer", "inner"], 0, 1)).toEqual([
      "inner",
      "outer",
    ]);
  });

  test("ignores moves outside the selected-station range", () => {
    expect(moveAdjacentStationId(["outer", "inner"], 0, -1)).toEqual([
      "outer",
      "inner",
    ]);
    expect(moveAdjacentStationId([], 0, 1)).toEqual([]);
    expect(moveAdjacentStationId(["only"], 0, 0)).toEqual(["only"]);
  });

  test("allows arbitrary ordering of three branch selections", () => {
    const firstMove = moveAdjacentStationId(
      ["upper", "center", "lower"],
      2,
      0,
    );
    expect(firstMove).toEqual(["lower", "upper", "center"]);
    expect(moveAdjacentStationId(firstMove, 2, 1)).toEqual([
      "lower",
      "center",
      "upper",
    ]);
  });
});
