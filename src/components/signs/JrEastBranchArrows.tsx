import { Fragment } from "react";
import { Line, Rect, Text } from "react-konva";
import type StationProps from "./DirectInputStationProps";
import JrEastAdjacentNumberBadge from "./JrEastAdjacentNumberBadge";
import { getJrEastLineArrowPoints } from "./arrowGeometry";
import {
  getJrEastBranchArrowColor,
  getJrEastBranchArrowPoints,
  getJrEastBranchDiagonalLineHeight,
  getJrEastBranchDiagonalDistance,
  getJrEastBranchOffsets,
  getJrEastBranchPrimaryFontSize,
  getJrEastBranchRenderOrder,
  getJrEastBranchSecondaryNameY,
  getJrEastBranchSecondaryFontSize,
  getJrEastBranchStartDistance,
  getJrEastBranchStationBadgeX,
  getJrEastBranchStationNameX,
  getJrEastBranchTrunkLineHeight,
  getJrEastHorizontalBranchArrowPoints,
  getJrEastThreeBranchDiagonalGeometry,
  JR_EAST_BRANCH_LAYOUT,
  type BranchSide,
} from "./jrEastBranchLayout";

type JrEastBranchArrowsProps = Pick<
  StationProps,
  | "left"
  | "right"
  | "baseColor"
  | "direction"
  | "stationNumberStyle"
> & {
  width: number;
  centerY: number;
  getLineColor: (prefix?: string) => string;
};

