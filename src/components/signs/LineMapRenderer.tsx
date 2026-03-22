import { Fragment, useState, useEffect, forwardRef } from "react";
import {
  Stage,
  Layer,
  Line as KonvaLine,
  Circle,
  Rect,
  Text,
  Path as KonvaPath,
} from "react-konva";
import Konva from "konva";
import type { Station, Line } from "@/db/types";

export const scale = 2;

export type StationNameField =
  | "primary_name"
  | "secondary_name"
  | "tertiary_name"
  | "quaternary_name";

function stationName(station: Station, field: StationNameField): string {
  return station[field] ?? "";
}

export type StationNumberMode = "none" | "badge" | "dot";

export type StationNumberMap = Record<
  string,
  { prefix: string; value: string; threeLetterCode?: string | null }
>;

export interface LineMapRendererProps {
  stations: Station[];
  line: Line;
  isLoop: boolean;
  /** Ignored when isLoop is true; circular lines are always rendered as a circle */
  orientation: "horizontal" | "vertical";
  /** When true, show fade dots before the first station (line continues beyond) */
  hasMoreBefore?: boolean;
  /** When true, show fade dots after the last station (line continues beyond) */
  hasMoreAfter?: boolean;
  /**
   * Horizontal layout name style (ignored for vertical/loop):
   *   "normal"  — horizontal names alternating above/below (default)
   *   "above"   — 縦書き names always above the track
   *   "below"   — 縦書き names always below the track
   */
  nameStyle?: "normal" | "above" | "below";
  /** Map from stationId to the other lines serving that station */
  transits: Record<string, Line[]>;
  /** JP font size for the circular layout only (default: JP_FONT) */
  circularFontSize?: number;
  /** How to display station numbers in the route map */
  stationNumberMode?: StationNumberMode;
  /** Map from stationId to its station number for the current line */
  stationNumbers?: Record<
    string,
    { prefix: string; value: string; threeLetterCode?: string | null }
  >;
  /** Override the gap between stations in canvas units (defaults: 90 horizontal, 62 vertical) */
  stationSpacing?: number;
  /** Which station field to use as the primary (large) name. Defaults to "primary_name". */
  primaryLangField?: StationNameField;
  /** Which station field to use as the secondary (small) name. Defaults to "secondary_name". */
  secondaryLangField?: StationNameField;
  /** When false, the secondary name row is hidden entirely. Defaults to true. */
  showSecondaryLang?: boolean;
  /** The company's station_number_style — used to decide whether to show a line indicator badge. */
  companyStyle?: string;
}

export const CIRCULAR_FONT_DEFAULT = 9;

// ── Overlap detection (exported for use in the parent) ──────────────────────

interface LabelBound {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function computeCircularBounds(
  stations: Station[],
  transits: Record<string, Line[]>,
  jpFont: number,
  stationNumberMode?: StationNumberMode,
  stationNumbers?: StationNumberMap,
  primaryLangField: StationNameField = "primary_name",
  secondaryLangField: StationNameField = "secondary_name",
  showSecondaryLang: boolean = true,
): LabelBound[] {
  const enFont = Math.max(5, jpFont - 3);
  const n = stations.length;
  if (n === 0) return [];
  const angleStep = (2 * Math.PI) / n;

  return stations.map((station, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const isXchg = (transits[station.id]?.length ?? 0) > 0;
    const r = isXchg ? XCHG_R : DOT_R;
    const snNum = stationNumbers?.[station.id];
    const dotModeActive = stationNumberMode === "dot" && !!snNum?.value;
    const effectiveR = dotModeActive
      ? (Math.abs(cosA) * snBadgeDims(!!snNum!.threeLetterCode).w) / 2 +
        (Math.abs(sinA) * snBadgeDims(!!snNum!.threeLetterCode).h) / 2
      : r;
    const stagger = i % 2 === 0 ? 0 : C_STAGGER;
    const labelR = C_RADIUS + effectiveR + C_TICK_LEN + stagger;
    const tickEndX = C_CX + labelR * cosA;
    const tickEndY = C_CY + labelR * sinA;

    const stTransits = transits[station.id] ?? [];
    const nBadges = stTransits.length;
    const pName = stationName(station, primaryLangField);
    const sName = showSecondaryLang
      ? (station[secondaryLangField] ?? null)
      : null;
    const jpW = measureTextWidth(pName, jpFont);
    const enW = sName ? measureTextWidth(sName, enFont) : 0;
    const bw = badgesWidth(nBadges);
    const maxW = Math.max(jpW, enW, bw);

    const enBlockH = sName ? enFont + 2 : 0;
    const badgeBlockH = nBadges > 0 ? BADGE_H + 3 : 0;
    const totalH = jpFont + enBlockH + badgeBlockH;

    const isRight = cosA > C_DIAG;
    const isLeft = cosA < -C_DIAG;
    const isTop = !isRight && !isLeft && sinA < 0;

    let x: number, y: number;
    if (isRight) {
      x = tickEndX + C_LABEL_GAP;
      y = tickEndY - totalH / 2;
    } else if (isLeft) {
      x = tickEndX - maxW - C_LABEL_GAP;
      y = tickEndY - totalH / 2;
    } else if (isTop) {
      x = tickEndX - maxW / 2;
      y = tickEndY - totalH - C_LABEL_GAP;
    } else {
      x = tickEndX - maxW / 2;
      y = tickEndY + C_LABEL_GAP;
    }

    return { name: pName, x, y, w: maxW, h: totalH };
  });
}

/**
 * Returns the logical (pre-scale) canvas dimensions for a given map configuration.
 * Multiply by `scale` to get the actual pixel dimensions of the exported image at 1x.
 */
export function getMapCanvasDimensions(
  stationCount: number,
  isLoop: boolean,
  orientation: "horizontal" | "vertical",
  transits: Record<string, Line[]>,
  nameStyle?: "normal" | "above" | "below",
  /** Max vertical extent of the name block in canvas units — used when nameStyle is above/below */
  maxNameExtent?: number,
  /** Override station spacing (defaults: H_SPACING for horizontal, V_SPACING for vertical) */
  stationSpacing?: number,
  /** When true, extra space is added on the left/top for fade extension */
  hasMoreBefore?: boolean,
  /** When true, extra space is added on the right/bottom for fade extension */
  hasMoreAfter?: boolean,
): { w: number; h: number } {
  if (isLoop) return { w: C_SIZE, h: C_SIZE };
  const n = stationCount;
  const hSpacing = stationSpacing ?? H_SPACING;
  const vSpacing = stationSpacing ?? V_SPACING;
  if (orientation === "horizontal") {
    const hFadeLen = Math.round(hSpacing / 3);
    const hFadeExtra = hFadeLen + FADE_DOT_SPACING * FADE_OPACITIES.length;
    const extraL = hasMoreBefore ? hFadeExtra : 0;
    const extraR = hasMoreAfter ? hFadeExtra : 0;
    if (nameStyle === "above" || nameStyle === "below") {
      const ne = maxNameExtent ?? 60;
      const hasAnyTransit = Object.values(transits).some((t) => t.length > 0);
      const halfExt =
        XCHG_R +
        VN_DOT_GAP +
        (hasAnyTransit ? BADGE_H + VN_ITEM_GAP : 0) +
        ne +
        PADDING;
      return {
        w: Math.max(
          300,
          PADDING + extraL + (n - 1) * hSpacing + PADDING + extraR,
        ),
        // same canvas height regardless of above/below
        h: halfExt + XCHG_R + PADDING,
      };
    }
    return {
      w: Math.max(
        300,
        PADDING + extraL + (n - 1) * hSpacing + PADDING + extraR,
      ),
      h: H_HEIGHT,
    };
  }
  // vertical
  const vFadeLen = Math.round(vSpacing / 3);
  const vFadeExtra = vFadeLen + FADE_DOT_SPACING * FADE_OPACITIES.length;
  const extraT = hasMoreBefore ? vFadeExtra : 0;
  const extraB = hasMoreAfter ? vFadeExtra : 0;
  const maxBadgeCount = Math.max(
    0,
    ...Object.values(transits).map((t) => t.length),
  );
  const maxNameW = 130;
  return {
    w: Math.max(
      200,
      V_TRACK_X +
        XCHG_R +
        10 +
        badgesWidth(maxBadgeCount) +
        (maxBadgeCount > 0 ? 8 : 0) +
        maxNameW +
        V_RIGHT_MARGIN,
    ),
    h: Math.max(200, PADDING + extraT + (n - 1) * vSpacing + PADDING + extraB),
  };
}

/** Returns primary names of stations whose labels overlap another label. */
export function detectCircularOverlaps(
  stations: Station[],
  transits: Record<string, Line[]>,
  jpFont: number,
  stationNumberMode?: StationNumberMode,
  stationNumbers?: StationNumberMap,
  primaryLangField?: StationNameField,
  secondaryLangField?: StationNameField,
  showSecondaryLang?: boolean,
): string[] {
  const bounds = computeCircularBounds(
    stations,
    transits,
    jpFont,
    stationNumberMode,
    stationNumbers,
    primaryLangField,
    secondaryLangField,
    showSecondaryLang,
  );
  const overlapping = new Set<string>();
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i];
      const b = bounds[j];
      if (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      ) {
        overlapping.add(a.name);
        overlapping.add(b.name);
      }
    }
  }
  return [...overlapping];
}

