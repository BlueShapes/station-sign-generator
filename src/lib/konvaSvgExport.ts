import Konva from "konva";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(4)).toString();
}

function nodeTransform(node: Konva.Node): string {
  const matrix = node.getAbsoluteTransform().getMatrix();
  return `matrix(${matrix.map(formatNumber).join(" ")})`;
}

function paintAttributes(shape: Konva.Shape): string {
  const fill = shape.fillEnabled() && shape.fill() ? shape.fill() : "none";
  const stroke = shape.strokeEnabled() && shape.stroke() ? shape.stroke() : "none";
  return [
    `fill="${escapeXml(String(fill))}"`,
    `stroke="${escapeXml(String(stroke))}"`,
    `stroke-width="${formatNumber(shape.strokeWidth())}"`,
    `opacity="${formatNumber(shape.getAbsoluteOpacity())}"`,
  ].join(" ");
}

function cornerRadii(value: number | number[], width: number, height: number) {
  const values = Array.isArray(value) ? value : [value, value, value, value];
  const limit = Math.max(0, Math.min(width, height) / 2);
  return [0, 1, 2, 3].map((index) =>
    Math.min(limit, Math.max(0, values[index] ?? values[0] ?? 0)),
  );
}

export function roundedRectPath(
  width: number,
  height: number,
  cornerRadius: number | number[],
): string {
  const [topLeft, topRight, bottomRight, bottomLeft] = cornerRadii(
    cornerRadius,
    width,
    height,
  );
  return [
    `M ${formatNumber(topLeft)} 0`,
    `H ${formatNumber(width - topRight)}`,
    `Q ${formatNumber(width)} 0 ${formatNumber(width)} ${formatNumber(topRight)}`,
    `V ${formatNumber(height - bottomRight)}`,
    `Q ${formatNumber(width)} ${formatNumber(height)} ${formatNumber(width - bottomRight)} ${formatNumber(height)}`,
    `H ${formatNumber(bottomLeft)}`,
    `Q 0 ${formatNumber(height)} 0 ${formatNumber(height - bottomLeft)}`,
    `V ${formatNumber(topLeft)}`,
    `Q 0 0 ${formatNumber(topLeft)} 0`,
    "Z",
  ].join(" ");
}

function serializeRect(node: Konva.Rect): string {
  const transform = nodeTransform(node);
  const paint = paintAttributes(node);
  const radius = node.cornerRadius();
  if (Array.isArray(radius) || radius > 0) {
    return `<path d="${roundedRectPath(node.width(), node.height(), radius)}" transform="${transform}" ${paint}/>`;
  }
  return `<rect width="${formatNumber(node.width())}" height="${formatNumber(node.height())}" transform="${transform}" ${paint}/>`;
}

function serializeCircle(node: Konva.Circle): string {
  return `<circle r="${formatNumber(node.radius())}" transform="${nodeTransform(node)}" ${paintAttributes(node)}/>`;
}

function serializeLine(node: Konva.Line): string {
  const points = node.points();
  const pointText = Array.from({ length: Math.floor(points.length / 2) }, (_, index) =>
    `${formatNumber(points[index * 2])},${formatNumber(points[index * 2 + 1])}`,
  ).join(" ");
  const lineCap = escapeXml(node.lineCap());
  const lineJoin = escapeXml(node.lineJoin());
  const tag = node.closed() ? "polygon" : "polyline";
  return `<${tag} points="${pointText}" transform="${nodeTransform(node)}" ${paintAttributes(node)} stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}"/>`;
}

export function svgFontWeight(fontStyle: string): string {
  const normalized = fontStyle.toLowerCase();
  const numericWeight = normalized.match(/(?:^|\s)([1-9]00)(?:\s|$)/)?.[1];
  return numericWeight ?? (normalized.includes("bold") ? "700" : "400");
}

export type SvgTextBaselineAdjustments = Readonly<Record<string, number>>;

export function svgTextBaselineAdjustment(
  fontFamily: string,
  adjustments: SvgTextBaselineAdjustments,
): number {
  return Object.entries(adjustments).find(([family]) =>
    fontFamily.includes(family),
  )?.[1] ?? 0;
}

function serializeText(
  node: Konva.Text,
  baselineAdjustments: SvgTextBaselineAdjustments,
): string {
  const fontStyle = node.fontStyle().toLowerCase();
  const fontWeight = svgFontWeight(fontStyle);
  const italic = fontStyle.includes("italic") ? "italic" : "normal";
  const align = node.align();
  const textAnchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
  const x = align === "center" ? node.width() / 2 : align === "right" ? node.width() : 0;
  const fontSize = node.fontSize();
  const lineHeight = node.lineHeight() * fontSize;
  const baselineAdjustment = svgTextBaselineAdjustment(
    node.fontFamily(),
    baselineAdjustments,
  );
  const lines = node.text().split("\n");
  const tspans = lines.map((line, index) =>
    `<tspan x="${formatNumber(x)}" y="${formatNumber(lineHeight * (index + 0.5) + baselineAdjustment)}">${escapeXml(line)}</tspan>`,
  ).join("");
  const letterSpacing = node.letterSpacing();
  const decoration = node.textDecoration();
  return `<text transform="${nodeTransform(node)}" fill="${escapeXml(String(node.fill() ?? "black"))}" opacity="${formatNumber(node.getAbsoluteOpacity())}" font-family="${escapeXml(node.fontFamily())}" font-size="${formatNumber(fontSize)}" font-weight="${fontWeight}" font-style="${italic}" text-anchor="${textAnchor}" alignment-baseline="middle" dominant-baseline="middle" letter-spacing="${formatNumber(letterSpacing)}" text-decoration="${escapeXml(decoration)}">${tspans}</text>`;
}

function serializeNode(
  node: Konva.Node,
  baselineAdjustments: SvgTextBaselineAdjustments,
): string {
  if (!node.isVisible()) return "";
  const className = node.getClassName();
  if (className === "Rect") return serializeRect(node as Konva.Rect);
  if (className === "Circle") return serializeCircle(node as Konva.Circle);
  if (className === "Line") return serializeLine(node as Konva.Line);
  if (className === "Text") {
    return serializeText(node as Konva.Text, baselineAdjustments);
  }

  const container = node as Konva.Container;
  return typeof container.getChildren === "function"
    ? container
        .getChildren()
        .map((child) => serializeNode(child, baselineAdjustments))
        .join("")
    : "";
}

export function createKonvaStageSvg(
  stage: Konva.Stage,
  embeddedFontCss = "",
  baselineAdjustments: SvgTextBaselineAdjustments = {},
): string {
  const width = Math.ceil(stage.width());
  const height = Math.ceil(stage.height());
  const style = embeddedFontCss ? `<style>${embeddedFontCss}</style>` : "";
  const contents = stage
    .getChildren()
    .map((child) => serializeNode(child, baselineAdjustments))
    .join("");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">`,
    style,
    contents,
    "</svg>",
  ].join("");
}
