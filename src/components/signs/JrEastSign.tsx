import { Fragment, useState, useEffect, forwardRef } from "react";
import type { UpdatePayload } from "vite";
import type StationProps from "./DirectInputStationProps";
import { Rect, Layer, Stage, Text, Line, Ellipse, Group } from "react-konva";
import Konva from "konva";
import { v7 as uuidv7 } from "uuid";
import { isMobile } from "react-device-detect";
import { getTokyoMetroStationNumberMetrics } from "@/components/signs/stationNumberBadgeMetrics";
import {
  CHINESE_STATION_NAME_FONT_FAMILY,
  getStationSignFontSpecs,
  waitForCanvasFonts,
} from "@/lib/fonts";
import styled from "styled-components";
import { getJrEastLineArrowPoints } from "./arrowGeometry";
import JrEastBranchArrows from "./JrEastBranchArrows";
import JrEastAdjacentNumberBadge from "./JrEastAdjacentNumberBadge";
import { StationNumberBadgeRow } from "./StationNumberBadge";
import { resolveSubwayStationNumberAppearance } from "./subwayStationNumberAppearance";
import {
  getJrEastBranchCanvasHeight,
  getJrEastBranchCenterSquareSize,
  hasActiveJrEastBranches,
  JR_EAST_BRANCH_LAYOUT,
} from "./jrEastBranchLayout";

export const height = 140;
export const scale = 3;

