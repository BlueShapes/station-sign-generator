export const TRANSIT_ICON_SIZE = 9;
export const TRANSIT_ICON_NAME_GAP = 2;
export const TRANSIT_ITEM_GAP = 2;
export const TRANSIT_GROUP_GAP = 4;
export const TRANSIT_ITEMS_PER_GROUP = 3;
export const TRANSIT_NAME_FONT = 5;
export const TRANSIT_SECONDARY_NAME_FONT = 3.5;
export const TRANSIT_NAME_LINE_GAP = 0.5;
export const TRANSIT_DIAGONAL_ANGLE = 45;
export const MIN_READABLE_TRANSIT_SECONDARY_FONT_PX = 10;

export function isTransitSecondaryNameExportTooSmall(
  exportScale: number,
): boolean {
  return (
    TRANSIT_SECONDARY_NAME_FONT * exportScale <
    MIN_READABLE_TRANSIT_SECONDARY_FONT_PX
  );
}

const VERTICAL_ROTATED_GLYPHS = new Set([
  "ー",
  "〜",
  "～",
  "‥",
  "…",
  "（",
  "）",
  "(",
  ")",
  "［",
  "］",
  "[",
  "]",
  "｛",
  "｝",
  "{",
  "}",
  "〈",
  "〉",
  "《",
  "》",
  "「",
  "」",
  "『",
  "』",
  "【",
  "】",
]);

/** Whether a glyph needs a 90° rotation in the manual vertical-text renderer. */
export function shouldRotateVerticalGlyph(character: string): boolean {
  return VERTICAL_ROTATED_GLYPHS.has(character);
}

export interface TransitLayoutItem {
  x: number;
  y: number;
}

export interface TransitLayout {
  items: TransitLayoutItem[];
  width: number;
  height: number;
}

export interface HorizontalStationDetailsLayout {
  primaryNameY: number;
  secondaryNameY: number;
  transitY: number;
}

export interface VerticalStationDetailsLayout {
  badgeX: number;
  nameX: number;
  transitAnchorX: number;
}

/**
 * Stack vertical-map details away from the track: optional station-number
 * badge, station-name block, then transfer lines at the outer edge.
 */
export function layoutVerticalStationDetails(
  side: "left" | "right",
  innerBoundary: number,
  badgeWidth: number,
  nameWidth: number,
  hasTransits: boolean,
): VerticalStationDetailsLayout {
  const badgeGap = badgeWidth > 0 ? 4 : 0;
  const transitGap = hasTransits ? 6 : 0;

  if (side === "right") {
    const badgeX = innerBoundary;
    const nameX = badgeX + badgeWidth + badgeGap;
    return {
      badgeX,
      nameX,
      transitAnchorX: nameX + nameWidth + transitGap,
    };
  }

  const badgeX = innerBoundary - badgeWidth;
  const nameRightEdge = badgeX - badgeGap;
  const nameX = nameRightEdge - nameWidth;
  return {
    badgeX,
    nameX,
    transitAnchorX: nameX - transitGap,
  };
}

/**
 * Stack standard horizontal labels with names nearest the station marker and
 * transfer lines beyond them. The language rows keep their existing mirrored
 * order above and below the track.
 */
export function layoutHorizontalStationDetails(
  side: "above" | "below",
  innerBoundary: number,
  innerGap: number,
  primaryNameHeight: number,
  secondaryNameHeight: number,
  transitHeight: number,
): HorizontalStationDetailsLayout {
  const nameGap = secondaryNameHeight > 0 ? 2 : 0;
  const transitGap = transitHeight > 0 ? 4 : 0;

  if (side === "above") {
    const nameBlockHeight =
      primaryNameHeight + nameGap + secondaryNameHeight;
    const primaryNameY = innerBoundary - innerGap - nameBlockHeight;
    return {
      primaryNameY,
      secondaryNameY: primaryNameY + primaryNameHeight + nameGap,
      transitY: primaryNameY - transitGap - transitHeight,
    };
  }

  const secondaryNameY = innerBoundary + innerGap;
  const primaryNameY =
    secondaryNameY + secondaryNameHeight + nameGap;
  return {
    primaryNameY,
    secondaryNameY,
    transitY: primaryNameY + primaryNameHeight + transitGap,
  };
}

