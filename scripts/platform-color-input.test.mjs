import { describe, expect, test } from "bun:test";
import { shouldEnableScreenEyeDropper } from "../src/components/inputs/PlatformColorInput.tsx";

describe("platform-safe color input", () => {
  test("disables the native screen eyedropper on Windows", () => {
    expect(
      shouldEnableScreenEyeDropper({
        requested: true,
        userAgentDataPlatform: "Windows",
        navigatorPlatform: "Win32",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      }),
    ).toBe(false);
  });

  test("detects Windows from legacy navigator fields", () => {
    expect(
      shouldEnableScreenEyeDropper({
        requested: true,
        navigatorPlatform: "Win32",
      }),
    ).toBe(false);
    expect(
      shouldEnableScreenEyeDropper({
        requested: true,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      }),
    ).toBe(false);
  });

  test("keeps the native screen eyedropper on other supported platforms", () => {
    expect(
      shouldEnableScreenEyeDropper({
        requested: true,
        userAgentDataPlatform: "macOS",
        navigatorPlatform: "MacIntel",
      }),
    ).toBe(true);
  });

  test("respects callers that explicitly disable the eyedropper", () => {
    expect(
      shouldEnableScreenEyeDropper({
        requested: false,
        userAgentDataPlatform: "macOS",
      }),
    ).toBe(false);
  });
});
