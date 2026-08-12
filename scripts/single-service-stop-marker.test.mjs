import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("single-service stop markers", () => {
  test("uses an outlined diamond that remains visible over thick tracks", () => {
    const source = readFileSync(
      "src/components/signs/LineMapRenderer.tsx",
      "utf8",
    );

    const marker = source.slice(
      source.indexOf("function ServiceStopMarker"),
      source.indexOf("function ServiceStopMarker") + 1500,
    );
    expect(marker).toContain('if (status === "special")');
    expect(marker).toContain("y - radius");
    expect(marker).toContain("x + radius");
    expect(marker).toContain('fill="white"');
    expect(marker).toContain("closed");
  });

  test("applies the status-aware marker in every map orientation", () => {
    const source = readFileSync(
      "src/components/signs/LineMapRenderer.tsx",
      "utf8",
    );

    expect(source.match(/<ServiceStopMarker/g)).toHaveLength(6);
    expect(source.match(/const singleServiceStatus =/g)).toHaveLength(4);
  });
});
