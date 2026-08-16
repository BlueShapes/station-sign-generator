import { describe, expect, test } from "bun:test";
import {
  getStationNumberSelectionLimit,
  getDefaultStationNumberLineIds,
  getSelectedStationNumberThreeLetterCode,
  resolveSelectedStationNumbers,
} from "../src/components/tabs/routeStationNumberSelection.ts";

const candidates = [
  { lineId: "jb", prefix: "JB", value: "07" },
  { lineId: "jc", prefix: "JC", value: "06" },
  { lineId: "t", prefix: "T", value: "01" },
];

describe("route-input station-number selection", () => {
  test("exposes all three supported JR East badge slots", () => {
    expect(
      getStationNumberSelectionLimit({
        numberPrimary: "optional",
        numberSecondary: "optional",
        numberTertiary: "optional",
      }),
    ).toBe(3);
    expect(
      getStationNumberSelectionLimit({
        numberPrimary: "required",
        numberSecondary: "hidden",
      }),
    ).toBe(1);
  });

  test("defaults to the selected route first without hiding other systems", () => {
    expect(getDefaultStationNumberLineIds("jc", candidates, 3)).toEqual(["jc"]);
    expect(getDefaultStationNumberLineIds("jc", candidates, 3, true)).toEqual([
      "jc",
      "jb",
      "t",
    ]);
  });

  test("maps the user-selected badge order to the rendered slots", () => {
    expect(
      resolveSelectedStationNumbers(["t", "jc"], candidates, 3).map(
        ({ lineId }) => lineId,
      ),
    ).toEqual(["t", "jc"]);
  });

  test("uses the code from a selected JR East badge's connected station", () => {
    expect(
      getSelectedStationNumberThreeLetterCode([
        {
          stationNumberStyle: "tokyometro",
          threeLetterCode: null,
        },
        {
          stationNumberStyle: "jreast",
          threeLetterCode: "SJK",
        },
      ]),
    ).toBe("SJK");
  });

  test("keeps the current station code as a fallback", () => {
    expect(
      getSelectedStationNumberThreeLetterCode(
        [{ stationNumberStyle: "jreast", threeLetterCode: null }],
        "KTR",
      ),
    ).toBe("KTR");
  });
});
