const JR_CENTRAL_REFERENCE_HEIGHT = 140;
const JR_CENTRAL_REFERENCE_RATIO = 576 / 257;

export const JR_CENTRAL_SIGN_WIDTH =
  JR_CENTRAL_REFERENCE_HEIGHT * JR_CENTRAL_REFERENCE_RATIO;
export const JR_CENTRAL_SIGN_HEIGHT = 128;
export const JR_CENTRAL_SIGN_RATIO =
  JR_CENTRAL_SIGN_WIDTH / JR_CENTRAL_SIGN_HEIGHT;
export const JR_CENTRAL_JAPANESE_SCALE_X = 1.2;
export const JR_CENTRAL_LONG_READING_SCALE_Y = 1.2;

function getUnspacedJrCentralNameLength(name: string): number {
  return [...name.replaceAll(" ", "").replaceAll("　", "")].length;
}

export function getJrCentralHiraganaScaleX(name: string): number {
  return getUnspacedJrCentralNameLength(name) > 6
    ? 1
    : JR_CENTRAL_JAPANESE_SCALE_X;
}

export function getJrCentralMainReadingTransform(
  name: string,
  requiredScaleY = 1,
): {
  scaleX: number;
  scaleY: number;
  fontSizeMultiplier: number;
} {
  const isLong = getUnspacedJrCentralNameLength(name) >= 6;
  const scaleY = isLong
    ? Math.max(JR_CENTRAL_LONG_READING_SCALE_Y, requiredScaleY)
    : 1;
  return {
    scaleX: isLong ? 1 : JR_CENTRAL_JAPANESE_SCALE_X,
    scaleY,
    fontSizeMultiplier: 1 / scaleY,
  };
}

export const JR_CENTRAL_LAYOUT = {
  bandY: 74,
  bandHeight: 17,
  bandTextOffsetY: 1.5,
  mainKanji: {
    y: 52,
    maxFontSize: 19,
    minFontSize: 11.5,
  },
  badge: {
    width: 35,
    height: 35,
    topHeight: 14,
    right: 5,
    y: 37,
  },
  stationArea: {
    size: 16,
    right: 5,
    y: 6,
    gap: 5,
  },
  adjacent: {
    sidePadding: 14,
    width: 96,
    japaneseY: 96,
    englishY: 110,
    englishMaxFontSize: 10,
    englishMinFontSize: 7,
    englishFontStyle: "400",
  },
} as const;

export function formatJrCentralJapaneseName(name: string): string {
  const characters = [...name];
  if (characters.length === 2) return characters.join("　　");
  if (characters.length === 3) return characters.join(" ");
  return name;
}

type JrCentralLineColor = {
  prefix: string;
  color: string;
};

export function getJrCentralMainNameLayout(
  width: number,
  showBadge: boolean,
): { x: number; width: number; maxTextWidth: number } {
  const badgeClearance =
    JR_CENTRAL_LAYOUT.badge.right + JR_CENTRAL_LAYOUT.badge.width + 6;
  return {
    x: 0,
    width,
    maxTextWidth: showBadge ? width - badgeClearance * 2 : width - 16,
  };
}

export function resolveJrCentralColors({
  companyColor,
  numberPrefix,
  lines,
}: {
  companyColor: string;
  numberPrefix?: string;
  lines?: readonly JrCentralLineColor[];
}): { bandColor: string; badgeColor: string } {
  const bandColor = companyColor.trim() || "#e85e0d";
  const numberLine =
    lines?.find((line) => line.prefix === numberPrefix) ?? lines?.[0];
  return {
    bandColor,
    badgeColor: numberLine?.color || bandColor,
  };
}

type JrCentralAdjacentStation = {
  primaryName: string;
  primaryNameFurigana?: string;
  secondaryName: string;
};

/**
 * JR Central's compact signs use the reading, rather than the kanji name, for
 * adjacent stations. Keep a kanji fallback for older imported data that does
 * not have readings yet.
 */
export function getJrCentralAdjacentLabels(
  stations: readonly JrCentralAdjacentStation[],
): { japanese: string; english: string } {
  const visibleStations = stations.slice(0, 2);

  return {
    japanese: visibleStations
      .map((station) => {
        const name =
          station.primaryNameFurigana?.trim() || station.primaryName.trim();
        return formatJrCentralJapaneseName(name);
      })
      .filter(Boolean)
      .join("・"),
    english: visibleStations
      .map((station) => station.secondaryName.trim())
      .filter(Boolean)
      .join(" / "),
  };
}
