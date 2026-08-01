import { describe, expect, test } from "bun:test";

import { bumpVersion, replaceVersionSource } from "./bump-version.mjs";

describe("bumpVersion", () => {
  test("increments a prerelease sequence within the same month", () => {
    expect(
      bumpVersion("2026.6.0-beta0", new Date("2026-06-15T00:00:00+09:00")),
    ).toBe("2026.6.0-beta1");
  });

  test("starts a new beta sequence when the month changes", () => {
    expect(
      bumpVersion("2026.6.0-beta10", new Date("2026-07-01T00:00:00+09:00")),
    ).toBe("2026.7.0-beta0");
  });

  test("uses the calendar month in Japan at the UTC month boundary", () => {
    expect(
      bumpVersion("2026.6.0-beta10", new Date("2026-06-30T15:00:00Z")),
    ).toBe("2026.7.0-beta0");
  });

  test("starts a new beta sequence when the year changes", () => {
    expect(
      bumpVersion("2026.12.0-beta4", new Date("2027-01-01T00:00:00+09:00")),
    ).toBe("2027.1.0-beta0");
  });

  test("increments the final numeric segment without a prerelease sequence", () => {
    expect(bumpVersion("2026.6.0")).toBe("2026.6.1");
  });

  test("rejects unsupported version formats", () => {
    expect(() => bumpVersion("development")).toThrow("Unsupported version format");
  });
});

describe("replaceVersionSource", () => {
  test("updates APP_VERSION without changing DB_VERSION", () => {
    expect(
      replaceVersionSource(
        'export const APP_VERSION = "2026.6.0-beta0";\nexport const DB_VERSION = "0.5.1";\n',
        new Date("2026-06-15T00:00:00+09:00"),
      ),
    ).toEqual({
      previousVersion: "2026.6.0-beta0",
      nextVersion: "2026.6.0-beta1",
      content:
        'export const APP_VERSION = "2026.6.0-beta1";\nexport const DB_VERSION = "0.5.1";\n',
    });
  });

  test("rejects a source file without the APP_VERSION export", () => {
    expect(() => replaceVersionSource('export const DB_VERSION = "0.5.1";\n')).toThrow(
      "APP_VERSION export was not found",
    );
  });
});
