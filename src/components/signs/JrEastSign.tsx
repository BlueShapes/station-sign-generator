import { Fragment, useState, useEffect, forwardRef } from "react";
import type StationProps from "./DirectInputStationProps";
import { Rect, Layer, Stage, Text, Line } from "react-konva";
import Konva from "konva";
import { v7 as uuidv7 } from "uuid";
import { isMobile } from "react-device-detect";

import styled from "styled-components";

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
      numberSecondaryPrefix,
      numberSecondaryValue,
      threeLetterCode,
      baseColor,
      centerSquareColors,
      localLines,
      direction,
      ratio,
    } = props;

    const getLineColor = (prefix?: string): string => {
      if (!prefix) return "#000000";
      return localLines?.find((l) => l.prefix === prefix)?.color ?? "#000000";
    };
    const leftPrimaryName = left[0]?.primaryName ?? "";
    const leftSecondaryName = left[0]?.secondaryName ?? "";
    const leftNumberPrimaryPrefix = left[0]?.numberPrimaryPrefix;
    const leftNumberPrimaryValue = left[0]?.numberPrimaryValue;
    const leftNumberSecondaryPrefix = left[0]?.numberSecondaryPrefix;
    const leftNumberSecondaryValue = left[0]?.numberSecondaryValue;
    const rightPrimaryName = right[0]?.primaryName ?? "";
    const rightSecondaryName = right[0]?.secondaryName ?? "";
    const rightNumberPrimaryPrefix = right[0]?.numberPrimaryPrefix;
    const rightNumberPrimaryValue = right[0]?.numberPrimaryValue;
    const rightNumberSecondaryPrefix = right[0]?.numberSecondaryPrefix;
    const rightNumberSecondaryValue = right[0]?.numberSecondaryValue;
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
    const yOffset = 6;
    const startingPoint = 40;
    const lineHeight = 24;
    const linePosY = 70 + yOffset;
    // const [isFontLoaded, setIsFontLoaded] = useState(false)
    const [stageKey, setStageKey] = useState(0);
    const reversedStationArea = stationAreas
      ? [...stationAreas].reverse()
      : undefined;

    useEffect(() => {
      document.fonts.ready.then(() => {
        setStageKey((prevKey) => prevKey + 1);
      });
    }, []);

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
    }, [props, stageKey]);

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
            style={{ display: "flex", justifyContent: "center" }}
            ref={ref}
            key={stageKey}
            width={width * scale}
            height={height * scale}
            scaleX={scale}
            scaleY={scale}
          >
            <Layer>
              <Rect fill="white" x={0} y={0} width={width} height={height} />
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
                points={[
                  startingPoint,
                  linePosY,
                  startingPoint,
                  linePosY + lineHeight,
                  15,
                  linePosY + 12,
                ]}
                fill={baseColor}
                strokeWidth={1}
                stroke={baseColor}
              />
              <Line
                closed
                points={[
                  width - startingPoint,
                  linePosY,
                  width - startingPoint,
                  linePosY + lineHeight,
                  width - 15,
                  linePosY + 12,
                ]}
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
                    <>
                      <Rect
                        stroke={getLineColor(leftNumberPrimaryPrefix)}
                        strokeWidth={2}
                        x={44}
                        y={yOffset + 97}
                        width={15}
                        height={15}
                        cornerRadius={2}
                      />
                      <Text
                        text={leftNumberPrimaryPrefix}
                        fill="black"
                        x={41.5}
                        fontSize={6}
                        fontFamily={"HindSemiBold"}
                        fontStyle="600"
                        y={yOffset + 99}
                        width={20}
                        height={30}
                        align="center"
                      />
                      <Text
                        text={leftNumberPrimaryValue}
                        fill="black"
                        x={41.5}
                        fontSize={9}
                        fontFamily={"HindSemiBold"}
                        fontStyle="600"
                        y={yOffset + 104}
                        width={20}
                        height={32}
                        align="center"
                      />
                    </>
                  )}
                  {leftNumberSecondaryValue && (
                    <>
                      <Rect
                        stroke={getLineColor(leftNumberSecondaryPrefix)}
                        strokeWidth={2}
                        x={24}
                        y={yOffset + 97}
                        width={15}
                        height={15}
                        cornerRadius={2}
                      />
                      <Text
                        text={leftNumberSecondaryPrefix}
                        fill="black"
                        x={21.5}
                        fontSize={6}
                        fontFamily={"HindSemiBold"}
                        fontStyle="600"
                        y={yOffset + 99}
                        width={20}
                        height={30}
                        align="center"
                      />
                      <Text
                        text={leftNumberSecondaryValue}
                        fill="black"
                        x={21.5}
                        fontSize={9}
                        fontFamily={"HindSemiBold"}
                        fontStyle="600"
                        y={yOffset + 104}
                        width={20}
                        height={32}
                        align="center"
                      />
                    </>
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
                    <>
                      <Rect
                        stroke={getLineColor(rightNumberPrimaryPrefix)}
                        strokeWidth={2}
                        x={width - 60}
                        y={yOffset + 97}
                        width={15}
                        height={15}
                        cornerRadius={2}
                      />
                      <Text
                        text={rightNumberPrimaryPrefix}
                        fill="black"
                        x={width - 62.5}
                        fontSize={6}
                        fontFamily={"HindSemiBold"}
                        fontStyle="600"
                        y={yOffset + 99}
                        width={20}
                        height={30}
                        align="center"
                      />
                      <Text
                        text={rightNumberPrimaryValue}
                        fill="black"
                        x={width - 62.5}
                        fontSize={9}
                        fontFamily={"HindSemiBold"}
                        fontStyle="600"
                        y={yOffset + 104}
                        width={20}
                        height={32}
                        align="center"
                      />
                    </>
                  )}
                  {rightNumberSecondaryValue && (
                    <>
                      <Rect
                        stroke={getLineColor(rightNumberSecondaryPrefix)}
                        strokeWidth={2}
                        x={width - 40}
                        y={yOffset + 97}
                        width={15}
                        height={15}
                        cornerRadius={2}
                      />
                      <Text
                        text={rightNumberSecondaryPrefix}
                        fill="black"
                        x={width - 42.5}
                        fontSize={6}
                        fontFamily={"HindSemiBold"}
                        fontStyle="600"
                        y={yOffset + 99}
                        width={20}
                        height={30}
                        align="center"
                      />
                      <Text
                        text={rightNumberSecondaryValue}
                        fill="black"
                        x={width - 42.5}
                        fontSize={9}
                        fontFamily={"HindSemiBold"}
                        fontStyle="600"
                        y={yOffset + 104}
                        width={20}
                        height={32}
                        align="center"
                      />
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
                height={height}
              />

              {/* Center Square — 1–4 vertical color segments (top to bottom) */}
              {(() => {
                const colors =
                  centerSquareColors && centerSquareColors.length > 0
                    ? centerSquareColors.slice(0, 4)
                    : [baseColor];
                const segH = 25 / colors.length;
                return colors.map((color, i) => (
                  <Rect
                    key={i}
                    fill={color}
                    x={width / 2 - 12}
                    y={yOffset + 69.5 + i * segH}
                    width={25}
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
                    y={yOffset + 8}
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
                    y={yOffset + 52}
                    fontSize={12}
                    fontStyle="800"
                    fontFamily="NotoSansJP"
                    fill="black"
                    align="center"
                  />
                  <Text
                    text={spacedStationName}
                    width={width}
                    x={0}
                    y={yOffset + 16}
                    {...stationNameStyle}
                    fill="black"
                    align="center"
                  />
                </>
              )}

              {/* If station number exists */}
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
                        <Text
                          text={threeLetterCode}
                          fill="white"
                          x={
                            xOffsetWithNote -
                            36 +
                            (width - stationNameWidth) / 2
                          }
                          fontSize={12.2}
                          fontFamily={"HindSemiBold"}
                          fontStyle="800"
                          y={yOffset + yOffsetWithNote + 18}
                          width={66}
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
                          fontFamily={"HindSemiBold"}
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
                          fontFamily={"HindSemiBold"}
                          fontStyle="600"
                          y={yOffset + yOffsetWithNote + 43}
                          width={30}
                          height={32}
                          align="center"
                        />
                      </>
                    ) : (
                      <>
                        <Text
                          text={threeLetterCode}
                          fill="white"
                          x={xOffsetWithNote + (width - stationNameWidth) / 2}
                          fontSize={12.2}
                          fontFamily={"HindSemiBold"}
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
                      fontFamily={"HindSemiBold"}
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
                      fontFamily={"HindSemiBold"}
                      fontStyle="600"
                      y={yOffset + yOffsetWithNote + 43}
                      width={30}
                      height={32}
                      align="center"
                    />
                  </>
                ) : (
                  <>
                    <Rect
                      stroke={getLineColor(numberPrimaryPrefix)}
                      strokeWidth={3}
                      x={xOffsetWithNote + (width - stationNameWidth) / 2}
                      y={yOffset + yOffsetWithNote + 18}
                      width={30}
                      height={30}
                      cornerRadius={2}
                    />
                    <Text
                      text={numberPrimaryPrefix}
                      fill="black"
                      x={xOffsetWithNote + (width - stationNameWidth) / 2}
                      fontSize={11}
                      fontFamily={"HindSemiBold"}
                      fontStyle="600"
                      y={yOffset + yOffsetWithNote + 22}
                      width={30}
                      height={30}
                      align="center"
                    />
                    <Text
                      text={numberPrimaryValue}
                      fill="black"
                      x={xOffsetWithNote + (width - stationNameWidth) / 2}
                      fontSize={17}
                      fontFamily={"HindSemiBold"}
                      fontStyle="600"
                      y={yOffset + yOffsetWithNote + 32}
                      width={30}
                      height={32}
                      align="center"
                    />
                    {numberSecondaryPrefix && (
                      <>
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
                        <Text
                          text={numberSecondaryPrefix}
                          fill="black"
                          x={
                            xOffsetWithNote -
                            37 +
                            (width - stationNameWidth) / 2
                          }
                          fontSize={11}
                          fontFamily={"HindSemiBold"}
                          fontStyle="600"
                          y={yOffset + yOffsetWithNote + 22}
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
                          fontSize={17}
                          fontFamily={"HindSemiBold"}
                          fontStyle="600"
                          y={yOffset + yOffsetWithNote + 32}
                          width={30}
                          height={32}
                          align="center"
                        />
                      </>
                    )}
                  </>
                ))}
              {note ? (
                <>
                  <Text
                    text={quaternaryName}
                    x={8 + (width + smallStationNameWidth) / 2}
                    y={yOffset + 18 - 8}
                    fontSize={10}
                    fontStyle="400"
                    fontFamily="NotoSansTC"
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
                    fontFamily="NotoSansTC"
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
