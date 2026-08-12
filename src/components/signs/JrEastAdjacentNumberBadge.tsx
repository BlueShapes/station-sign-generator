import StationNumberBadge from "./StationNumberBadge";

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

  return (
    <StationNumberBadge
      x={x}
      y={y}
      size={15}
      prefix={prefix}
      value={value}
      color={color}
      style={stationNumberStyle}
    />
  );
}