const JrEastSign = forwardRef<Konva.Stage, StationProps>(
  (props, ref: React.Ref<Konva.Stage>) => {
    // font importer memo
    // const font = new FontFace('CustomFont', 'url(/path/to/font.woff2)');
    //const stageRef = useRef<Konva.Stage>(null)

    const {
      primaryName,
      secondaryName,
      primaryNameFurigana,
      quaternaryName,
      tertiaryName,
      note,
      stationAreas,
      left,
      right,
      numberPrimaryPrefix,
      numberPrimaryValue,
      numberPrimaryColor,
      numberPrimaryStyle,
      numberSecondaryPrefix,
      numberSecondaryValue,
      numberSecondaryColor,
      numberSecondaryStyle,
      numberTertiaryPrefix,
      numberTertiaryValue,
      numberTertiaryColor,
      numberTertiaryStyle,
      threeLetterCode: threeLetterCodeRaw,
      stationNumberStyle,
      baseColor,
      centerSquareColors,
      localLines,
      direction,
      ratio,
      branchMode = false,
      branchLayoutRenderKey,
    } = props;

    const fontSpecs = getStationSignFontSpecs("jreast", stationNumberStyle);

    const getLineColor = (prefix?: string): string => {
      if (!prefix) return "#000000";
      return localLines?.find((l) => l.prefix === prefix)?.color ?? "#000000";
    };
    const resolveNumberAppearance = (
      prefix?: string,
      color?: string,
      style?: string,
    ) => resolveSubwayStationNumberAppearance({
      prefix,
      color,
      style,
      localLines,
      fallbackColor: getLineColor(prefix),
      fallbackStyle: stationNumberStyle ?? "jreast",
    });
    const primaryNumberAppearance = resolveNumberAppearance(
      numberPrimaryPrefix,
      numberPrimaryColor,
      numberPrimaryStyle,
    );
    const secondaryNumberAppearance = resolveNumberAppearance(
      numberSecondaryPrefix,
      numberSecondaryColor,
      numberSecondaryStyle,
    );
    const tertiaryNumberAppearance = resolveNumberAppearance(
      numberTertiaryPrefix,
      numberTertiaryColor,
      numberTertiaryStyle,
    );
    const hasJrEastNumber =
      (!!numberPrimaryPrefix && primaryNumberAppearance.style === "jreast") ||
      (!!numberSecondaryPrefix &&
        secondaryNumberAppearance.style === "jreast") ||
      (!!numberTertiaryPrefix &&
        branchMode &&
        !!numberSecondaryPrefix &&
        tertiaryNumberAppearance.style === "jreast");
    const threeLetterCode = hasJrEastNumber
      ? threeLetterCodeRaw
      : undefined;
    const stationBadgeFontFamily =
      stationNumberStyle === "tokyometro"
        ? "JostTrispaceHybrid"
        : "HindSemiBold";
    const metroStandardBadgeMetrics = getTokyoMetroStationNumberMetrics(30);
    const metroLargeStrokeWidth = metroStandardBadgeMetrics.strokeWidth + 1;
    const mergeAdjacentStations = (stations: StationProps["left"]) => {
      if (stations.length === 0) {
        return {
          primaryName: "",
          secondaryName: "",
          numberPrimaryPrefix: undefined,
          numberPrimaryValue: undefined,
          numberPrimaryColor: undefined,
          numberPrimaryStyle: undefined,
          numberSecondaryPrefix: undefined,
          numberSecondaryValue: undefined,
          numberSecondaryColor: undefined,
          numberSecondaryStyle: undefined,
        };
      }
      if (stations.length === 1) {
        return {
          primaryName: stations[0].primaryName,
          secondaryName: stations[0].secondaryName,
          numberPrimaryPrefix: stations[0].numberPrimaryPrefix,
          numberPrimaryValue: stations[0].numberPrimaryValue,
          numberPrimaryColor: stations[0].numberPrimaryColor,
          numberPrimaryStyle: stations[0].numberPrimaryStyle,
          numberSecondaryPrefix: stations[0].numberSecondaryPrefix,
          numberSecondaryValue: stations[0].numberSecondaryValue,
          numberSecondaryColor: stations[0].numberSecondaryColor,
          numberSecondaryStyle: stations[0].numberSecondaryStyle,
        };
      }
      return {
        primaryName: `${stations[0].primaryName}／${stations[1].primaryName}`,
        secondaryName: `${stations[0].secondaryName}／${stations[1].secondaryName}`,
        numberPrimaryPrefix: stations[0].numberPrimaryPrefix,
        numberPrimaryValue: stations[0].numberPrimaryValue,
        numberPrimaryColor: stations[0].numberPrimaryColor,
        numberPrimaryStyle: stations[0].numberPrimaryStyle,
        numberSecondaryPrefix: stations[1].numberPrimaryPrefix,
        numberSecondaryValue: stations[1].numberPrimaryValue,
        numberSecondaryColor: stations[1].numberPrimaryColor,
        numberSecondaryStyle: stations[1].numberPrimaryStyle,
      };
    };
    const leftMerged = mergeAdjacentStations(left);
    const rightMerged = mergeAdjacentStations(right);
    const leftPrimaryName = leftMerged.primaryName;
    const leftSecondaryName = leftMerged.secondaryName;
    const leftNumberPrimaryPrefix = leftMerged.numberPrimaryPrefix;
    const leftNumberPrimaryValue = leftMerged.numberPrimaryValue;
    const leftNumberPrimaryAppearance = resolveNumberAppearance(
      leftMerged.numberPrimaryPrefix,
      leftMerged.numberPrimaryColor,
      leftMerged.numberPrimaryStyle,
    );
    const leftNumberSecondaryPrefix = leftMerged.numberSecondaryPrefix;
    const leftNumberSecondaryValue = leftMerged.numberSecondaryValue;
    const leftNumberSecondaryAppearance = resolveNumberAppearance(
      leftMerged.numberSecondaryPrefix,
      leftMerged.numberSecondaryColor,
      leftMerged.numberSecondaryStyle,
    );
    const rightPrimaryName = rightMerged.primaryName;
    const rightSecondaryName = rightMerged.secondaryName;
    const rightNumberPrimaryPrefix = rightMerged.numberPrimaryPrefix;
    const rightNumberPrimaryValue = rightMerged.numberPrimaryValue;
    const rightNumberPrimaryAppearance = resolveNumberAppearance(
      rightMerged.numberPrimaryPrefix,
      rightMerged.numberPrimaryColor,
      rightMerged.numberPrimaryStyle,
    );
    const rightNumberSecondaryPrefix = rightMerged.numberSecondaryPrefix;
    const rightNumberSecondaryValue = rightMerged.numberSecondaryValue;
    const rightNumberSecondaryAppearance = resolveNumberAppearance(
      rightMerged.numberSecondaryPrefix,
      rightMerged.numberSecondaryColor,
      rightMerged.numberSecondaryStyle,
    );
    const spacedStationName = (() => {
      const str = primaryName;
      switch (str.length) {
        case 2:
          return str.split("").join("　");
        case 3:
          return str.split("").join(" ");
        default:
          return str;
      }
    })();
    //const height = 140;
    const width = height * ratio;
    const canvasHeight = getJrEastBranchCanvasHeight(
      height,
      branchMode,
      left.length,
      right.length,
    );
    const centerSquareSize = getJrEastBranchCenterSquareSize(
      branchMode,
      left.length,
      right.length,
    );
    const hasActiveBranches = hasActiveJrEastBranches(
      branchMode,
      left.length,
      right.length,
    );
    const branchCenterBadgeYOffset = hasActiveBranches
      ? JR_EAST_BRANCH_LAYOUT.centerBadgeYOffset
      : 0;
    const branchCenterTextYOffset = hasActiveBranches
      ? JR_EAST_BRANCH_LAYOUT.centerTextYOffset
      : 0;
    const numberTertiaryPrefixForRender =
      branchMode && numberSecondaryPrefix ? numberTertiaryPrefix : undefined;
    const numberTertiaryValueForRender = numberTertiaryPrefixForRender
      ? numberTertiaryValue
      : undefined;
    const yOffset = 6;
    const startingPoint = 40;
    const lineHeight = 24;
    const linePosY = 70 + yOffset;
    // const [isFontLoaded, setIsFontLoaded] = useState(false)
    const [stageKey, setStageKey] = useState(0);
    useEffect(() => {
      const hot = import.meta.hot;
      if (!hot || !branchMode) return;

      const handleHmrUpdate = (payload: UpdatePayload) => {
        const hasBranchArrowUpdate = payload.updates.some((update) =>
          [update.path, update.acceptedPath].some((path) =>
            path
              .split("?", 1)[0]
              .endsWith("/src/components/signs/JrEastBranchArrows.tsx"),
          )
        );
        if (hasBranchArrowUpdate) {
          setStageKey((key) => key + 1);
        }
      };

      hot.on("vite:afterUpdate", handleHmrUpdate);
      return () => hot.off("vite:afterUpdate", handleHmrUpdate);
    }, [branchMode]);
    const reversedStationArea = stationAreas
      ? [...stationAreas].reverse()
      : undefined;

    useEffect(() => {
      let cancelled = false;
      waitForCanvasFonts(fontSpecs)
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) setStageKey((prevKey) => prevKey + 1);
        });
      return () => {
        cancelled = true;
      };
    }, [fontSpecs]);

    const autoSpace = (str: string) => {
      return str.length <= 2 ? str.split("").join(" ") : str;
    };

    const stationNameStyle = {
      fontSize: 32,
      fontFamily: "NotoSansJP",
      fontStyle: "900",
    };

    const smallStationNameStyle = {
      fontSize: 30,
      fontFamily: "NotoSansJP",
      fontStyle: "800",
    };

    const stationNameWidth = (() => {
      const tempText = new Konva.Text({
        text: spacedStationName,
        ...stationNameStyle,
      });
      return tempText.getWidth();
    })();

    const smallStationNameWidth = (() => {
      const tempText = new Konva.Text({
        text: spacedStationName,
        ...smallStationNameStyle,
      });
      return tempText.getWidth();
    })();

    const xOffsetWithNote = note ? -38 : -45;
    const yOffsetWithNote = note ? (threeLetterCode ? -14 : -9) : 0;

    const [canvasImage, setCanvasImage] = useState("");
    useEffect(() => {
      if (stageKey < 1) {
        setCanvasImage("");
        return;
      }
      const renderFunction = () => {
        ref && "current" in ref && ref.current
          ? setCanvasImage(ref.current.toDataURL())
          : setCanvasImage("");
      };
      if (isMobile && stageKey >= 1) {
        const t = setTimeout(renderFunction, isMobile ? 1000 : 0);
        return () => clearTimeout(t);
      } else {
        renderFunction();
      }
    }, [props, stageKey, branchLayoutRenderKey]);

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
            style={{ display: "flex", justifyContent: "center" }}
            ref={ref}
            key={stageKey}
            width={width * scale}
            height={canvasHeight * scale}
            scaleX={scale}
            scaleY={scale}
          >
            <Layer>
              <Rect
                fill="white"
                x={0}
                y={0}
                width={width}
                height={canvasHeight}
              />
              {hasActiveBranches ? (
                <JrEastBranchArrows
                  width={width}
                  centerY={linePosY + lineHeight / 2}
                  left={left}
                  right={right}
                  baseColor={baseColor}
                  direction={direction}
                  stationNumberStyle={stationNumberStyle}
                  localLines={localLines}
                  getLineColor={getLineColor}
                />
              ) : (
                <>
              <Rect
                fill={baseColor}
                x={startingPoint}
                y={linePosY}
                width={width - 80}
                height={lineHeight}
                strokeWidth={1}
                stroke={baseColor}
              />
              <Line
                closed
                points={getJrEastLineArrowPoints(
                  startingPoint - 15,
                  lineHeight,
                  "left",
                )}
                x={15}
                y={linePosY}
                fill={baseColor}
                strokeWidth={1}
                stroke={baseColor}
              />
              <Line
                closed
                points={getJrEastLineArrowPoints(
                  startingPoint - 15,
                  lineHeight,
                  "right",
                )}
                x={width - startingPoint}
                y={linePosY}
                fill={baseColor}
                strokeWidth={1}
                stroke={baseColor}
              />
              {direction == "left" && (
                <>
                  <Rect
                    fill={baseColor}
                    x={startingPoint}
                    y={linePosY}
                    width={width}
                    height={lineHeight}
                    strokeWidth={1}
                    stroke={baseColor}
                  />
                  <Text
                    text={autoSpace(rightPrimaryName)}
                    width={width}
                    x={-30}
                    y={yOffset + 74}
                    fontSize={15}
                    fontStyle="400"
                    fontFamily="NotoSansJP"
                    fill="white"
                    align="right"
                  />
                  <Text
                    text={rightSecondaryName}
                    width={width}
                    x={-30}
                    y={yOffset + 98}
                    fontSize={13}
                    fontFamily="OverusedGrotesk"
                    fill="black"
                    align="right"
                  />
                </>
              )}
              {direction == "right" && (
                <>
                  <Rect
                    fill={baseColor}
                    x={0}
                    y={linePosY}
                    width={width - 80}
                    height={lineHeight}
                    strokeWidth={1}
                    stroke={baseColor}
                  />
                  <Text
                    text={autoSpace(leftPrimaryName)}
                    width={width}
                    x={30}
                    y={yOffset + 74}
                    fontSize={15}
                    fontStyle="400"
                    fontFamily="NotoSansJP"
                    fill="white"
                    align="left"
                  />
                  <Text
                    text={leftSecondaryName}
                    width={width}
                    x={30}
                    y={yOffset + 98}
                    fontSize={13}
                    fontFamily="OverusedGrotesk"
                    fill="black"
                    align="left"
                  />
                </>
              )}
              {(direction == "left" || direction == "both") && (
                <>
                  <Text
                    text={leftSecondaryName}
                    width={width}
                    x={64}
                    y={yOffset + 98}
                    fontSize={13}
                    fontFamily="OverusedGrotesk"
                    fill="black"
                    align="left"
                  />
                  <Text
                    text={autoSpace(leftPrimaryName)}
                    width={width}
                    x={60}
                    y={yOffset + 72}
                    fontSize={21}
                    fontStyle="400"
                    fontFamily="NotoSansJP"
                    fill="white"
                    align="left"
                  />
                  {leftNumberPrimaryValue && (
                    <JrEastAdjacentNumberBadge
                      x={44}
                      y={yOffset + 97}
                      prefix={leftNumberPrimaryPrefix}
                      value={leftNumberPrimaryValue}
                      color={leftNumberPrimaryAppearance.color}
                      stationNumberStyle={leftNumberPrimaryAppearance.style}
                    />
                  )}
                  {leftNumberSecondaryValue && (
                    <JrEastAdjacentNumberBadge
                      x={24}
                      y={yOffset + 97}
                      prefix={leftNumberSecondaryPrefix}
                      value={leftNumberSecondaryValue}
                      color={leftNumberSecondaryAppearance.color}
                      stationNumberStyle={leftNumberSecondaryAppearance.style}
                    />
                  )}
                </>
              )}
              {(direction == "both" || direction == "right") && (
                <>
                  <Text
                    text={autoSpace(rightPrimaryName)}
                    width={width}
                    x={-60}
                    y={yOffset + 72}
                    fontSize={21}
                    fontStyle="400"
                    fontFamily="NotoSansJP"
                    fill="white"
                    align="right"
                  />
                  <Text
                    text={rightSecondaryName}
                    width={width}
                    x={-66}
                    y={yOffset + 98}
                    fontSize={13}
                    fontFamily="OverusedGrotesk"
                    fill="black"
                    align="right"
                  />
                  {rightNumberPrimaryValue && (
                    <JrEastAdjacentNumberBadge
                      x={width - 60}
                      y={yOffset + 97}
                      prefix={rightNumberPrimaryPrefix}
                      value={rightNumberPrimaryValue}
                      color={rightNumberPrimaryAppearance.color}
                      stationNumberStyle={rightNumberPrimaryAppearance.style}
                    />
                  )}
                  {rightNumberSecondaryValue && (
                    <JrEastAdjacentNumberBadge
                      x={width - 40}
                      y={yOffset + 97}
                      prefix={rightNumberSecondaryPrefix}
                      value={rightNumberSecondaryValue}
                      color={rightNumberSecondaryAppearance.color}
                      stationNumberStyle={rightNumberSecondaryAppearance.style}
                    />
                  )}
                </>
              )}
                </>
              )}

              {/* Outline */}
              <Rect
                stroke="grey"
                strokeWidth={8}
                x={0}
                y={0}
                width={width}
                height={canvasHeight}
              />

              {/* Center Square — 1–4 vertical color segments (top to bottom) */}
              {(() => {
                const colors =
                  centerSquareColors && centerSquareColors.length > 0
                    ? centerSquareColors.slice(0, 4)
                    : [baseColor];
                const segH = centerSquareSize / colors.length;
                return colors.map((color, i) => (
                  <Rect
                    key={i}
                    fill={color}
                    x={width / 2 - centerSquareSize / 2}
                    y={linePosY + lineHeight / 2 - centerSquareSize / 2 + i * segH}
                    width={centerSquareSize}
                    height={segH}
                  />
                ));
              })()}

              {note ? (
                <>
                  {/* With note (smaller station name, medium station note) */}
                  <Text
                    text={note}
                    width={width}
                    x={0}
                    y={yOffset + 40}
                    fontSize={24}
                    fontStyle="800"
                    fontFamily="NotoSansJP"
                    fill="black"
                    align="center"
                  />
                  <Text
                    text={spacedStationName}
                    width={width}
                    x={0}
                    y={yOffset + 8 + branchCenterTextYOffset}
                    {...smallStationNameStyle}
                    fill="black"
                    align="center"
                  />
                </>
              ) : (
                <>
                  {/* Without note (large station name, small furigana) */}
                  <Text
                    text={primaryNameFurigana}
                    width={width}
                    x={0}
                    y={yOffset + 52 + branchCenterTextYOffset}
                    fontSize={
                      hasActiveBranches
                        ? JR_EAST_BRANCH_LAYOUT.furiganaFontSize
                        : 12
                    }
                    fontStyle="800"
                    fontFamily="NotoSansJP"
                    fill="black"
                    align="center"
                  />
                  <Text
                    text={spacedStationName}
                    width={width}
                    x={0}
                    y={yOffset + 16 + branchCenterTextYOffset}
                    {...stationNameStyle}
                    fill="black"
                    align="center"
                  />
                </>
              )}

              {/* If station number exists */}
              {/* Legacy renderer retained temporarily for layout parity checks. */}
              <Group y={branchCenterBadgeYOffset} visible={false}>
                {numberPrimaryPrefix &&
                  (threeLetterCode ? (
                  <>
                    <Rect
                      stroke={getLineColor(numberPrimaryPrefix)}
                      strokeWidth={3}
                      x={xOffsetWithNote + (width - stationNameWidth) / 2}
                      y={yOffset + yOffsetWithNote + 29}
                      width={30}
                      height={30}
                      cornerRadius={2}
                    />
                    <Rect
                      stroke="black"
                      strokeWidth={3}
                      x={xOffsetWithNote - 3 + (width - stationNameWidth) / 2}
                      y={yOffset + yOffsetWithNote + 26}
                      width={36}
                      height={36}
                      cornerRadius={5}
                    />
                    <Rect
                      stroke="black"
                      strokeWidth={3}
                      x={xOffsetWithNote - 3 + (width - stationNameWidth) / 2}
                      y={yOffset + yOffsetWithNote + 24}
                      width={36}
                      height={38}
                      cornerRadius={4}
                    />
                    <Rect
                      stroke="black"
                      strokeWidth={3}
                      x={xOffsetWithNote - 3 + (width - stationNameWidth) / 2}
                      y={yOffset + yOffsetWithNote + 22}
                      width={36}
                      height={40}
                      cornerRadius={4}
                    />
                    <Rect
                      stroke="black"
                      strokeWidth={3}
                      x={xOffsetWithNote - 3 + (width - stationNameWidth) / 2}
                      y={yOffset + yOffsetWithNote + 20}
                      width={36}
                      height={42}
                      cornerRadius={4}
                    />
                    <Rect
                      stroke="black"
                      strokeWidth={3}
                      x={xOffsetWithNote - 3 + (width - stationNameWidth) / 2}
                      y={yOffset + yOffsetWithNote + 18}
                      width={36}
                      height={44}
                      cornerRadius={4}
                    />
                    <Rect
                      stroke="black"
                      strokeWidth={3}
                      x={xOffsetWithNote - 3 + (width - stationNameWidth) / 2}
                      y={yOffset + yOffsetWithNote + 17}
                      width={36}
                      height={45}
                      cornerRadius={4}
                    />
                    {numberSecondaryPrefix ? (
                      <>
                        <Rect
                          stroke={getLineColor(numberSecondaryPrefix)}
                          strokeWidth={3}
                          x={
                            xOffsetWithNote -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          y={yOffset + yOffsetWithNote + 29}
                          width={30}
                          height={30}
                          cornerRadius={2}
                        />
                        <Rect
                          stroke="black"
                          strokeWidth={3}
                          x={
                            xOffsetWithNote -
                            3 -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          y={yOffset + yOffsetWithNote + 26}
                          width={36}
                          height={36}
                          cornerRadius={5}
                        />
                        <Rect
                          stroke="black"
                          strokeWidth={3}
                          x={
                            xOffsetWithNote -
                            3 -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          y={yOffset + yOffsetWithNote + 24}
                          width={36}
                          height={38}
                          cornerRadius={4}
                        />
                        <Rect
                          stroke="black"
                          strokeWidth={3}
                          x={
                            xOffsetWithNote -
                            3 -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          y={yOffset + yOffsetWithNote + 22}
                          width={36}
                          height={40}
                          cornerRadius={4}
                        />
                        <Rect
                          stroke="black"
                          strokeWidth={3}
                          x={
                            xOffsetWithNote -
                            3 -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          y={yOffset + yOffsetWithNote + 20}
                          width={36}
                          height={42}
                          cornerRadius={4}
                        />
                        <Rect
                          stroke="black"
                          strokeWidth={3}
                          x={
                            xOffsetWithNote -
                            3 -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          y={yOffset + yOffsetWithNote + 18}
                          width={36}
                          height={44}
                          cornerRadius={4}
                        />
                        <Rect
                          stroke="black"
                          strokeWidth={3}
                          x={
                            xOffsetWithNote -
                            3 -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          y={yOffset + yOffsetWithNote + 17}
                          width={36}
                          height={45}
                          cornerRadius={4}
                        />
                        <Rect
                          stroke="black"
                          strokeWidth={3}
                          x={
                            xOffsetWithNote -
                            3 -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          y={yOffset + yOffsetWithNote + 17}
                          width={72}
                          height={45}
                          cornerRadius={4}
                        />
                        {numberTertiaryPrefixForRender && (
                          <>
                            <Rect
                              stroke={getLineColor(
                                numberTertiaryPrefixForRender,
                              )}
                              strokeWidth={3}
                              x={
                                xOffsetWithNote -
                                72 +
                                (width - stationNameWidth) / 2
                              }
                              y={yOffset + yOffsetWithNote + 29}
                              width={30}
                              height={30}
                              cornerRadius={2}
                            />
                            {[26, 24, 22, 20, 18, 17].map((outlineY) => (
                              <Rect
                                key={outlineY}
                                stroke="black"
                                strokeWidth={3}
                                x={
                                  xOffsetWithNote -
                                  75 +
                                  (width - stationNameWidth) / 2
                                }
                                y={yOffset + yOffsetWithNote + outlineY}
                                width={36}
                                height={62 - outlineY}
                                cornerRadius={outlineY === 26 ? 5 : 4}
                              />
                            ))}
                            <Rect
                              stroke="black"
                              strokeWidth={3}
                              x={
                                xOffsetWithNote -
                                75 +
                                (width - stationNameWidth) / 2
                              }
                              y={yOffset + yOffsetWithNote + 17}
                              width={108}
                              height={45}
                              cornerRadius={4}
                            />
                          </>
                        )}
                        <Text
                          text={threeLetterCode}
                          fill="white"
                          x={
                            xOffsetWithNote -
                            (numberTertiaryPrefixForRender ? 72 : 36) +
                            (width - stationNameWidth) / 2
                          }
                          fontSize={12.2}
                          fontFamily={stationBadgeFontFamily}
                          fontStyle="800"
                          y={yOffset + yOffsetWithNote + 18}
                          width={numberTertiaryPrefixForRender ? 102 : 66}
                          height={30}
                          align="center"
                        />
                        <Text
                          text={numberSecondaryPrefix}
                          fill="black"
                          x={
                            xOffsetWithNote -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          fontSize={11}
                          fontFamily={stationBadgeFontFamily}
                          fontStyle="600"
                          y={yOffset + yOffsetWithNote + 33}
                          width={30}
                          height={30}
                          align="center"
                        />
                        <Text
                          text={numberSecondaryValue}
                          fill="black"
                          x={
                            xOffsetWithNote -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          fontSize={17}
                          fontFamily={stationBadgeFontFamily}
                          fontStyle="600"
                          y={yOffset + yOffsetWithNote + 43}
                          width={30}
                          height={32}
                          align="center"
                        />
                        {numberTertiaryPrefixForRender && (
                          <>
                            <Text
                              text={numberTertiaryPrefixForRender}
                              fill="black"
                              x={
                                xOffsetWithNote -
                                72 +
                                (width - stationNameWidth) / 2
                              }
                              fontSize={11}
                              fontFamily={stationBadgeFontFamily}
                              fontStyle="600"
                              y={yOffset + yOffsetWithNote + 33}
                              width={30}
                              height={30}
                              align="center"
                            />
                            <Text
                              text={numberTertiaryValueForRender}
                              fill="black"
                              x={
                                xOffsetWithNote -
                                72 +
                                (width - stationNameWidth) / 2
                              }
                              fontSize={17}
                              fontFamily={stationBadgeFontFamily}
                              fontStyle="600"
                              y={yOffset + yOffsetWithNote + 43}
                              width={30}
                              height={32}
                              align="center"
                            />
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <Text
                          text={threeLetterCode}
                          fill="white"
                          x={xOffsetWithNote + (width - stationNameWidth) / 2}
                          fontSize={12.2}
                          fontFamily={stationBadgeFontFamily}
                          fontStyle="800"
                          y={yOffset + yOffsetWithNote + 18}
                          width={30}
                          height={30}
                          align="center"
                        />
                      </>
                    )}
                    <Text
                      text={numberPrimaryPrefix}
                      fill="black"
                      x={xOffsetWithNote + (width - stationNameWidth) / 2}
                      fontSize={11}
                      fontFamily={stationBadgeFontFamily}
                      fontStyle="600"
                      y={yOffset + yOffsetWithNote + 33}
                      width={30}
                      height={30}
                      align="center"
                    />
                    <Text
                      text={numberPrimaryValue}
                      fill="black"
                      x={xOffsetWithNote + (width - stationNameWidth) / 2}
                      fontSize={17}
                      fontFamily={stationBadgeFontFamily}
                      fontStyle="600"
                      y={yOffset + yOffsetWithNote + 43}
                      width={30}
                      height={32}
                      align="center"
                    />
                  </>
                ) : (
                  <>
                    {stationNumberStyle === "tokyometro" ? (
                      <Ellipse
                        x={
                          xOffsetWithNote + (width - stationNameWidth) / 2 + 15
                        }
                        y={yOffset + yOffsetWithNote + 33}
                        radiusX={14.5}
                        radiusY={14.5}
                        stroke={getLineColor(numberPrimaryPrefix)}
                        strokeWidth={metroLargeStrokeWidth}
                      />
                    ) : (
                      <Rect
                        stroke={getLineColor(numberPrimaryPrefix)}
                        strokeWidth={3}
                        x={xOffsetWithNote + (width - stationNameWidth) / 2}
                        y={yOffset + yOffsetWithNote + 18}
                        width={30}
                        height={30}
                        cornerRadius={2}
                      />
                    )}
                    <Text
                      text={numberPrimaryPrefix}
                      fill="black"
                      x={xOffsetWithNote + (width - stationNameWidth) / 2}
                      fontSize={
                        stationNumberStyle === "tokyometro"
                          ? metroStandardBadgeMetrics.prefixFontSize + 1
                          : 11
                      }
                      fontFamily={stationBadgeFontFamily}
                      fontStyle={
                        stationNumberStyle === "tokyometro"
                          ? metroStandardBadgeMetrics.prefixFontWeight
                          : "600"
                      }
                      y={
                        yOffset +
                        yOffsetWithNote +
                        (stationNumberStyle === "tokyometro"
                          ? 17 + metroStandardBadgeMetrics.prefixYOffset
                          : 22)
                      }
                      width={30}
                      height={30}
                      align="center"
                    />
                    <Text
                      text={numberPrimaryValue}
                      fill="black"
                      x={xOffsetWithNote + (width - stationNameWidth) / 2}
                      fontSize={
                        stationNumberStyle === "tokyometro"
                          ? metroStandardBadgeMetrics.valueFontSize + 1
                          : 17
                      }
                      fontFamily={stationBadgeFontFamily}
                      fontStyle={
                        stationNumberStyle === "tokyometro"
                          ? metroStandardBadgeMetrics.valueFontWeight
                          : "600"
                      }
                      y={
                        yOffset +
                        yOffsetWithNote +
                        (stationNumberStyle === "tokyometro"
                          ? 18 + metroStandardBadgeMetrics.valueYOffset
                          : 32)
                      }
                      width={30}
                      height={32}
                      align="center"
                    />
                    {numberSecondaryPrefix && (
                      <>
                        {stationNumberStyle === "tokyometro" ? (
                          <Ellipse
                            x={
                              xOffsetWithNote -
                              37 +
                              (width - stationNameWidth) / 2 +
                              15
                            }
                            y={yOffset + yOffsetWithNote + 33}
                            radiusX={14.5}
                            radiusY={14.5}
                            stroke={getLineColor(numberSecondaryPrefix)}
                            strokeWidth={metroLargeStrokeWidth}
                          />
                        ) : (
                          <Rect
                            stroke={getLineColor(numberSecondaryPrefix)}
                            strokeWidth={3}
                            x={
                              xOffsetWithNote -
                              37 +
                              (width - stationNameWidth) / 2
                            }
                            y={yOffset + yOffsetWithNote + 18}
                            width={30}
                            height={30}
                            cornerRadius={2}
                          />
                        )}
                        <Text
                          text={numberSecondaryPrefix}
                          fill="black"
                          x={
                            xOffsetWithNote -
                            37 +
                            (width - stationNameWidth) / 2
                          }
                          fontSize={
                            stationNumberStyle === "tokyometro"
                              ? metroStandardBadgeMetrics.prefixFontSize + 1
                              : 11
                          }
                          fontFamily={stationBadgeFontFamily}
                          fontStyle={
                            stationNumberStyle === "tokyometro"
                              ? metroStandardBadgeMetrics.prefixFontWeight
                              : "600"
                          }
                          y={
                            yOffset +
                            yOffsetWithNote +
                            (stationNumberStyle === "tokyometro"
                              ? 17 + metroStandardBadgeMetrics.prefixYOffset
                              : 22)
                          }
                          width={30}
                          height={30}
                          align="center"
                        />
                        <Text
                          text={numberSecondaryValue}
                          fill="black"
                          x={
                            xOffsetWithNote -
                            37 +
                            (width - stationNameWidth) / 2
                          }
                          fontSize={
                            stationNumberStyle === "tokyometro"
                              ? metroStandardBadgeMetrics.valueFontSize + 1
                              : 17
                          }
                          fontFamily={stationBadgeFontFamily}
                          fontStyle={
                            stationNumberStyle === "tokyometro"
                              ? metroStandardBadgeMetrics.valueFontWeight
                              : "600"
                          }
                          y={
                            yOffset +
                            yOffsetWithNote +
                            (stationNumberStyle === "tokyometro"
                              ? 18 + metroStandardBadgeMetrics.valueYOffset
                              : 32)
                          }
                          width={30}
                          height={32}
                          align="center"
                        />
                      </>
                    )}
                    {numberTertiaryPrefixForRender && (
                      <>
                        {stationNumberStyle === "tokyometro" ? (
                          <Ellipse
                            x={
                              xOffsetWithNote -
                              74 +
                              (width - stationNameWidth) / 2 +
                              15
                            }
                            y={yOffset + yOffsetWithNote + 33}
                            radiusX={14.5}
                            radiusY={14.5}
                            stroke={getLineColor(
                              numberTertiaryPrefixForRender,
                            )}
                            strokeWidth={metroLargeStrokeWidth}
                          />
                        ) : (
                          <Rect
                            stroke={getLineColor(
                              numberTertiaryPrefixForRender,
                            )}
                            strokeWidth={3}
                            x={
                              xOffsetWithNote -
                              74 +
                              (width - stationNameWidth) / 2
                            }
                            y={yOffset + yOffsetWithNote + 18}
                            width={30}
                            height={30}
                            cornerRadius={2}
                          />
                        )}
                        <Text
                          text={numberTertiaryPrefixForRender}
                          fill="black"
                          x={
                            xOffsetWithNote -
                            74 +
                            (width - stationNameWidth) / 2
                          }
                          fontSize={
                            stationNumberStyle === "tokyometro"
                              ? metroStandardBadgeMetrics.prefixFontSize + 1
                              : 11
                          }
                          fontFamily={stationBadgeFontFamily}
                          fontStyle={
                            stationNumberStyle === "tokyometro"
                              ? metroStandardBadgeMetrics.prefixFontWeight
                              : "600"
                          }
                          y={
                            yOffset +
                            yOffsetWithNote +
                            (stationNumberStyle === "tokyometro"
                              ? 17 + metroStandardBadgeMetrics.prefixYOffset
                              : 22)
                          }
                          width={30}
                          height={30}
                          align="center"
                        />
                        <Text
                          text={numberTertiaryValueForRender}
                          fill="black"
                          x={
                            xOffsetWithNote -
                            74 +
                            (width - stationNameWidth) / 2
                          }
                          fontSize={
                            stationNumberStyle === "tokyometro"
                              ? metroStandardBadgeMetrics.valueFontSize + 1
                              : 17
                          }
                          fontFamily={stationBadgeFontFamily}
                          fontStyle={
                            stationNumberStyle === "tokyometro"
                              ? metroStandardBadgeMetrics.valueFontWeight
                              : "600"
                          }
                          y={
                            yOffset +
                            yOffsetWithNote +
                            (stationNumberStyle === "tokyometro"
                              ? 18 + metroStandardBadgeMetrics.valueYOffset
                              : 32)
                          }
                          width={30}
                          height={32}
                          align="center"
                        />
                      </>
                    )}
                  </>
                  ))}
              </Group>
              <Group y={branchCenterBadgeYOffset}>
                <StationNumberBadgeRow
                  y={yOffset + yOffsetWithNote + 18}
                  size={30}
                  threeLetterCode={threeLetterCode}
                  numbers={[
                    ...(numberTertiaryPrefixForRender
                      ? [{
                          x:
                            xOffsetWithNote -
                            74 +
                            (width - stationNameWidth) / 2,
                          prefix: numberTertiaryPrefixForRender,
                          value: numberTertiaryValueForRender,
                          color: tertiaryNumberAppearance.color,
                          style: tertiaryNumberAppearance.style,
                        }]
                      : []),
                    ...(numberSecondaryPrefix
                      ? [{
                          x:
                            xOffsetWithNote -
                            37 +
                            (width - stationNameWidth) / 2,
                          prefix: numberSecondaryPrefix,
                          value: numberSecondaryValue,
                          color: secondaryNumberAppearance.color,
                          style: secondaryNumberAppearance.style,
                        }]
                      : []),
                    ...(numberPrimaryPrefix
                      ? [{
                          x:
                            xOffsetWithNote +
                            (width - stationNameWidth) / 2,
                          prefix: numberPrimaryPrefix,
                          value: numberPrimaryValue,
                          color: primaryNumberAppearance.color,
                          style: primaryNumberAppearance.style,
                        }]
                      : []),
                  ]}
                />
              </Group>
              <Group y={branchCenterTextYOffset}>
                {note ? (
                  <>
                  <Text
                    text={quaternaryName}
                    x={8 + (width + smallStationNameWidth) / 2}
                    y={yOffset + 18 - 8}
                    fontSize={10}
                    fontStyle="400"
                    fontFamily={CHINESE_STATION_NAME_FONT_FAMILY}
                    fill="black"
                    align="center"
                  />
                  <Text
                    text={tertiaryName}
                    x={8 + (width + smallStationNameWidth) / 2}
                    y={yOffset + 35 - 9}
                    fontSize={10}
                    fontStyle="400"
                    fontFamily="NotoSansKR"
                    fill="black"
                    align="center"
                  />
                  </>
                ) : (
                  <>
                  <Text
                    text={quaternaryName}
                    x={8 + (width + stationNameWidth) / 2}
                    y={yOffset + 18}
                    fontSize={10}
                    fontStyle="400"
                    fontFamily={CHINESE_STATION_NAME_FONT_FAMILY}
                    fill="black"
                    align="center"
                  />
                  <Text
                    text={tertiaryName}
                    x={8 + (width + stationNameWidth) / 2}
                    y={yOffset + 35}
                    fontSize={10}
                    fontStyle="400"
                    fontFamily="NotoSansKR"
                    fill="black"
                    align="center"
                  />
                  </>
                )}
              </Group>
              <Text
                text={secondaryName}
                width={width}
                x={0}
                y={yOffset + 98}
                fontSize={16}
                fontStyle="600"
                fontFamily="OverusedGrotesk"
                fill="black"
                align="center"
              />
              {reversedStationArea?.map((e, i) => {
                return (
                  <Fragment key={uuidv7()}>
                    <Rect
                      x={width - 40 + i * -22}
                      y={yOffset + 14}
                      fill={e.isWhite ? "white" : "black"}
                      width={16}
                      height={16}
                      stroke="black"
                      strokeWidth={1}
                    />
                    <Text
                      text={e.name}
                      x={width - 39.5 + i * -22}
                      y={yOffset + 14.5}
                      fontSize={15}
                      fontStyle="600"
                      fontFamily="NotoSansJP"
                      fill={e.isWhite ? "black" : "white"}
                      align="center"
                    />
                  </Fragment>
                );
              })}
            </Layer>
          </Stage>
          {/*<img src="temp\nottest.jpg" width={720} />*/}
        </StageWrapper>
      </>
    );
  },
);

const StageWrapper = styled.div`
  position: relative;
`;

const CanvasImage = styled.img`
  width: 100%;
  max-height: 20vh;
  object-fit: contain;
`;

export default JrEastSign;
