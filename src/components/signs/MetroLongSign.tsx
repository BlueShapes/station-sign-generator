import { Fragment, useEffect, useState, forwardRef } from "react";
import type StationProps from "./DirectInputStationProps";
import type { AdjacentStationProps } from "./DirectInputStationProps";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import Konva from "konva";
import { isMobile } from "react-device-detect";
import { METRO_LONG_FONT_SPECS, waitForCanvasFonts } from "@/lib/fonts";
import styled from "styled-components";
import {
  getTokyoMetroStationNumberMetrics,
  SUBWAY_MAIN_BADGE_NUMBER_FONT_SIZE_DELTA,
  TOKYO_METRO_BADGE_NUMBER_STROKE_WIDTH,
} from "./stationNumberBadgeMetrics";
import {
  getSubwayStationNameScaleX,
  spaceTokyoMetroPrimaryName,
} from "./stationNameLayout";
import { getMetroSmallArrowPoints } from "./arrowGeometry";
import JrCentralStationNumberBadge from "./JrCentralStationNumberBadge";
import { resolveSubwayStationNumberAppearance } from "./subwayStationNumberAppearance";

export const height = 105;
export const scale = 3;

const width = height * 7.2;
const TEXT_SCALE = 1.3;
const BADGE_SCALE = 1.3;
const BADGE_RADIUS_SCALE = 0.9;

