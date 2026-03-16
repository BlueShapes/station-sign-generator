import { useState, useEffect, forwardRef, Fragment } from "react";
import type StationProps from "./DirectInputStationProps";
import type { AdjacentStationProps } from "./DirectInputStationProps";
import { Rect, Layer, Stage, Text, Line } from "react-konva";
import Konva from "konva";
import { isMobile } from "react-device-detect";
import styled from "styled-components";
import spacedStationName from "@/functions/spaceStationName";
import { v7 as uuidv7 } from "uuid";

export const height = 140;
export const scale = 3;

const topBarH = 22;
const bottomBarH = 40;
const contentY = topBarH;
const contentH = height - topBarH - bottomBarH; // 96

const JrWestSign = forwardRef<Konva.Stage, StationProps>(
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

    const width = height * 3.3;

    // 30 / 40 / 30 split
    const sideW = width * 0.3;
    const centerX = sideW;
    const centerW = width * 0.4;
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
      document.fonts.ready.then(() => {
        setStageKey((k) => k + 1);
      });
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
      } else {
        render();
      }
    }, [props, stageKey]);

    // Arrow pointing right (tip on the right side)
    const arrowRight = (x: number, y: number, size: number) => [
      x + 3, y,
      x + 11, y + 0,
      x + size, y + size / 2,
      x + 11, y + size,
      x + 3, y + size,
      x + size - 10.5, y + size / 2 + 2.5,
      x - 11, y + size / 2 + 2.5,
      x - 11, y + size / 2 - 2.5,
      x + size - 10.5, y + size / 2 - 2.5,
    ];

    /**
     * Render one adjacent station's text rows (furigana, name, English).
     * offsetY is relative to the top of the sub-slot.
     */
    const renderStation = (
      s: AdjacentStationProps,
      secX: number,
      slotY: number, // absolute y of the slot top
    ) => {
      const withArrow = direction === "both" || (
        (secX === 0 && showLeftArrow) || (secX !== 0 && showRightArrow)
      );
      const textWidth = Math.max(
        (new Konva.Text({ text: s.primaryNameFurigana, fontSize: 14, fontFamily: "NotoSansJP", fontStyle: "700" })).width(),
        (new Konva.Text({ text: s.secondaryName, fontSize: 12, fontFamily: "NotoSansJP", fontStyle: "500" })).width()
      );
      const isRight = secX !== 0;
      const pad = (withArrow ? 42 * (secX === 0 ? 1 : -1) : 0) + 12 + (isRight ? -1 * textWidth + 115 : 0);

      return (
        <>
          <Text
            text={s.primaryNameFurigana ?? ""}
            x={secX + pad}
            y={slotY + 86}
            width={width}
            fontSize={14}
            fontFamily="NotoSansJP"
            fontStyle="700"
            fill="white"
            align="left"
          />
          <Text
            text={s.secondaryName}
            x={secX + pad}
            y={slotY + 102}
            width={width}
            fontSize={12}
            fontFamily="NotoSansJP"
            fontStyle="500"
            fill="white"
            align="left"
          />
        </>
      );
    };

    /** Render a full side section (1 or 2 stations). */
    const renderSide = (stations: AdjacentStationProps[], isLeft: boolean) => {
      if (stations.length === 0) return null;

      const secX = isLeft ? 0 : rightSecX;

      // Merge 2 stations into one with ／-joined fields
      const merged: AdjacentStationProps =
        stations.length === 2
          ? {
            ...stations[0],
            primaryNameFurigana: `${stations[0].primaryNameFurigana ?? ""}／${stations[1].primaryNameFurigana ?? ""}`,
            secondaryName: `${stations[0].secondaryName}／${stations[1].secondaryName}`,
          }
          : stations[0];

      // White arrow in the bottom bar
      const arrowSize = 24;

      // 1. points 用のベース座標は「0」にする
      // これにより、Lineの基準点(0,0)からの相対的な形が定義されます
      const points = arrowRight(0, 0, arrowSize);

      // 2. 実際の描画位置を計算
      // isLeft のときは、x=12 の位置から「左」に向かって描画されるように
      // 反転の起点（arrowSize分）をずらします
      const actualX = isLeft ? 8 + arrowSize : width - 8 - arrowSize;

      return (
        <>
          {isLeft && showLeftArrow && (
            <Line
              closed
              points={points}
              x={actualX}
              y={108}
              scaleX={isLeft ? -1 : 1}
              fill="white"
              strokeWidth={0}
            />
          )}
          {!isLeft && showRightArrow && (
            <Line
              closed
              points={points}
              x={actualX}
              y={108}
              scaleX={isLeft ? -1 : 1}
              fill="white"
              strokeWidth={0}
            />
          )}
          {renderStation(merged, secX, contentY)}
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
              {/* White background */}
              <Rect fill="white" x={0} y={0} width={width} height={height} />

              {/* Bottom color bar */}
              <Rect
                fill={baseColor}
                x={0}
                y={height - bottomBarH}
                width={width}
                height={bottomBarH}
              />

              {/* Fare zone (note) — right side of top bar */}
              {reversedStationArea?.map((e, i) => {
                return (
                  <Fragment key={uuidv7()}>
                    <Rect
                      x={width - 42 + 5 + i * -32}
                      y={12}
                      fill={e.isWhite ? "white" : "#462cb9"}
                      width={26}
                      height={26}
                      stroke={e.isWhite ? "black" : "#462cb9"}
                      strokeWidth={1}
                    />
                    <Text
                      text={e.name}
                      x={width - 43 + 5 + i * -32}
                      y={10.5}
                      fontSize={28}
                      fontStyle="600"
                      fontFamily="NotoSansJP"
                      fill={e.isWhite ? "black" : "white"}
                      align="center"
                    />
                  </Fragment>
                );
              })}

              {/* ── Current station (center) ── */}
              <Text
                text={spacedStationName(primaryName)}
                x={0}
                y={contentY - 8}
                width={width}
                fontSize={52}
                fontFamily="NotoSansJP"
                fontStyle="900"
                fill="black"
                align="center"
              />
              <Text
                text={`${primaryNameFurigana}  ${secondaryName}`}
                x={0}
                y={contentY + 50}
                width={width}
                fontSize={18}
                fontFamily="NotoSansJP"
                fontStyle="800"
                fill="black"
                align="center"
              />

              {/* ── Adjacent stations ── */}
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

export default JrWestSign;
