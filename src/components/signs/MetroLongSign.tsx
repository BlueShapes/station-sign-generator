import { Fragment, useEffect, useState, forwardRef } from "react";
import type StationProps from "./DirectInputStationProps";
import type { AdjacentStationProps } from "./DirectInputStationProps";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import Konva from "konva";
import { isMobile } from "react-device-detect";
import styled from "styled-components";
import { getTokyoMetroStationNumberMetrics } from "./stationNumberBadgeMetrics";

export const height = 105;
export const scale = 3;

const width = height * 7.2;
const TEXT_SCALE = 1.3;
const BADGE_SCALE = 1.3;
const BADGE_RADIUS_SCALE = 0.9;

const MetroLongSign = forwardRef<Konva.Stage, StationProps>(
  (props, ref: React.Ref<Konva.Stage>) => {
    const {
      primaryName,
      primaryNameFurigana,
      secondaryName,
      left,
      right,
      numberPrimaryPrefix,
      numberPrimaryValue,
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
      document.fonts.ready.then(() => setStageKey((k) => k + 1));
    }, []);

    useEffect(() => {
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

    const arrowPoints = (size: number) => [
      6,
      0,
      18,
      0,
      size,
      size / 2,
      18,
      size,
      6,
      size,
      size - 12.5,
      size / 2 + 4,
      -9,
      size / 2 + 4,
      -9,
      size / 2 - 4,
      size - 12.5,
      size / 2 - 4,
    ];

    const renderBadge = (
      cx: number,
      cy: number,
      prefix?: string,
      value?: string,
      innerSize = mainBadgeInner,
      strokeWidth = mainBadgeStroke,
      metrics = mainBadgeMetrics,
      prefixFontSizeDelta = 1,
      valueFontSizeDelta = 3,
      prefixYOffsetDelta = 0,
      valueYOffsetDelta = 0,
      prefixXOffsetDelta = 0,
      valueXOffsetDelta = 0,
    ) => {
      if (!prefix || !value) return null;

      return (
        <>
          <Circle
            x={cx}
            y={cy}
            radius={(innerSize / 2 + strokeWidth) * BADGE_RADIUS_SCALE}
            fill="white"
            stroke={lineColor}
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
    const displayPrimaryName =
      primaryName.length === 2 ? primaryName.split("").join("　") : primaryName;
    const centerSubFontFamily =
      effectiveSubTextMode === "secondary" ? "Jost" : "NotoSansJP";
    const centerSubFontSize =
      ((effectiveSubTextMode === "secondary" ? 11 : 13) + 7) * TEXT_SCALE;
    const centerSubFontStyle = effectiveSubTextMode === "secondary" ? "600" : "500";
    const mainNameWidth = measureText(displayPrimaryName, {
      fontSize: 33 * TEXT_SCALE,
      fontFamily: "NotoSansJP",
      fontStyle: "600",
    });
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
                  points={arrowPoints(leftArrowSize)}
                  x={14 + leftArrowSize}
                  y={27}
                  scaleX={-1}
                  fill="#1b1831"
                  strokeWidth={0}
                />
              )}
              {(direction === "right" || direction === "both") && (
                <Line
                  closed
                  points={arrowPoints(rightArrowSize)}
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
                  8,
                  -2,
                  0,
                  0,
                  0,
                )}
                <Text
                  text={displayPrimaryName}
                  x={mainNameX}
                  y={3}
                  width={mainNameWidth}
                  fontSize={33 * TEXT_SCALE}
                  fontFamily="NotoSansJP"
                  fontStyle="600"
                  fill="#202126"
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
  display: block;
  user-select: none;
  -webkit-user-drag: none;
`;

const StageWrapper = styled.div`
  position: absolute;
  left: -999999px;
  top: 0;
`;

export default MetroLongSign;
