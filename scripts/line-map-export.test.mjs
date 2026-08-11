import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  roundedRectPath,
  svgFontWeight,
  svgTextBaselineAdjustment,
} from "../src/lib/konvaSvgExport";
import {
  applyAdaptivePngFilters,
  createPngHeader,
  createPngChunk,
  getLineMapPngSizeOptions,
  getStagePngExportBounds,
} from "../src/lib/streamingPngExport";

function inspectSfnt(path) {
  const font = readFileSync(path);
  const tables = new Map();
  const tableCount = font.readUInt16BE(4);
  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;
    tables.set(
      font.toString("ascii", recordOffset, recordOffset + 4),
      font.readUInt32BE(recordOffset + 8),
    );
  }
  const os2Offset = tables.get("OS/2");
  return {
    tables,
    weight: os2Offset === undefined ? null : font.readUInt16BE(os2Offset + 4),
  };
}

describe("line-map exports", () => {
  test("keeps independent rounded corners in vector badges", () => {
    expect(roundedRectPath(30, 40, [4, 4, 0, 0])).toContain(
      "M 4 0 H 26 Q 30 0 30 4",
    );
    expect(roundedRectPath(30, 40, [4, 4, 0, 0])).toContain(
      "H 0 Q 0 40 0 40 V 4 Q 0 0 4 0 Z",
    );
  });

  test("offers correctly sized PNG options through XXL", () => {
    const options = getLineMapPngSizeOptions(100, 50);
    expect(options).toHaveLength(6);
    expect(options[0]).toEqual({ label: "100 × 50 (SS)", value: 1 });
    expect(options[5]).toEqual({ label: "600 × 300 (XXL)", value: 6 });
  });

  test("preserves numeric badge weights for SVG and PDF font matching", () => {
    expect(svgFontWeight("normal")).toBe("400");
    expect(svgFontWeight("bold")).toBe("700");
    expect(svgFontWeight("600")).toBe("600");
    expect(svgFontWeight("italic 700")).toBe("700");
  });

  test("can compensate PDF badge baselines without moving station names", () => {
    const adjustments = {
      HindSemiBold: -1,
      JostTrispaceHybrid: -1,
      PublicSans: -1,
    };
    expect(svgTextBaselineAdjustment("HindSemiBold", adjustments)).toBe(-1);
    expect(
      svgTextBaselineAdjustment("'JostTrispaceHybrid', sans-serif", adjustments),
    ).toBe(-1);
    expect(svgTextBaselineAdjustment("NotoSansJP", adjustments)).toBe(0);
    expect(svgTextBaselineAdjustment("PublicSans", adjustments)).toBe(-1);
  });

  test("uses static Noto Sans JP faces for PDF weight fidelity", () => {
    const regular = inspectSfnt("src/fonts/NotoSansJP-Regular.ttf");
    const bold = inspectSfnt("src/fonts/NotoSansJP-Bold.ttf");
    expect(regular.tables.has("fvar")).toBe(false);
    expect(bold.tables.has("fvar")).toBe(false);
    expect(regular.weight).toBe(400);
    expect(bold.weight).toBe(700);
  });

  test("writes valid PNG chunk framing", () => {
    expect([...createPngChunk("IEND")]).toEqual([
      0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]);
  });

  test("writes opaque RGB PNG headers", () => {
    const header = createPngHeader(320, 180);
    expect(new DataView(header.buffer).getUint32(0)).toBe(320);
    expect(new DataView(header.buffer).getUint32(4)).toBe(180);
    expect(header[8]).toBe(8);
    expect(header[9]).toBe(2);
  });

  test("selects efficient PNG filters across horizontal and repeated rows", () => {
    const repeatedPixelRow = new Uint8Array([10, 20, 30, 10, 20, 30]);
    expect([...applyAdaptivePngFilters(repeatedPixelRow, 2, 1)]).toEqual([
      1, 10, 20, 30, 0, 0, 0,
    ]);

    const previous = new Uint8Array(repeatedPixelRow);
    expect([
      ...applyAdaptivePngFilters(repeatedPixelRow, 2, 1, previous),
    ]).toEqual([2, 0, 0, 0, 0, 0, 0]);
  });

  test("trims a full white canvas while retaining padded visible content", () => {
    const shape = ({ className, bounds, fill = "#333" }) => ({
      isVisible: () => true,
      getAbsoluteOpacity: () => 1,
      getClassName: () => className,
      getClientRect: () => bounds,
      fill: () => fill,
      strokeEnabled: () => false,
      stroke: () => undefined,
    });
    const background = shape({
      className: "Rect",
      bounds: { x: 0, y: 0, width: 100, height: 80 },
      fill: "white",
    });
    const content = shape({
      className: "Text",
      bounds: { x: 20, y: 30, width: 40, height: 10 },
    });
    const layer = {
      isVisible: () => true,
      getAbsoluteOpacity: () => 1,
      getChildren: () => [background, content],
    };
    const stage = {
      isVisible: () => true,
      getAbsoluteOpacity: () => 1,
      getChildren: () => [layer],
      width: () => 100,
      height: () => 80,
    };
    expect(getStagePngExportBounds(stage, 5)).toEqual({
      x: 15,
      y: 25,
      width: 50,
      height: 20,
    });
  });

  test("keeps SVG and PDF route-map controls and tiled PNG export wired", () => {
    const routeInput = readFileSync(
      "src/components/tabs/RouteInputTab.tsx",
      "utf8",
    );
    const exportModule = readFileSync("src/lib/lineMapExport.ts", "utf8");
    expect(routeInput).toContain('value: "svg"');
    expect(routeInput).toContain('value: "pdf"');
    expect(routeInput).toContain("createLineMapExportBlob");
    expect(exportModule).toContain("exportStageToStreamingPng");
    expect(exportModule).toContain("svg2pdf");
    expect(exportModule).toContain("NotoSansJP-Regular.ttf?url");
    expect(exportModule).toContain("NotoSansJP-Bold.ttf?url");
    expect(exportModule).toContain('pdf.addFont(filename, family, "normal", weight');
    expect(exportModule).not.toContain('pdf.addFont(filename, family, "bold"');
  });
});
