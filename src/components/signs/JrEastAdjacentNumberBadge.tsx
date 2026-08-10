import { Ellipse, Rect, Text } from "react-konva";

type JrEastAdjacentNumberBadgeProps = {
  x: number;
  y: number;
  prefix?: string;
  value?: string;
  color: string;
  stationNumberStyle?: string;
};

/** The compact adjacent-station badge shared by all JR East sign layouts. */
export default function JrEastAdjacentNumberBadge({
  x,
  y,
  prefix,
  value,
  color,
  stationNumberStyle,
}: JrEastAdjacentNumberBadgeProps) {
  if (!value) return null;

  const fontFamily =
    stationNumberStyle === "tokyometro"
      ? "JostTrispaceHybrid"
      : "HindSemiBold";

  return (
    <>
      {stationNumberStyle === "tokyometro" ? (
        <Ellipse
          x={x + 7.5}
          y={y + 7.5}
          radiusX={7.5}
          radiusY={7.5}
          stroke={color}
          strokeWidth={2}
        />
      ) : (
        <Rect
          x={x}
          y={y}
          width={15}
          height={15}
          cornerRadius={2}
          stroke={color}
          strokeWidth={2}
        />
      )}
      <Text
        text={prefix}
        fill="black"
        x={x - 2.5}
        y={y + 2}
        width={20}
        height={30}
        fontSize={6}
        fontFamily={fontFamily}
        fontStyle="600"
        align="center"
      />
      <Text
        text={value}
        fill="black"
        x={x - 2.5}
        y={y + 7}
        width={20}
        height={32}
        fontSize={stationNumberStyle === "tokyometro" ? 7 : 9}
        fontFamily={fontFamily}
        fontStyle="600"
        align="center"
      />
    </>
  );
}
