import { Fragment, useState, useEffect, forwardRef } from "react";
import {
  Stage,
  Layer,
  Line as KonvaLine,
  Circle,
  Rect,
  Text,
} from "react-konva";
import Konva from "konva";
import type { Station, Line } from "@/db/types";

export const scale = 2;

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
    const jpW = measureTextWidth(station.primary_name, jpFont);
    const enW = station.secondary_name
      ? measureTextWidth(station.secondary_name, enFont)
      : 0;
    const bw = badgesWidth(nBadges);
    const maxW = Math.max(jpW, enW, bw);

    const enBlockH = station.secondary_name ? enFont + 2 : 0;
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

    return { name: station.primary_name, x, y, w: maxW, h: totalH };
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
): { w: number; h: number } {
  if (isLoop) return { w: C_SIZE, h: C_SIZE };
  const n = stationCount;
  const hSpacing = stationSpacing ?? H_SPACING;
  const vSpacing = stationSpacing ?? V_SPACING;
  if (orientation === "horizontal") {
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
        w: Math.max(300, PADDING * 2 + (n - 1) * hSpacing),
        // same canvas height regardless of above/below
        h: halfExt + XCHG_R + PADDING,
      };
    }
    return {
      w: Math.max(300, PADDING * 2 + (n - 1) * hSpacing),
      h: H_HEIGHT,
    };
  }
  // vertical
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
    h: Math.max(200, PADDING * 2 + (n - 1) * vSpacing),
  };
}

