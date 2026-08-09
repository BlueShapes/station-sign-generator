import { forwardRef, useEffect, useState } from "react";
import Konva from "konva";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { isMobile } from "react-device-detect";
import styled from "styled-components";
import type StationProps from "./DirectInputStationProps";
import type { AdjacentStationProps } from "./DirectInputStationProps";
import { METRO_LONG_FONT_SPECS, waitForCanvasFonts } from "@/lib/fonts";
import { getTokyoMetroStationNumberMetrics } from "./stationNumberBadgeMetrics";
import {
  getSubwayStationNameScaleX,
  spaceSubwayPrimaryName,
} from "./stationNameLayout";
import {
  getMetroSmallBadgeTextAdjustments,
  getSubwayMediumArrowPoints,
  METRO_MEDIUM_DIMENSIONS,
  type MetroSmallBadgeKind,
} from "./subwaySignGeometry";

export type SubwaySignVariant = "metroMedium" | "toeiMedium" | "toeiLarge";

export const subwaySignDimensions = {
  metroMedium: {
    height: METRO_MEDIUM_DIMENSIONS.height,
    ratio: METRO_MEDIUM_DIMENSIONS.ratio,
  },
  toeiMedium: { height: 190, ratio: 2.6 },
  toeiLarge: { height: 240, ratio: 1.8 },
} as const;

export const scale = 3;

const ARROW_COLOR = "#171820";
const INACTIVE_COLOR = "#8e8c82";

type SubwaySignProps = StationProps & { variant: SubwaySignVariant };

