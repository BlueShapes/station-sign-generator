import { Group, Ellipse, Rect, Text } from "react-konva";
import JrCentralStationNumberBadge from "./JrCentralStationNumberBadge";
import { getTokyoMetroStationNumberMetrics } from "./stationNumberBadgeMetrics";
import { getStationNumberBadgeThreeLetterCode } from "./subwayStationNumberAppearance";
import { resolveConnectedStationNumberRuns } from "./stationNumberGroup";
import { getJrEastStationNumberBadgeFrameMetrics } from "./stationNumberBadgeFrame";
import { getCustomStationNumberBadgeVisualStyle } from "@/customization/registry";
import type { CustomDefinition } from "@/customization/model";

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
  /** Use the framed JR East corner geometry without drawing another header. */
  insideThreeLetterCodeFrame?: boolean;
  /** Unsaved custom definitions used only by draft previews. */
  customDefinitions?: readonly CustomDefinition[];
};

export type StationNumberBadgeRowItem = Omit<
  StationNumberBadgeProps,
  "y" | "size" | "threeLetterCode" | "insideThreeLetterCodeFrame"
> & { threeLetterCode?: string | null };

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
  insideThreeLetterCodeFrame = false,
  customDefinitions,
}: StationNumberBadgeProps) {
  if (!prefix && !value) return null;
  const customStyle = getCustomStationNumberBadgeVisualStyle(
    style,
    customDefinitions,
  );
  const resolvedStyle = customStyle?.templateId ?? style;
  const customFontFamily = customStyle?.fontFamily;

  if (resolvedStyle === "jrcentral") {
    return (
      <JrCentralStationNumberBadge
        x={x}
        y={y}
        size={size}
        color={color}
        prefix={prefix}
        value={value}
        fontFamily={customFontFamily}
      />
    );
  }

  const scale = size / 30;

  if (resolvedStyle === "tokyometro") {
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
          fontFamily={customFontFamily ?? "JostTrispaceHybrid"}
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
          fontFamily={customFontFamily ?? "JostTrispaceHybrid"}
          fontStyle={metrics.valueFontWeight}
          fill="black"
        />
      </Group>
    );
  }

  const jrEastThreeLetterCode = getStationNumberBadgeThreeLetterCode(
    resolvedStyle,
    threeLetterCode,
  );
  const hasHeader = Boolean(jrEastThreeLetterCode);
  const frame = getJrEastStationNumberBadgeFrameMetrics(size);
  const badgeY = hasHeader ? frame.innerYOffset : 0;
  const fontFamily = customFontFamily ?? "HindSemiBold";

  return (
    <Group x={x} y={y}>
      {hasHeader && (
        <>
          <Rect
            x={-frame.outerPaddingX}
            y={frame.outerYOffset}
            width={size + frame.outerPaddingX * 2}
            height={frame.outerHeight}
            cornerRadius={frame.outerCornerRadius}
            fill="black"
            stroke="black"
            strokeWidth={frame.strokeWidth}
          />
          <Text
            text={jrEastThreeLetterCode}
            x={-frame.outerPaddingX}
            y={frame.codeYOffset}
            width={size + frame.outerPaddingX * 2}
            align="center"
            fontSize={frame.codeFontSize}
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
        cornerRadius={
          hasHeader || insideThreeLetterCodeFrame
            ? [
                frame.innerCornerRadius,
                frame.innerCornerRadius,
                frame.innerBottomCornerRadius,
                frame.innerBottomCornerRadius,
              ]
            : frame.innerCornerRadius
        }
        fill="white"
        stroke={color}
        strokeWidth={frame.strokeWidth}
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

/**
 * Renders a horizontal row of station numbers. Consecutive JR East badges
 * share one black three-letter-code frame; other badge styles remain separate.
 */
export function StationNumberBadgeRow({
  y,
  size,
  numbers,
  threeLetterCode,
}: {
  y: number;
  size: number;
  numbers: StationNumberBadgeRowItem[];
  threeLetterCode?: string;
}) {
  const frame = getJrEastStationNumberBadgeFrameMetrics(size);
  const runs = resolveConnectedStationNumberRuns(numbers, threeLetterCode);

  return (
    <Group>
      {runs.map((run, runIndex) => {
        const sharedCode = run.sharedThreeLetterCode;
        const rightmostX = Math.max(
          ...run.numbers.map((number) => number.x),
        );
        const badgeXs = sharedCode
          ? run.numbers.map(
              (_, index) =>
                rightmostX -
                (run.numbers.length - 1 - index) * frame.connectedBadgeStep,
            )
          : run.numbers.map((number) => number.x);
        const left = Math.min(...badgeXs);
        const right = Math.max(...badgeXs.map((badgeX) => badgeX + size));

        return (
          <Group key={`${runIndex}:${left}`}>
            {sharedCode && (
              <>
                <Rect
                  x={left - frame.outerPaddingX}
                  y={y + frame.outerYOffset}
                  width={right - left + frame.outerPaddingX * 2}
                  height={frame.outerHeight}
                  cornerRadius={frame.outerCornerRadius}
                  fill="black"
                  stroke="black"
                  strokeWidth={frame.strokeWidth}
                />
                <Text
                  text={sharedCode}
                  x={left - frame.outerPaddingX}
                  y={y + frame.codeYOffset}
                  width={right - left + frame.outerPaddingX * 2}
                  align="center"
                  fontSize={frame.codeFontSize}
                  fontFamily="HindSemiBold"
                  fontStyle="800"
                  fill="white"
                />
              </>
            )}
            {run.numbers.map((number, numberIndex) => (
              <StationNumberBadge
                key={`${number.prefix}:${number.value}:${numberIndex}`}
                {...number}
                x={badgeXs[numberIndex]}
                y={sharedCode ? y + frame.innerYOffset : y}
                size={size}
                threeLetterCode={number.threeLetterCode ?? undefined}
                insideThreeLetterCodeFrame={!!sharedCode}
              />
            ))}
          </Group>
        );
      })}
    </Group>
  );
}
