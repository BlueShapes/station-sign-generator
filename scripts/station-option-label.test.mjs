import { describe, expect, test } from "bun:test";
import { formatStationOptionLabel } from "../src/components/tabs/stationOptionLabel.ts";

describe("station option labels", () => {
  test("places the line prefix and station number before the station name", () => {
    expect(
      formatStationOptionLabel("荻窪", { prefix: "M", value: "01" }),
    ).toBe("[M01] 荻窪");
    expect(
      formatStationOptionLabel("秋葉原", { prefix: "JB", value: "19" }),
    ).toBe("[JB19] 秋葉原");
  });

  test("keeps the station name unchanged when no number is registered", () => {
    expect(formatStationOptionLabel("横浜", null)).toBe("横浜");
  });

  test("shows a number even when its line has no prefix", () => {
    expect(
      formatStationOptionLabel("関内", { prefix: "", value: "03" }),
    ).toBe("[03] 関内");
  });
});
