import { describe, expect, test } from "bun:test";
import { DEFAULT_DATA } from "../src/db/seed";
import {
  DIRECT_INPUT_JSON_MAX_LENGTH,
  sanitizeDirectInputData,
  TEXT_INPUT_MAX_LENGTH,
  truncateTextInput,
} from "../src/lib/textInputSafety";

describe("text input safety", () => {
  test("keeps the direct-input JSON limit well above ordinary form data", () => {
    expect(JSON.stringify(DEFAULT_DATA).length).toBeLessThan(
      DIRECT_INPUT_JSON_MAX_LENGTH,
    );
  });

  test("truncates text at the shared maximum length", () => {
    expect(truncateTextInput("x".repeat(TEXT_INPUT_MAX_LENGTH + 50))).toHaveLength(
      TEXT_INPUT_MAX_LENGTH,
    );
  });

  test("sanitizes top-level and nested station text", () => {
    const oversized = "data:image/png;base64," + "A".repeat(1_000);
    const sanitized = sanitizeDirectInputData({
      ...DEFAULT_DATA,
      primaryName: oversized,
      left: [{ ...DEFAULT_DATA.left[0], secondaryName: oversized }],
      stationAreas: [{ id: "area", name: oversized }],
      localLines: [{ id: "line", prefix: oversized, color: "#ffffff" }],
    });

    expect(sanitized.primaryName).toHaveLength(TEXT_INPUT_MAX_LENGTH);
    expect(sanitized.left[0].secondaryName).toHaveLength(TEXT_INPUT_MAX_LENGTH);
    expect(sanitized.stationAreas?.[0].name).toHaveLength(
      TEXT_INPUT_MAX_LENGTH,
    );
    expect(sanitized.localLines?.[0].prefix).toHaveLength(
      TEXT_INPUT_MAX_LENGTH,
    );
  });
});
