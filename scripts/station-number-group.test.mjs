import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  resolveConnectedStationNumberRuns,
  resolveConnectedStationNumbers,
} from "../src/components/signs/stationNumberGroup";

describe("connected station-number badges", () => {
  test("shares one three-letter code across JR East badges", () => {
    const result = resolveConnectedStationNumbers(
      [
        { prefix: "JY", value: "17", style: "jreast", threeLetterCode: "SJK" },
        { prefix: "JS", value: "20", style: "jreast", threeLetterCode: "SJK" },
      ],
      "SJK",
      true,
    );

    expect(result.sharedThreeLetterCode).toBe("SJK");
    expect(result.numbers.map((number) => number.threeLetterCode)).toEqual([
      null,
      null,
    ]);
  });

  test("keeps the code only on the JR East badge in a mixed group", () => {
    const result = resolveConnectedStationNumbers(
      [
        { prefix: "M", value: "08", style: "tokyometro" },
        { prefix: "JY", value: "17", style: "jreast" },
      ],
      "SJK",
      true,
    );

    expect(result.sharedThreeLetterCode).toBeNull();
    expect(result.numbers.map((number) => number.threeLetterCode)).toEqual([
      null,
      "SJK",
    ]);
  });

  test("does not add a code to connected non-JR East badges", () => {
    const result = resolveConnectedStationNumbers(
      [
        { prefix: "M", value: "08", style: "tokyometro" },
        { prefix: "S", value: "01", style: "tokyometro" },
      ],
      "SJK",
      true,
    );

    expect(result.sharedThreeLetterCode).toBeNull();
    expect(result.numbers.every((number) => !number.threeLetterCode)).toBe(true);
  });

  test("groups only consecutive JR East badges under a shared code", () => {
    const runs = resolveConnectedStationNumberRuns(
      [
        { prefix: "M", style: "tokyometro" },
        { prefix: "JY", style: "jreast" },
        { prefix: "JS", style: "jreast" },
      ],
      "SJK",
    );

    expect(runs.map((run) => run.numbers.map((number) => number.prefix)))
      .toEqual([["M"], ["JY", "JS"]]);
    expect(runs.map((run) => run.sharedThreeLetterCode)).toEqual([null, "SJK"]);
    expect(runs[0].numbers[0].threeLetterCode).toBeNull();
    expect(runs[1].numbers.every((number) => !number.threeLetterCode)).toBe(true);
  });

  test("does not join JR East badges separated by another style", () => {
    const runs = resolveConnectedStationNumberRuns(
      [
        { prefix: "JY", style: "jreast" },
        { prefix: "M", style: "tokyometro" },
        { prefix: "JS", style: "jreast" },
      ],
      "SJK",
    );

    expect(runs).toHaveLength(3);
    expect(runs.every((run) => run.sharedThreeLetterCode === null)).toBe(true);
    expect(runs.map((run) => run.numbers[0].threeLetterCode)).toEqual([
      "SJK",
      null,
      "SJK",
    ]);
  });

  test("reads each through-route boundary code from its actual station", () => {
    const routeInput = readFileSync(
      "src/components/tabs/RouteInputTab.tsx",
      "utf8",
    );
    const renderer = readFileSync(
      "src/components/signs/LineMapRenderer.tsx",
      "utf8",
    );

    expect(routeInput).toContain(
      "stationById.get(incomingStationId)?.three_letter_code",
    );
    expect(routeInput).toContain(
      "stationById.get(outgoingStationId)?.three_letter_code",
    );
    expect(renderer).toContain("getSharedStationThreeLetterCode(");
    expect(renderer).toContain('if (orientation === "horizontal")');
  });
});