const SubwaySign = forwardRef<Konva.Stage, SubwaySignProps>(
  (props, ref) => {
    const {
      variant,
      primaryName,
      primaryNameFurigana,
      secondaryName,
      left,
      right,
      numberPrimaryPrefix,
      numberPrimaryValue,
      baseColor,
      localLines,
      direction = "both",
    } = props;
    const { height, ratio } = subwaySignDimensions[variant];
    const width = height * ratio;
    const lineColor = localLines?.[0]?.color ?? baseColor ?? "#0b74ba";
    const [stageKey, setStageKey] = useState(0);
    const [canvasImage, setCanvasImage] = useState("");

    useEffect(() => {
      let cancelled = false;
      waitForCanvasFonts(METRO_LONG_FONT_SPECS)
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) setStageKey((key) => key + 1);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (stageKey < 1) {
        setCanvasImage("");
        return;
      }
      const render = () => {
        ref && "current" in ref && ref.current
          ? setCanvasImage(ref.current.toDataURL())
          : setCanvasImage("");
      };
      if (isMobile) {
        const timer = setTimeout(render, 1000);
        return () => clearTimeout(timer);
      }
      render();
    }, [props, ref, stageKey]);

    const measureText = (
      text: string,
      fontSize: number,
      fontFamily: string,
      fontStyle: string,
    ) => new Konva.Text({ text, fontSize, fontFamily, fontStyle }).width();

    const fitFontSize = (
      text: string,
      maxFontSize: number,
      maxWidth: number,
      fontFamily: string,
      fontStyle: string,
    ) => {
      const measuredWidth = measureText(
        text,
        maxFontSize,
        fontFamily,
        fontStyle,
      );
      return measuredWidth > maxWidth
        ? maxFontSize * (maxWidth / measuredWidth)
        : maxFontSize;
    };

    const renderBadge = ({
      cx,
      cy,
      prefix,
      value,
      diameter,
      whiteOutline = false,
      metroSmallBadgeKind,
    }: {
      cx: number;
      cy: number;
      prefix?: string;
      value?: string;
      diameter: number;
      whiteOutline?: boolean;
      metroSmallBadgeKind?: MetroSmallBadgeKind;
    }) => {
      if (!prefix || !value) return null;
      const metrics = getTokyoMetroStationNumberMetrics(diameter);
      const textAdjustments = metroSmallBadgeKind
        ? getMetroSmallBadgeTextAdjustments(diameter, metroSmallBadgeKind)
        : {
          prefixFontSizeDelta: 0,
          valueFontSizeDelta: 2,
          prefixYOffsetDelta: 0,
          valueYOffsetDelta: 0,
          valueXOffsetDelta: 0,
          valueLetterSpacing: 1,
          valueFontStyle: metrics.valueFontWeight,
        };
      const strokeWidth = Math.max(2.4, metrics.strokeWidth * 0.72);
      const radius = diameter / 2 + strokeWidth / 2;
      return (
        <Group>
          {whiteOutline && (
            <Circle
              x={cx}
              y={cy}
              radius={radius + 2}
              fill="white"
              stroke="white"
              strokeWidth={1.5}
            />
          )}
          <Circle
            x={cx}
            y={cy}
            radius={radius}
            fill="white"
            stroke={lineColor}
            strokeWidth={strokeWidth}
          />
          <Text
            text={prefix}
            x={cx - diameter / 2}
            y={
              cy -
              diameter / 2 +
              metrics.prefixYOffset -
              1 +
              textAdjustments.prefixYOffsetDelta
            }
            width={diameter}
            fontSize={
              metrics.prefixFontSize + textAdjustments.prefixFontSizeDelta
            }
            fontFamily="JostTrispaceHybrid"
            fontStyle={metrics.prefixFontWeight}
            align="center"
            fill="#202126"
          />
          <Text
            text={value}
            x={cx - diameter / 2 + textAdjustments.valueXOffsetDelta}
            y={
              cy -
              diameter / 2 +
              metrics.valueYOffset -
              1 +
              textAdjustments.valueYOffsetDelta
            }
            width={diameter}
            fontSize={
              metrics.valueFontSize + textAdjustments.valueFontSizeDelta
            }
            fontFamily="JostTrispaceHybrid"
            fontStyle={textAdjustments.valueFontStyle}
            letterSpacing={textAdjustments.valueLetterSpacing}
            align="center"
            fill="#202126"
          />
        </Group>
      );
    };

    const renderArrow = (
      side: "left" | "right",
      x: number,
      y: number,
      arrowWidth: number,
      arrowHeight: number,
    ) => {
      const points = getSubwayMediumArrowPoints(
        arrowWidth,
        arrowHeight,
        side,
      );
      return (
        <Line
          closed
          points={points}
          x={x}
          y={y}
          fill={ARROW_COLOR}
          strokeWidth={0}
        />
      );
    };

    const isActive = (side: "left" | "right") =>
      direction === "both" || direction === side;

    const renderMetroSide = (
      station: AdjacentStationProps | undefined,
      side: "left" | "right",
    ) => {
      if (!station) return null;
      const active = isActive(side);
      const isLeft = side === "left";
      const blockWidth = 126;
      const x = isLeft ? 12 : width - blockWidth - 12;
      const align = isLeft ? "left" : "right";
      const naturalNameWidth = measureText(
        station.primaryName,
        22,
        "NotoSansJP",
        "700",
      );
      const nameScaleX = getSubwayStationNameScaleX(
        station.primaryName,
        naturalNameWidth,
        blockWidth,
      );
      const furiganaSize = fitFontSize(
        station.primaryNameFurigana ?? "",
        11,
        blockWidth,
        "NotoSansJP",
        "500",
      );
      const secondarySize = fitFontSize(
        station.secondaryName,
        13,
        blockWidth,
        "Jost",
        "400",
      );
      const renderedNameWidth = naturalNameWidth * nameScaleX;
      const nameX = isLeft ? x : x + blockWidth - renderedNameWidth;
      return (
        <Group>
          {active &&
            renderArrow(side, isLeft ? x : x + blockWidth - 40, 7, 40, 25)}
          <Text
            text={station.primaryName}
            x={nameX}
            y={35}
            width={naturalNameWidth}
            fontSize={22}
            fontFamily="NotoSansJP"
            fontStyle="700"
            align="left"
            scaleX={nameScaleX}
            wrap="none"
            fill={active ? "#202126" : INACTIVE_COLOR}
          />
          <Text
            text={station.primaryNameFurigana ?? ""}
            x={x}
            y={59}
            width={blockWidth}
            fontSize={furiganaSize}
            fontFamily="NotoSansJP"
            fontStyle="500"
            align={align}
            fill={active ? "#202126" : INACTIVE_COLOR}
          />
          <Text
            text={station.secondaryName}
            x={x}
            y={72}
            width={blockWidth}
            fontSize={secondarySize}
            fontFamily="Jost"
            fontStyle="400"
            align={align}
            wrap="none"
            fill={active ? "#202126" : INACTIVE_COLOR}
          />
          {active &&
            renderBadge({
              cx: isLeft ? x + 22 : x + blockWidth - 22,
              cy:
                METRO_MEDIUM_DIMENSIONS.bandTop +
                METRO_MEDIUM_DIMENSIONS.bandHeight / 2,
              prefix: station.numberPrimaryPrefix,
              value: station.numberPrimaryValue,
              diameter: 29,
              whiteOutline: true,
              metroSmallBadgeKind: "side",
            })}
        </Group>
      );
    };

    const renderMetroMedium = () => {
      const bandTop = METRO_MEDIUM_DIMENSIONS.bandTop;
      const centerWidth = width - 268;
      const displayName = spaceSubwayPrimaryName(primaryName);
      const naturalMainNameWidth = measureText(
        displayName,
        39,
        "NotoSansJP",
        "700",
      );
      const mainNameScaleX = getSubwayStationNameScaleX(
        primaryName,
        naturalMainNameWidth,
        centerWidth,
      );
      const renderedMainNameWidth = naturalMainNameWidth * mainNameScaleX;
      const furiganaSize = fitFontSize(
        primaryNameFurigana,
        18,
        centerWidth,
        "NotoSansJP",
        "600",
      );
      const secondarySize = fitFontSize(
        secondaryName,
        20,
        centerWidth,
        "Jost",
        "600",
      );
      return (
        <>
          <Rect fill={lineColor} x={0} y={bandTop} width={width} height={height - bandTop} />
          {renderMetroSide(left[0], "left")}
          {renderMetroSide(right[0], "right")}
          <Text
            text={displayName}
            x={134 + (centerWidth - renderedMainNameWidth) / 2}
            y={4}
            width={naturalMainNameWidth}
            fontSize={39}
            fontFamily="NotoSansJP"
            fontStyle="700"
            align="left"
            scaleX={mainNameScaleX}
            wrap="none"
            fill="#202126"
          />
          <Text
            text={primaryNameFurigana}
            x={134}
            y={47}
            width={centerWidth}
            fontSize={furiganaSize}
            fontFamily="NotoSansJP"
            fontStyle="600"
            align="center"
            wrap="none"
            fill="#202126"
          />
          <Text
            text={secondaryName}
            x={134}
            y={69}
            width={centerWidth}
            fontSize={secondarySize}
            fontFamily="Jost"
            fontStyle="600"
            align="center"
            wrap="none"
            fill="#202126"
          />
          {renderBadge({
            cx: width / 2,
            cy:
              METRO_MEDIUM_DIMENSIONS.bandTop +
              METRO_MEDIUM_DIMENSIONS.bandHeight / 2,
            prefix: numberPrimaryPrefix,
            value: numberPrimaryValue,
            diameter: 34,
            whiteOutline: true,
            metroSmallBadgeKind: "main",
          })}
        </>
      );
    };

    const renderToeiSide = (
      station: AdjacentStationProps | undefined,
      side: "left" | "right",
      large: boolean,
    ) => {
      if (!station) return null;
      const active = isActive(side);
      const isLeft = side === "left";
      const blockWidth = large ? 154 : 150;
      const margin = large ? 14 : 12;
      const x = isLeft ? margin : width - blockWidth - margin;
      const align = isLeft ? "left" : "right";
      const nameY = large ? 190 : 139;
      const secondaryY = large ? 214 : 161;
      const arrowY = large ? 150 : 99;
      const arrowWidth = large ? 50 : 48;
      const arrowHeight = large ? 31 : 29;
      const arrowX = isLeft ? x : x + blockWidth - arrowWidth;
      const badgeCx = isLeft
        ? arrowX + arrowWidth + (large ? 17 : 15)
        : arrowX - (large ? 17 : 15);
      const sideNameSize = large ? 25 : 24;
      const naturalNameWidth = measureText(
        station.primaryName,
        sideNameSize,
        "NotoSansJP",
        "600",
      );
      const nameScaleX = getSubwayStationNameScaleX(
        station.primaryName,
        naturalNameWidth,
        blockWidth,
      );
      const renderedNameWidth = naturalNameWidth * nameScaleX;
      const nameX = isLeft ? x : x + blockWidth - renderedNameWidth;
      return (
        <Group>
          {active && renderArrow(side, arrowX, arrowY, arrowWidth, arrowHeight)}
          {active &&
            renderBadge({
              cx: badgeCx,
              cy: arrowY + arrowHeight / 2,
              prefix: station.numberPrimaryPrefix,
              value: station.numberPrimaryValue,
              diameter: large ? 29 : 27,
            })}
          <Text
            text={station.primaryName}
            x={nameX}
            y={nameY}
            width={naturalNameWidth}
            fontSize={sideNameSize}
            fontFamily="NotoSansJP"
            fontStyle="600"
            align="left"
            scaleX={nameScaleX}
            wrap="none"
            fill={active ? "#202126" : INACTIVE_COLOR}
          />
          <Text
            text={station.secondaryName}
            x={x}
            y={secondaryY}
            width={blockWidth}
            fontSize={large ? 14 : 13}
            fontFamily="Jost"
            fontStyle="500"
            align={align}
            wrap="none"
            fill={active ? "#202126" : INACTIVE_COLOR}
          />
        </Group>
      );
    };

    const renderToei = (large: boolean) => {
      const bandHeight = large ? 18 : 16;
      const maxMainNameSize = large ? 49 : 48;
      const maxMainFuriganaSize = large ? 18 : 17;
      const maxMainSecondarySize = large ? 23 : 22;
      const mainBadgeDiameter = large ? 43 : 42;
      const displayName = spaceSubwayPrimaryName(primaryName);
      const badgeMetrics = getTokyoMetroStationNumberMetrics(mainBadgeDiameter);
      const badgeOuter = mainBadgeDiameter + Math.max(2.4, badgeMetrics.strokeWidth * 0.72);
      const maxTextWidth = width - badgeOuter - 34;
      const naturalMainNameWidth = measureText(
        displayName,
        maxMainNameSize,
        "NotoSansJP",
        "600",
      );
      const mainNameScaleX = getSubwayStationNameScaleX(
        primaryName,
        naturalMainNameWidth,
        maxTextWidth,
      );
      const renderedMainNameWidth = naturalMainNameWidth * mainNameScaleX;
      const mainFuriganaSize = fitFontSize(
        primaryNameFurigana,
        maxMainFuriganaSize,
        maxTextWidth,
        "NotoSansJP",
        "600",
      );
      const mainSecondarySize = fitFontSize(
        secondaryName,
        maxMainSecondarySize,
        maxTextWidth,
        "Jost",
        "600",
      );
      const nameWidth = Math.min(maxTextWidth, Math.max(
        renderedMainNameWidth,
        measureText(primaryNameFurigana, mainFuriganaSize, "NotoSansJP", "600"),
        measureText(secondaryName, mainSecondarySize, "Jost", "600"),
      ));
      const groupWidth = badgeOuter + 10 + nameWidth;
      const groupX = Math.max(12, (width - groupWidth) / 2);
      const mainTop = large ? 47 : 27;
      const textX = groupX + badgeOuter + 10;
      return (
        <>
          <Rect fill={lineColor} x={0} y={0} width={width} height={bandHeight} />
          <Rect
            fill={lineColor}
            x={0}
            y={height - bandHeight}
            width={width}
            height={bandHeight}
          />
          <Group>
            {renderBadge({
              cx: groupX + badgeOuter / 2,
              cy: mainTop + 32,
              prefix: numberPrimaryPrefix,
              value: numberPrimaryValue,
              diameter: mainBadgeDiameter,
            })}
            <Text
              text={displayName}
              x={textX + (nameWidth - renderedMainNameWidth) / 2}
              y={mainTop}
              width={naturalMainNameWidth}
              fontSize={maxMainNameSize}
              fontFamily="NotoSansJP"
              fontStyle="600"
              align="left"
              scaleX={mainNameScaleX}
              wrap="none"
              fill="#202126"
            />
            <Text
              text={primaryNameFurigana}
              x={textX}
              y={mainTop + 58}
              width={nameWidth}
              fontSize={mainFuriganaSize}
              fontFamily="NotoSansJP"
              fontStyle="600"
              align="center"
              wrap="none"
              fill="#202126"
            />
            <Text
              text={secondaryName}
              x={textX}
              y={mainTop + 80}
              width={nameWidth}
              fontSize={mainSecondarySize}
              fontFamily="Jost"
              fontStyle="600"
              align="center"
              wrap="none"
              fill="#202126"
            />
          </Group>
          {renderToeiSide(left[0], "left", large)}
          {renderToeiSide(right[0], "right", large)}
        </>
      );
    };

    return (
      <>
        {canvasImage && (
          <CanvasImage
            src={canvasImage}
            draggable={false}
            style={{ width: "100%" }}
            onContextMenu={(event) => event.preventDefault()}
          />
        )}
        <StageWrapper hidden>
          <Stage
            ref={ref}
            key={stageKey}
            width={width * scale}
            height={height * scale}
            scaleX={scale}
            scaleY={scale}
          >
            <Layer>
              <Rect fill="#ffffff" x={0} y={0} width={width} height={height} />
              {variant === "metroMedium"
                ? renderMetroMedium()
                : renderToei(variant === "toeiLarge")}
            </Layer>
          </Stage>
        </StageWrapper>
      </>
    );
  },
);
SubwaySign.displayName = "SubwaySign";

const createSubwaySign = (variant: SubwaySignVariant) => {
  const Component = forwardRef<Konva.Stage, StationProps>((props, ref) => (
    <SubwaySign {...props} variant={variant} ref={ref} />
  ));
  Component.displayName = `${variant}Sign`;
  return Component;
};

export const MetroMediumSign = createSubwaySign("metroMedium");
export const ToeiMediumSign = createSubwaySign("toeiMedium");
export const ToeiLargeSign = createSubwaySign("toeiLarge");

const CanvasImage = styled.img`
  display: block;
  user-select: none;
  -webkit-user-drag: none;
`;

const StageWrapper = styled.div`
  position: absolute;
  left: -999999px;
  top: 0;
`;
