import { forwardRef, useEffect, useState } from "react";
import Konva from "konva";
import { Group, Layer, Rect, Stage, Text } from "react-konva";
import styled from "styled-components";
import {
  JR_CENTRAL_FONT_SPECS,
  JR_CENTRAL_STATION_NAME_FONT_FAMILY,
  JR_CENTRAL_STATION_NUMBER_FONT_FAMILY,
  waitForCanvasFonts,
} from "@/lib/fonts";
import type StationProps from "./DirectInputStationProps";
import JrCentralStationNumberBadge from "./JrCentralStationNumberBadge";
import {
  formatJrCentralJapaneseName,
  getJrCentralAdjacentLabels,
  getJrCentralHiraganaScaleX,
  getJrCentralMainReadingTransform,
  getJrCentralMainNameLayout,
  JR_CENTRAL_JAPANESE_SCALE_X,
  JR_CENTRAL_LAYOUT,
  JR_CENTRAL_SIGN_HEIGHT,
  JR_CENTRAL_SIGN_RATIO,
  resolveJrCentralColors,
} from "./jrCentralSignLayout";

export const height = JR_CENTRAL_SIGN_HEIGHT;
export const scale = 3;

type FitTextOptions = {
  text: string;
  maxWidth: number;
  maxFontSize: number;
  minFontSize: number;
  fontFamily: string;
  fontStyle: string;
};

function measuredTextWidth({
  text,
  fontSize,
  fontFamily,
  fontStyle,
}: {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
}): number {
  const measurement = new Konva.Text({
    text,
    fontSize,
    fontFamily,
    fontStyle,
  });
  const width = measurement.width();
  measurement.destroy();
  return width;
}

function fittedFontSize({
  text,
  maxWidth,
  maxFontSize,
  minFontSize,
  fontFamily,
  fontStyle,
}: FitTextOptions): number {
  if (!text) return maxFontSize;

  const measuredWidth = measuredTextWidth({
    text,
    fontSize: maxFontSize,
    fontFamily,
    fontStyle,
  });

  if (measuredWidth <= maxWidth) return maxFontSize;
  return Math.max(minFontSize, (maxFontSize * maxWidth) / measuredWidth);
}