export default function JrEastBranchArrows({
  width,
  centerY,
  left,
  right,
  baseColor,
  direction = "both",
  stationNumberStyle,
  getLineColor,
}: JrEastBranchArrowsProps) {
  const centerX = width / 2;
  const hasThreeBranchLayout = left.length >= 3 || right.length >= 3;

  const renderSide = (side: BranchSide, stations: StationProps["left"]) => {
    const shownStations = stations.slice(0, 3);
    const branches = shownStations.length > 0 ? shownStations : [null];
    const branchCount = branches.length;
    const isBranched = branchCount > 1;
    const isTravelDirection = direction === "both" || direction === side;
    const align = side === "left" ? "left" : "right";

    if (!isBranched) {
      const station = branches[0];
      const lineHeight = getJrEastBranchTrunkLineHeight(
        branchCount,
        hasThreeBranchLayout,
      );
      const linePosY = centerY - lineHeight / 2;
      const startingPoint = 40;
      const lineColor = getJrEastBranchArrowColor(
        station?.arrowColor,
        baseColor,
      );
      const primaryX = side === "left"
        ? isTravelDirection ? 60 : 30
        : isTravelDirection ? -60 : -30;
      const secondaryX = side === "left"
        ? isTravelDirection ? 64 : 30
        : isTravelDirection ? -66 : -30;
      const primaryBadgeX = side === "left" ? 44 : width - 60;
      const secondaryBadgeX = side === "left" ? 24 : width - 40;
      const tertiaryBadgeX = side === "left" ? 4 : width - 20;
      const primaryFontSize = hasThreeBranchLayout
        ? getJrEastBranchPrimaryFontSize(
          branchCount,
          isTravelDirection,
          true,
        )
        : isTravelDirection ? 21 : 15;
      const secondaryFontSize = getJrEastBranchSecondaryFontSize(
        branchCount,
        hasThreeBranchLayout,
      );
      const primaryY = hasThreeBranchLayout
        ? centerY - primaryFontSize / 2
        : isTravelDirection ? linePosY + 2 : linePosY + 4;
      const secondaryY = hasThreeBranchLayout
        ? getJrEastBranchSecondaryNameY(
          centerY,
          lineHeight,
          isTravelDirection,
        )
        : linePosY + 28;
      const badgeY = centerY + lineHeight / 2 + 3;

      return (
        <>
          <Rect
            x={
              isTravelDirection
                ? side === "left" ? startingPoint : centerX
                : side === "left" ? 0 : centerX
            }
            y={linePosY}
            width={
              isTravelDirection
                ? side === "left"
                  ? centerX - startingPoint
                  : width - startingPoint - centerX
                : side === "left" ? centerX : width - centerX
            }
            height={lineHeight}
            fill={lineColor}
            stroke={lineColor}
            strokeWidth={1}
          />
          {isTravelDirection && (
            <Line
              closed
              points={getJrEastLineArrowPoints(
                startingPoint - 15,
                lineHeight,
                side,
              )}
              x={side === "left" ? 15 : width - startingPoint}
              y={linePosY}
              fill={lineColor}
              stroke={lineColor}
              strokeWidth={1}
            />
          )}
          {station && (
            <>
              <Text
                text={
                  station.primaryName.length <= 2
                    ? station.primaryName.split("").join(" ")
                    : station.primaryName
                }
                width={width}
                x={primaryX}
                y={primaryY}
                fontSize={primaryFontSize}
                fontStyle="400"
                fontFamily="NotoSansJP"
                fill="white"
                align={align}
              />
              <Text
                text={station.secondaryName}
                width={width}
                x={secondaryX}
                y={secondaryY}
                fontSize={secondaryFontSize}
                fontFamily="OverusedGrotesk"
                fill="black"
                align={align}
              />
              {isTravelDirection && (
                <>
                  <JrEastAdjacentNumberBadge
                    x={primaryBadgeX}
                    y={badgeY}
                    prefix={station.numberPrimaryPrefix}
                    value={station.numberPrimaryValue}
                    color={getLineColor(station.numberPrimaryPrefix)}
                    stationNumberStyle={stationNumberStyle}
                  />
                  <JrEastAdjacentNumberBadge
                    x={tertiaryBadgeX}
                    y={badgeY}
                    prefix={station.numberTertiaryPrefix}
                    value={station.numberTertiaryValue}
                    color={getLineColor(station.numberTertiaryPrefix)}
                    stationNumberStyle={stationNumberStyle}
                  />
                  <JrEastAdjacentNumberBadge
                    x={secondaryBadgeX}
                    y={badgeY}
                    prefix={station.numberSecondaryPrefix}
                    value={station.numberSecondaryValue}
                    color={getLineColor(station.numberSecondaryPrefix)}
                    stationNumberStyle={stationNumberStyle}
                  />
                </>
              )}
            </>
          )}
        </>
      );
    }

    const offsets = getJrEastBranchOffsets(branchCount);
    const renderOrder = getJrEastBranchRenderOrder(branchCount);
    const primaryFontSize = getJrEastBranchPrimaryFontSize(
      branchCount,
      isTravelDirection,
      hasThreeBranchLayout,
    );
    const primaryX = getJrEastBranchStationNameX(
      side,
      "primary",
      isTravelDirection,
    );
    const secondaryX = getJrEastBranchStationNameX(
      side,
      "secondary",
      isTravelDirection,
    );
    const branchStartDistance = getJrEastBranchStartDistance(width);
    const branchDiagonalDistance = getJrEastBranchDiagonalDistance(width);
    const trunkLineHeight = getJrEastBranchTrunkLineHeight(
      branchCount,
      hasThreeBranchLayout,
    );
    const priorityBranchIndex = renderOrder.at(-1) ?? 0;
    const trunkColor = getJrEastBranchArrowColor(
      branches[priorityBranchIndex]?.arrowColor,
      baseColor,
    );
    const secondaryFontSize = getJrEastBranchSecondaryFontSize(
      branchCount,
      hasThreeBranchLayout,
    );

    return (
      <>
        {renderOrder.map((index, renderIndex) => {
          const station = branches[index];
          const targetY = centerY + offsets[index];
          const lineHeight = JR_EAST_BRANCH_LAYOUT.branchLineHeight;
          const arrowColor = getJrEastBranchArrowColor(
            station?.arrowColor,
            baseColor,
          );
          const primaryText = station
            ? station.primaryName.length <= 2
              ? station.primaryName.split("").join(" ")
              : station.primaryName
            : "";
          const badgeY = targetY + lineHeight / 2 + 3;
          const badgeCount = station?.numberTertiaryValue
            ? 3
            : station?.numberSecondaryValue
              ? 2
              : 1;
          const primaryBadgeX = getJrEastBranchStationBadgeX(
            side,
            width,
            "primary",
            isTravelDirection,
            badgeCount,
          );
          const secondaryBadgeX = getJrEastBranchStationBadgeX(
            side,
            width,
            "secondary",
            isTravelDirection,
            badgeCount,
          );
          const tertiaryBadgeX = getJrEastBranchStationBadgeX(
            side,
            width,
            "tertiary",
            isTravelDirection,
            badgeCount,
          );
          const usesThickClippedDiagonal =
            hasThreeBranchLayout && offsets[index] !== 0;
          const thickBranchDiagonal = usesThickClippedDiagonal
            ? getJrEastThreeBranchDiagonalGeometry({
              side,
              width,
              centerX,
              centerY,
              targetY,
              trunkLineHeight,
              branchLineHeight: lineHeight,
              diagonalLineHeight:
                JR_EAST_BRANCH_LAYOUT.threeBranchDiagonalLineHeight,
              branchStartDistance,
              branchDiagonalDistance,
            })
            : null;

          return (
            <Fragment key={station?.id ?? `${side}-empty`}>
              {renderIndex === renderOrder.length - 1 && (
                <Rect
                  x={
                    side === "left"
                      ? centerX - branchStartDistance
                      : centerX
                  }
                  y={centerY - trunkLineHeight / 2}
                  width={branchStartDistance}
                  height={trunkLineHeight}
                  fill={trunkColor}
                  stroke={trunkColor}
                  strokeWidth={1}
                />
              )}
              {thickBranchDiagonal ? (
                <>
                  <Line
                    closed
                    points={thickBranchDiagonal.points}
                    fill={arrowColor}
                    stroke={arrowColor}
                    strokeWidth={1}
                    lineJoin="miter"
                  />
                  <Line
                    closed
                    points={getJrEastHorizontalBranchArrowPoints({
                      side,
                      width,
                      startX: thickBranchDiagonal.horizontalStartX,
                      targetY,
                      lineHeight,
                      showArrowhead: isTravelDirection,
                    })}
                    fill={arrowColor}
                    stroke={arrowColor}
                    strokeWidth={1}
                    lineJoin="miter"
                  />
                </>
              ) : (
                <Line
                  closed
                  points={getJrEastBranchArrowPoints({
                    side,
                    width,
                    centerX,
                    centerY,
                    targetY,
                    lineHeight,
                    diagonalLineHeight:
                      getJrEastBranchDiagonalLineHeight(
                        branchCount,
                        offsets[index] === 0,
                        hasThreeBranchLayout,
                      ),
                    branchStartDistance,
                    branchDiagonalDistance,
                    junctionOverlap:
                      branchCount >= 3 && offsets[index] === 0
                        ? JR_EAST_BRANCH_LAYOUT.threeBranchCenterArrowOverlap
                        : 0,
                    showArrowhead: isTravelDirection,
                  })}
                  fill={arrowColor}
                  stroke={arrowColor}
                  strokeWidth={1}
                  lineJoin="miter"
                />
              )}
              {station && (
                <>
                  <Text
                    text={primaryText}
                    width={width}
                    x={primaryX}
                    y={targetY - primaryFontSize / 2}
                    fontSize={primaryFontSize}
                    fontStyle="400"
                    fontFamily="NotoSansJP"
                    fill="white"
                    align={align}
                  />
                  <Text
                    text={station.secondaryName}
                    width={width}
                    x={secondaryX}
                    y={getJrEastBranchSecondaryNameY(
                      targetY,
                      lineHeight,
                      isTravelDirection,
                    )}
                    fontSize={secondaryFontSize}
                    fontFamily="OverusedGrotesk"
                    fill="black"
                    align={align}
                  />
                  {isTravelDirection && (
                    <>
                      <JrEastAdjacentNumberBadge
                        x={primaryBadgeX}
                        y={badgeY}
                        prefix={station.numberPrimaryPrefix}
                        value={station.numberPrimaryValue}
                        color={getLineColor(station.numberPrimaryPrefix)}
                        stationNumberStyle={stationNumberStyle}
                      />
                      <JrEastAdjacentNumberBadge
                        x={tertiaryBadgeX}
                        y={badgeY}
                        prefix={station.numberTertiaryPrefix}
                        value={station.numberTertiaryValue}
                        color={getLineColor(station.numberTertiaryPrefix)}
                        stationNumberStyle={stationNumberStyle}
                      />
                      <JrEastAdjacentNumberBadge
                        x={secondaryBadgeX}
                        y={badgeY}
                        prefix={station.numberSecondaryPrefix}
                        value={station.numberSecondaryValue}
                        color={getLineColor(station.numberSecondaryPrefix)}
                        stationNumberStyle={stationNumberStyle}
                      />
                    </>
                  )}
                </>
              )}
            </Fragment>
          );
        })}
      </>
    );
  };

  return (
    <>
      {renderSide("left", left)}
      {renderSide("right", right)}
    </>
  );
}
