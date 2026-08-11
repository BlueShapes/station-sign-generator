import { Group, Rect, Text } from "react-konva";
import { JR_CENTRAL_STATION_NUMBER_FONT_FAMILY } from "@/lib/fonts";
import { getJrCentralStationNumberBadgeMetrics } from "./jrCentralStationNumberBadgeMetrics";

export { getJrCentralStationNumberBadgeMetrics } from "./jrCentralStationNumberBadgeMetrics";

export type JrCentralStationNumberBadgeProps = {
  x: number;
  y: number;
  size: number;
  color: string;
  prefix: string;
  value: string;
};

/** Shared Konva renderer used by both JR Central station signs and route maps. */
export default function JrCentralStationNumberBadge({
  x,
  y,
  size,
  color,
  prefix,
  value,
}: JrCentralStationNumberBadgeProps) {
  const metrics = getJrCentralStationNumberBadgeMetrics(size);

  return (
    <Group x={x} y={y}>
      <Rect
        x={0}
        y={0}
        width={metrics.width}
        height={metrics.height}
        fill="white"
      />
      <Rect
        x={0}
        y={0}
        width={metrics.width}
        height={metrics.headerHeight}
        fill={color}
      />
      <Text
        text={prefix}
        x={0}
        y={metrics.prefixY}
        width={metrics.width}
        align="center"
        fontSize={metrics.prefixFontSize}
        fontFamily={JR_CENTRAL_STATION_NUMBER_FONT_FAMILY}
        fontStyle="700"
        fill="white"
      />
      <Text
        text={value}
        x={0}
        y={metrics.valueY}
        width={metrics.width}
        align="center"
        fontSize={metrics.valueFontSize}
        fontFamily={JR_CENTRAL_STATION_NUMBER_FONT_FAMILY}
        fontStyle="700"
        fill="#111923"
      />
      <Rect
        x={0}
        y={0}
        width={metrics.width}
        height={metrics.height}
        stroke={color}
        strokeWidth={metrics.strokeWidth}
      />
    </Group>
  );
}