// ── Layout constants ────────────────────────────────────────────────────────

const DOT_R = 7;
const XCHG_R = 10;
const TRACK_W = 6;
const PADDING = 50;
export const JP_FONT = 9;
const EN_FONT = 6;
const LINE_TITLE_FONT = 12;
const BADGE_H = 8;
const BADGE_W = 22;
const BADGE_GAP = 2;

// Horizontal
const H_SPACING = 90;
const H_HEIGHT = 210;
const H_TRACK_Y = 105;

// Vertical names (horizontal layout with rotated station names)
const VN_DOT_GAP = 6; // gap from dot edge to first item
const VN_ITEM_GAP = 4; // gap between items (badges, SN badge, name)

// Characters that are horizontal glyphs in normal writing and must be
// rotated 90° clockwise in 縦書き so they read as vertical strokes.
const VJ_ROTATE_CHARS = new Set(["ー", "〜", "～", "‥", "…"]);

// Hyphen/dash characters rendered as a Konva Rect (horizontal bar) in 縦書き.
// Using a Rect avoids font-baseline positioning errors that shift the glyph
// horizontally after 90° rotation (the glyph sits near the baseline, ~75-80%
// from the top of the em square, not at the 50% we assume for ー etc.).
// Values are bar length as a fraction of the cell size.
const VJ_LINE_WIDTHS: Record<string, number> = {
  "-": 0.55, // U+002D hyphen-minus
  "‐": 0.55, // U+2010 hyphen
  "–": 0.75, // U+2013 en dash
  "—": 0.95, // U+2014 em dash
};

// Vertical
const V_SPACING = 62;
const V_TRACK_X = 50;
const V_RIGHT_MARGIN = 30;

// Station number badge — all proportions derived from the JR East reference.
// Reference coordinate system: inner badge = 30×30 sign units.
// Every measurement below is (reference sign-unit value) × SN_S.
const SN_INNER = 20; // inner badge size in Konva units (= 30 ref × SN_S)
const SN_S = SN_INNER / 30; // scale factor from 30-unit reference
const SN_BADGE_GAP = 4; // gap between badge and station name (Konva units)

// Circular
const C_SIZE = 760;
const C_CX = C_SIZE / 2; // 380
const C_CY = C_SIZE / 2; // 380
const C_RADIUS = 250;
const C_TICK_LEN = 3; // gap between dot edge and label anchor
const C_STAGGER = 0; // no stagger — labels sit close to their dot
const C_LABEL_GAP = 4; // gap between tick end and text
const C_DIAG = 0.35; // |cosA| threshold below which station is in top/bottom zone

// Fade dots — shown at line ends when the map is a partial view of the full line
const FADE_DOT_SPACING = 10; // spacing between dots beyond the cutoff
const FADE_DOT_R = TRACK_W / 2; // same radius as line half-width
const FADE_OPACITIES = [0.65, 0.35, 0.15] as const; // nearest → farthest

// ── Helper: compute total badges width for a station ───────────────────────

function badgesWidth(count: number): number {
  return count > 0 ? count * (BADGE_W + BADGE_GAP) - BADGE_GAP : 0;
}

// ── Helper: JR East station number badge dimensions ─────────────────────────

// Derived reference measurements (all in Konva units = ref sign-units × SN_S)
// Reference: outer-pad-x=3, trc-height=12, outer-pad-bot=3, stroke=3,
//            corner-outer=4, corner-inner=2, trc-font=12.2, trc-y=1,
//            prefix-font=11, prefix-y=4, value-font=17, value-y=14
const _snOuterPadX = 3 * SN_S;
const _snTrcH = 12 * SN_S;
const _snOuterPadBot = 3 * SN_S;
const _snStroke = 3 * SN_S;
const _snCornerOuter = 4 * SN_S;
const _snCornerInner = 2 * SN_S;
const _snTrcFont = 12.2 * SN_S;
const _snTrcY = 1 * SN_S;
const _snPrefixFont = 11 * SN_S;
const _snPrefixY = 4 * SN_S;
const _snValueFont = 17 * SN_S;
const _snValueY = 14 * SN_S;

function snBadgeDims(hasTrc: boolean): { w: number; h: number } {
  if (hasTrc) {
    return {
      w: SN_INNER + _snOuterPadX * 2, // 36 ref units
      h: _snTrcH + SN_INNER + _snOuterPadBot, // 45 ref units
    };
  }
  return { w: SN_INNER, h: SN_INNER };
}

/** Renders a JR East style station number badge at (x, y) top-left corner */
function SnBadge({
  x,
  y,
  color,
  prefix,
  value,
  trc,
}: {
  x: number;
  y: number;
  color: string;
  prefix: string;
  value: string;
  trc?: string | null;
}) {
  const hasTrc = !!trc;
  const outerW = SN_INNER + _snOuterPadX * 2;
  const outerH = _snTrcH + SN_INNER + _snOuterPadBot;
  // Inner square top-left
  const ix = hasTrc ? x + _snOuterPadX : x;
  const iy = hasTrc ? y + _snTrcH : y;
  const font = "HindSemiBold, Arial, sans-serif";

  return (
    <Fragment>
      {hasTrc && (
        <>
          {/* Outer white frame */}
          <Rect
            x={x}
            y={y}
            width={outerW}
            height={outerH}
            fill="white"
            stroke="black"
            strokeWidth={_snStroke}
            cornerRadius={_snCornerOuter}
          />
          {/* Black TRC strip — extended by _snCornerInner so the inner
              square's rounded top corners sit on black with no white gap */}
          <Rect
            x={x}
            y={y}
            width={outerW}
            height={_snTrcH + _snCornerInner}
            fill="black"
            cornerRadius={[_snCornerOuter, _snCornerOuter, 0, 0]}
          />
          {/* TRC text: 1 ref unit below outer top, centered over inner width */}
          <Text
            x={ix}
            y={y + _snTrcY}
            width={SN_INNER}
            text={trc!}
            fontSize={_snTrcFont}
            fontFamily={font}
            fontStyle="bold"
            fill="white"
            align="center"
          />
        </>
      )}
      {/* Inner white square with colored outline.
          When hasTrc: top corners rounded (backed by the extended TRC strip),
          bottom corners concentric with outer frame (outerCorner − pad).
          When no TRC: uniform _snCornerInner. */}
      <Rect
        x={ix}
        y={iy}
        width={SN_INNER}
        height={SN_INNER}
        fill="white"
        stroke={color}
        strokeWidth={_snStroke}
        cornerRadius={
          hasTrc
            ? [
                _snCornerInner,
                _snCornerInner,
                _snCornerOuter - _snOuterPadX,
                _snCornerOuter - _snOuterPadX,
              ]
            : _snCornerInner
        }
      />
      {/* Prefix: 11 ref-unit font, 4 ref units from inner top (textBaseline=top) */}
      <Text
        x={ix}
        y={iy + _snPrefixY}
        width={SN_INNER}
        text={prefix}
        fontSize={_snPrefixFont}
        fontFamily={font}
        fontStyle="bold"
        fill="black"
        align="center"
      />
      {/* Value: 17 ref-unit font, 14 ref units from inner top (textBaseline=top) */}
      <Text
        x={ix}
        y={iy + _snValueY}
        width={SN_INNER}
        text={value}
        fontSize={_snValueFont}
        fontFamily={font}
        fontStyle="bold"
        fill="black"
        align="center"
      />
    </Fragment>
  );
}

// ── Line indicator badge (JR East style) ────────────────────────────────────