/** Returns primary names of stations whose labels overlap another label. */
export function detectCircularOverlaps(
  stations: Station[],
  transits: Record<string, Line[]>,
  jpFont: number,
  stationNumberMode?: StationNumberMode,
  stationNumbers?: StationNumberMap,
): string[] {
  const bounds = computeCircularBounds(
    stations,
    transits,
    jpFont,
    stationNumberMode,
    stationNumbers,
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
    }, [stations, line.id, orientation, nameStyle, isLoop]);

    const lc = line.line_color;
    const n = stations.length;
    if (n === 0) return null;

    // ── Circular layout ───────────────────────────────────────────────────

    if (isLoop) {
      const cJpFont = circularFontSize ?? JP_FONT;
      const cEnFont = Math.max(5, cJpFont - 3);
      const angleStep = (2 * Math.PI) / n;

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
            <Text
              x={C_CX - 60}
              y={C_CY - LINE_TITLE_FONT / 2}
              text={line.name}
              fontSize={LINE_TITLE_FONT}
              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
              fontStyle="bold"
              fill={lc}
              align="center"
              width={120}
            />

            {/* Track segments */}
            {stationData.map((sd, i) => {
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

              const jpW = measureTextWidth(station.primary_name, cJpFont);
              const enW = station.secondary_name
                ? measureTextWidth(station.secondary_name, cEnFont)
                : 0;

              const enBlockH = station.secondary_name ? cEnFont + 2 : 0;
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
                    text={station.primary_name}
                    fontSize={cJpFont}
                    fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                    fill="#222"
                  />
                  {station.secondary_name && (
                    <Text
                      x={enX}
                      y={enY}
                      text={station.secondary_name}
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
      const enWidths = stations.map((s) =>
        s.secondary_name ? measureTextWidth(s.secondary_name, EN_FONT) : 0,
      );
      // JP 縦書き text height: each character is JP_FONT tall, +1px gap between chars
      const jpTextHeights = stations.map((s) => {
        const n = [...s.primary_name].length;
        return n > 0 ? n * (JP_FONT + 1) - 1 : 0;
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
      const vnCanvasW = Math.max(300, PADDING * 2 + (n - 1) * hSpacing);
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
            <Text
              x={PADDING}
              y={8}
              text={line.name}
              fontSize={LINE_TITLE_FONT}
              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
              fontStyle="bold"
              fill={lc}
            />

            {/* Track */}
            <KonvaLine
              points={[
                PADDING,
                vnTrackY,
                PADDING + (n - 1) * hSpacing,
                vnTrackY,
              ]}
              stroke={lc}
              strokeWidth={TRACK_W}
              lineCap="round"
            />

            {/* Stations */}
            {stations.map((station, i) => {
              const x = PADDING + i * hSpacing;
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

              const jpChars = [...station.primary_name];

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

                  {/* EN name — rotation 90° (reads top-to-bottom), to the right of JP 縦書き block */}
                  {station.secondary_name && (
                    <Text
                      x={enX}
                      y={enCenterY}
                      offsetX={enW / 2}
                      offsetY={EN_FONT / 2}
                      rotation={90}
                      text={station.secondary_name}
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
    }

    // ── Horizontal linear layout ──────────────────────────────────────────

    if (orientation === "horizontal") {
      const canvasW = Math.max(300, PADDING * 2 + (n - 1) * hSpacing);
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
            <Text
              x={PADDING}
              y={8}
              text={line.name}
              fontSize={LINE_TITLE_FONT}
              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
              fontStyle="bold"
              fill={lc}
            />

            {/* Track */}
            <KonvaLine
              points={[
                PADDING,
                H_TRACK_Y,
                PADDING + (n - 1) * hSpacing,
                H_TRACK_Y,
              ]}
              stroke={lc}
              strokeWidth={TRACK_W}
              lineCap="round"
            />

            {/* Stations */}
            {stations.map((station, i) => {
              const x = PADDING + i * hSpacing;
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
              const jpW = measureTextWidth(station.primary_name, JP_FONT);
              const enW = station.secondary_name
                ? measureTextWidth(station.secondary_name, EN_FONT)
                : 0;

              // Calculate label heights
              const jpH = JP_FONT;
              const enH = station.secondary_name ? EN_FONT + 2 : 0;
              const badgeBlockH = nBadges > 0 ? BADGE_H + 4 : 0;

              // For "above" stations: jp name at top, then en name, then badges, then gap, then dot
              // For "below" stations: dot, then gap, then badges, then en name, then jp name
              let jpNameY: number;
              let enNameY: number;
              let badgeRowY: number;

              if (above) {
                const totalH = jpH + enH + badgeBlockH;
                jpNameY = H_TRACK_Y - r - 8 - totalH;
                enNameY = jpNameY + jpH + 2;
                badgeRowY = enNameY + enH;
              } else {
                badgeRowY = H_TRACK_Y + r + 6;
                enNameY = badgeRowY + badgeBlockH;
                jpNameY = enNameY + enH;
              }

              // SN badge: inline to the left of the JP name
              const snDims = snNum
                ? snBadgeDims(!!snNum.threeLetterCode)
                : snBadgeDims(false);
              const snBadgeX = x - jpW / 2 - snDims.w - SN_BADGE_GAP;
              const snBadgeY = jpNameY + (JP_FONT - snDims.h) / 2;

              // Dot replacement: center badge on the dot position
              const snDotDims =
                showSnDot && snNum
                  ? snBadgeDims(!!snNum.threeLetterCode)
                  : null;

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
                    text={station.primary_name}
                    fontSize={JP_FONT}
                    fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                    fill="#222"
                  />

                  {/* English name */}
                  {station.secondary_name && (
                    <Text
                      x={x - enW / 2}
                      y={enNameY}
                      text={station.secondary_name}
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
    const canvasH = Math.max(200, PADDING * 2 + (n - 1) * vSpacing);

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
          <Text
            x={V_TRACK_X + XCHG_R + 10}
            y={8}
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
              PADDING,
              V_TRACK_X,
              PADDING + (n - 1) * vSpacing,
            ]}
            stroke={lc}
            strokeWidth={TRACK_W}
            lineCap="round"
          />

          {/* Stations */}
          {stations.map((station, i) => {
            const y = PADDING + i * vSpacing;
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
                  text={station.primary_name}
                  fontSize={JP_FONT}
                  fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                  fill="#222"
                />

                {/* English name */}
                {station.secondary_name && (
                  <Text
                    x={nameX}
                    y={enNameY}
                    text={station.secondary_name}
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
