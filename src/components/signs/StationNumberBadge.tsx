import { Group, Ellipse, Rect, Text } from "react-konva";
import JrCentralStationNumberBadge from "./JrCentralStationNumberBadge";
import { getTokyoMetroStationNumberMetrics } from "./stationNumberBadgeMetrics";
import { getStationNumberBadgeThreeLetterCode } from "./subwayStationNumberAppearance";

export type StationNumberBadgeStyle = "jreast" | "tokyometro" | "jrcentral";

type StationNumberBadgeProps = {
  x: number;
  y: number;
  size: number;
  color: string;
  prefix?: string;
  value?: string;
  style?: string;
  /** JR East-only header decoration. Ignored by every other badge style. */
  threeLetterCode?: string;
};

/** Renders one station number using the appearance of the line that owns it. */
export default function StationNumberBadge({
  x,
  y,
  size,
  color,
  prefix = "",
  value = "",
  style = "jreast",
  threeLetterCode,
}: StationNumberBadgeProps) {
  if (!prefix && !value) return null;

  if (style === "jrcentral") {
    return (
      <JrCentralStationNumberBadge
        x={x}
        y={y}
        size={size}
        color={color}
        prefix={prefix}
        value={value}
      />
    );
  }

  const scale = size / 30;

  if (style === "tokyometro") {
    const metrics = getTokyoMetroStationNumberMetrics(size);
    return (
      <Group x={x} y={y}>
        <Ellipse
          x={size / 2}
          y={size / 2}
          radiusX={size / 2 - metrics.strokeWidth / 2}
          radiusY={size / 2 - metrics.strokeWidth / 2}
          stroke={color}
          strokeWidth={metrics.strokeWidth}
        />
        <Text
          text={prefix}
          x={0}
          y={metrics.prefixYOffset}
          width={size}
          align="center"
          fontSize={metrics.prefixFontSize}
          fontFamily="JostTrispaceHybrid"
          fontStyle={metrics.prefixFontWeight}
          fill="black"
        />
        <Text
          text={value}
          x={0}
          y={metrics.valueYOffset}
          width={size}
          align="center"
          fontSize={metrics.valueFontSize}
          fontFamily="JostTrispaceHybrid"
          fontStyle={metrics.valueFontWeight}
          fill="black"
        />
      </Group>
    );
  }

  const jrEastThreeLetterCode = getStationNumberBadgeThreeLetterCode(
    style,
    threeLetterCode,
  );
  const hasHeader = Boolean(jrEastThreeLetterCode);
  const outerPadding = 3 * scale;
  const headerHeight = 12 * scale;
  const badgeY = hasHeader ? headerHeight : 0;
  const fontFamily = "HindSemiBold";

  return (
    <Group x={x} y={y}>
      {hasHeader && (
        <>
          <Rect
            x={-outerPadding}
            y={-outerPadding}
            width={size + outerPadding * 2}
            height={size + headerHeight + outerPadding * 2}
            cornerRadius={4 * scale}
            fill="black"
          />
          <Text
            text={jrEastThreeLetterCode}
            x={-outerPadding}
            y={-1 * scale}
            width={size + outerPadding * 2}
            align="center"
            fontSize={12.2 * scale}
            fontFamily={fontFamily}
            fontStyle="800"
            fill="white"
          />
        </>
      )}
      <Rect
        x={0}
        y={badgeY}
        width={size}
        height={size}
        cornerRadius={2 * scale}
        fill="white"
        stroke={color}
        strokeWidth={3 * scale}
      />
      <Text
        text={prefix}
        x={0}
        y={badgeY + 4 * scale}
        width={size}
        align="center"
        fontSize={11 * scale}
        fontFamily={fontFamily}
        fontStyle="600"
        fill="black"
      />
      <Text
        text={value}
        x={0}
        y={badgeY + 14 * scale}
        width={size}
        align="center"
        fontSize={17 * scale}
        fontFamily={fontFamily}
        fontStyle="600"
        fill="black"
      />
    </Group>
  );
}