const JrCentralSign = forwardRef<Konva.Stage, StationProps>(
  (props, ref: React.Ref<Konva.Stage>) => {
    const {
      primaryName,
      primaryNameFurigana,
      secondaryName,
      note,
      numberPrimaryPrefix,
      numberPrimaryValue,
      stationAreas,
      left,
      right,
      baseColor,
      localLines,
    } = props;

    const width = height * JR_CENTRAL_SIGN_RATIO;
    const line =
      localLines?.find((candidate) => candidate.prefix === numberPrimaryPrefix) ??
      localLines?.[0];
    const { bandColor, badgeColor } = resolveJrCentralColors({
      companyColor: baseColor,
      numberPrefix: numberPrimaryPrefix,
      lines: localLines,
    });
    const badgePrefix = numberPrimaryPrefix?.trim() || line?.prefix?.trim() || "";
    const badgeValue = numberPrimaryValue?.trim() || "";
    const showBadge = Boolean(badgePrefix || badgeValue);
    const badgeX = width - JR_CENTRAL_LAYOUT.badge.right - JR_CENTRAL_LAYOUT.badge.width;

    const rawReading = primaryNameFurigana.trim() || primaryName;
    const reading = formatJrCentralJapaneseName(rawReading);
    const kanjiName = primaryNameFurigana.trim()
      ? formatJrCentralJapaneseName(primaryName)
      : "";
    const titleLayout = getJrCentralMainNameLayout(width, showBadge);
    const readingNaturalWidth = measuredTextWidth({
      text: reading,
      fontSize: 39,
      fontFamily: JR_CENTRAL_STATION_NAME_FONT_FAMILY,
      fontStyle: "700",
    });
    const readingTransform = getJrCentralMainReadingTransform(
      rawReading,
      readingNaturalWidth / titleLayout.maxTextWidth,
    );
    const readingFontSize =
      readingTransform.scaleY > 1
        ? 39 * readingTransform.fontSizeMultiplier
        : fittedFontSize({
          text: reading,
          maxWidth: titleLayout.maxTextWidth / readingTransform.scaleX,
          maxFontSize: 39,
          minFontSize: 21,
          fontFamily: JR_CENTRAL_STATION_NAME_FONT_FAMILY,
          fontStyle: "700",
        });
    const kanjiFontSize = fittedFontSize({
      text: kanjiName,
      maxWidth:
        (titleLayout.maxTextWidth * 0.72) /
        JR_CENTRAL_JAPANESE_SCALE_X,
      maxFontSize: JR_CENTRAL_LAYOUT.mainKanji.maxFontSize,
      minFontSize: JR_CENTRAL_LAYOUT.mainKanji.minFontSize,
      fontFamily: JR_CENTRAL_STATION_NAME_FONT_FAMILY,
      fontStyle: "700",
    });
    const romanFontSize = fittedFontSize({
      text: secondaryName,
      maxWidth: width - 24,
      maxFontSize: 14,
      minFontSize: 9,
      fontFamily: JR_CENTRAL_STATION_NUMBER_FONT_FAMILY,
      fontStyle: "400",
    });

    const leftLabels = getJrCentralAdjacentLabels(left);
    const rightLabels = getJrCentralAdjacentLabels(right);
    const reversedStationAreas = stationAreas
      ? [...stationAreas].reverse()
      : [];

    const [stageKey, setStageKey] = useState(0);
    const [canvasImage, setCanvasImage] = useState("");

    useEffect(() => {
      let cancelled = false;
      waitForCanvasFonts(JR_CENTRAL_FONT_SPECS)
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
      if (ref && "current" in ref && ref.current) {
        setCanvasImage(ref.current.toDataURL());
      }
    }, [props, ref, stageKey]);

    const renderAdjacentStation = (
      labels: { japanese: string; english: string },
      side: "left" | "right",
    ) => {
      const { sidePadding, width: blockWidth, japaneseY, englishY } =
        JR_CENTRAL_LAYOUT.adjacent;
      const japaneseScaleX = getJrCentralHiraganaScaleX(labels.japanese);
      const japaneseFontSize = fittedFontSize({
        text: labels.japanese,
        maxWidth: blockWidth / japaneseScaleX,
        maxFontSize: 12.5,
        minFontSize: 8.5,
        fontFamily: JR_CENTRAL_STATION_NAME_FONT_FAMILY,
        fontStyle: "700",
      });
      const englishFontSize = fittedFontSize({
        text: labels.english,
        maxWidth: blockWidth,
        maxFontSize: JR_CENTRAL_LAYOUT.adjacent.englishMaxFontSize,
        minFontSize: JR_CENTRAL_LAYOUT.adjacent.englishMinFontSize,
        fontFamily: JR_CENTRAL_STATION_NUMBER_FONT_FAMILY,
        fontStyle: JR_CENTRAL_LAYOUT.adjacent.englishFontStyle,
      });
      const japaneseWidth = Math.min(
        blockWidth,
        measuredTextWidth({
          text: labels.japanese,
          fontSize: japaneseFontSize,
          fontFamily: JR_CENTRAL_STATION_NAME_FONT_FAMILY,
          fontStyle: "700",
        }) * japaneseScaleX,
      );
      const englishWidth = Math.min(
        blockWidth,
        measuredTextWidth({
          text: labels.english,
          fontSize: englishFontSize,
          fontFamily: JR_CENTRAL_STATION_NUMBER_FONT_FAMILY,
          fontStyle: JR_CENTRAL_LAYOUT.adjacent.englishFontStyle,
        }),
      );
      const contentWidth = Math.max(japaneseWidth, englishWidth);
      const x =
        side === "left" ? sidePadding : width - sidePadding - contentWidth;

      return (
        <>
          <Text
            text={labels.japanese}
            x={x}
            y={japaneseY}
            width={contentWidth / japaneseScaleX}
            align="left"
            scaleX={japaneseScaleX}
            fontSize={japaneseFontSize}
            fontFamily={JR_CENTRAL_STATION_NAME_FONT_FAMILY}
            fontStyle="700"
            fill="#111923"
          />
          <Text
            text={labels.english}
            x={x}
            y={englishY}
            width={contentWidth}
            align="left"
            fontSize={englishFontSize}
            fontFamily={JR_CENTRAL_STATION_NUMBER_FONT_FAMILY}
            fontStyle={JR_CENTRAL_LAYOUT.adjacent.englishFontStyle}
            fill="#111923"
          />
        </>
      );
    };

    return (
      <>
        {canvasImage && (
          <CanvasImage
            src={canvasImage}
            alt=""
            draggable={false}
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
              <Rect x={0} y={0} width={width} height={height} fill="#f8faf9" />

              <Text
                text={reading}
                x={titleLayout.x + titleLayout.width / 2}
                y={7}
                width={titleLayout.width}
                offsetX={titleLayout.width / 2}
                align="center"
                scaleX={readingTransform.scaleX}
                scaleY={readingTransform.scaleY}
                fontSize={readingFontSize}
                fontFamily={JR_CENTRAL_STATION_NAME_FONT_FAMILY}
                fontStyle="700"
                fill="#111923"
              />
              <Text
                text={kanjiName}
                x={titleLayout.x + titleLayout.width / 2}
                y={JR_CENTRAL_LAYOUT.mainKanji.y}
                width={titleLayout.width}
                offsetX={titleLayout.width / 2}
                align="center"
                scaleX={JR_CENTRAL_JAPANESE_SCALE_X}
                fontSize={kanjiFontSize}
                fontFamily={JR_CENTRAL_STATION_NAME_FONT_FAMILY}
                fontStyle="700"
                fill="#111923"
              />

              {showBadge && (
                <JrCentralStationNumberBadge
                  x={badgeX}
                  y={JR_CENTRAL_LAYOUT.badge.y}
                  size={JR_CENTRAL_LAYOUT.badge.width}
                  color={badgeColor}
                  prefix={badgePrefix}
                  value={badgeValue}
                />
              )}

              {reversedStationAreas.map((area, index) => {
                const areaLayout = JR_CENTRAL_LAYOUT.stationArea;
                const x =
                  width -
                  areaLayout.right -
                  areaLayout.size -
                  index * (areaLayout.size + areaLayout.gap);
                return (
                  <Group key={area.id}>
                    <Rect
                      x={x}
                      y={areaLayout.y}
                      width={areaLayout.size}
                      height={areaLayout.size}
                      fill={area.isWhite ? "white" : "black"}
                      stroke="black"
                      strokeWidth={1}
                    />
                    <Text
                      text={area.name}
                      x={x}
                      y={areaLayout.y + 0.5}
                      width={areaLayout.size}
                      align="center"
                      fontSize={14.5}
                      fontFamily={JR_CENTRAL_STATION_NAME_FONT_FAMILY}
                      fontStyle="700"
                      fill={area.isWhite ? "black" : "white"}
                    />
                  </Group>
                );
              })}

              <Rect
                x={0}
                y={JR_CENTRAL_LAYOUT.bandY}
                width={width}
                height={JR_CENTRAL_LAYOUT.bandHeight}
                fill={bandColor}
              />
              <Text
                text={secondaryName}
                x={12}
                y={
                  JR_CENTRAL_LAYOUT.bandY +
                  JR_CENTRAL_LAYOUT.bandTextOffsetY
                }
                width={width - 24}
                align="center"
                fontSize={romanFontSize}
                fontFamily={JR_CENTRAL_STATION_NUMBER_FONT_FAMILY}
                fontStyle="400"
                fill="white"
              />

              {renderAdjacentStation(leftLabels, "left")}
              {renderAdjacentStation(rightLabels, "right")}
              <Text
                text={note ?? ""}
                x={width / 2}
                y={JR_CENTRAL_LAYOUT.note.y}
                width={width * JR_CENTRAL_LAYOUT.note.widthRatio}
                offsetX={
                  (width * JR_CENTRAL_LAYOUT.note.widthRatio) / 2
                }
                align="center"
                scaleX={JR_CENTRAL_LAYOUT.note.scaleX}
                fontSize={fittedFontSize({
                  text: note ?? "",
                  maxWidth:
                    (width * JR_CENTRAL_LAYOUT.note.widthRatio) /
                    JR_CENTRAL_LAYOUT.note.scaleX,
                  maxFontSize: JR_CENTRAL_LAYOUT.note.maxFontSize,
                  minFontSize: JR_CENTRAL_LAYOUT.note.minFontSize,
                  fontFamily: JR_CENTRAL_STATION_NAME_FONT_FAMILY,
                  fontStyle: "700",
                })}
                fontFamily={JR_CENTRAL_STATION_NAME_FONT_FAMILY}
                fontStyle="700"
                fill="#111923"
              />
            </Layer>
          </Stage>
        </StageWrapper>
      </>
    );
  },
);

const StageWrapper = styled.div`
  display: none;
`;

const CanvasImage = styled.img`
  display: block;
  width: 100%;
  max-height: 20vh;
  object-fit: contain;
`;

export default JrCentralSign;
