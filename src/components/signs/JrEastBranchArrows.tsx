import { Fragment } from "react";
import { Line, Rect, Text } from "react-konva";
import type StationProps from "./DirectInputStationProps";
import JrEastAdjacentNumberBadge from "./JrEastAdjacentNumberBadge";
import { getJrEastLineArrowPoints } from "./arrowGeometry";
import {
  getJrEastBranchArrowColor,
  getJrEastBranchArrowPoints,
  getJrEastBranchDiagonalDistance,
  getJrEastBranchOffsets,
  getJrEastBranchPrimaryFontSize,
  getJrEastBranchSecondaryNameY,
  getJrEastBranchStartDistance,
  getJrEastBranchStationBadgeX,
  getJrEastBranchStationNameX,
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

  const renderSide = (side: BranchSide, stations: StationProps["left"]) => {
    const shownStations = stations.slice(0, 3);
    const branches = shownStations.length > 0 ? shownStations : [null];
    const branchCount = branches.length;
    const isBranched = branchCount > 1;
    const isTravelDirection = direction === "both" || direction === side;
    const align = side === "left" ? "left" : "right";

    if (!isBranched) {
      const station = branches[0];
      const linePosY = centerY - JR_EAST_BRANCH_LAYOUT.mainLineHeight / 2;
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
            height={JR_EAST_BRANCH_LAYOUT.mainLineHeight}
            fill={lineColor}
            stroke={lineColor}
            strokeWidth={1}
          />
          {isTravelDirection && (
            <Line
              closed
              points={getJrEastLineArrowPoints(
                startingPoint - 15,
                JR_EAST_BRANCH_LAYOUT.mainLineHeight,
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
                y={isTravelDirection ? linePosY + 2 : linePosY + 4}
                fontSize={isTravelDirection ? 21 : 15}
                fontStyle="400"
                fontFamily="NotoSansJP"
                fill="white"
                align={align}
              />
              <Text
                text={station.secondaryName}
                width={width}
                x={secondaryX}
                y={linePosY + 28}
                fontSize={13}
                fontFamily="OverusedGrotesk"
                fill="black"
                align={align}
              />
              {isTravelDirection && (
                <>
                  <JrEastAdjacentNumberBadge
                    x={primaryBadgeX}
                    y={linePosY + 27}
                    prefix={station.numberPrimaryPrefix}
                    value={station.numberPrimaryValue}
                    color={getLineColor(station.numberPrimaryPrefix)}
                    stationNumberStyle={stationNumberStyle}
                  />
                  <JrEastAdjacentNumberBadge
                    x={secondaryBadgeX}
                    y={linePosY + 27}
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
    const primaryFontSize = getJrEastBranchPrimaryFontSize(
      branchCount,
      isTravelDirection,
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

    return (
      <>
        <Rect
          x={side === "left" ? centerX - branchStartDistance : centerX}
          y={centerY - JR_EAST_BRANCH_LAYOUT.mainLineHeight / 2}
          width={branchStartDistance}
          height={JR_EAST_BRANCH_LAYOUT.mainLineHeight}
          fill={baseColor}
          stroke={baseColor}
          strokeWidth={1}
        />
        {branches.map((station, index) => {
          const targetY = centerY + offsets[index];
          const lineHeight = JR_EAST_BRANCH_LAYOUT.branchLineHeight;
          const arrowColor = getJrEastBranchArrowColor(
            station?.arrowColor,
            baseColor,
          );
          const badgeY = targetY + lineHeight / 2 + 3;
          const primaryBadgeX = getJrEastBranchStationBadgeX(
            side,
            width,
            "primary",
            isTravelDirection,
          );
          const secondaryBadgeX = getJrEastBranchStationBadgeX(
            side,
            width,
            "secondary",
            isTravelDirection,
          );

          return (
            <Fragment key={station?.id ?? `${side}-empty`}>
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
                    JR_EAST_BRANCH_LAYOUT.branchDiagonalLineHeight,
                  branchStartDistance,
                  branchDiagonalDistance,
                  showArrowhead: isTravelDirection,
                })}
                fill={arrowColor}
                stroke={arrowColor}
                strokeWidth={1}
                lineJoin="miter"
              />
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
                    fontSize={branchCount === 1 ? 13 : 11}
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