const MetroLongSignBase = forwardRef<Konva.Stage, StationProps>(
  (props, ref: React.Ref<Konva.Stage>) => {
    const {
      primaryName,
      primaryNameFurigana,
      secondaryName,
      left,
      right,
      numberPrimaryPrefix,
      numberPrimaryValue,
      numberPrimaryColor,
      numberPrimaryStyle,
      stationNumberStyle,
      baseColor,
      localLines,
      direction,
      subTextMode,
    } = props;

    const lineColor = localLines?.[0]?.color ?? baseColor ?? "#e46f22";
    const effectiveSubTextMode =
      subTextMode ?? (primaryNameFurigana ? "furigana" : "secondary");
    const [stageKey, setStageKey] = useState(0);
    const [canvasImage, setCanvasImage] = useState("");

    useEffect(() => {
      let cancelled = false;
      waitForCanvasFonts(METRO_LONG_FONT_SPECS)
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) setStageKey((k) => k + 1);
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
      if (isMobile && stageKey >= 1) {
        const t = setTimeout(render, 1000);
        return () => clearTimeout(t);
      }
      render();
    }, [props, stageKey]);

    const measureText = (
      text: string,
      config: {
        fontSize: number;
        fontFamily: string;
        fontStyle?: string;
      },
    ) =>
      new Konva.Text({
        text,
        ...config,
      }).width();

    const mainBadgeInner = 38 * BADGE_SCALE;
    const sideBadgeInner = 22 * BADGE_SCALE;
    const mainBadgeMetrics = getTokyoMetroStationNumberMetrics(mainBadgeInner);
    const sideBadgeMetrics = getTokyoMetroStationNumberMetrics(sideBadgeInner);
    const mainBadgeStroke =
      (Math.max(1.25, mainBadgeMetrics.strokeWidth * 0.58) + 1) * BADGE_SCALE;
    const sideBadgeStroke =
      Math.max(1, sideBadgeMetrics.strokeWidth * 0.5) * BADGE_SCALE;
    const mainBadgeOuter = mainBadgeInner + mainBadgeStroke * 2;
    const sideBadgeOuter = sideBadgeInner + sideBadgeStroke * 2;

    const renderBadge = (
      cx: number,
      cy: number,
      prefix?: string,
      value?: string,
      innerSize = mainBadgeInner,
      strokeWidth = mainBadgeStroke,
      metrics = mainBadgeMetrics,
      prefixFontSizeDelta = 0,
      valueFontSizeDelta = 0,
      prefixYOffsetDelta = 0,
      valueYOffsetDelta = 0,
      prefixXOffsetDelta = 0,
      valueXOffsetDelta = 0,
      color?: string,
      style?: string,
    ) => {
      if (!prefix || !value) return null;

      const appearance = resolveSubwayStationNumberAppearance({
        prefix,
        color,
        style,
        localLines,
        fallbackColor: lineColor,
        fallbackStyle: stationNumberStyle ?? "tokyometro",
      });
      if (appearance.style === "jrcentral") {
        return (
          <JrCentralStationNumberBadge
            x={cx - innerSize / 2}
            y={cy - innerSize / 2}
            size={innerSize}
            color={appearance.color}
            prefix={prefix}
            value={value}
          />
        );
      }
      if (appearance.style !== "tokyometro") {
        const top = cy - innerSize / 2;
        return (
          <>
            <Rect
              x={cx - innerSize / 2}
              y={top}
              width={innerSize}
              height={innerSize}
              fill="white"
              stroke={appearance.color}
              strokeWidth={Math.max(1.5, innerSize * 0.1)}
              cornerRadius={innerSize / 15}
            />
            <Text
              text={prefix}
              x={cx - innerSize / 2}
              y={top + (innerSize * 4) / 30}
              width={innerSize}
              fontSize={(innerSize * 11) / 30}
              fontFamily="HindSemiBold"
              fontStyle="600"
              fill="#1f2230"
              align="center"
            />
            <Text
              text={value}
              x={cx - innerSize / 2}
              y={top + (innerSize * 14) / 30}
              width={innerSize}
              fontSize={(innerSize * 17) / 30}
              fontFamily="HindSemiBold"
              fontStyle="600"
              fill="#1f2230"
              align="center"
            />
          </>
        );
      }

      return (
        <>
          <Circle
            x={cx}
            y={cy}
            radius={(innerSize / 2 + strokeWidth) * BADGE_RADIUS_SCALE}
            fill="white"
            stroke={appearance.color}
            strokeWidth={strokeWidth}
          />
          <Text
            text={prefix}
            x={cx - innerSize / 2 + prefixXOffsetDelta}
            y={cy - innerSize / 2 + metrics.prefixYOffset - 1 + prefixYOffsetDelta}
            width={innerSize}
            fontSize={metrics.prefixFontSize + prefixFontSizeDelta}
            fontFamily="JostTrispaceHybrid"
            fontStyle={metrics.prefixFontWeight}
            fill="#1f2230"
            align="center"
          />
          <Text
            text={value}
            x={cx - innerSize / 2 + valueXOffsetDelta}
            y={cy - innerSize / 2 + metrics.valueYOffset - 1 + valueYOffsetDelta}
            width={innerSize}
            fontSize={metrics.valueFontSize + valueFontSizeDelta}
            fontFamily="JostTrispaceHybrid"
            fontStyle={metrics.valueFontWeight}
            letterSpacing={2}
            stroke="#1f2230"
            strokeWidth={TOKYO_METRO_BADGE_NUMBER_STROKE_WIDTH}
            fill="#1f2230"
            align="center"
          />
        </>
      );
    };

    const getStationSubText = (station: {
      primaryNameFurigana?: string;
      secondaryName?: string;
    }) =>
      effectiveSubTextMode === "furigana"
        ? (station.primaryNameFurigana ?? "")
        : (station.secondaryName ?? "");
    const isProgressSide = (side: "left" | "right") =>
      direction === "both" || direction === side;

    const getSingleSideWidth = (station?: AdjacentStationProps) => {
      if (!station) return 0;
      const nameWidth = measureText(station.primaryName, {
        fontSize: 17 * TEXT_SCALE,
        fontFamily: "NotoSansJP",
        fontStyle: "700",
      });
      const subText = getStationSubText(station);
      const useSecondary = effectiveSubTextMode === "secondary";
      const subWidth = measureText(subText, {
        fontSize: 10 * TEXT_SCALE,
        fontFamily: useSecondary ? "Jost" : "NotoSansJP",
        fontStyle: useSecondary ? "600" : "500",
      });
      return Math.max(nameWidth, subWidth, sideBadgeOuter);
    };

    const getTwoStationSideWidth = (stations: AdjacentStationProps[]) => {
      if (stations.length === 0) return 0;
      return Math.max(
        ...stations.map((station) => {
          const nameWidth = measureText(station.primaryName, {
            fontSize: 15 * TEXT_SCALE,
            fontFamily: "NotoSansJP",
            fontStyle: "700",
          });
          const subWidth = measureText(getStationSubText(station), {
            fontSize: 8 * TEXT_SCALE,
            fontFamily:
              effectiveSubTextMode === "secondary" ? "Jost" : "NotoSansJP",
            fontStyle: effectiveSubTextMode === "secondary" ? "600" : "500",
          });
          return Math.max(nameWidth, subWidth) + 8 + sideBadgeOuter;
        }),
      );
    };

    const leftArrowSize = 34;
    const rightArrowSize = 34;
    const leftContentStart = direction === "left" || direction === "both" ? 63 : 18;
    const rightContentEnd =
      width - (direction === "right" || direction === "both" ? 63 : 18);
    const leftWidth =
      left.length >= 2
        ? getTwoStationSideWidth(left.slice(0, 2))
        : getSingleSideWidth(left[0]);
    const rightWidth =
      right.length >= 2
        ? getTwoStationSideWidth(right.slice(0, 2))
        : getSingleSideWidth(right[0]);
    const leftOccupiedRight = leftContentStart + leftWidth;
    const rightOccupiedLeft = rightContentEnd - rightWidth;

    const centerSubText = getStationSubText({
      primaryNameFurigana,
      secondaryName,
    });
    const displayPrimaryName = spaceTokyoMetroPrimaryName(primaryName);
    const centerSubFontFamily =
      effectiveSubTextMode === "secondary" ? "Jost" : "NotoSansJP";
    const centerSubFontSize =
      ((effectiveSubTextMode === "secondary" ? 11 : 13) + 7) * TEXT_SCALE;
    const centerSubFontStyle = effectiveSubTextMode === "secondary" ? "600" : "500";
    const naturalMainNameWidth = measureText(displayPrimaryName, {
      fontSize: 33 * TEXT_SCALE,
      fontFamily: "NotoSansJP",
      fontStyle: "600",
    });
    const maxMainNameWidth = Math.max(
      120,
      rightOccupiedLeft - leftOccupiedRight - mainBadgeOuter - 36,
    );
    const mainNameScaleX = getSubwayStationNameScaleX(
      primaryName,
      naturalMainNameWidth,
      maxMainNameWidth,
    );
    const mainNameWidth = naturalMainNameWidth * mainNameScaleX;
    const centerSubWidth = measureText(centerSubText, {
      fontSize: centerSubFontSize,
      fontFamily: centerSubFontFamily,
      fontStyle: centerSubFontStyle,
    });
    const centerTextWidth = Math.max(mainNameWidth, centerSubWidth);
    const textColumnX = mainBadgeOuter + 2;
    const mainNameX = textColumnX + (centerTextWidth - mainNameWidth) / 2;
    const centerSubX = textColumnX + (centerTextWidth - centerSubWidth) / 2;
    const centerGroupWidth = textColumnX + centerTextWidth;
    const centerGapMid = (leftOccupiedRight + rightOccupiedLeft) / 2;
    const centerStart = Math.max(
      leftOccupiedRight + 16,
      Math.min(centerGapMid - centerGroupWidth / 2, rightOccupiedLeft - centerGroupWidth - 16),
    );

    const renderSingleSide = (
      station: AdjacentStationProps | undefined,
      side: "left" | "right",
    ) => {
      if (!station) return null;

      const isLeft = side === "left";
      const isActiveSide = isProgressSide(side);
      const contentX = isLeft ? leftContentStart : rightContentEnd;
      const align = isLeft ? "left" : "right";
      const textX = isLeft ? contentX : contentX - getSingleSideWidth(station);
      const badgeCx = isLeft
        ? textX + sideBadgeOuter / 2
        : textX + getSingleSideWidth(station) - sideBadgeOuter / 2;
      const subText = getStationSubText(station);
      const useSecondary = effectiveSubTextMode === "secondary";

      return (
        <>
          <Text
            text={station.primaryName}
            x={textX}
            y={24}
            width={getSingleSideWidth(station)}
            fontSize={17 * TEXT_SCALE}
            fontFamily="NotoSansJP"
            fontStyle="600"
            fill={isActiveSide ? "#202126" : "#b7b7b7"}
            align={align}
          />
          <Text
            text={subText}
            x={textX}
            y={47}
            width={getSingleSideWidth(station)}
            fontSize={10 * TEXT_SCALE}
            fontFamily={useSecondary ? "Jost" : "NotoSansJP"}
            fontStyle={useSecondary ? "500" : "400"}
            fill={isActiveSide ? "#202126" : "#b7b7b7"}
            align={align}
          />
          {isActiveSide &&
            renderBadge(
              badgeCx,
              76,
              station.numberPrimaryPrefix,
              station.numberPrimaryValue,
              sideBadgeInner,
              sideBadgeStroke,
              sideBadgeMetrics,
              0,
              3,
              0,
              0.5,
              0,
              0.6,
              station.numberPrimaryColor,
              station.numberPrimaryStyle,
            )}
        </>
      );
    };

    const renderDoubleSide = (
      stations: AdjacentStationProps[],
      side: "left" | "right",
    ) => {
      if (stations.length === 0) return null;

      const isLeft = side === "left";
      const isActiveSide = isProgressSide(side);
      const blockWidth = getTwoStationSideWidth(stations);
      const anchorX = isLeft ? leftContentStart : rightContentEnd;
      const textAreaWidth = blockWidth - sideBadgeOuter - 8;
      const textX = isLeft ? anchorX : anchorX - blockWidth + sideBadgeOuter + 8;
      const badgeCx = isLeft
        ? anchorX + blockWidth - sideBadgeOuter / 2
        : anchorX - blockWidth + sideBadgeOuter / 2;
      const align = isLeft ? "left" : "right";

      return (
        <>
          {stations.slice(0, 2).map((station, idx) => {
            const rowY = 8 + idx * 42;
            return (
              <Fragment key={station.id}>
                <Text
                  text={station.primaryName}
                  x={textX}
                  y={rowY + 6}
                  width={textAreaWidth}
                  fontSize={15 * TEXT_SCALE}
                  fontFamily="NotoSansJP"
                  fontStyle="600"
                  fill={isActiveSide ? "#202126" : "#b7b7b7"}
                  align={align}
                />
                <Text
                  text={getStationSubText(station)}
                  x={textX}
                  y={rowY + 26}
                  width={textAreaWidth}
                  fontSize={8 * TEXT_SCALE}
                  fontFamily={
                    effectiveSubTextMode === "secondary" ? "Jost" : "NotoSansJP"
                  }
                  fontStyle={effectiveSubTextMode === "secondary" ? "500" : "400"}
                  fill={isActiveSide ? "#202126" : "#b7b7b7"}
                  align={align}
                />
                {isActiveSide &&
                  renderBadge(
                    badgeCx,
                    rowY + 23,
                    station.numberPrimaryPrefix,
                    station.numberPrimaryValue,
                    sideBadgeInner,
                    sideBadgeStroke,
                    sideBadgeMetrics,
                    0,
                    3,
                    0,
                    0.5,
                    0,
                    0.6,
                    station.numberPrimaryColor,
                    station.numberPrimaryStyle,
                  )}
              </Fragment>
            );
          })}
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
            onContextMenu={(e) => e.preventDefault()}
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
              <Rect fill="#f4f4f4" x={0} y={0} width={width} height={2} />

              {(direction === "left" || direction === "both") && (
                <Line
                  closed
                  points={getMetroSmallArrowPoints(leftArrowSize, "left")}
                  x={14}
                  y={27}
                  fill="#1b1831"
                  strokeWidth={0}
                />
              )}
              {(direction === "right" || direction === "both") && (
                <Line
                  closed
                  points={getMetroSmallArrowPoints(rightArrowSize, "right")}
                  x={width - 14 - rightArrowSize}
                  y={27}
                  fill="#1b1831"
                  strokeWidth={0}
                />
              )}

              {left.length >= 2
                ? renderDoubleSide(left, "left")
                : renderSingleSide(left[0], "left")}
              {right.length >= 2
                ? renderDoubleSide(right, "right")
                : renderSingleSide(right[0], "right")}

              <Group x={centerStart} y={22}>
                {renderBadge(
                  mainBadgeOuter / 2,
                  31,
                  numberPrimaryPrefix,
                  numberPrimaryValue,
                  mainBadgeInner,
                  mainBadgeStroke,
                  mainBadgeMetrics,
                  3,
                  8 + SUBWAY_MAIN_BADGE_NUMBER_FONT_SIZE_DELTA,
                  -2,
                  0,
                  0,
                  0,
                  numberPrimaryColor,
                  numberPrimaryStyle,
                )}
                <Text
                  text={displayPrimaryName}
                  x={mainNameX}
                  y={3}
                  width={naturalMainNameWidth}
                  fontSize={33 * TEXT_SCALE}
                  fontFamily="NotoSansJP"
                  fontStyle="600"
                  fill="#202126"
                  scaleX={mainNameScaleX}
                  wrap="none"
                />
                {centerSubText && (
                  <Text
                    text={centerSubText}
                    x={centerSubX}
                    y={50}
                    width={centerSubWidth}
                    fontSize={centerSubFontSize}
                    fontFamily={centerSubFontFamily}
                    fontStyle={centerSubFontStyle}
                    fill="#202126"
                    wrap="none"
                  />
                )}
              </Group>
            </Layer>
          </Stage>
        </StageWrapper>
      </>
    );
  },
);

const CanvasImage = styled.img`
  width: 100%;
  max-width: 60rem;
  max-height: 20vh;
  margin-inline: auto;
  object-fit: contain;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
`;

const StageWrapper = styled.div`
  position: absolute;
  left: -999999px;
  top: 0;
`;

export const MetroLongForeignSign = forwardRef<Konva.Stage, StationProps>(
  (props, ref) => (
    <MetroLongSignBase {...props} subTextMode="secondary" ref={ref} />
  ),
);
MetroLongForeignSign.displayName = "MetroLongForeignSign";

const MetroLongSign = forwardRef<Konva.Stage, StationProps>((props, ref) => (
  <MetroLongSignBase {...props} subTextMode="furigana" ref={ref} />
));
MetroLongSign.displayName = "MetroLongSign";

export default MetroLongSign;