// Badge side length — same as SN_INNER so line and station badges share proportions.
const LI_SIZE = SN_INNER - 3; // 20 Konva units
const LI_STROKE = 2;
// Font/badge ratio 19:30 — identical to the canvas LineIndicatorBadgePreview.
const LI_FONT = Math.round((LI_SIZE * 20) / 28); // 13
const LI_CORNER = 1.5;
const LI_GAP = 5; // gap between badge and line name text

/**
 * Compute the Konva Text y-offset (from badge top) that optically centres the
 * glyphs vertically. Mirrors the measureText technique used in the canvas
 * LineIndicatorBadgePreview (actualBoundingBoxAscent / actualBoundingBoxDescent).
 *
 * Konva positions text with y = top of the em-square ("top" textBaseline).
 * We measure the actual rendered glyph bounds using a temporary canvas so the
 * result is exact regardless of font metrics.
 */
function liTextY(): number {
  if (typeof document === "undefined") return LI_SIZE / 2 - LI_FONT * 0.35;
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d");
  if (!ctx) return LI_SIZE / 2 - LI_FONT * 0.35;
  const fontSpec = `600 ${LI_FONT}px "HindSemiBold", Arial, sans-serif`;

  // Glyph bounds measured from the alphabetic baseline
  ctx.textBaseline = "alphabetic";
  ctx.font = fontSpec;
  const mA = ctx.measureText("IM");
  const glyphH = mA.actualBoundingBoxAscent + mA.actualBoundingBoxDescent;

  // Distance from the em-square top to the visual top of the glyphs
  ctx.textBaseline = "top";
  ctx.font = fontSpec;
  const mT = ctx.measureText("IM");
  // mT.actualBoundingBoxAscent = how far glyphs extend ABOVE em-top (≈0 for caps)
  const emTopToGlyphTop = -mT.actualBoundingBoxAscent;

  // Centre the glyph block inside the badge
  return LI_SIZE / 2 - glyphH / 2 - emTopToGlyphTop;
}

function LineIndicatorBadge({
  x,
  y,
  color,
  prefix,
}: {
  x: number;
  y: number;
  color: string;
  prefix: string;
}) {
  const ty = liTextY();
  return (
    <Fragment>
      <Rect
        x={x}
        y={y}
        width={LI_SIZE}
        height={LI_SIZE}
        fill="white"
        stroke={color}
        strokeWidth={LI_STROKE}
        cornerRadius={LI_CORNER}
      />
      <Text
        x={x}
        y={y + ty}
        width={LI_SIZE}
        text={prefix}
        fontSize={LI_FONT}
        fontFamily="HindSemiBold, Arial, sans-serif"
        fontStyle="bold"
        fill="black"
        align="center"
      />
    </Fragment>
  );
}

// ── Helper: measure rendered text width via Konva ───────────────────────────

export function measureTextWidth(
  text: string,
  fontSize: number,
  fontStyle = "normal",
): number {
  const node = new Konva.Text({
    text,
    fontSize,
    fontStyle,
    fontFamily: "NotoSansJP, Noto Sans JP, sans-serif",
  });
  return node.width();
}

// ── Renderer ────────────────────────────────────────────────────────────────