function chunksOfThree(values: number[]): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < values.length; index += TRANSIT_ITEMS_PER_GROUP) {
    chunks.push(values.slice(index, index + TRANSIT_ITEMS_PER_GROUP));
  }
  return chunks;
}

/**
 * Lay out horizontal icon/name pairs in columns of at most three rows.
 * For left-side station labels, columns grow to the left while the icon stays
 * on the left of its own line name.
 */
export function layoutHorizontalTransitLines(
  nameWidths: number[],
  side: "left" | "right",
): TransitLayout {
  const groups = chunksOfThree(nameWidths);
  const groupWidths = groups.map((group) =>
    Math.max(
      ...group.map(
        (nameWidth) =>
          TRANSIT_ICON_SIZE +
          (nameWidth > 0 ? TRANSIT_ICON_NAME_GAP + nameWidth : 0),
      ),
      0,
    ),
  );
  const width = groupWidths.reduce(
    (total, groupWidth, index) =>
      total + groupWidth + (index > 0 ? TRANSIT_GROUP_GAP : 0),
    0,
  );
  const items: TransitLayoutItem[] = [];
  let groupOffset = 0;

  groups.forEach((group, groupIndex) => {
    const groupWidth = groupWidths[groupIndex];
    const groupX =
      side === "right"
        ? groupOffset
        : -(groupOffset + groupWidth);
    group.forEach((_, rowIndex) => {
      items.push({
        x: groupX,
        y: rowIndex * (TRANSIT_ICON_SIZE + TRANSIT_ITEM_GAP),
      });
    });
    groupOffset += groupWidth + TRANSIT_GROUP_GAP;
  });

  return {
    items,
    width,
    height:
      Math.min(nameWidths.length, TRANSIT_ITEMS_PER_GROUP) *
        (TRANSIT_ICON_SIZE + TRANSIT_ITEM_GAP) -
      (nameWidths.length > 0 ? TRANSIT_ITEM_GAP : 0),
  };
}

/**
 * Lay out transfer icons on one vertical station axis. Labels extend
 * diagonally to the right, while the first icon remains closest to the track.
 */
export function layoutDiagonalTransitLines(
  nameWidths: number[],
  direction: "above" | "below",
  nameHeights: number[] = nameWidths.map((width) =>
    width > 0 ? TRANSIT_NAME_FONT : 0,
  ),
): TransitLayout {
  if (nameWidths.length === 0) {
    return { items: [], width: 0, height: 0 };
  }
  const itemStep = TRANSIT_ICON_SIZE + TRANSIT_ITEM_GAP;
  const diagonalFactor = Math.SQRT1_2;
  const items = nameWidths.map((_, index) => ({
    x: 0,
    y:
      direction === "above"
        ? -TRANSIT_ICON_SIZE - index * itemStep
        : index * itemStep,
  }));
  const width = Math.max(
    TRANSIT_ICON_SIZE,
    ...nameWidths.map((nameWidth, index) =>
      nameWidth > 0
        ? TRANSIT_ICON_SIZE +
          TRANSIT_ICON_NAME_GAP +
          (nameWidth + nameHeights[index]) * diagonalFactor
        : TRANSIT_ICON_SIZE,
    ),
  );
  const height = Math.max(
    0,
    ...nameWidths.map((nameWidth, index) =>
      Math.max(
        (index + 1) * TRANSIT_ICON_SIZE + index * TRANSIT_ITEM_GAP,
        index * itemStep +
          TRANSIT_ICON_SIZE +
          (nameWidth + nameHeights[index]) * diagonalFactor,
      ),
    ),
  );

  return {
    items,
    width,
    height,
  };
}

export function oppositeVerticalDirection(
  stationNameSide: "above" | "below",
): "above" | "below" {
  return stationNameSide === "above" ? "below" : "above";
}
