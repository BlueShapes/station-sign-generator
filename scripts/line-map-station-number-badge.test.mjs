import { describe, expect, mock, test } from "bun:test";

const konvaNode = () => null;

mock.module("react-konva", () => ({
  Stage: konvaNode,
  Layer: konvaNode,
  Line: konvaNode,
  Circle: konvaNode,
  Rect: konvaNode,
  Text: konvaNode,
  Group: konvaNode,
}));
mock.module("konva", () => ({ default: {} }));

const { StationNumberBadgeGroup, stationNumberGroupDimensions } = await import(
  "../src/components/signs/LineMapRenderer.tsx"
);

function renderedText(node) {
  if (Array.isArray(node)) return node.flatMap(renderedText);
  if (!node || typeof node !== "object") return [];

  const text = typeof node.props?.text === "string" ? [node.props.text] : [];
  if (typeof node.type === "function") {
    return [...text, ...renderedText(node.type(node.props))];
  }
  return [...text, ...renderedText(node.props?.children)];
}

function renderBadge(number) {
  return StationNumberBadgeGroup({
    x: 0,
    y: 0,
    numbers: [number],
    orientation: "horizontal",
    fallbackColor: "#6cbb00",
  });
}

describe("single-line route-map station-number badges", () => {
  test("ignores a three-letter code on a non-JR-East badge", () => {
    const plain = { prefix: "L", value: "05", style: "tokyometro" };
    const withCode = { ...plain, threeLetterCode: "GEN" };

    expect(renderedText(renderBadge(withCode))).not.toContain("GEN");
    expect(stationNumberGroupDimensions([withCode], "horizontal")).toEqual(
      stationNumberGroupDimensions([plain], "horizontal"),
    );
  });

  test("keeps a three-letter code on a JR East badge", () => {
    const plain = { prefix: "JY", value: "17", style: "jreast" };
    const withCode = { ...plain, threeLetterCode: "SJK" };

    expect(renderedText(renderBadge(withCode))).toContain("SJK");
    expect(stationNumberGroupDimensions([withCode], "horizontal").h)
      .toBeGreaterThan(stationNumberGroupDimensions([plain], "horizontal").h);
  });
});