const LineMapRenderer = forwardRef<Konva.Stage, LineMapRendererProps>(
  (
    {
      stations,
      line,
      isLoop,
      orientation,
      nameStyle = "normal",
      transits,
      circularFontSize,
      stationNumberMode = "none",
      stationNumbers = {},
      stationSpacing,
      primaryLangField = "primary_name",
      secondaryLangField = "secondary_name",
      showSecondaryLang = true,
      hasMoreBefore = false,
      hasMoreAfter = false,
      companyStyle,
    },
    ref,
  ) => {
    const hSpacing = stationSpacing ?? H_SPACING;
    const vSpacing = stationSpacing ?? V_SPACING;

    const [stageKey, setStageKey] = useState(0);

    // Re-render once fonts are ready (same pattern as JrEastSign)
    useEffect(() => {
      document.fonts.ready.then(() => setStageKey((k) => k + 1));
    }, []);

    // Also re-key when data changes so Konva re-renders correctly
    useEffect(() => {
      setStageKey((k) => k + 1);
    }, [
      stations,
      line.id,
      orientation,
      nameStyle,
      isLoop,
      primaryLangField,
      secondaryLangField,
      showSecondaryLang,
    ]);

    const lc = line.line_color;
    const n = stations.length;
    if (n === 0) return null;

    // Whether to show a line indicator badge next to / above the line title
    const showLineBadge = companyStyle === "jreast" && !!line.prefix;

    // ── Circular layout ───────────────────────────────────────────────────

    if (isLoop) {
      const cJpFont = circularFontSize ?? JP_FONT;
      const cEnFont = Math.max(5, cJpFont - 3);
      const isPartialLoop = hasMoreBefore || hasMoreAfter;
      // For large partial loops widen the gap between the two cut-off endpoints
      // to ceil(n/12) station-widths by shrinking angleStep accordingly.
      const gapStations = isPartialLoop && n > 15 ? Math.ceil(n / 12) : 1;
      const angleStep = (2 * Math.PI) / (n - 1 + gapStations);

      // Precompute dot positions and per-station label anchors
      const stationData = stations.map((station, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const dotX = C_CX + C_RADIUS * cosA;
        const dotY = C_CY + C_RADIUS * sinA;
        const isXchg = (transits[station.id]?.length ?? 0) > 0;
        const r = isXchg ? XCHG_R : DOT_R;

        // In dot-replace mode the badge is pushed outward from the dot so its
        // inner edge touches the track circle.  Use the full badge dimension as
        // the effective radius so labels are anchored past the outer edge.
        const snNum = stationNumbers[station.id];
        const dotModeActive = stationNumberMode === "dot" && !!snNum?.value;
        const _snDims = dotModeActive
          ? snBadgeDims(!!snNum!.threeLetterCode)
          : null;
        // Radial extent of the (upright) badge in the outward direction.
        // For a rectangle this equals |cosA|×w/2 + |sinA|×h/2 — largest at
        // diagonal angles (~45°) and smallest at purely axial angles.
        const snDotPush = 0;
        const dotEffectiveR = dotModeActive
          ? (Math.abs(cosA) * _snDims!.w) / 2 +
            (Math.abs(sinA) * _snDims!.h) / 2
          : r;
        // In badge mode the badge sits beside the text, centred at tickEnd.
        // Its radial extent from tickEnd must be added so labels start outside it.
        const badgeModeActive = stationNumberMode === "badge" && !!snNum?.value;
        const _badgeDims = badgeModeActive
          ? snBadgeDims(!!snNum!.threeLetterCode)
          : null;
        const badgeExtraPush = 0;

        // Alternate label radii to stagger adjacent stations and prevent overlap
        const stagger = i % 2 === 0 ? 0 : C_STAGGER;
        const labelR =
          C_RADIUS + dotEffectiveR + C_TICK_LEN + stagger + badgeExtraPush;
        const tickEndX = C_CX + labelR * cosA;
        const tickEndY = C_CY + labelR * sinA;

        // Zone: left/right vs top/bottom
        const isRight = cosA > C_DIAG;
        const isLeft = cosA < -C_DIAG;
        const isTop = !isRight && !isLeft && sinA < 0;
        // isBottom = !isRight && !isLeft && sinA >= 0

        return {
          angle,
          cosA,
          sinA,
          dotX,
          dotY,
          r,
          isXchg,
          tickEndX,
          tickEndY,
          isRight,
          isLeft,
          isTop,
        };
      });

      return (
        <Stage
          ref={ref}
          key={stageKey}
          width={C_SIZE * scale}
          height={C_SIZE * scale}
          scaleX={scale}
          scaleY={scale}
          listening={false}
        >
          <Layer>
            <Rect x={0} y={0} width={C_SIZE} height={C_SIZE} fill="white" />

            {/* Line title in the center */}
            {showLineBadge && (
              <LineIndicatorBadge
                x={C_CX - LI_SIZE / 2}
                y={C_CY - (LI_SIZE + LI_GAP + LINE_TITLE_FONT) / 2}
                color={lc}
                prefix={line.prefix}
              />
            )}
            <Text
              x={C_CX - 60}
              y={
                showLineBadge
                  ? C_CY -
                    (LI_SIZE + LI_GAP + LINE_TITLE_FONT) / 2 +
                    LI_SIZE +
                    LI_GAP
                  : C_CY - LINE_TITLE_FONT / 2
              }
              text={line.name}
              fontSize={LINE_TITLE_FONT}
              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
              fontStyle="bold"
              fill={lc}
              align="center"
              width={120}
            />

            {/* Track segments — skip closing segment for partial loops */}
            {stationData.map((sd, i) => {
              const isClosing = i === n - 1;
              if (isClosing && isPartialLoop) return null;
              const next = stationData[(i + 1) % n];
              return (
                <KonvaLine
                  key={`track-${i}`}
                  points={[sd.dotX, sd.dotY, next.dotX, next.dotY]}
                  stroke={lc}
                  strokeWidth={TRACK_W}
                  lineCap="round"
                  lineJoin="round"
                />
              );
            })}

            {/* Fade track + dots at arc ends for partial circular loops */}
            {(hasMoreBefore || hasMoreAfter) &&
              (() => {
                const angle0 = -Math.PI / 2;
                const angleN = (n - 1) * angleStep - Math.PI / 2;
                const arcExt = (2 * Math.PI) / n / 3;
                const arcDot = FADE_DOT_SPACING / C_RADIUS;
                const extAngle0 = angle0 - arcExt;
                const extAngleN = angleN + arcExt;
                return (
                  <Fragment>
                    {/* Extension lines (opacity 1, butt cap) */}
                    <KonvaLine
                      points={[
                        stationData[0].dotX,
                        stationData[0].dotY,
                        C_CX + C_RADIUS * Math.cos(extAngle0),
                        C_CY + C_RADIUS * Math.sin(extAngle0),
                      ]}
                      stroke={lc}
                      strokeWidth={TRACK_W}
                      lineCap="round"
                    />
                    <KonvaLine
                      points={[
                        stationData[n - 1].dotX,
                        stationData[n - 1].dotY,
                        C_CX + C_RADIUS * Math.cos(extAngleN),
                        C_CY + C_RADIUS * Math.sin(extAngleN),
                      ]}
                      stroke={lc}
                      strokeWidth={TRACK_W}
                      lineCap="round"
                    />
                    {/* Fading dots beyond the cutoff */}
                    {FADE_OPACITIES.map((opacity, idx) => {
                      const a = extAngle0 - arcDot * (idx + 1);
                      return (
                        <Circle
                          key={`fade-circ-before-${idx}`}
                          x={C_CX + C_RADIUS * Math.cos(a)}
                          y={C_CY + C_RADIUS * Math.sin(a)}
                          radius={FADE_DOT_R}
                          fill={lc}
                          opacity={opacity}
                        />
                      );
                    })}
                    {FADE_OPACITIES.map((opacity, idx) => {
                      const a = extAngleN + arcDot * (idx + 1);
                      return (
                        <Circle
                          key={`fade-circ-after-${idx}`}
                          x={C_CX + C_RADIUS * Math.cos(a)}
                          y={C_CY + C_RADIUS * Math.sin(a)}
                          radius={FADE_DOT_R}
                          fill={lc}
                          opacity={opacity}
                        />
                      );
                    })}
                  </Fragment>
                );
              })()}

            {/* Station dots */}
            {stationData.map((sd, i) => {
              const snNum = stationNumbers[stations[i].id];
              const showSnDot = stationNumberMode === "dot" && !!snNum?.value;
              const snDotDims = showSnDot
                ? snBadgeDims(!!snNum!.threeLetterCode)
                : null;
              return showSnDot && snDotDims ? (
                <SnBadge
                  key={`dot-${i}`}
                  x={sd.dotX - snDotDims.w / 2}
                  y={sd.dotY - snDotDims.h / 2}
                  color={lc}
                  prefix={snNum!.prefix}
                  value={snNum!.value}
                  trc={snNum!.threeLetterCode}
                />
              ) : (
                <Circle
                  key={`dot-${i}`}
                  x={sd.dotX}
                  y={sd.dotY}
                  radius={sd.r}
                  fill="white"
                  stroke={lc}
                  strokeWidth={sd.isXchg ? 3 : 2}
                />
              );
            })}

            {/* Labels — rendered last so they sit on top */}
            {stations.map((station, i) => {
              const sd = stationData[i];
              const stTransits = transits[station.id] ?? [];
              const nBadges = stTransits.length;
              const bw = badgesWidth(nBadges);

              const snNum = stationNumbers[station.id];
              const showSnBadge =
                stationNumberMode === "badge" && !!snNum?.value;
              const snDims = snNum
                ? snBadgeDims(!!snNum.threeLetterCode)
                : snBadgeDims(false);

              const primaryName = stationName(station, primaryLangField);
              const secondaryName = showSecondaryLang
                ? (station[secondaryLangField] ?? null)
                : null;
              const jpW = measureTextWidth(primaryName, cJpFont);
              const enW = secondaryName
                ? measureTextWidth(secondaryName, cEnFont)
                : 0;

              const enBlockH = secondaryName ? cEnFont + 2 : 0;
              const badgeBlockH = nBadges > 0 ? BADGE_H + 3 : 0;
              const totalLabelH = cJpFont + enBlockH + badgeBlockH;

              let jpX: number,
                jpY: number,
                enX: number,
                enY: number,
                bRowX: number,
                bRowY: number,
                snBadgeX: number,
                snBadgeY: number;

              if (sd.isRight) {
                // SN badge goes between tick and JP text.
                // For diagonal right stations (upper/lower) shift labels right
                // proportionally to |sinA| so they clear the badge visually.
                const rightDiagShift = Math.abs(sd.sinA) * 10;
                snBadgeX = sd.tickEndX + C_LABEL_GAP + rightDiagShift;
                snBadgeY = sd.tickEndY - snDims.h / 2;
                const snShift = showSnBadge ? snDims.w + SN_BADGE_GAP : 0;
                jpX = sd.tickEndX + C_LABEL_GAP + rightDiagShift + snShift;
                jpY = sd.tickEndY - totalLabelH / 2;
                enX = jpX;
                enY = jpY + cJpFont + 2;
                bRowX = jpX;
                bRowY = enY + enBlockH;
              } else if (sd.isLeft) {
                // For diagonal left stations (upper/lower) shift labels left
                // proportionally to |sinA| so they clear the badge visually.
                const leftDiagShift = Math.abs(sd.sinA) * 10;
                const blockRight = sd.tickEndX - C_LABEL_GAP - leftDiagShift;
                if (showSnBadge) {
                  // Badge to the right of all text, right edge flush at blockRight.
                  // Text lines are right-aligned to the left edge of the badge.
                  snBadgeX = blockRight - snDims.w;
                  snBadgeY = sd.tickEndY - snDims.h / 2;
                  const textRight = snBadgeX - SN_BADGE_GAP;
                  jpX = textRight - jpW;
                  jpY = sd.tickEndY - totalLabelH / 2;
                  enX = textRight - enW;
                  enY = jpY + cJpFont + 2;
                  bRowX = textRight - bw;
                  bRowY = enY + enBlockH;
                } else {
                  jpX = blockRight - jpW;
                  jpY = sd.tickEndY - totalLabelH / 2;
                  snBadgeX = jpX - snDims.w - SN_BADGE_GAP;
                  snBadgeY = sd.tickEndY - snDims.h / 2;
                  enX = blockRight - enW;
                  enY = jpY + cJpFont + 2;
                  bRowX = blockRight - bw;
                  bRowY = enY + enBlockH;
                }
              } else if (sd.isTop) {
                if (showSnBadge) {
                  // Stack top→bottom: JP, EN, transfers, gap, SN badge (closest to tick)
                  // All elements centred on tickEndX.
                  const totalH =
                    cJpFont + enBlockH + badgeBlockH + 2 + snDims.h;
                  jpY = sd.tickEndY - C_LABEL_GAP - totalH;
                  jpX = sd.tickEndX - jpW / 2;
                  enX = sd.tickEndX - enW / 2;
                  enY = jpY + cJpFont + 2;
                  bRowX = sd.tickEndX - bw / 2;
                  bRowY = enY + enBlockH;
                  snBadgeX = sd.tickEndX - snDims.w / 2;
                  snBadgeY = bRowY + badgeBlockH + 2;
                } else {
                  jpY = sd.tickEndY - totalLabelH - C_LABEL_GAP;
                  jpX = sd.tickEndX - jpW / 2;
                  snBadgeX = jpX - snDims.w - SN_BADGE_GAP;
                  snBadgeY = jpY + (cJpFont - snDims.h) / 2;
                  enX = sd.tickEndX - enW / 2;
                  enY = jpY + cJpFont + 2;
                  bRowX = sd.tickEndX - bw / 2;
                  bRowY = enY + enBlockH;
                }
              } else {
                if (showSnBadge) {
                  // Stack top→bottom: SN badge (closest to tick), gap, JP, EN, transfers
                  // All elements centred on tickEndX.
                  snBadgeX = sd.tickEndX - snDims.w / 2;
                  snBadgeY = sd.tickEndY + C_LABEL_GAP;
                  jpY = snBadgeY + snDims.h + 2;
                  jpX = sd.tickEndX - jpW / 2;
                  enX = sd.tickEndX - enW / 2;
                  enY = jpY + cJpFont + 2;
                  bRowX = sd.tickEndX - bw / 2;
                  bRowY = enY + enBlockH;
                } else {
                  jpY = sd.tickEndY + C_LABEL_GAP;
                  jpX = sd.tickEndX - jpW / 2;
                  snBadgeX = jpX - snDims.w - SN_BADGE_GAP;
                  snBadgeY = jpY + (cJpFont - snDims.h) / 2;
                  enX = sd.tickEndX - enW / 2;
                  enY = jpY + cJpFont + 2;
                  bRowX = sd.tickEndX - bw / 2;
                  bRowY = enY + enBlockH;
                }
              }

              return (
                <Fragment key={`label-${station.id}`}>
                  {showSnBadge && snNum && (
                    <SnBadge
                      x={snBadgeX}
                      y={snBadgeY}
                      color={lc}
                      prefix={snNum.prefix}
                      value={snNum.value}
                      trc={snNum.threeLetterCode}
                    />
                  )}
                  <Text
                    x={jpX}
                    y={jpY}
                    text={primaryName}
                    fontSize={cJpFont}
                    fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                    fill="#222"
                  />
                  {secondaryName && (
                    <Text
                      x={enX}
                      y={enY}
                      text={secondaryName}
                      fontSize={cEnFont}
                      fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                      fill="#666"
                    />
                  )}
                  {stTransits.map((tl, ti) => {
                    const bx = bRowX + ti * (BADGE_W + BADGE_GAP);
                    return (
                      <Fragment key={tl.id}>
                        <Rect
                          x={bx}
                          y={bRowY}
                          width={BADGE_W}
                          height={BADGE_H}
                          fill={tl.line_color}
                          cornerRadius={2}
                        />
                        <Text
                          x={bx}
                          y={bRowY + 1}
                          text={tl.prefix}
                          fontSize={6}
                          fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                          fontStyle="bold"
                          fill="white"
                          align="center"
                          width={BADGE_W}
                        />
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </Layer>
        </Stage>
      );
    }

    // ── Horizontal layout — 縦書き names (above or below track) ──────────────

    if (
      orientation === "horizontal" &&
      (nameStyle === "above" || nameStyle === "below")
    ) {
      // EN name widths (for rotation=-90 sizing)
      const enWidths = stations.map((s) => {
        const sName = showSecondaryLang
          ? (s[secondaryLangField] ?? null)
          : null;
        return sName ? measureTextWidth(sName, EN_FONT) : 0;
      });
      // JP 縦書き text height: each character is JP_FONT tall, +1px gap between chars
      const jpTextHeights = stations.map((s) => {
        const pName = stationName(s, primaryLangField);
        const cn = [...pName].length;
        return cn > 0 ? cn * (JP_FONT + 1) - 1 : 0;
      });
      const maxJpTextH = Math.max(1, ...jpTextHeights);
      // EN text is placed to the right of the JP block, so its width does not
      // contribute to the vertical (halfExt) calculation.

      const hasAnyTransit = Object.values(transits).some((t) => t.length > 0);
      const hasAnySnBadge =
        stationNumberMode === "badge" &&
        stations.some((s) => !!stationNumbers[s.id]?.value);
      const maxSnH = hasAnySnBadge
        ? Math.max(
            ...stations.map((s) => {
              const snNum = stationNumbers[s.id];
              return snNum ? snBadgeDims(!!snNum.threeLetterCode).h : 0;
            }),
          )
        : 0;

      // halfExt: distance from track centre to outermost element + padding
      const halfExt =
        XCHG_R +
        VN_DOT_GAP +
        (hasAnyTransit ? BADGE_H + VN_ITEM_GAP : 0) +
        (hasAnySnBadge ? maxSnH + VN_ITEM_GAP : 0) +
        maxJpTextH +
        PADDING;

      // "above": track sits at the bottom of the name area; "below": track at top
      const vnTrackY = nameStyle === "above" ? halfExt : XCHG_R + PADDING;
      const vnCanvasH =
        nameStyle === "above"
          ? halfExt + XCHG_R + PADDING
          : XCHG_R + PADDING + halfExt;
      const vnFadeLen = Math.round(hSpacing / 3);
      const vnFadeExtra = vnFadeLen + FADE_DOT_SPACING * FADE_OPACITIES.length;
      const vnExtraL = hasMoreBefore ? vnFadeExtra : 0;
      const vnExtraR = hasMoreAfter ? vnFadeExtra : 0;
      const vnCanvasW = Math.max(
        300,
        PADDING + vnExtraL + (n - 1) * hSpacing + PADDING + vnExtraR,
      );
      // d: direction away from track (+1 = down for "below", -1 = up for "above")
      const d = nameStyle === "above" ? -1 : 1;

      return (
        <Stage
          ref={ref}
          key={stageKey}
          width={vnCanvasW * scale}
          height={vnCanvasH * scale}
          scaleX={scale}
          scaleY={scale}
          listening={false}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={vnCanvasW}
              height={vnCanvasH}
              fill="white"
            />

            {/* Line title */}
            {showLineBadge && (
              <LineIndicatorBadge
                x={PADDING + vnExtraL}
                y={8}
                color={lc}
                prefix={line.prefix}
              />
            )}
            <Text
              x={PADDING + vnExtraL + (showLineBadge ? LI_SIZE + LI_GAP : 0)}
              y={showLineBadge ? 8 + (LI_SIZE - LINE_TITLE_FONT) / 2 : 8}
              text={line.name}
              fontSize={LINE_TITLE_FONT}
              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
              fontStyle="bold"
              fill={lc}
            />

            {/* Track */}
            <KonvaLine
              points={[
                PADDING + vnExtraL,
                vnTrackY,
                PADDING + vnExtraL + (n - 1) * hSpacing,
                vnTrackY,
              ]}
              stroke={lc}
              strokeWidth={TRACK_W}
              lineCap="round"
            />

            {/* Fade extension + dots — before first station */}
            {hasMoreBefore && (
              <Fragment>
                <KonvaLine
                  points={[
                    PADDING + vnExtraL,
                    vnTrackY,
                    PADDING + vnExtraL - vnFadeLen,
                    vnTrackY,
                  ]}
                  stroke={lc}
                  strokeWidth={TRACK_W}
                  lineCap="round"
                />
                {FADE_OPACITIES.map((opacity, idx) => (
                  <Circle
                    key={`fade-before-${idx}`}
                    x={
                      PADDING +
                      vnExtraL -
                      vnFadeLen -
                      FADE_DOT_SPACING * (idx + 1)
                    }
                    y={vnTrackY}
                    radius={FADE_DOT_R}
                    fill={lc}
                    opacity={opacity}
                  />
                ))}
              </Fragment>
            )}

            {/* Fade extension + dots — after last station */}
            {hasMoreAfter && (
              <Fragment>
                <KonvaLine
                  points={[
                    PADDING + vnExtraL + (n - 1) * hSpacing,
                    vnTrackY,
                    PADDING + vnExtraL + (n - 1) * hSpacing + vnFadeLen,
                    vnTrackY,
                  ]}
                  stroke={lc}
                  strokeWidth={TRACK_W}
                  lineCap="round"
                />
                {FADE_OPACITIES.map((opacity, idx) => (
                  <Circle
                    key={`fade-after-${idx}`}
                    x={
                      PADDING +
                      vnExtraL +
                      (n - 1) * hSpacing +
                      vnFadeLen +
                      FADE_DOT_SPACING * (idx + 1)
                    }
                    y={vnTrackY}
                    radius={FADE_DOT_R}
                    fill={lc}
                    opacity={opacity}
                  />
                ))}
              </Fragment>
            )}

            {/* Stations */}
            {stations.map((station, i) => {
              const x = PADDING + vnExtraL + i * hSpacing;
              const isXchg = (transits[station.id]?.length ?? 0) > 0;
              const r = isXchg ? XCHG_R : DOT_R;
              const stTransits = transits[station.id] ?? [];
              const nBadges = stTransits.length;
              const bw = badgesWidth(nBadges);

              const snNum = stationNumbers[station.id];
              const showSnBadge =
                stationNumberMode === "badge" && !!snNum?.value;
              const showSnDot = stationNumberMode === "dot" && !!snNum?.value;
              const snDims = snNum
                ? snBadgeDims(!!snNum.threeLetterCode)
                : snBadgeDims(false);

              const primaryName = stationName(station, primaryLangField);
              const secondaryName = showSecondaryLang
                ? (station[secondaryLangField] ?? null)
                : null;
              const jpTextH = jpTextHeights[i];
              const enW = enWidths[i];

              // Walk outward from dot edge; cur is the inner boundary of the
              // next item (decreases when going up, increases when going down).
              // In dot mode the badge may be taller than the circle radius, so
              // use the actual badge half-height as the starting offset.
              const dotEdge = showSnDot ? Math.max(r, snDims.h / 2) : r;
              let cur = vnTrackY + d * dotEdge + d * VN_DOT_GAP;

              // Transit badges row (horizontal, centered on x, upright)
              const badgeRowY = d === -1 ? cur - BADGE_H : cur;
              if (nBadges > 0) cur += d * (BADGE_H + VN_ITEM_GAP);

              // SN badge (upright, centered on x)
              const snBadgeY = d === -1 ? cur - snDims.h : cur;
              if (showSnBadge) cur += d * (snDims.h + VN_ITEM_GAP);

              // JP 縦書き block
              // For "above" (d=-1): bottom of block = cur, top = cur - jpTextH
              // For "below" (d=+1): top of block = cur, bottom = cur + jpTextH
              const jpTopY = d === -1 ? cur - jpTextH : cur;

              // EN text (rotation=-90°) sits to the RIGHT of the JP block,
              // vertically centred on it — does not affect vertical extent.
              const enX = x + JP_FONT / 2 + 2 + EN_FONT / 2;
              // "above": EN bottom-edge aligns with JP block bottom (closest to track)
              // "below": EN top-edge aligns with JP block top (closest to track)
              const enCenterY =
                d === -1 ? jpTopY + jpTextH - enW / 2 : jpTopY + enW / 2;

              const snDotDims =
                showSnDot && snNum
                  ? snBadgeDims(!!snNum.threeLetterCode)
                  : null;

              const jpChars = [...primaryName];

              // Non-Latin secondary text: compute actual stacked height so the
              // block aligns correctly (enW ≈ n×EN_FONT but stack height = n×(EN_FONT+1)−1).
              const secChars =
                secondaryName && !/[a-zA-Z]/.test(secondaryName)
                  ? [...secondaryName]
                  : [];
              const actualSecH =
                secChars.length > 0 ? secChars.length * (EN_FONT + 1) - 1 : 0;
              // above (d=-1): align block bottom with JP block bottom (nearest track)
              // below (d=+1): align block top with JP block top (nearest track)
              const secTopY = d === -1 ? jpTopY + jpTextH - actualSecH : jpTopY;

              return (
                <Fragment key={station.id}>
                  {/* Dot or SN dot badge */}
                  {showSnDot && snDotDims ? (
                    <SnBadge
                      x={x - snDotDims.w / 2}
                      y={vnTrackY - snDotDims.h / 2}
                      color={lc}
                      prefix={snNum!.prefix}
                      value={snNum!.value}
                      trc={snNum!.threeLetterCode}
                    />
                  ) : (
                    <Circle
                      x={x}
                      y={vnTrackY}
                      radius={r}
                      fill="white"
                      stroke={lc}
                      strokeWidth={isXchg ? 3 : 2}
                    />
                  )}

                  {/* Transit badges — horizontal row, centered on x */}
                  {stTransits.map((tl, ti) => {
                    const bx = x - bw / 2 + ti * (BADGE_W + BADGE_GAP);
                    return (
                      <Fragment key={tl.id}>
                        <Rect
                          x={bx}
                          y={badgeRowY}
                          width={BADGE_W}
                          height={BADGE_H}
                          fill={tl.line_color}
                          cornerRadius={2}
                        />
                        <Text
                          x={bx}
                          y={badgeRowY + 1}
                          text={tl.prefix}
                          fontSize={6}
                          fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                          fontStyle="bold"
                          fill="white"
                          align="center"
                          width={BADGE_W}
                        />
                      </Fragment>
                    );
                  })}

                  {/* SN badge (badge mode) — upright, centered on x */}
                  {showSnBadge && snNum && (
                    <SnBadge
                      x={x - snDims.w / 2}
                      y={snBadgeY}
                      color={lc}
                      prefix={snNum.prefix}
                      value={snNum.value}
                      trc={snNum.threeLetterCode}
                    />
                  )}

                  {/* JP name — 縦書き: each character stacked top-to-bottom.
                      Horizontal glyphs (ー, 〜, …) are rotated 90° around
                      their cell centre so they render as vertical strokes. */}
                  {jpChars.map((char, ci) => {
                    const charTopY = jpTopY + ci * (JP_FONT + 1);
                    // Hyphens/dashes: draw as a precisely centred vertical bar
                    // (thin vertical line spanning the cell) for 縦書き layout.
                    if (char in VJ_LINE_WIDTHS) {
                      const barLen = VJ_LINE_WIDTHS[char] * JP_FONT;
                      return (
                        <Rect
                          key={ci}
                          x={x - 0.5}
                          y={charTopY + (JP_FONT - barLen) / 2}
                          width={1}
                          height={barLen}
                          fill="#222"
                        />
                      );
                    }
                    if (VJ_ROTATE_CHARS.has(char)) {
                      return (
                        <Text
                          key={ci}
                          x={x}
                          y={charTopY + JP_FONT / 2}
                          offsetX={JP_FONT / 2}
                          offsetY={JP_FONT / 2}
                          rotation={90}
                          text={char}
                          fontSize={JP_FONT}
                          fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                          fill="#222"
                          width={JP_FONT}
                          align="center"
                        />
                      );
                    }
                    return (
                      <Text
                        key={ci}
                        x={x - JP_FONT / 2}
                        y={charTopY}
                        text={char}
                        fontSize={JP_FONT}
                        fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                        fill="#222"
                        width={JP_FONT}
                        align="center"
                      />
                    );
                  })}

                  {/* Secondary name — rotated 90° for Latin text, stacked vertically for CJK.
                      CJK path applies VJ_ROTATE_CHARS (ー etc.) and VJ_LINE_WIDTHS (dashes). */}
                  {secondaryName &&
                    (/[a-zA-Z]/.test(secondaryName) ? (
                      <Text
                        x={enX}
                        y={enCenterY}
                        offsetX={enW / 2}
                        offsetY={EN_FONT / 2}
                        rotation={90}
                        text={secondaryName}
                        fontSize={EN_FONT}
                        fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                        fill="#666"
                      />
                    ) : (
                      <Fragment>
                        {secChars.map((char, ci) => {
                          const charTopY = secTopY + ci * (EN_FONT + 1);
                          if (char in VJ_LINE_WIDTHS) {
                            const barLen = VJ_LINE_WIDTHS[char] * EN_FONT;
                            return (
                              <Rect
                                key={ci}
                                x={enX - 0.35}
                                y={charTopY + (EN_FONT - barLen) / 2}
                                width={0.7}
                                height={barLen}
                                fill="#666"
                              />
                            );
                          }
                          if (VJ_ROTATE_CHARS.has(char)) {
                            return (
                              <Text
                                key={ci}
                                x={enX}
                                y={charTopY + EN_FONT / 2}
                                offsetX={EN_FONT / 2}
                                offsetY={EN_FONT / 2}
                                rotation={90}
                                text={char}
                                fontSize={EN_FONT}
                                fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                                fill="#666"
                                width={EN_FONT}
                                align="center"
                              />
                            );
                          }
                          return (
                            <Text
                              key={ci}
                              x={enX - EN_FONT / 2}
                              y={charTopY}
                              text={char}
                              fontSize={EN_FONT}
                              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                              fill="#666"
                              width={EN_FONT}
                              align="center"
                            />
                          );
                        })}
                      </Fragment>
                    ))}
                </Fragment>
              );
            })}
          </Layer>
        </Stage>
      );
    }

    // ── Horizontal linear layout ──────────────────────────────────────────

    if (orientation === "horizontal") {
      const hFadeLen = Math.round(hSpacing / 3);
      const hFadeExtra = hFadeLen + FADE_DOT_SPACING * FADE_OPACITIES.length;
      const hExtraL = hasMoreBefore ? hFadeExtra : 0;
      const hExtraR = hasMoreAfter ? hFadeExtra : 0;
      const canvasW = Math.max(
        300,
        PADDING + hExtraL + (n - 1) * hSpacing + PADDING + hExtraR,
      );
      const canvasH = H_HEIGHT;

      return (
        <Stage
          ref={ref}
          key={stageKey}
          width={canvasW * scale}
          height={canvasH * scale}
          scaleX={scale}
          scaleY={scale}
          listening={false}
        >
          <Layer>
            <Rect x={0} y={0} width={canvasW} height={canvasH} fill="white" />

            {/* Line title */}
            {showLineBadge && (
              <LineIndicatorBadge
                x={PADDING + hExtraL}
                y={8}
                color={lc}
                prefix={line.prefix}
              />
            )}
            <Text
              x={PADDING + hExtraL + (showLineBadge ? LI_SIZE + LI_GAP : 0)}
              y={showLineBadge ? 8 + (LI_SIZE - LINE_TITLE_FONT) / 2 : 8}
              text={line.name}
              fontSize={LINE_TITLE_FONT}
              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
              fontStyle="bold"
              fill={lc}
            />

            {/* Track */}
            <KonvaLine
              points={[
                PADDING + hExtraL,
                H_TRACK_Y,
                PADDING + hExtraL + (n - 1) * hSpacing,
                H_TRACK_Y,
              ]}
              stroke={lc}
              strokeWidth={TRACK_W}
              lineCap="round"
            />

            {/* Fade extension + dots — before first station */}
            {hasMoreBefore && (
              <Fragment>
                <KonvaLine
                  points={[
                    PADDING + hExtraL,
                    H_TRACK_Y,
                    PADDING + hExtraL - hFadeLen,
                    H_TRACK_Y,
                  ]}
                  stroke={lc}
                  strokeWidth={TRACK_W}
                  lineCap="round"
                />
                {FADE_OPACITIES.map((opacity, idx) => (
                  <Circle
                    key={`fade-before-${idx}`}
                    x={
                      PADDING +
                      hExtraL -
                      hFadeLen -
                      FADE_DOT_SPACING * (idx + 1)
                    }
                    y={H_TRACK_Y}
                    radius={FADE_DOT_R}
                    fill={lc}
                    opacity={opacity}
                  />
                ))}
              </Fragment>
            )}

            {/* Fade extension + dots — after last station */}
            {hasMoreAfter && (
              <Fragment>
                <KonvaLine
                  points={[
                    PADDING + hExtraL + (n - 1) * hSpacing,
                    H_TRACK_Y,
                    PADDING + hExtraL + (n - 1) * hSpacing + hFadeLen,
                    H_TRACK_Y,
                  ]}
                  stroke={lc}
                  strokeWidth={TRACK_W}
                  lineCap="round"
                />
                {FADE_OPACITIES.map((opacity, idx) => (
                  <Circle
                    key={`fade-after-${idx}`}
                    x={
                      PADDING +
                      hExtraL +
                      (n - 1) * hSpacing +
                      hFadeLen +
                      FADE_DOT_SPACING * (idx + 1)
                    }
                    y={H_TRACK_Y}
                    radius={FADE_DOT_R}
                    fill={lc}
                    opacity={opacity}
                  />
                ))}
              </Fragment>
            )}

            {/* Stations */}
            {stations.map((station, i) => {
              const x = PADDING + hExtraL + i * hSpacing;
              const isXchg = (transits[station.id]?.length ?? 0) > 0;
              const r = isXchg ? XCHG_R : DOT_R;
              const above = i % 2 === 0;
              const stTransits = transits[station.id] ?? [];
              const nBadges = stTransits.length;
              const bw = badgesWidth(nBadges);

              const snNum = stationNumbers[station.id];
              const showSnBadge =
                stationNumberMode === "badge" && !!snNum?.value;
              const showSnDot = stationNumberMode === "dot" && !!snNum?.value;

              // Measure actual text widths to center without wrapping
              const primaryName = stationName(station, primaryLangField);
              const secondaryName = showSecondaryLang
                ? (station[secondaryLangField] ?? null)
                : null;
              const jpW = measureTextWidth(primaryName, JP_FONT);
              const enW = secondaryName
                ? measureTextWidth(secondaryName, EN_FONT)
                : 0;

              // Calculate label heights
              const jpH = JP_FONT;
              const enH = secondaryName ? EN_FONT + 2 : 0;
              const badgeBlockH = nBadges > 0 ? BADGE_H + 4 : 0;

              // Dot replacement: center badge on the dot position
              const snDotDims =
                showSnDot && snNum
                  ? snBadgeDims(!!snNum.threeLetterCode)
                  : null;

              // When replacing the dot with a badge, use the badge half-height
              // as the effective radius so text doesn't overlap the badge.
              const effectiveDotR = snDotDims
                ? Math.max(r, snDotDims.h / 2)
                : r;

              // SN badge dimensions (used in badge mode)
              const snDims = snNum
                ? snBadgeDims(!!snNum.threeLetterCode)
                : snBadgeDims(false);

              // For "above" stations: jp name at top, then en name, then transit badges, then gap, then dot
              // For "below" stations: dot, then gap, then transit badges, then en name, then jp name
              // In badge mode the SN badge is inserted between the dot and the rest of the labels,
              // centered on the station x.
              let jpNameY: number;
              let enNameY: number;
              let badgeRowY: number;
              let snBadgeX: number;
              let snBadgeY: number;

              if (showSnBadge && snNum) {
                // Badge mode: SN badge sits directly adjacent to the dot; labels stack beyond it.
                snBadgeX = x - snDims.w / 2;
                if (above) {
                  snBadgeY = H_TRACK_Y - r - 8 - snDims.h;
                  const totalH = jpH + enH + badgeBlockH;
                  jpNameY = snBadgeY - SN_BADGE_GAP - totalH;
                  enNameY = jpNameY + jpH + 2;
                  badgeRowY = enNameY + enH;
                } else {
                  snBadgeY = H_TRACK_Y + r + 8;
                  badgeRowY = snBadgeY + snDims.h + SN_BADGE_GAP;
                  enNameY = badgeRowY + badgeBlockH;
                  jpNameY = enNameY + enH;
                }
              } else {
                snBadgeX = 0;
                snBadgeY = 0;
                if (above) {
                  const totalH = jpH + enH + badgeBlockH;
                  jpNameY = H_TRACK_Y - effectiveDotR - 8 - totalH;
                  enNameY = jpNameY + jpH + 2;
                  badgeRowY = enNameY + enH;
                } else {
                  badgeRowY = H_TRACK_Y + effectiveDotR + 6;
                  enNameY = badgeRowY + badgeBlockH;
                  jpNameY = enNameY + enH;
                }
              }

              return (
                <Fragment key={station.id}>
                  {showSnDot && snDotDims ? (
                    <SnBadge
                      x={x - snDotDims.w / 2}
                      y={H_TRACK_Y - snDotDims.h / 2}
                      color={lc}
                      prefix={snNum!.prefix}
                      value={snNum!.value}
                      trc={snNum!.threeLetterCode}
                    />
                  ) : (
                    <Circle
                      x={x}
                      y={H_TRACK_Y}
                      radius={r}
                      fill="white"
                      stroke={lc}
                      strokeWidth={isXchg ? 3 : 2}
                    />
                  )}

                  {/* SN badge inline to the left of the JP name */}
                  {showSnBadge && snNum && (
                    <SnBadge
                      x={snBadgeX}
                      y={snBadgeY}
                      color={lc}
                      prefix={snNum.prefix}
                      value={snNum.value}
                      trc={snNum.threeLetterCode}
                    />
                  )}

                  {/* Primary name — centered on station x, no width constraint so no wrapping */}
                  <Text
                    x={x - jpW / 2}
                    y={jpNameY}
                    text={primaryName}
                    fontSize={JP_FONT}
                    fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                    fill="#222"
                  />

                  {/* Secondary name — centered on station x */}
                  {secondaryName && (
                    <Text
                      x={x - enW / 2}
                      y={enNameY}
                      text={secondaryName}
                      fontSize={EN_FONT}
                      fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                      fill="#666"
                    />
                  )}

                  {/* Transit badges */}
                  {stTransits.map((tl, ti) => {
                    const bx = x - bw / 2 + ti * (BADGE_W + BADGE_GAP);
                    return (
                      <Fragment key={tl.id}>
                        <Rect
                          x={bx}
                          y={badgeRowY}
                          width={BADGE_W}
                          height={BADGE_H}
                          fill={tl.line_color}
                          cornerRadius={2}
                        />
                        <Text
                          x={bx}
                          y={badgeRowY + 1}
                          text={tl.prefix}
                          fontSize={6}
                          fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                          fontStyle="bold"
                          fill="white"
                          align="center"
                          width={BADGE_W}
                        />
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </Layer>
        </Stage>
      );
    }

    // ── Vertical linear layout ────────────────────────────────────────────

    // Compute canvas width based on maximum badges + name
    const maxBadgeCount = Math.max(
      0,
      ...Object.values(transits).map((t) => t.length),
    );
    const maxNameW = 130;
    const canvasW = Math.max(
      200,
      V_TRACK_X +
        XCHG_R +
        10 +
        badgesWidth(maxBadgeCount) +
        (maxBadgeCount > 0 ? 8 : 0) +
        maxNameW +
        V_RIGHT_MARGIN,
    );
    const vFadeLen = Math.round(vSpacing / 3);
    const vFadeExtra = vFadeLen + FADE_DOT_SPACING * FADE_OPACITIES.length;
    const vExtraT = hasMoreBefore ? vFadeExtra : 0;
    const vExtraB = hasMoreAfter ? vFadeExtra : 0;
    const canvasH = Math.max(
      200,
      PADDING + vExtraT + (n - 1) * vSpacing + PADDING + vExtraB,
    );

    return (
      <Stage
        ref={ref}
        key={stageKey}
        width={canvasW * scale}
        height={canvasH * scale}
        scaleX={scale}
        scaleY={scale}
        listening={false}
      >
        <Layer>
          <Rect x={0} y={0} width={canvasW} height={canvasH} fill="white" />

          {/* Line title */}
          {showLineBadge && (
            <LineIndicatorBadge
              x={V_TRACK_X + XCHG_R + 10}
              y={8}
              color={lc}
              prefix={line.prefix}
            />
          )}
          <Text
            x={V_TRACK_X + XCHG_R + 10 + (showLineBadge ? LI_SIZE + LI_GAP : 0)}
            y={showLineBadge ? 8 + (LI_SIZE - LINE_TITLE_FONT) / 2 : 8}
            text={line.name}
            fontSize={LINE_TITLE_FONT}
            fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
            fontStyle="bold"
            fill={lc}
          />

          {/* Track */}
          <KonvaLine
            points={[
              V_TRACK_X,
              PADDING + vExtraT,
              V_TRACK_X,
              PADDING + vExtraT + (n - 1) * vSpacing,
            ]}
            stroke={lc}
            strokeWidth={TRACK_W}
            lineCap="round"
          />

          {/* Fade extension + dots — before first station */}
          {hasMoreBefore && (
            <Fragment>
              <KonvaLine
                points={[
                  V_TRACK_X,
                  PADDING + vExtraT,
                  V_TRACK_X,
                  PADDING + vExtraT - vFadeLen,
                ]}
                stroke={lc}
                strokeWidth={TRACK_W}
                lineCap="round"
              />
              {FADE_OPACITIES.map((opacity, idx) => (
                <Circle
                  key={`fade-before-${idx}`}
                  x={V_TRACK_X}
                  y={
                    PADDING + vExtraT - vFadeLen - FADE_DOT_SPACING * (idx + 1)
                  }
                  radius={FADE_DOT_R}
                  fill={lc}
                  opacity={opacity}
                />
              ))}
            </Fragment>
          )}

          {/* Fade extension + dots — after last station */}
          {hasMoreAfter && (
            <Fragment>
              <KonvaLine
                points={[
                  V_TRACK_X,
                  PADDING + vExtraT + (n - 1) * vSpacing,
                  V_TRACK_X,
                  PADDING + vExtraT + (n - 1) * vSpacing + vFadeLen,
                ]}
                stroke={lc}
                strokeWidth={TRACK_W}
                lineCap="round"
              />
              {FADE_OPACITIES.map((opacity, idx) => (
                <Circle
                  key={`fade-after-${idx}`}
                  x={V_TRACK_X}
                  y={
                    PADDING +
                    vExtraT +
                    (n - 1) * vSpacing +
                    vFadeLen +
                    FADE_DOT_SPACING * (idx + 1)
                  }
                  radius={FADE_DOT_R}
                  fill={lc}
                  opacity={opacity}
                />
              ))}
            </Fragment>
          )}

          {/* Stations */}
          {stations.map((station, i) => {
            const y = PADDING + vExtraT + i * vSpacing;
            const isXchg = (transits[station.id]?.length ?? 0) > 0;
            const r = isXchg ? XCHG_R : DOT_R;
            const stTransits = transits[station.id] ?? [];
            const nBadges = stTransits.length;

            const snNum = stationNumbers[station.id];
            const showSnBadge = stationNumberMode === "badge" && !!snNum?.value;
            const showSnDot = stationNumberMode === "dot" && !!snNum?.value;
            const snDims = snNum
              ? snBadgeDims(!!snNum.threeLetterCode)
              : snBadgeDims(false);

            // Badges start right after the dot
            const badgesStartX = V_TRACK_X + r + 10;
            const afterBadgesX =
              badgesStartX + badgesWidth(nBadges) + (nBadges > 0 ? 6 : 0);
            // SN badge (if any) goes between transit badges and station name
            const snBadgeX = afterBadgesX;
            const snExtraW = showSnBadge ? snDims.w + SN_BADGE_GAP : 0;
            // Name starts after SN badge
            const nameX = afterBadgesX + snExtraW;

            const jpNameY = y - JP_FONT / 2;
            const enNameY = jpNameY + JP_FONT + 1;

            // Dot replacement: center badge on the dot position
            const snDotDims =
              showSnDot && snNum ? snBadgeDims(!!snNum.threeLetterCode) : null;

            return (
              <Fragment key={station.id}>
                {showSnDot && snDotDims ? (
                  <SnBadge
                    x={V_TRACK_X - snDotDims.w / 2}
                    y={y - snDotDims.h / 2}
                    color={lc}
                    prefix={snNum!.prefix}
                    value={snNum!.value}
                    trc={snNum!.threeLetterCode}
                  />
                ) : (
                  <Circle
                    x={V_TRACK_X}
                    y={y}
                    radius={r}
                    fill="white"
                    stroke={lc}
                    strokeWidth={isXchg ? 3 : 2}
                  />
                )}

                {/* Transit badges */}
                {stTransits.map((tl, ti) => {
                  const bx = badgesStartX + ti * (BADGE_W + BADGE_GAP);
                  return (
                    <Fragment key={tl.id}>
                      <Rect
                        x={bx}
                        y={y - BADGE_H / 2}
                        width={BADGE_W}
                        height={BADGE_H}
                        fill={tl.line_color}
                        cornerRadius={2}
                      />
                      <Text
                        x={bx}
                        y={y - BADGE_H / 2 + 1}
                        text={tl.prefix}
                        fontSize={6}
                        fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                        fontStyle="bold"
                        fill="white"
                        align="center"
                        width={BADGE_W}
                      />
                    </Fragment>
                  );
                })}

                {/* Station number badge */}
                {showSnBadge && snNum && (
                  <SnBadge
                    x={snBadgeX}
                    y={y - snDims.h / 2}
                    color={lc}
                    prefix={snNum.prefix}
                    value={snNum.value}
                    trc={snNum.threeLetterCode}
                  />
                )}

                {/* Primary name */}
                <Text
                  x={nameX}
                  y={jpNameY}
                  text={stationName(station, primaryLangField)}
                  fontSize={JP_FONT}
                  fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                  fill="#222"
                />

                {/* Secondary name */}
                {showSecondaryLang && station[secondaryLangField] && (
                  <Text
                    x={nameX}
                    y={enNameY}
                    text={station[secondaryLangField]!}
                    fontSize={EN_FONT}
                    fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                    fill="#666"
                  />
                )}
              </Fragment>
            );
          })}
        </Layer>
      </Stage>
    );
  },
);

LineMapRenderer.displayName = "LineMapRenderer";
export default LineMapRenderer;
