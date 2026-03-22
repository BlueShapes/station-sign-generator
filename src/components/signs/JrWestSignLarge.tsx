import { useState, useEffect, forwardRef, Fragment } from "react";
import type StationProps from "./DirectInputStationProps";
import type { AdjacentStationProps } from "./DirectInputStationProps";
import { Rect, Layer, Stage, Text, Line } from "react-konva";
import Konva from "konva";
import { isMobile } from "react-device-detect";
import styled from "styled-components";
import spacedStationName from "@/functions/spaceStationName";

export const height = 240;
export const scale = 3;

const topBarH = 22;
const bottomBarH = 55;

const JrWestSignLarge = forwardRef<Konva.Stage, StationProps>(
  (props, ref: React.Ref<Konva.Stage>) => {
    const {
      primaryName,
      primaryNameFurigana,
      secondaryName,
      stationAreas,
      left,
      right,
      baseColor,
      direction,
    } = props;

    const width = height * 1.4;
    const rightSecX = width * 0.7;

    const showLeftArrow = direction !== "right";
    const showRightArrow = direction !== "left";

    const leftStations = left.slice(0, 2);
    const rightStations = right.slice(0, 2);

    const [stageKey, setStageKey] = useState(0);
    const [canvasImage, setCanvasImage] = useState("");

    const reversedStationArea = stationAreas
      ? [...stationAreas].reverse()
      : undefined;

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

    // Arrow shape pointing right; origin is (0,0), tip at (size, size/2)
    const arrowPoints = (size: number) => [
      3,
      0,
      11,
      0,
      size,
      size / 2,
      11,
      size,
      3,
      size,
      size - 10.5,
      size / 2 + 2.5,
      -11,
      size / 2 + 2.5,
      -11,
      size / 2 - 2.5,
      size - 10.5,
      size / 2 - 2.5,
    ];

    const renderStation = (s: AdjacentStationProps, secX: number) => {
      const isRight = secX !== 0;
      const showArrow = isRight ? showRightArrow : showLeftArrow;
      const textWidth = Math.max(
        new Konva.Text({
          text: s.primaryNameFurigana,
          fontSize: 18,
          fontFamily: "NotoSansJP",
          fontStyle: "500",
        }).width(),
        new Konva.Text({
          text: s.secondaryName,
          fontSize: 14.5,
          fontFamily: "NotoSansJP",
          fontStyle: "400",
        }).width(),
      );
      const arrowOffset = showArrow ? 32 * (isRight ? -1 : 1) : 0;
      const pad = arrowOffset + 18 + (isRight ? -textWidth + 70 : 0);

      return (
        <>
          <Text
            text={s.primaryNameFurigana ?? ""}
            x={secX + pad}
            y={topBarH + 174}
            width={width}
            fontSize={18}
            fontFamily="NotoSansJP"
            fontStyle="500"
            fill="white"
            align="left"
          />
          <Text
            text={s.secondaryName}
            x={secX + pad}
            y={topBarH + 194}
            width={width}
            fontSize={14.5}
            fontFamily="NotoSansJP"
            fontStyle="400"
            fill="white"
            align="left"
          />
        </>
      );
    };

    const renderSide = (stations: AdjacentStationProps[], isLeft: boolean) => {
      if (stations.length === 0) return null;

      const secX = isLeft ? 0 : rightSecX;
      const showArrow = isLeft ? showLeftArrow : showRightArrow;

      const merged: AdjacentStationProps =
        stations.length === 2
          ? {
              ...stations[0],
              primaryNameFurigana: `${stations[0].primaryNameFurigana ?? ""}／${stations[1].primaryNameFurigana ?? ""}`,
              secondaryName: `${stations[0].secondaryName}／${stations[1].secondaryName}`,
            }
          : stations[0];

      const arrowSize = 24;
      const actualX = isLeft ? 8 + arrowSize : width - 8 - arrowSize;

      return (
        <>
          {showArrow && (
            <Line
              closed
              points={arrowPoints(arrowSize)}
              x={actualX}
              y={204}
              scaleX={isLeft ? -0.8 : 0.8}
              scaleY={0.7}
              fill="white"
              strokeWidth={0}
            />
          )}
          {renderStation(merged, secX)}
        </>
      );
    };

    // --- 1. メイン駅名の計算 ---
    const mainNameText = spacedStationName(primaryName).replace("　", " ");
    const mainMeasurer = new Konva.Text({
      text: mainNameText,
      fontSize: 52,
      fontFamily: "NotoSansJP",
      fontStyle: "900",
    });
    const mainNativeWidth = mainMeasurer.width();
    const numBadges = reversedStationArea?.length ?? 0;
    const badgeMargin = 4;
    const mainMaxWidth =
      numBadges > 0
        ? Math.max(
            2 * (width - 37 - (numBadges - 1) * 32 - badgeMargin) - width,
            60,
          )
        : width * 0.9;
    const mainScale =
      mainNativeWidth > mainMaxWidth ? mainMaxWidth / mainNativeWidth : 1;

    // --- 2. ふりがな・副駅名の計算 ---
    const subNameText = `${primaryNameFurigana}　${secondaryName}`;
    const subMeasurer = new Konva.Text({
      text: subNameText,
      fontSize: 22,
      fontFamily: "NotoSansJP",
      fontStyle: "800",
    });
    const subNativeWidth = subMeasurer.width();
    const subMaxWidth = width * 0.9;
    const subScale =
      subNativeWidth > subMaxWidth ? subMaxWidth / subNativeWidth : 1;

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
              {/* White background */}
              <Rect fill="white" x={0} y={0} width={width} height={height} />

              {/* Bottom color bar — uses line color (localLines[0]) for JR West */}
              <Rect
                fill={props.localLines?.[0]?.color ?? baseColor}
                x={0}
                y={height - bottomBarH}
                width={width}
                height={bottomBarH}
              />

              {/* Fare zone badges — top-right */}
              {reversedStationArea?.map((e, i) => (
                <Fragment key={i}>
                  <Rect
                    x={width - 42 + 5 + i * -32}
                    y={65}
                    fill={e.isWhite ? "white" : "#462cb9"}
                    width={26}
                    height={26}
                    stroke={e.isWhite ? "black" : "#462cb9"}
                    strokeWidth={1}
                  />
                  <Text
                    text={e.name}
                    x={width - 43 + 5 + i * -32}
                    y={63.5}
                    fontSize={28}
                    fontStyle="600"
                    fontFamily="NotoSansJP"
                    fill={e.isWhite ? "black" : "white"}
                    align="center"
                  />
                </Fragment>
              ))}

              {/* Current station */}
              <Text
                text={spacedStationName(primaryName).replace("　", " ")}
                x={width / 2}
                y={topBarH + 40}
                fontSize={52}
                fontFamily="NotoSansJP"
                fontStyle="900"
                fill="black"
                offsetX={mainNativeWidth / 2}
                align="center"
                scaleX={mainScale}
              />
              <Text
                text={`${primaryNameFurigana}　${secondaryName}`}
                x={width / 2}
                y={topBarH + 100}
                offsetX={subNativeWidth / 2}
                fontSize={22}
                fontFamily="NotoSansJP"
                fontStyle="800"
                fill="black"
                align="center"
                scaleX={subScale}
              />

              {/* Adjacent stations */}
              {renderSide(leftStations, true)}
              {renderSide(rightStations, false)}
            </Layer>
          </Stage>
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

export default JrWestSignLarge;
