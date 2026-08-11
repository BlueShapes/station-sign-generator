import { describe, expect, test } from "bun:test";
import { resolveSubwayStationNumberAppearance } from "../src/components/signs/subwayStationNumberAppearance.ts";

describe("subway station-number appearance", () => {
  const localLines = [
    {
      id: "line-selected",
      prefix: "M",
      color: "#dd3839",
      stationNumberStyle: "tokyometro",
    },
    {
      id: "line-adjacent",
      prefix: "JC",
      color: "#f15a22",
      stationNumberStyle: "jreast",
    },
  ];

  test("matches color and shape to the number prefix in simple input", () => {
    expect(
      resolveSubwayStationNumberAppearance({
        prefix: "JC",
        localLines,
        fallbackColor: "#dd3839",
      }),
    ).toEqual({ color: "#f15a22", style: "jreast" });
  });

  test("uses resolved source-line metadata from route input", () => {
    expect(
      resolveSubwayStationNumberAppearance({
        prefix: "A",
        color: "#e85298",
        style: "jrcentral",
        localLines,
        fallbackColor: "#dd3839",
      }),
    ).toEqual({ color: "#e85298", style: "jrcentral" });
  });

  test("keeps the subway badge defaults when no metadata exists", () => {
    expect(
      resolveSubwayStationNumberAppearance({
        prefix: "G",
        fallbackColor: "#f39700",
      }),
    ).toEqual({ color: "#f39700", style: "tokyometro" });
  });
});
