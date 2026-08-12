import { Fragment, useState, useEffect, forwardRef } from "react";
import {
  Stage,
  Layer,
  Line as KonvaLine,
  Circle,
  Rect,
  Text,
  Group,
} from "react-konva";
import Konva from "konva";
import type { Station, Line } from "@/db/types";
import { getTokyoMetroStationNumberMetrics } from "@/components/signs/stationNumberBadgeMetrics";
import JrCentralStationNumberBadge, {
  getJrCentralStationNumberBadgeMetrics,
} from "@/components/signs/JrCentralStationNumberBadge";
import {
  TRANSIT_ICON_NAME_GAP,
  TRANSIT_ICON_SIZE,
  TRANSIT_DIAGONAL_ANGLE,
  TRANSIT_NAME_FONT,
  TRANSIT_NAME_LINE_GAP,
  TRANSIT_SECONDARY_NAME_FONT,
  layoutDiagonalTransitLines,
  layoutHorizontalStationDetails,
  layoutHorizontalTransitLines,
  layoutVerticalStationDetails,
  oppositeVerticalDirection,
  shouldRotateVerticalGlyph,
} from "@/components/signs/transitLineLayout";
import {
  getLineIndicatorVisualStyle,
  shouldShowLineIndicatorBadge,
} from "@/components/signs/lineIndicatorStyle";
import { isJrEastStationNumber } from "@/components/signs/stationNumberGroup";
import { getLineMapFontSpecs, waitForCanvasFonts } from "@/lib/fonts";
import {
  ceilCanvasDimensions,
  DEFAULT_TRACK_WIDTH,
  getFadeDotSpacing,
  getServiceTrackGap,
  getServiceTrackWidth,
  getSegmentedTrackEndCaps,
  getSegmentedTrackRuns,
  getTrackEdgeRadius,
  layoutConnectedMarkers,
  layoutExpandedLinearStations,
  normalizeTrackWidth,
  shouldExpandStationNumberGroups,
} from "@/components/signs/lineMapGeometry";

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

export interface StationNumberInfo {
  prefix: string;
  value: string;
  threeLetterCode?: string | null;
  color?: string;
  style?: string;
}

export type StationNumberMap = Record<string, StationNumberInfo>;
export type StationNumberGroupMap = Record<string, StationNumberInfo[]>;

/** A service (train type) that runs on a line, e.g. 普通 or 快速. */
export interface ServiceInfo {
  id: string;
  name: string;
  color: string;
}

/**
 * Per-station, per-service stop status.
 * serviceStops[stationId][serviceId] = "stop" | "special" | undefined (= pass)
 */
export type ServiceStopMap = Record<string, Record<string, "stop" | "special">>;

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
  /** When false, transfer lines are represented by their icons only. */
  showTransitNames?: boolean;
  /** Station-number style for each transfer line, keyed by line ID. */
  transitLineStyles?: Record<string, string>;
  /** JP font size for the circular layout only (default: JP_FONT) */
  circularFontSize?: number;
  /** How to display station numbers in the route map */
  stationNumberMode?: StationNumberMode;
  /** Map from stationId to its station number for the current line */
  stationNumbers?: StationNumberMap;
  /** Multiple station numbers shown as one connected badge at through boundaries. */
  stationNumberGroups?: StationNumberGroupMap;
  /** Per-gap route colours. Used by a direction-aware through route. */
  trackColors?: string[];
  /** Per-station marker colours for a direction-aware through route. */
  stationColors?: Record<string, string>;
  /** Override the gap between stations in canvas units (defaults: 75 horizontal, 62 vertical) */
  stationSpacing?: number;
  /** Width of the route line in canvas units. */
  trackWidth?: number;
  /** Which station field to use as the primary (large) name. Defaults to "primary_name". */
  primaryLangField?: StationNameField;
  /** Which station field to use as the secondary (small) name. Defaults to "secondary_name". */
  secondaryLangField?: StationNameField;
  /** When false, the secondary name row is hidden entirely. Defaults to true. */
  showSecondaryLang?: boolean;
  /** The company's station_number_style — used to choose the line indicator badge design. */
  companyStyle?: string;
  /**
   * Vertical layout name side (ignored for horizontal/loop):
   *   "right" — names to the right of the track (default)
   *   "left"  — names to the left of the track
   */
  verticalNameSide?: "left" | "right";
  /**
   * Services to render as parallel tracks (horizontal above/below and vertical).
   * When length >= 2 the renderer draws one track per service; single or empty
   * falls back to the normal single-track rendering.
   */
  services?: ServiceInfo[];
  /**
   * Per-station per-service stop status.
   * serviceStops[stationId][serviceId] = "stop" | "special"; absent = pass.
   */
  serviceStops?: ServiceStopMap;
  /** When false, stations where no selected service stops are hidden. Default: true */
  showPassedStations?: boolean;
  /**
   * How to display the single-service name next to the line title.
   *   "paren"  — append （サービス名） in the service colour (default)
   *   "badge"  — coloured rectangle with white text
   */
  serviceNameStyle?: "paren" | "badge";
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
  showTransitNames: boolean = true,
  trackWidth: number = DEFAULT_TRACK_WIDTH,
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
      ? (Math.abs(cosA) *
          snBadgeDims(!!snNum!.threeLetterCode, snNum!.style).w) /
          2 +
        (Math.abs(sinA) *
          snBadgeDims(!!snNum!.threeLetterCode, snNum!.style).h) /
          2
      : getTrackEdgeRadius(r, trackWidth);
    const stagger = i % 2 === 0 ? 0 : C_STAGGER;
    const labelR = C_RADIUS + effectiveR + C_TICK_LEN + stagger;
    const tickEndX = C_CX + labelR * cosA;
    const tickEndY = C_CY + labelR * sinA;

    const stTransits = transits[station.id] ?? [];
    const transitLayout = getHorizontalTransitLayout(
      stTransits,
      showTransitNames,
      "right",
    );
    const pName = stationName(station, primaryLangField);
    const sName = showSecondaryLang
      ? (station[secondaryLangField] ?? null)
      : null;
    const jpW = measureTextWidth(pName, jpFont);
    const enW = sName ? measureTextWidth(sName, enFont) : 0;
    const bw = transitLayout.width;
    const maxW = Math.max(jpW, enW, bw);

    const enBlockH = sName ? enFont + 2 : 0;
    const badgeBlockH =
      stTransits.length > 0 ? transitLayout.height + 3 : 0;
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
  /** Whether transfer line names are included next to their icons. */
  showTransitNames = true,
  /** Width of the route line in canvas units. */
  trackWidth = DEFAULT_TRACK_WIDTH,
  /** Extra route-axis extent introduced by connected dot-replacement badges. */
  stationNumberExtraExtent = 0,
): { w: number; h: number } {
  if (isLoop) return { w: C_SIZE, h: C_SIZE };
  const n = stationCount;
  const hSpacing = stationSpacing ?? H_SPACING;
  const vSpacing = stationSpacing ?? V_SPACING;
  if (orientation === "horizontal") {
    const hFadeLen = Math.round(hSpacing / 3);
    const fadeDotSpacing = getFadeDotSpacing(normalizeTrackWidth(trackWidth));
    const hFadeExtra = hFadeLen + fadeDotSpacing * FADE_OPACITIES.length;
    const extraL = hasMoreBefore ? hFadeExtra : 0;
    const extraR = hasMoreAfter ? hFadeExtra : 0;
    if (nameStyle === "above" || nameStyle === "below") {
      const ne = maxNameExtent ?? 60;
      const transitDirection = oppositeVerticalDirection(nameStyle);
      const transitLayouts = Object.values(transits).map((lines) =>
        getDiagonalTransitLayout(lines, showTransitNames, transitDirection),
      );
      const maxTransitExtent = Math.max(
        0,
        ...transitLayouts.map((layout) => layout.height),
      );
      const maxTransitWidth = Math.max(
        0,
        ...transitLayouts.map((layout) => layout.width),
      );
      const lineEdgeRadius = getTrackEdgeRadius(XCHG_R, trackWidth);
      const stationSideExtent = lineEdgeRadius + VN_DOT_GAP + ne + PADDING;
      const transitSideExtent =
        lineEdgeRadius + VN_DOT_GAP + maxTransitExtent + PADDING;
      return ceilCanvasDimensions(
        Math.max(
          300,
          PADDING +
            extraL +
            (n - 1) * hSpacing +
            stationNumberExtraExtent +
            Math.max(PADDING, maxTransitWidth + 5) +
            extraR,
        ),
        stationSideExtent + transitSideExtent,
      );
    }
    return ceilCanvasDimensions(
      Math.max(
        300,
        PADDING +
          extraL +
          (n - 1) * hSpacing +
          stationNumberExtraExtent +
          PADDING +
          extraR,
      ),
      H_HEIGHT,
    );
  }
  // vertical
  const vFadeLen = Math.round(vSpacing / 3);
  const fadeDotSpacing = getFadeDotSpacing(normalizeTrackWidth(trackWidth));
  const vFadeExtra = vFadeLen + fadeDotSpacing * FADE_OPACITIES.length;
  const extraT = hasMoreBefore ? vFadeExtra : 0;
  const extraB = hasMoreAfter ? vFadeExtra : 0;
  const maxTransitWidth = Math.max(
    0,
    ...Object.values(transits).map(
      (lines) =>
        getHorizontalTransitLayout(lines, showTransitNames, "right").width,
    ),
  );
  const maxNameW = 130;
  return ceilCanvasDimensions(
    Math.max(
      200,
      V_TRACK_X +
        getTrackEdgeRadius(XCHG_R, trackWidth) +
        10 +
        maxTransitWidth +
        (maxTransitWidth > 0 ? 8 : 0) +
        maxNameW +
        V_RIGHT_MARGIN,
    ),
    Math.max(
      200,
      PADDING +
        extraT +
        (n - 1) * vSpacing +
        stationNumberExtraExtent +
        PADDING +
        extraB,
    ),
  );
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
  showTransitNames?: boolean,
  trackWidth?: number,
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
    showTransitNames,
    trackWidth,
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

export const DOT_R = 7;
export const XCHG_R = 10;
const PADDING = 50;
export const JP_FONT = 9;
export const EN_FONT = 6;
export const LINE_TITLE_FONT = 12;

interface SegmentedTrackProps {
  stationPoints: Array<{ x: number; y: number }>;
  colors?: string[];
  fallbackColor: string;
  strokeWidth: number;
}

function SegmentedTrack({
  stationPoints,
  colors,
  fallbackColor,
  strokeWidth,
}: SegmentedTrackProps) {
  const firstPoint = stationPoints[0];
  const lastPoint = stationPoints[stationPoints.length - 1];
  if (!firstPoint || !lastPoint) return null;
  if (!colors || colors.length !== stationPoints.length - 1) {
    return (
      <KonvaLine
        points={[firstPoint.x, firstPoint.y, lastPoint.x, lastPoint.y]}
        stroke={fallbackColor}
        strokeWidth={strokeWidth}
        lineCap="round"
      />
    );
  }

  const endCaps = getSegmentedTrackEndCaps(
    stationPoints,
    colors,
    strokeWidth,
  );
  const runs = getSegmentedTrackRuns(stationPoints, colors);

  return (
    <Fragment>
      {runs.map((run, index) => (
        <KonvaLine
          key={`track-run-${index}`}
          points={run.points.flatMap((point) => [point.x, point.y])}
          stroke={run.color}
          strokeWidth={strokeWidth}
          lineCap="butt"
        />
      ))}
      {endCaps.map((cap, index) => (
        <Circle
          key={`track-end-cap-${index}`}
          x={cap.x}
          y={cap.y}
          radius={cap.radius}
          fill={cap.color}
        />
      ))}
    </Fragment>
  );
}

// Horizontal
const H_SPACING = 75;
const H_HEIGHT = 210;
const H_TRACK_Y = 105;

// Vertical names (horizontal layout with rotated station names)
const VN_DOT_GAP = 6; // gap from dot edge to first item
const VN_ITEM_GAP = 4; // gap between items (badges, SN badge, name)

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

// Multi-service parallel tracks
const SVC_DOT_R = 5; // dot radius on a service track
const V_RIGHT_MARGIN = 30;

// Station number badge — all proportions derived from the JR East reference.
// Reference coordinate system: inner badge = 30×30 sign units.
// Every measurement below is (reference sign-unit value) × SN_S.

/**
 * Module-level variable set by LineMapRenderer at the beginning of each render so that
 * SnBadge can read the current company style without prop threading. React renders within
 * a single component tree are synchronous, so this is safe as long as SnBadge is only
 * ever called inside a LineMapRenderer render.
 */
let _snBadgeStyle = "jreast";

const SN_INNER = 20; // inner badge size in Konva units (= 30 ref × SN_S)
const SN_S = SN_INNER / 30; // scale factor from 30-unit reference
export const SN_BADGE_GAP = 4; // gap between badge and station name (Konva units)

// Circular
const C_SIZE = 760;
const C_CX = C_SIZE / 2; // 380
const C_CY = C_SIZE / 2; // 380
const C_RADIUS = 250;
export const C_TICK_LEN = 3; // gap between dot edge and label anchor
export const C_STAGGER = 0; // no stagger — labels sit close to their dot
export const C_LABEL_GAP = 4; // gap between tick end and text
export const C_DIAG = 0.35; // |cosA| threshold below which station is in top/bottom zone

// Fade dots — shown at line ends when the map is a partial view of the full line
const FADE_OPACITIES = [0.65, 0.35, 0.15] as const; // nearest → farthest

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
export function snBadgeDims(
  hasTrc: boolean,
  style: string = _snBadgeStyle,
): { w: number; h: number } {
  if (style === "jrcentral") {
    const metrics = getJrCentralStationNumberBadgeMetrics(SN_INNER);
    return { w: metrics.width, h: metrics.height };
  }
  if (hasTrc) {
    return {
      w: SN_INNER + _snOuterPadX * 2, // 36 ref units
      h: _snTrcH + SN_INNER + _snOuterPadBot, // 45 ref units
    };
  }
  return { w: SN_INNER, h: SN_INNER };
}

/** Renders a JR East style station number badge at (x, y) top-left corner.
 *  Pass scale < 1 to shrink the entire badge proportionally.
 *  Pass forceFullRender=true when the badge is inside a Konva Group with opacity < 1
 *  to skip the semi-transparent compound-darkening workaround and render with full
 *  color so the parent Group's opacity applies uniformly. */
function SnBadge({
  x,
  y,
  color,
  prefix,
  value,
  trc,
  style,
  scale = 1,
  forceFullRender = false,
  strokeWidthAdjust = 0,
}: {
  x: number;
  y: number;
  color: string;
  prefix: string;
  value: string;
  trc?: string | null;
  style?: string;
  scale?: number;
  forceFullRender?: boolean;
  strokeWidthAdjust?: number;
}) {
  const s = scale;
  const badgeStyle = style ?? _snBadgeStyle;
  if (badgeStyle === "jrcentral") {
    return (
      <JrCentralStationNumberBadge
        x={x}
        y={y}
        size={SN_INNER * s}
        color={color}
        prefix={prefix}
        value={value}
      />
    );
  }
  const hasTrc = !!trc;
  const outerW = (SN_INNER + _snOuterPadX * 2) * s;
  const outerH = (_snTrcH + SN_INNER + _snOuterPadBot) * s;
  // Inner square top-left
  const ix = hasTrc ? x + _snOuterPadX * s : x;
  const iy = hasTrc ? y + _snTrcH * s : y;
  const metroMetrics = getTokyoMetroStationNumberMetrics(SN_INNER * s);
  const font =
    badgeStyle === "tokyometro"
      ? '"JostTrispaceHybrid", Arial, sans-serif'
      : '"HindSemiBold", Arial, sans-serif';
  const strokeWidth =
    (badgeStyle === "tokyometro"
      ? metroMetrics.strokeWidth
      : _snStroke * s) +
    (badgeStyle === "tokyometro" ? strokeWidthAdjust : 0);
  const prefixFont =
    badgeStyle === "tokyometro"
      ? metroMetrics.prefixFontSize
      : _snPrefixFont * s;
  const prefixY =
    iy +
    (badgeStyle === "tokyometro"
      ? metroMetrics.prefixYOffset
      : _snPrefixY * s);
  const valueFont =
    badgeStyle === "tokyometro"
      ? metroMetrics.valueFontSize
      : _snValueFont * s;
  const valueY =
    iy +
    (badgeStyle === "tokyometro"
      ? metroMetrics.valueYOffset
      : _snValueY * s);

  return (
    <Fragment>
      {hasTrc && (
        <>
          {s < 1 && !forceFullRender ? (
            // Semi-transparent: one unified black rect for border + TRC area.
            // Avoids the compound darkening caused by a separate stroke rect
            // and TRC fill rect each compositing at <1 opacity in sequence.
            // NOTE: skip this path (use forceFullRender=true) when inside a
            // Konva Group with opacity<1 so the parent Group fades all parts
            // uniformly instead of compounding with this black rect.
            <>
              <Rect
                x={x}
                y={y}
                width={outerW}
                height={outerH}
                fill="black"
                cornerRadius={_snCornerOuter * s}
              />
              <Rect
                x={x + _snStroke * s}
                y={y + (_snTrcH + _snCornerInner) * s}
                width={outerW - _snStroke * s * 2}
                height={outerH - (_snTrcH + _snCornerInner) * s - _snStroke * s}
                fill="white"
                cornerRadius={[
                  0,
                  0,
                  Math.max(0, (_snCornerOuter - _snStroke) * s),
                  Math.max(0, (_snCornerOuter - _snStroke) * s),
                ]}
              />
            </>
          ) : (
            <>
              {/* Outer white frame */}
              <Rect
                x={x}
                y={y}
                width={outerW}
                height={outerH}
                fill="white"
                stroke="black"
                strokeWidth={_snStroke * s}
                cornerRadius={_snCornerOuter * s}
              />
              {/* Black TRC strip — extended by _snCornerInner so the inner
                  square's rounded top corners sit on black with no white gap */}
              <Rect
                x={x}
                y={y}
                width={outerW}
                height={(_snTrcH + _snCornerInner) * s}
                fill="black"
                cornerRadius={[_snCornerOuter * s, _snCornerOuter * s, 0, 0]}
              />
            </>
          )}
          {/* TRC text: 1 ref unit below outer top, centered over inner width */}
          <Text
            x={ix}
            y={y + _snTrcY * s}
            width={SN_INNER * s}
            text={trc!}
            fontSize={_snTrcFont * s}
            fontFamily={font}
            fontStyle="bold"
            fill="white"
            align="center"
          />
        </>
      )}
      {/* Inner badge shape — circle for tokyometro, rounded square otherwise.
          When hasTrc: top corners rounded, bottom corners concentric with outer frame.
          When no TRC and jreast: uniform _snCornerInner. */}
      {badgeStyle === "tokyometro" ? (
        <Circle
          x={ix + (SN_INNER * s) / 2}
          y={iy + (SN_INNER * s) / 2}
          radius={(SN_INNER * s) / 2}
          fill="white"
          stroke={color}
          strokeWidth={strokeWidth}
        />
      ) : (
        <Rect
          x={ix}
          y={iy}
          width={SN_INNER * s}
          height={SN_INNER * s}
          fill="white"
          stroke={color}
          strokeWidth={strokeWidth}
          cornerRadius={
            hasTrc
              ? [
                  _snCornerInner * s,
                  _snCornerInner * s,
                  (_snCornerOuter - _snOuterPadX) * s,
                  (_snCornerOuter - _snOuterPadX) * s,
                ]
              : _snCornerInner * s
          }
        />
      )}
      {/* Prefix: 11 ref-unit font, 4 ref units from inner top (textBaseline=top) */}
      <Text
        x={ix}
        y={prefixY}
        width={SN_INNER * s}
        text={prefix}
        fontSize={prefixFont}
        fontFamily={font}
        fontStyle={
          badgeStyle === "tokyometro"
            ? metroMetrics.prefixFontWeight
            : "bold"
        }
        fill="black"
        align="center"
      />
      {/* Value: 17 ref-unit font, 14 ref units from inner top (textBaseline=top) */}
      <Text
        x={ix}
        y={valueY}
        width={SN_INNER * s}
        text={value}
        fontSize={valueFont}
        fontFamily={font}
        fontStyle={
          badgeStyle === "tokyometro" ? metroMetrics.valueFontWeight : "bold"
        }
        fill="black"
        align="center"
      />
    </Fragment>
  );
}

type StationNumberGroupOrientation = "horizontal" | "vertical";

function getSharedStationThreeLetterCode(
  numbers: StationNumberInfo[],
  sharedThreeLetterCode?: string | null,
): string | null {
  if (
    numbers.length < 2 ||
    !numbers.every((number) =>
      isJrEastStationNumber(number, _snBadgeStyle),
    )
  ) {
    return null;
  }
  return (
    sharedThreeLetterCode?.trim() ||
    numbers.find((number) => number.threeLetterCode?.trim())
      ?.threeLetterCode?.trim() ||
    null
  );
}

function stationNumberBadgeVisualOutset(
  number: StationNumberInfo,
  badgeScale: number,
  forceFullRender: boolean,
  strokeWidthAdjust: number,
): number {
  if (number.threeLetterCode) {
    return badgeScale < 1 && !forceFullRender
      ? 0
      : (_snStroke * badgeScale) / 2;
  }
  const badgeStyle = number.style ?? _snBadgeStyle;
  if (badgeStyle === "jrcentral") {
    return (
      getJrCentralStationNumberBadgeMetrics(SN_INNER * badgeScale)
        .strokeWidth / 2
    );
  }
  if (badgeStyle === "tokyometro") {
    const metrics = getTokyoMetroStationNumberMetrics(SN_INNER * badgeScale);
    return (metrics.strokeWidth + strokeWidthAdjust) / 2;
  }
  return (_snStroke * badgeScale) / 2;
}

function stationNumberGroupLayout(
  numbers: StationNumberInfo[],
  orientation: StationNumberGroupOrientation,
  badgeScale = 1,
  forceFullRender = false,
  strokeWidthAdjust = 0,
  sharedThreeLetterCode?: string | null,
): { w: number; h: number; positions: number[] } {
  const resolvedSharedThreeLetterCode = getSharedStationThreeLetterCode(
    numbers,
    sharedThreeLetterCode,
  );
  const hasSharedThreeLetterCode = !!resolvedSharedThreeLetterCode;
  const layoutNumbers = hasSharedThreeLetterCode
    ? numbers.map((number) => ({ ...number, threeLetterCode: null }))
    : numbers;
  const dimensions = layoutNumbers.map((number) => {
    const dims = snBadgeDims(
      !!number.threeLetterCode,
      number.style ?? _snBadgeStyle,
    );
    return { w: dims.w * badgeScale, h: dims.h * badgeScale };
  });
  if (dimensions.length === 0) return { w: 0, h: 0, positions: [] };
  const axisExtents = dimensions.map((dims) =>
    orientation === "horizontal" ? dims.w : dims.h,
  );
  const visualOutsets = layoutNumbers.map((number) =>
    stationNumberBadgeVisualOutset(
      number,
      badgeScale,
      forceFullRender,
      strokeWidthAdjust,
    ),
  );
  const connected = layoutConnectedMarkers(axisExtents, visualOutsets);
  const sharedHeaderHeight = hasSharedThreeLetterCode
    ? (snBadgeDims(true).h - snBadgeDims(false).h) * badgeScale
    : 0;
  const sharedHeaderWidth = hasSharedThreeLetterCode
    ? snBadgeDims(true).w * badgeScale
    : 0;
  if (hasSharedThreeLetterCode) {
    // JR East connected badges sit on one black plate. Keep one stroke-width
    // visible around and between the rounded route frames.
    const sharedDivider = _snStroke * badgeScale;
    if (orientation === "horizontal") {
      return {
        w: connected.extent + sharedDivider,
        h:
          sharedHeaderHeight +
          Math.max(...dimensions.map((dims) => dims.h)) +
          sharedDivider * 1.5,
        positions: connected.positions.map(
          (position) => position + sharedDivider / 2,
        ),
      };
    }
    const positions: number[] = [];
    let position = sharedHeaderHeight;
    dimensions.forEach((dims, index) => {
      positions.push(position);
      if (index < dimensions.length - 1) {
        position += dims.h + sharedDivider * 2;
      }
    });
    const lastIndex = dimensions.length - 1;
    return {
      w: Math.max(
        sharedHeaderWidth + sharedDivider,
        ...dimensions.map((dims) => dims.w + sharedDivider),
      ),
      h:
        positions[lastIndex] +
        dimensions[lastIndex].h +
        sharedDivider * 1.5,
      positions,
    };
  }
  return {
    w:
      orientation === "horizontal"
        ? connected.extent
        : Math.max(sharedHeaderWidth, ...dimensions.map((dims) => dims.w)),
    h:
      orientation === "horizontal"
        ? Math.max(...dimensions.map((dims) => dims.h))
        : sharedHeaderHeight + connected.extent,
    positions: connected.positions.map((position) =>
      position + sharedHeaderHeight
    ),
  };
}

export function stationNumberGroupDimensions(
  numbers: StationNumberInfo[],
  orientation: StationNumberGroupOrientation,
  badgeScale = 1,
  forceFullRender = false,
  strokeWidthAdjust = 0,
  sharedThreeLetterCode?: string | null,
): { w: number; h: number } {
  const { w, h } = stationNumberGroupLayout(
    numbers,
    orientation,
    badgeScale,
    forceFullRender,
    strokeWidthAdjust,
    sharedThreeLetterCode,
  );
  return { w, h };
}

export function getStationNumberGroupExtraExtent(
  groups: StationNumberGroupMap,
  orientation: StationNumberGroupOrientation,
  strokeWidthAdjust = 0,
): number {
  return Object.values(groups).reduce((total, numbers) => {
    if (numbers.length < 2) return total;
    const group = stationNumberGroupDimensions(
      numbers,
      orientation,
      1,
      false,
      strokeWidthAdjust,
    );
    const largestSingle = Math.max(
      ...numbers.map((number) => {
        const dims = snBadgeDims(
          !!number.threeLetterCode,
          number.style ?? _snBadgeStyle,
        );
        return orientation === "horizontal" ? dims.w : dims.h;
      }),
    );
    const groupExtent = orientation === "horizontal" ? group.w : group.h;
    return total + Math.max(0, groupExtent - largestSingle);
  }, 0);
}

export function StationNumberBadgeGroup({
  x,
  y,
  numbers,
  orientation,
  fallbackColor,
  badgeScale = 1,
  forceFullRender = false,
  strokeWidthAdjust = 0,
  sharedThreeLetterCode,
}: {
  x: number;
  y: number;
  numbers: StationNumberInfo[];
  orientation: StationNumberGroupOrientation;
  fallbackColor: string;
  badgeScale?: number;
  forceFullRender?: boolean;
  strokeWidthAdjust?: number;
  sharedThreeLetterCode?: string | null;
}) {
  const resolvedSharedThreeLetterCode = getSharedStationThreeLetterCode(
    numbers,
    sharedThreeLetterCode,
  );
  const hasSharedThreeLetterCode = !!resolvedSharedThreeLetterCode;
  const displayNumbers = hasSharedThreeLetterCode
    ? numbers.map((number) => ({ ...number, threeLetterCode: null }))
    : numbers;
  const group = stationNumberGroupLayout(
    displayNumbers,
    orientation,
    badgeScale,
    forceFullRender,
    strokeWidthAdjust,
    resolvedSharedThreeLetterCode,
  );
  const sharedCodeYOffset = hasSharedThreeLetterCode
    ? (_snStroke * badgeScale) / 2
    : 0;
  return (
    <Fragment>
      {hasSharedThreeLetterCode && (
        <Rect
          x={x}
          y={y}
          width={group.w}
          height={group.h}
          fill="black"
          cornerRadius={_snCornerOuter * badgeScale}
        />
      )}
      {hasSharedThreeLetterCode && (
        <Fragment>
          <Text
            x={x + (group.w - SN_INNER * badgeScale) / 2}
            y={y + sharedCodeYOffset + _snTrcY * badgeScale}
            width={SN_INNER * badgeScale}
            text={resolvedSharedThreeLetterCode!}
            fontSize={_snTrcFont * badgeScale}
            fontFamily='"HindSemiBold", Arial, sans-serif'
            fontStyle="bold"
            fill="white"
            align="center"
          />
        </Fragment>
      )}
      {displayNumbers.map((number, index) => {
        const baseDims = snBadgeDims(
          !!number.threeLetterCode,
          number.style ?? _snBadgeStyle,
        );
        const dims = {
          w: baseDims.w * badgeScale,
          h: baseDims.h * badgeScale,
        };
        const badgeX =
          orientation === "horizontal"
            ? x + group.positions[index]
            : x + (group.w - dims.w) / 2;
        const badgeY =
          orientation === "horizontal"
            ? hasSharedThreeLetterCode
              ? y +
                (snBadgeDims(true).h - snBadgeDims(false).h) * badgeScale
              : y + (group.h - dims.h) / 2
            : y + group.positions[index];
        return (
          <SnBadge
            key={`${number.prefix}:${number.value}:${index}`}
            x={badgeX}
            y={badgeY}
            color={number.color ?? fallbackColor}
            prefix={number.prefix}
            value={number.value}
            trc={number.threeLetterCode}
            style={number.style}
            scale={badgeScale}
            forceFullRender={forceFullRender}
            strokeWidthAdjust={strokeWidthAdjust}
          />
        );
      })}
    </Fragment>
  );
}

// ── Line indicator badge (JR East style) ────────────────────────────────────

// Badge side length — same as SN_INNER so line and station badges share proportions.
export const LI_SIZE = SN_INNER - 3; // 20 Konva units
const LI_STROKE = 2;
// Font/badge ratio 19:30 — identical to the canvas LineIndicatorBadgePreview.
const LI_FONT = Math.round((LI_SIZE * 20) / 28); // 13
const LI_CORNER = 1.5;
export const LI_GAP = 5; // gap between badge and line name text

const EMPTY_LINE_STYLES: Record<string, string> = {};
const EMPTY_STATION_COLORS: Record<string, string> = {};
const EMPTY_STATION_NUMBER_GROUPS: StationNumberGroupMap = {};

/**
 * Compute the Konva Text y-offset (from badge top) that optically centres the
 * glyphs vertically. Mirrors the measureText technique used in the canvas
 * LineIndicatorBadgePreview (actualBoundingBoxAscent / actualBoundingBoxDescent).
 *
 * Konva positions text with y = top of the em-square ("top" textBaseline).
 * We measure the actual rendered glyph bounds using a temporary canvas so the
 * result is exact regardless of font metrics.
 */
function liTextY(
  fontFamily: string,
  size = LI_SIZE,
  fontSize = LI_FONT,
): number {
  if (typeof document === "undefined") return size / 2 - fontSize * 0.35;
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d");
  if (!ctx) return size / 2 - fontSize * 0.35;
  const fontSpec = `600 ${fontSize}px ${fontFamily}`;

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
  return size / 2 - glyphH / 2 - emTopToGlyphTop;
}

export function LineIndicatorBadge({
  x,
  y,
  color,
  prefix,
  style = "jreast",
  size = LI_SIZE,
  strokeWidth = LI_STROKE,
}: {
  x: number;
  y: number;
  color: string;
  prefix: string;
  style?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const visualStyle = getLineIndicatorVisualStyle(style);
  const fontFamily = visualStyle.fontFamily;
  const baseFontSize = LI_FONT * (size / LI_SIZE);
  const effectiveStrokeWidth = strokeWidth * visualStyle.strokeScale;
  const availableTextWidth = Math.max(
    1,
    size - effectiveStrokeWidth * 2 - 1,
  );
  const prefixText = new Konva.Text({
    text: prefix,
    fontSize: baseFontSize,
    fontFamily,
    fontStyle: visualStyle.fontWeight,
    wrap: "none",
  });
  const fontSize =
    prefixText.width() > availableTextWidth
      ? baseFontSize * (availableTextWidth / prefixText.width())
      : baseFontSize;
  const ty = liTextY(fontFamily, size, fontSize);
  return (
    <Fragment>
      {visualStyle.shape === "circle" ? (
        <Circle
          x={x + size / 2}
          y={y + size / 2}
          radius={Math.max(0, (size - effectiveStrokeWidth) / 2)}
          fill="white"
          stroke={color}
          strokeWidth={effectiveStrokeWidth}
        />
      ) : (
        <Rect
          x={x}
          y={y}
          width={size}
          height={size}
          fill="white"
          stroke={color}
          strokeWidth={effectiveStrokeWidth}
          cornerRadius={LI_CORNER * (size / LI_SIZE)}
        />
      )}
      <Text
        x={x}
        y={y + ty}
        width={size}
        height={size}
        text={prefix}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontStyle={visualStyle.fontWeight}
        fill="black"
        align="center"
        wrap="none"
      />
    </Fragment>
  );
}

function TransitLineIcon({
  x,
  y,
  line,
  style,
}: {
  x: number;
  y: number;
  line: Line;
  style?: string;
}) {
  if (line.prefix.trim()) {
    return (
      <LineIndicatorBadge
        x={x}
        y={y}
        color={line.line_color}
        prefix={line.prefix}
        style={style}
        size={TRANSIT_ICON_SIZE}
        strokeWidth={1}
      />
    );
  }

  return (
    <Rect
      x={x}
      y={y}
      width={TRANSIT_ICON_SIZE}
      height={TRANSIT_ICON_SIZE}
      fill="white"
      stroke={line.line_color}
      strokeWidth={1}
      cornerRadius={0}
    />
  );
}

export function getHorizontalTransitLayout(
  lines: Line[],
  showNames: boolean,
  side: "left" | "right",
) {
  return layoutHorizontalTransitLines(
    lines.map((line) => {
      if (!showNames) return 0;
      const secondaryName = line.secondary_name?.trim();
      return Math.max(
        measureTextWidth(line.name, TRANSIT_NAME_FONT),
        secondaryName
          ? measureTextWidth(secondaryName, TRANSIT_SECONDARY_NAME_FONT)
          : 0,
      );
    }),
    side,
  );
}

function getDiagonalTransitLayout(
  lines: Line[],
  showNames: boolean,
  direction: "above" | "below",
) {
  const nameMetrics = lines.map((line) => {
    if (!showNames) return { width: 0, height: 0 };
    const secondaryName = line.secondary_name?.trim();
    return {
      width: Math.max(
        measureTextWidth(line.name, TRANSIT_NAME_FONT),
        secondaryName
          ? measureTextWidth(secondaryName, TRANSIT_SECONDARY_NAME_FONT)
          : 0,
      ),
      height:
        TRANSIT_NAME_FONT +
        (secondaryName
          ? TRANSIT_NAME_LINE_GAP + TRANSIT_SECONDARY_NAME_FONT
          : 0),
    };
  });
  return layoutDiagonalTransitLines(
    nameMetrics.map(({ width }) => width),
    direction,
    nameMetrics.map(({ height }) => height),
  );
}

export function HorizontalTransitLines({
  x,
  y,
  lines,
  side,
  showNames,
  lineStyles,
}: {
  x: number;
  y: number;
  lines: Line[];
  side: "left" | "right";
  showNames: boolean;
  lineStyles: Record<string, string>;
}) {
  const layout = getHorizontalTransitLayout(lines, showNames, side);

  return lines.map((line, index) => {
    const item = layout.items[index];
    const itemX = x + item.x;
    const itemY = y + item.y;
    const secondaryName = line.secondary_name?.trim();
    const textBlockHeight =
      TRANSIT_NAME_FONT +
      (secondaryName
        ? TRANSIT_NAME_LINE_GAP + TRANSIT_SECONDARY_NAME_FONT
        : 0);
    const textBlockY = itemY + (TRANSIT_ICON_SIZE - textBlockHeight) / 2;
    return (
      <Fragment key={line.id}>
        <TransitLineIcon
          x={itemX}
          y={itemY}
          line={line}
          style={lineStyles[line.id]}
        />
        {showNames && (
          <Fragment>
            <Text
              x={itemX + TRANSIT_ICON_SIZE + TRANSIT_ICON_NAME_GAP}
              y={textBlockY}
              text={line.name}
              fontSize={TRANSIT_NAME_FONT}
              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
              fill="#222"
              wrap="none"
            />
            {secondaryName && (
              <Text
                x={itemX + TRANSIT_ICON_SIZE + TRANSIT_ICON_NAME_GAP}
                y={textBlockY + TRANSIT_NAME_FONT + TRANSIT_NAME_LINE_GAP}
                text={secondaryName}
                fontSize={TRANSIT_SECONDARY_NAME_FONT}
                fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                fill="#666"
                wrap="none"
              />
            )}
          </Fragment>
        )}
      </Fragment>
    );
  });
}

function DiagonalTransitLines({
  x,
  y,
  lines,
  direction,
  showNames,
  lineStyles,
}: {
  x: number;
  y: number;
  lines: Line[];
  direction: "above" | "below";
  showNames: boolean;
  lineStyles: Record<string, string>;
}) {
  const layout = getDiagonalTransitLayout(lines, showNames, direction);

  return lines.map((line, index) => {
    const item = layout.items[index];
    const itemX = x + item.x;
    const itemY = y + item.y;
    const secondaryName = line.secondary_name?.trim();
    const rotation =
      direction === "above"
        ? -TRANSIT_DIAGONAL_ANGLE
        : TRANSIT_DIAGONAL_ANGLE;
    const secondaryOffset = TRANSIT_NAME_FONT + TRANSIT_NAME_LINE_GAP;
    return (
      <Fragment key={line.id}>
        <TransitLineIcon
          x={itemX}
          y={itemY}
          line={line}
          style={lineStyles[line.id]}
        />
        {showNames && (
          <Group
            x={itemX + TRANSIT_ICON_SIZE + TRANSIT_ICON_NAME_GAP}
            y={itemY + TRANSIT_ICON_SIZE}
            rotation={rotation}
          >
            <Text
              x={0}
              y={0}
              text={line.name}
              fontSize={TRANSIT_NAME_FONT}
              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
              fill="#222"
              wrap="none"
            />
            {secondaryName && (
              <Text
                x={direction === "below" ? secondaryOffset : -secondaryOffset}
                y={secondaryOffset}
                text={secondaryName}
                fontSize={TRANSIT_SECONDARY_NAME_FONT}
                fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                fill="#666"
                wrap="none"
              />
            )}
          </Group>
        )}
      </Fragment>
    );
  });
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

/** Render the service-name label at (x, y) where y is the text baseline top. */
function ServiceNameLabel({
  x,
  y,
  name,
  color,
  style,
}: {
  x: number;
  y: number;
  name: string;
  color: string;
  style: "paren" | "badge";
}) {
  if (style === "badge") {
    const tw = measureTextWidth(name, LINE_TITLE_FONT - 1);
    const bw = tw + 6;
    const bh = LINE_TITLE_FONT + 2;
    return (
      <Fragment>
        <Rect
          x={x}
          y={y - 1}
          width={bw}
          height={bh}
          fill={color}
          cornerRadius={2}
        />
        <Text
          x={x + 3}
          y={y}
          text={name}
          fontSize={LINE_TITLE_FONT - 1}
          fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
          fill="white"
        />
      </Fragment>
    );
  }
  return (
    <Text
      x={x}
      y={y}
      text={`（${name}）`}
      fontSize={LINE_TITLE_FONT}
      fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
      fill={color}
    />
  );
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
      showTransitNames = true,
      transitLineStyles = EMPTY_LINE_STYLES,
      circularFontSize,
      stationNumberMode = "none",
      stationNumbers = {},
      stationNumberGroups = EMPTY_STATION_NUMBER_GROUPS,
      trackColors,
      stationColors = EMPTY_STATION_COLORS,
      stationSpacing,
      trackWidth = DEFAULT_TRACK_WIDTH,
      primaryLangField = "primary_name",
      secondaryLangField = "secondary_name",
      showSecondaryLang = true,
      hasMoreBefore = false,
      hasMoreAfter = false,
      companyStyle,
      verticalNameSide = "right",
      services,
      serviceStops = {},
      showPassedStations = true,
      serviceNameStyle = "paren",
    },
    ref,
  ) => {
    // Expose the company style to SnBadge via the module-level variable
    _snBadgeStyle = companyStyle ?? "jreast";
    const lineMapFontSpecs = getLineMapFontSpecs([
      companyStyle,
      ...Object.values(stationNumbers).map((number) => number.style),
      ...Object.values(stationNumberGroups)
        .flat()
        .map((number) => number.style),
    ]);

    const multiService = (services?.length ?? 0) >= 2;
    const hSpacing = stationSpacing ?? H_SPACING;
    const vSpacing = stationSpacing ?? V_SPACING;
    const effectiveTrackWidth = normalizeTrackWidth(trackWidth);
    const serviceTrackWidth = getServiceTrackWidth(effectiveTrackWidth);
    const serviceTrackGap = getServiceTrackGap(effectiveTrackWidth);
    const fadeDotRadius = effectiveTrackWidth / 2;
    const serviceFadeDotRadius = serviceTrackWidth / 2;
    const fadeDotSpacing = getFadeDotSpacing(effectiveTrackWidth);
    const serviceFadeDotSpacing = getFadeDotSpacing(serviceTrackWidth);
    const lineExchangeEdgeRadius = getTrackEdgeRadius(
      XCHG_R,
      effectiveTrackWidth,
    );
    const serviceDotEdgeRadius = Math.max(
      SVC_DOT_R,
      serviceTrackWidth / 2,
    );
    const serviceExchangeEdgeRadius = Math.max(
      XCHG_R,
      serviceTrackWidth / 2,
    );

    const [stageKey, setStageKey] = useState(0);

    // Re-render once fonts are ready (same pattern as JrEastSign)
    useEffect(() => {
      let cancelled = false;
      waitForCanvasFonts(lineMapFontSpecs)
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) setStageKey((k) => k + 1);
        });
      return () => {
        cancelled = true;
      };
    }, [lineMapFontSpecs]);

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
      showTransitNames,
      transitLineStyles,
      effectiveTrackWidth,
      trackColors,
      stationColors,
      stationNumberGroups,
    ]);

    const lc = line.line_color;
    const n = stations.length;
    if (n === 0) return null;
    const firstTrackColor = trackColors?.[0] ?? lc;
    const lastTrackColor = trackColors?.[trackColors.length - 1] ?? lc;
    const getStationColor = (station: Station, index: number) => {
      const adjacentTrackColor = trackColors?.length
        ? trackColors[Math.min(index, trackColors.length - 1)]
        : undefined;
      return stationColors[station.id] ?? adjacentTrackColor ?? lc;
    };
    const getStationNumbers = (stationId: string): StationNumberInfo[] => {
      const connectedNumbers = stationNumberGroups[stationId]?.filter(
        (number) => !!number.value,
      );
      if ((connectedNumbers?.length ?? 0) >= 2) return connectedNumbers!;
      const singleNumber = stationNumbers[stationId];
      return singleNumber?.value ? [singleNumber] : [];
    };
    const horizontalMarkerExtras = stations.map((station) => {
      const numbers = getStationNumbers(station.id);
      if (
        !shouldExpandStationNumberGroups(
          stationNumberMode,
          "horizontal",
          nameStyle,
        ) || numbers.length < 2
      ) {
        return 0;
      }
      const group = stationNumberGroupDimensions(
        numbers,
        "horizontal",
        1,
        false,
        stationNumberMode === "dot" ? 1 : 0,
      );
      const largestSingle = Math.max(
        ...numbers.map(
          (number) =>
            snBadgeDims(!!number.threeLetterCode, number.style).w,
        ),
      );
      return Math.max(0, group.w - largestSingle);
    });
    const verticalMarkerExtras = stations.map((station) => {
      const numbers = getStationNumbers(station.id);
      if (
        !shouldExpandStationNumberGroups(
          stationNumberMode,
          "vertical",
          nameStyle,
        ) || numbers.length < 2
      ) {
        return 0;
      }
      const group = stationNumberGroupDimensions(
        numbers,
        "vertical",
        1,
        false,
        1,
      );
      const largestSingle = Math.max(
        ...numbers.map(
          (number) =>
            snBadgeDims(!!number.threeLetterCode, number.style).h,
        ),
      );
      return Math.max(0, group.h - largestSingle);
    });
    const horizontalStationLayout = layoutExpandedLinearStations(
      hSpacing,
      horizontalMarkerExtras,
    );
    const verticalStationLayout = layoutExpandedLinearStations(
      vSpacing,
      verticalMarkerExtras,
    );
    const horizontalPositions = horizontalStationLayout.positions;
    const horizontalFirstPosition = horizontalPositions[0] ?? 0;
    const horizontalLastPosition = horizontalPositions[n - 1] ?? 0;
    const verticalPositions = verticalStationLayout.positions;
    const verticalFirstPosition = verticalPositions[0] ?? 0;
    const verticalLastPosition = verticalPositions[n - 1] ?? 0;

    // Show the line indicator whenever the line has an abbreviation. The company
    // style controls its shape and typography, not whether it is rendered.
    const showLineBadge = shouldShowLineIndicatorBadge(line.prefix);

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
          ? snBadgeDims(!!snNum!.threeLetterCode, snNum!.style)
          : null;
        // Radial extent of the (upright) badge in the outward direction.
        // For a rectangle this equals |cosA|×w/2 + |sinA|×h/2 — largest at
        // diagonal angles (~45°) and smallest at purely axial angles.
        const markerEdgeRadius = getTrackEdgeRadius(r, effectiveTrackWidth);
        const dotEffectiveR = dotModeActive
          ? (Math.abs(cosA) * _snDims!.w) / 2 +
            (Math.abs(sinA) * _snDims!.h) / 2
          : markerEdgeRadius;
        // In badge mode the badge sits beside the text, centred at tickEnd.
        // Its radial extent from tickEnd must be added so labels start outside it.
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
                style={companyStyle}
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
                  strokeWidth={effectiveTrackWidth}
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
                const arcDot = fadeDotSpacing / C_RADIUS;
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
                      strokeWidth={effectiveTrackWidth}
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
                      strokeWidth={effectiveTrackWidth}
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
                          radius={fadeDotRadius}
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
                          radius={fadeDotRadius}
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
                ? snBadgeDims(!!snNum!.threeLetterCode, snNum!.style)
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
                  strokeWidthAdjust={1}
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
              const transitLayout = getHorizontalTransitLayout(
                stTransits,
                showTransitNames,
                "right",
              );
              const bw = transitLayout.width;

              const snNum = stationNumbers[station.id];
              const showSnBadge =
                stationNumberMode === "badge" && !!snNum?.value;
              const snDims = snNum
                ? snBadgeDims(!!snNum.threeLetterCode, snNum.style)
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
              const badgeBlockH =
                stTransits.length > 0 ? transitLayout.height + 3 : 0;
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
                  <HorizontalTransitLines
                    x={bRowX}
                    y={bRowY}
                    lines={stTransits}
                    side="right"
                    showNames={showTransitNames}
                    lineStyles={transitLineStyles}
                  />
                </Fragment>
              );
            })}
          </Layer>
        </Stage>
      );
    }

    // ── Multi-service horizontal layout (above or below) ─────────────────────

    if (
      multiService &&
      services &&
      orientation === "horizontal" &&
      (nameStyle === "above" || nameStyle === "below")
    ) {
      const N = services.length;
      const bundleHalfH = ((N - 1) / 2) * serviceTrackGap;

      const enWidths = stations.map((s) => {
        const sName = showSecondaryLang
          ? (s[secondaryLangField] ?? null)
          : null;
        return sName ? measureTextWidth(sName, EN_FONT) : 0;
      });
      const jpTextHeights = stations.map((s) => {
        const pName = stationName(s, primaryLangField);
        const cn = [...pName].length;
        return cn > 0 ? cn * (JP_FONT + 1) - 1 : 0;
      });
      const maxJpTextH = Math.max(1, ...jpTextHeights);
      const maxSecondaryTextH = Math.max(
        0,
        ...stations.map((station, index) => {
          const secondaryName = showSecondaryLang
            ? (station[secondaryLangField] ?? null)
            : null;
          if (!secondaryName) return 0;
          return /[a-zA-Z]/.test(secondaryName)
            ? enWidths[index]
            : [...secondaryName].length * (EN_FONT + 1) - 1;
        }),
      );
      const maxStationNameExtent = Math.max(maxJpTextH, maxSecondaryTextH);
      const transitDirection = oppositeVerticalDirection(nameStyle);
      const diagonalTransitLayouts = Object.values(transits).map((lines) =>
        getDiagonalTransitLayout(lines, showTransitNames, transitDirection),
      );
      const maxTransitExtent = Math.max(
        0,
        ...diagonalTransitLayouts.map((layout) => layout.height),
      );
      const maxTransitWidth = Math.max(
        0,
        ...diagonalTransitLayouts.map((layout) => layout.width),
      );
      const stationNumberBadgeGroups = stations.map((station) =>
        getStationNumbers(station.id),
      );
      const hasAnySnBadge =
        stationNumberMode === "badge" &&
        stationNumberBadgeGroups.some((numbers) => numbers.length > 0);
      const maxSnH = hasAnySnBadge
        ? Math.max(
            ...stationNumberBadgeGroups.map((numbers) =>
              numbers.length > 0
                ? stationNumberGroupDimensions(numbers, "horizontal").h
                : 0,
            ),
          )
        : 0;

      const nameSideExtent =
        serviceDotEdgeRadius +
        VN_DOT_GAP +
        (hasAnySnBadge ? maxSnH + VN_ITEM_GAP : 0) +
        maxStationNameExtent +
        PADDING;
      const transitSideExtent =
        serviceDotEdgeRadius + VN_DOT_GAP + maxTransitExtent + PADDING;
      const bundleSpan = (N - 1) * serviceTrackGap;
      const topSideExtent =
        nameStyle === "above" ? nameSideExtent : transitSideExtent;
      const bundleCenterY = topSideExtent + bundleHalfH;
      const rawCanvasH = nameSideExtent + bundleSpan + transitSideExtent;

      const vnFadeLen = Math.round(hSpacing / 3);
      const vnFadeExtra =
        vnFadeLen + serviceFadeDotSpacing * FADE_OPACITIES.length;
      const vnExtraL = hasMoreBefore ? vnFadeExtra : 0;
      const vnExtraR = hasMoreAfter ? vnFadeExtra : 0;

      // Extra left space to fit long service name labels (rendered at x=4, right-aligned)
      const svcLabelFontSize = 8;
      const maxSvcLabelW = Math.max(
        0,
        ...services.map((svc) => measureTextWidth(svc.name, svcLabelFontSize)),
      );
      const svcExtraL = Math.max(
        0,
        4 + maxSvcLabelW + serviceDotEdgeRadius + 10 - PADDING - vnExtraL,
      );
      // Effective track start X
      const tL = PADDING + vnExtraL + svcExtraL;

      const rawCanvasW = Math.max(
        300,
        tL +
          horizontalStationLayout.extent +
          Math.max(PADDING, maxTransitWidth + 5) +
          vnExtraR,
      );
      const { w: vnCanvasW, h: vnCanvasH } = ceilCanvasDimensions(
        rawCanvasW,
        rawCanvasH,
      );
      const d = nameStyle === "above" ? -1 : 1;
      const transitD = -d;

      // Y positions for each service track
      const trackYs = services.map(
        (_, si) => bundleCenterY + (si - (N - 1) / 2) * serviceTrackGap,
      );
      // The track whose edge is closest to the names
      const outerTrackY = nameStyle === "above" ? trackYs[0] : trackYs[N - 1];
      const transitTrackY =
        nameStyle === "above" ? trackYs[N - 1] : trackYs[0];

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
                x={tL}
                y={8}
                color={lc}
                prefix={line.prefix}
                style={companyStyle}
              />
            )}
            <Text
              x={tL + (showLineBadge ? LI_SIZE + LI_GAP : 0)}
              y={showLineBadge ? 8 + (LI_SIZE - LINE_TITLE_FONT) / 2 : 8}
              text={line.name}
              fontSize={LINE_TITLE_FONT}
              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
              fontStyle="bold"
              fill={lc}
            />

            {/* Service labels at track start (in left padding area) */}
            {services.map((svc, si) => {
              const ty = trackYs[si];
              const labelFont = svcLabelFontSize;
              // The right edge must clear the first station marker.
              const labelW = Math.max(
                20,
                tL + horizontalFirstPosition - SVC_DOT_R - 10,
              );
              return (
                <Text
                  key={`svclab-${svc.id}`}
                  x={4}
                  y={ty - labelFont / 2}
                  width={labelW}
                  text={svc.name}
                  fontSize={labelFont}
                  fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                  fill={svc.color}
                  align="right"
                />
              );
            })}

            {/* Service tracks + fade */}
            {services.map((svc, si) => {
              const ty = trackYs[si];
              return (
                <Fragment key={`svctrack-${svc.id}`}>
                  <KonvaLine
                    points={[
                      tL + horizontalFirstPosition,
                      ty,
                      tL + horizontalLastPosition,
                      ty,
                    ]}
                    stroke={svc.color}
                    strokeWidth={serviceTrackWidth}
                    lineCap="round"
                  />
                  {hasMoreBefore && (
                    <Fragment>
                      <KonvaLine
                        points={[
                          tL + horizontalFirstPosition,
                          ty,
                          tL + horizontalFirstPosition - vnFadeLen,
                          ty,
                        ]}
                        stroke={svc.color}
                        strokeWidth={serviceTrackWidth}
                        lineCap="round"
                      />
                      {FADE_OPACITIES.map((opacity, idx) => (
                        <Circle
                          key={`fb-${si}-${idx}`}
                          x={
                            tL +
                            horizontalFirstPosition -
                            vnFadeLen -
                            serviceFadeDotSpacing * (idx + 1)
                          }
                          y={ty}
                          radius={serviceFadeDotRadius}
                          fill={svc.color}
                          opacity={opacity}
                        />
                      ))}
                    </Fragment>
                  )}
                  {hasMoreAfter && (
                    <Fragment>
                      <KonvaLine
                        points={[
                          tL + horizontalLastPosition,
                          ty,
                          tL + horizontalLastPosition + vnFadeLen,
                          ty,
                        ]}
                        stroke={svc.color}
                        strokeWidth={serviceTrackWidth}
                        lineCap="round"
                      />
                      {FADE_OPACITIES.map((opacity, idx) => (
                        <Circle
                          key={`fa-${si}-${idx}`}
                          x={
                            tL +
                            horizontalLastPosition +
                            vnFadeLen +
                            serviceFadeDotSpacing * (idx + 1)
                          }
                          y={ty}
                          radius={serviceFadeDotRadius}
                          fill={svc.color}
                          opacity={opacity}
                        />
                      ))}
                    </Fragment>
                  )}
                </Fragment>
              );
            })}

            {/* Station labels + per-service dots */}
            {stations.map((station, i) => {
              const x = tL + horizontalPositions[i];
              const stopsHere = services.some(
                (svc) => !!serviceStops[station.id]?.[svc.id],
              );
              if (!showPassedStations && !stopsHere) return null;
              const stTransits = transits[station.id] ?? [];
              const primaryName = stationName(station, primaryLangField);
              const secondaryName = showSecondaryLang
                ? (station[secondaryLangField] ?? null)
                : null;
              const jpTextH = jpTextHeights[i];
              const enW = enWidths[i];

              const stationNumberGroup = getStationNumbers(station.id);
              const showSnBadge =
                stationNumberMode === "badge" &&
                stationNumberGroup.length > 0;
              const snDims = stationNumberGroup.length > 0
                ? stationNumberGroupDimensions(
                    stationNumberGroup,
                    "horizontal",
                  )
                : snBadgeDims(false);
              const stationColor = getStationColor(station, i);

              // Walk outward from the bundle's outer edge
              let cur =
                outerTrackY + d * (serviceDotEdgeRadius + VN_DOT_GAP);
              const snBadgeTopY = d === -1 ? cur - snDims.h : cur;
              if (showSnBadge) cur += d * (snDims.h + VN_ITEM_GAP);
              const jpTopY = d === -1 ? cur - jpTextH : cur;
              const enX = x + JP_FONT / 2 + 2 + EN_FONT / 2;
              const enCenterY =
                d === -1 ? jpTopY + jpTextH - enW / 2 : jpTopY + enW / 2;
              const secChars =
                secondaryName && !/[a-zA-Z]/.test(secondaryName)
                  ? [...secondaryName]
                  : [];
              const actualSecH =
                secChars.length > 0 ? secChars.length * (EN_FONT + 1) - 1 : 0;
              const secTopY = d === -1 ? jpTopY + jpTextH - actualSecH : jpTopY;
              const jpChars = [...primaryName];
              const transitAnchorX = x - TRANSIT_ICON_SIZE / 2;
              const transitAnchorY =
                transitTrackY +
                transitD * (serviceDotEdgeRadius + VN_DOT_GAP);

              return (
                <Group key={station.id} opacity={stopsHere ? 1 : 0.5}>
                  {/* Per-service dots */}
                  {services.map((svc, si) => {
                    const status = serviceStops[station.id]?.[svc.id];
                    if (!status) return null;
                    const ty = trackYs[si];
                    return status === "special" ? (
                      <Circle
                        key={`dot-${svc.id}`}
                        x={x}
                        y={ty}
                        radius={SVC_DOT_R}
                        fill={svc.color}
                      />
                    ) : (
                      <Circle
                        key={`dot-${svc.id}`}
                        x={x}
                        y={ty}
                        radius={SVC_DOT_R}
                        fill="white"
                        stroke={svc.color}
                        strokeWidth={2}
                      />
                    );
                  })}

                  <DiagonalTransitLines
                    x={transitAnchorX}
                    y={transitAnchorY}
                    lines={stTransits}
                    direction={transitDirection}
                    showNames={showTransitNames}
                    lineStyles={transitLineStyles}
                  />

                  {/* Station number badge */}
                  {showSnBadge && (
                    <StationNumberBadgeGroup
                      x={x - snDims.w / 2}
                      y={snBadgeTopY}
                      numbers={stationNumberGroup}
                      orientation="horizontal"
                      fallbackColor={stationColor}
                    />
                  )}

                  {/* JP 縦書き name */}
                  {jpChars.map((char, ci) => {
                    const charTopY = jpTopY + ci * (JP_FONT + 1);
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
                    if (shouldRotateVerticalGlyph(char)) {
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
                      />
                    );
                  })}

                  {/* Secondary name */}
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
                          if (shouldRotateVerticalGlyph(char)) {
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
                            />
                          );
                        })}
                      </Fragment>
                    ))}
                </Group>
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
      const maxSecondaryTextH = Math.max(
        0,
        ...stations.map((station, index) => {
          const secondaryName = showSecondaryLang
            ? (station[secondaryLangField] ?? null)
            : null;
          if (!secondaryName) return 0;
          return /[a-zA-Z]/.test(secondaryName)
            ? enWidths[index]
            : [...secondaryName].length * (EN_FONT + 1) - 1;
        }),
      );
      const maxStationNameExtent = Math.max(maxJpTextH, maxSecondaryTextH);
      // EN text is placed to the right of the JP block, so its width does not
      // contribute to the vertical (halfExt) calculation.

      const transitDirection = oppositeVerticalDirection(nameStyle);
      const diagonalTransitLayouts = Object.values(transits).map((lines) =>
        getDiagonalTransitLayout(lines, showTransitNames, transitDirection),
      );
      const maxTransitExtent = Math.max(
        0,
        ...diagonalTransitLayouts.map((layout) => layout.height),
      );
      const maxTransitWidth = Math.max(
        0,
        ...diagonalTransitLayouts.map((layout) => layout.width),
      );
      const hasAnySnBadge =
        stationNumberMode === "badge" &&
        stations.some((s) => !!stationNumbers[s.id]?.value);
      const maxSnH = hasAnySnBadge
        ? Math.max(
            ...stations.map((s) => {
              const snNum = stationNumbers[s.id];
              return snNum
                ? snBadgeDims(!!snNum.threeLetterCode, snNum.style).h
                : 0;
            }),
          )
        : 0;

      const stationSideExtent =
        lineExchangeEdgeRadius +
        VN_DOT_GAP +
        (hasAnySnBadge ? maxSnH + VN_ITEM_GAP : 0) +
        maxStationNameExtent +
        PADDING;
      const transitSideExtent =
        lineExchangeEdgeRadius + VN_DOT_GAP + maxTransitExtent + PADDING;

      const vnTrackY =
        nameStyle === "above" ? stationSideExtent : transitSideExtent;
      const rawCanvasH = stationSideExtent + transitSideExtent;
      const vnFadeLen = Math.round(hSpacing / 3);
      const vnFadeExtra = vnFadeLen + fadeDotSpacing * FADE_OPACITIES.length;
      const vnExtraL = hasMoreBefore ? vnFadeExtra : 0;
      const vnExtraR = hasMoreAfter ? vnFadeExtra : 0;
      const rawCanvasW = Math.max(
        300,
        PADDING +
          vnExtraL +
          horizontalStationLayout.extent +
          Math.max(PADDING, maxTransitWidth + 5) +
          vnExtraR,
      );
      const { w: vnCanvasW, h: vnCanvasH } = ceilCanvasDimensions(
        rawCanvasW,
        rawCanvasH,
      );
      // d: direction away from track (+1 = down for "below", -1 = up for "above")
      const d = nameStyle === "above" ? -1 : 1;
      const transitD = -d;

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
                style={companyStyle}
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
            {services?.length === 1 && (
              <ServiceNameLabel
                x={
                  PADDING +
                  vnExtraL +
                  (showLineBadge ? LI_SIZE + LI_GAP : 0) +
                  measureTextWidth(line.name, LINE_TITLE_FONT, "bold") +
                  4
                }
                y={showLineBadge ? 8 + (LI_SIZE - LINE_TITLE_FONT) / 2 : 8}
                name={services[0].name}
                color={services[0].color}
                style={serviceNameStyle}
              />
            )}

            {/* Track */}
            <SegmentedTrack
              stationPoints={horizontalPositions.map((position) => ({
                x: PADDING + vnExtraL + position,
                y: vnTrackY,
              }))}
              colors={trackColors}
              fallbackColor={lc}
              strokeWidth={effectiveTrackWidth}
            />

            {/* Fade extension + dots — before first station */}
            {hasMoreBefore && (
              <Fragment>
                <KonvaLine
                  points={[
                    PADDING + vnExtraL + horizontalFirstPosition,
                    vnTrackY,
                    PADDING +
                      vnExtraL +
                      horizontalFirstPosition -
                      vnFadeLen,
                    vnTrackY,
                  ]}
                  stroke={firstTrackColor}
                  strokeWidth={effectiveTrackWidth}
                  lineCap="round"
                />
                {FADE_OPACITIES.map((opacity, idx) => (
                  <Circle
                    key={`fade-before-${idx}`}
                    x={
                      PADDING +
                      vnExtraL -
                      vnFadeLen +
                      horizontalFirstPosition -
                      fadeDotSpacing * (idx + 1)
                    }
                    y={vnTrackY}
                    radius={fadeDotRadius}
                    fill={firstTrackColor}
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
                    PADDING + vnExtraL + horizontalLastPosition,
                    vnTrackY,
                    PADDING +
                      vnExtraL +
                      horizontalLastPosition +
                      vnFadeLen,
                    vnTrackY,
                  ]}
                  stroke={lastTrackColor}
                  strokeWidth={effectiveTrackWidth}
                  lineCap="round"
                />
                {FADE_OPACITIES.map((opacity, idx) => (
                  <Circle
                    key={`fade-after-${idx}`}
                    x={
                      PADDING +
                      vnExtraL +
                      horizontalLastPosition +
                      vnFadeLen +
                      fadeDotSpacing * (idx + 1)
                    }
                    y={vnTrackY}
                    radius={fadeDotRadius}
                    fill={lastTrackColor}
                    opacity={opacity}
                  />
                ))}
              </Fragment>
            )}

            {/* Stations */}
            {stations.map((station, i) => {
              const x = PADDING + vnExtraL + horizontalPositions[i];
              const stationColor = getStationColor(station, i);
              const isXchg = (transits[station.id]?.length ?? 0) > 0;
              const r = isXchg ? XCHG_R : DOT_R;
              const stTransits = transits[station.id] ?? [];

              const isPassed =
                (services?.length ?? 0) > 0 &&
                !services!.some((svc) => !!serviceStops[station.id]?.[svc.id]);
              if (!showPassedStations && isPassed) return null;

              const stationNumberGroup = getStationNumbers(station.id);
              const showSnBadge =
                stationNumberMode === "badge" && stationNumberGroup.length > 0;
              const showSnDot =
                stationNumberMode === "dot" && stationNumberGroup.length > 0;
              const snDims = stationNumberGroup.length > 0
                ? stationNumberGroupDimensions(
                    stationNumberGroup,
                    "horizontal",
                    1,
                    false,
                    showSnDot ? 1 : 0,
                  )
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
              const markerEdge = getTrackEdgeRadius(r, effectiveTrackWidth);
              const dotEdge = showSnDot
                ? Math.max(markerEdge, snDims.h / 2)
                : markerEdge;
              let cur = vnTrackY + d * dotEdge + d * VN_DOT_GAP;

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

              const snDotDims = showSnDot ? snDims : null;

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

              // For passed dot-replace: anchor badge VN_DOT_GAP away from track,
              // then push the name further out so it clears the badge.
              let passedBadgeY = 0;
              let effectiveJpTopY = jpTopY;
              let effectiveEnCenterY = enCenterY;
              let effectiveSecTopY = secTopY;
              if (isPassed && showSnDot && snDotDims) {
                if (d === -1) {
                  // "above": badge bottom sits VN_DOT_GAP above track stroke top
                  passedBadgeY =
                    vnTrackY -
                    effectiveTrackWidth / 2 -
                    VN_DOT_GAP -
                    snDotDims.h * 0.85;
                  // name bottom = badge top - VN_ITEM_GAP
                  effectiveJpTopY = passedBadgeY - VN_ITEM_GAP - jpTextH;
                } else {
                  // "below": badge top sits VN_DOT_GAP below track stroke bottom
                  passedBadgeY =
                    vnTrackY + effectiveTrackWidth / 2 + VN_DOT_GAP;
                  // name top = badge bottom + VN_ITEM_GAP
                  effectiveJpTopY =
                    passedBadgeY + snDotDims.h * 0.85 + VN_ITEM_GAP;
                }
                effectiveEnCenterY =
                  d === -1
                    ? effectiveJpTopY + jpTextH - enW / 2
                    : effectiveJpTopY + enW / 2;
                effectiveSecTopY =
                  d === -1
                    ? effectiveJpTopY + jpTextH - actualSecH
                    : effectiveJpTopY;
              }
              const transitAnchorX = x - TRANSIT_ICON_SIZE / 2;
              const transitAnchorY =
                vnTrackY +
                transitD *
                  (getTrackEdgeRadius(r, effectiveTrackWidth) + VN_DOT_GAP);

              return (
                <Fragment key={station.id}>
                  {/* Passed replace-dot badge: VN_DOT_GAP from track, centered on x */}
                  {isPassed && showSnDot && snDotDims && (
                    <StationNumberBadgeGroup
                      x={x - (snDotDims.w * 0.85) / 2}
                      y={passedBadgeY}
                      numbers={stationNumberGroup}
                      orientation="horizontal"
                      fallbackColor={stationColor}
                      badgeScale={0.85}
                      strokeWidthAdjust={1}
                    />
                  )}
                  {/* SN badge (badge mode) for passed stations — full opacity outside the faded group */}
                  {isPassed && showSnBadge && (
                    <StationNumberBadgeGroup
                      x={x - (snDims.w * 0.85) / 2}
                      y={snBadgeY + (snDims.h * (1 - 0.85)) / 2}
                      numbers={stationNumberGroup}
                      orientation="horizontal"
                      fallbackColor={stationColor}
                      badgeScale={0.85}
                    />
                  )}
                  <Group opacity={isPassed ? 0.5 : 1}>
                    {/* Dot or SN dot badge (non-passed only) */}
                    {!isPassed &&
                      (showSnDot && snDotDims ? (
                        <StationNumberBadgeGroup
                          x={x - snDotDims.w / 2}
                          y={vnTrackY - snDotDims.h / 2}
                          numbers={stationNumberGroup}
                          orientation="horizontal"
                          fallbackColor={stationColor}
                          strokeWidthAdjust={1}
                        />
                      ) : (
                        <Circle
                          x={x}
                          y={vnTrackY}
                          radius={r}
                          fill="white"
                          stroke={stationColor}
                          strokeWidth={isXchg ? 3 : 2}
                        />
                      ))}

                    <DiagonalTransitLines
                      x={transitAnchorX}
                      y={transitAnchorY}
                      lines={stTransits}
                      direction={transitDirection}
                      showNames={showTransitNames}
                      lineStyles={transitLineStyles}
                    />

                    {/* SN badge (badge mode) — upright, centered on x; passed case rendered above */}
                    {!isPassed && showSnBadge && (
                      <StationNumberBadgeGroup
                        x={x - snDims.w / 2}
                        y={snBadgeY}
                        numbers={stationNumberGroup}
                        orientation="horizontal"
                        fallbackColor={stationColor}
                      />
                    )}

                    {/* JP name — 縦書き: each character stacked top-to-bottom.
                      Horizontal glyphs (ー, 〜, …) are rotated 90° around
                      their cell centre so they render as vertical strokes. */}
                    {jpChars.map((char, ci) => {
                      const charTopY = effectiveJpTopY + ci * (JP_FONT + 1);
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
                      if (shouldRotateVerticalGlyph(char)) {
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
                        />
                      );
                    })}

                    {/* Secondary name — rotated 90° for Latin text, stacked vertically for CJK.
                      CJK path rotates vertical glyphs (ー, brackets, etc.) and applies VJ_LINE_WIDTHS to dashes. */}
                    {secondaryName &&
                      (/[a-zA-Z]/.test(secondaryName) ? (
                        <Text
                          x={enX}
                          y={effectiveEnCenterY}
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
                            const charTopY =
                              effectiveSecTopY + ci * (EN_FONT + 1);
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
                            if (shouldRotateVerticalGlyph(char)) {
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
                              />
                            );
                          })}
                        </Fragment>
                      ))}
                  </Group>
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
      const hFadeExtra = hFadeLen + fadeDotSpacing * FADE_OPACITIES.length;
      const hExtraL = hasMoreBefore ? hFadeExtra : 0;
      const hExtraR = hasMoreAfter ? hFadeExtra : 0;
      const rawCanvasW = Math.max(
        300,
        PADDING +
          hExtraL +
          horizontalStationLayout.extent +
          PADDING +
          hExtraR,
      );
      const { w: canvasW, h: canvasH } = ceilCanvasDimensions(
        rawCanvasW,
        H_HEIGHT,
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
                x={PADDING + hExtraL}
                y={8}
                color={lc}
                prefix={line.prefix}
                style={companyStyle}
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
            {services?.length === 1 && (
              <ServiceNameLabel
                x={
                  PADDING +
                  hExtraL +
                  (showLineBadge ? LI_SIZE + LI_GAP : 0) +
                  measureTextWidth(line.name, LINE_TITLE_FONT, "bold") +
                  4
                }
                y={showLineBadge ? 8 + (LI_SIZE - LINE_TITLE_FONT) / 2 : 8}
                name={services[0].name}
                color={services[0].color}
                style={serviceNameStyle}
              />
            )}

            {/* Track */}
            <SegmentedTrack
              stationPoints={horizontalPositions.map((position) => ({
                x: PADDING + hExtraL + position,
                y: H_TRACK_Y,
              }))}
              colors={trackColors}
              fallbackColor={lc}
              strokeWidth={effectiveTrackWidth}
            />

            {/* Fade extension + dots — before first station */}
            {hasMoreBefore && (
              <Fragment>
                <KonvaLine
                  points={[
                    PADDING + hExtraL + horizontalFirstPosition,
                    H_TRACK_Y,
                    PADDING +
                      hExtraL +
                      horizontalFirstPosition -
                      hFadeLen,
                    H_TRACK_Y,
                  ]}
                  stroke={firstTrackColor}
                  strokeWidth={effectiveTrackWidth}
                  lineCap="round"
                />
                {FADE_OPACITIES.map((opacity, idx) => (
                  <Circle
                    key={`fade-before-${idx}`}
                    x={
                      PADDING +
                      hExtraL -
                      hFadeLen +
                      horizontalFirstPosition -
                      fadeDotSpacing * (idx + 1)
                    }
                    y={H_TRACK_Y}
                    radius={fadeDotRadius}
                    fill={firstTrackColor}
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
                    PADDING + hExtraL + horizontalLastPosition,
                    H_TRACK_Y,
                    PADDING +
                      hExtraL +
                      horizontalLastPosition +
                      hFadeLen,
                    H_TRACK_Y,
                  ]}
                  stroke={lastTrackColor}
                  strokeWidth={effectiveTrackWidth}
                  lineCap="round"
                />
                {FADE_OPACITIES.map((opacity, idx) => (
                  <Circle
                    key={`fade-after-${idx}`}
                    x={
                      PADDING +
                      hExtraL +
                      horizontalLastPosition +
                      hFadeLen +
                      fadeDotSpacing * (idx + 1)
                    }
                    y={H_TRACK_Y}
                    radius={fadeDotRadius}
                    fill={lastTrackColor}
                    opacity={opacity}
                  />
                ))}
              </Fragment>
            )}

            {/* Stations */}
            {stations.map((station, i) => {
              const x = PADDING + hExtraL + horizontalPositions[i];
              const stationColor = getStationColor(station, i);
              const isXchg = (transits[station.id]?.length ?? 0) > 0;
              const r = isXchg ? XCHG_R : DOT_R;
              const above = i % 2 === 0;
              const stTransits = transits[station.id] ?? [];
              const transitLayout = getHorizontalTransitLayout(
                stTransits,
                showTransitNames,
                "right",
              );
              const bw = transitLayout.width;

              const isPassed =
                (services?.length ?? 0) > 0 &&
                !services!.some((svc) => !!serviceStops[station.id]?.[svc.id]);
              if (!showPassedStations && isPassed) return null;

              const stationNumberGroup = getStationNumbers(station.id);
              const showSnBadge =
                stationNumberMode === "badge" && stationNumberGroup.length > 0;
              const showSnDot =
                stationNumberMode === "dot" && stationNumberGroup.length > 0;

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
              const enH = secondaryName ? EN_FONT : 0;
              const transitH = stTransits.length > 0 ? transitLayout.height : 0;

              // Dot replacement: center badge on the dot position
              const snDims = stationNumberGroup.length > 0
                ? stationNumberGroupDimensions(
                    stationNumberGroup,
                    "horizontal",
                    1,
                    false,
                    showSnDot ? 1 : 0,
                  )
                : snBadgeDims(false);
              const snDotDims = showSnDot ? snDims : null;

              // When replacing the dot with a badge, use the badge half-height
              // as the effective radius so text doesn't overlap the badge.
              const markerEdgeRadius = getTrackEdgeRadius(
                r,
                effectiveTrackWidth,
              );
              const effectiveDotR = snDotDims
                ? Math.max(markerEdgeRadius, snDotDims.h / 2)
                : markerEdgeRadius;

              // The station-name block stays nearest the marker. Transfer lines
              // are stacked beyond the names, away from the track.
              // In badge mode the SN badge is inserted between the dot and the rest of the labels,
              // centered on the station x.
              let jpNameY: number;
              let enNameY: number;
              let badgeRowY: number;
              let snBadgeX: number;
              let snBadgeY: number;

              if (showSnBadge) {
                // Badge mode: SN badge sits directly adjacent to the dot; labels stack beyond it.
                snBadgeX = x - snDims.w / 2;
                if (above) {
                  snBadgeY =
                    H_TRACK_Y - markerEdgeRadius - 8 - snDims.h;
                  const details = layoutHorizontalStationDetails(
                    "above",
                    snBadgeY,
                    SN_BADGE_GAP,
                    jpH,
                    enH,
                    transitH,
                  );
                  jpNameY = details.primaryNameY;
                  enNameY = details.secondaryNameY;
                  badgeRowY = details.transitY;
                } else {
                  snBadgeY = H_TRACK_Y + markerEdgeRadius + 8;
                  const details = layoutHorizontalStationDetails(
                    "below",
                    snBadgeY + snDims.h,
                    SN_BADGE_GAP,
                    jpH,
                    enH,
                    transitH,
                  );
                  jpNameY = details.primaryNameY;
                  enNameY = details.secondaryNameY;
                  badgeRowY = details.transitY;
                }
              } else {
                snBadgeX = 0;
                snBadgeY = 0;
                const details = layoutHorizontalStationDetails(
                  above ? "above" : "below",
                  above
                    ? H_TRACK_Y - effectiveDotR
                    : H_TRACK_Y + effectiveDotR,
                  above ? 8 : 6,
                  jpH,
                  enH,
                  transitH,
                );
                jpNameY = details.primaryNameY;
                enNameY = details.secondaryNameY;
                badgeRowY = details.transitY;
              }

              return (
                <Fragment key={station.id}>
                  {/* Passed replace-dot badge: full opacity, 0.85 scale, left of JP name */}
                  {isPassed && showSnDot && snDotDims && (
                    <StationNumberBadgeGroup
                      x={
                        x - (jpW * 0.85) / 2 - SN_BADGE_GAP - snDotDims.w * 0.85
                      }
                      y={
                        jpNameY +
                        (JP_FONT * 0.85) / 2 -
                        (snDotDims.h * 0.85) / 2
                      }
                      numbers={stationNumberGroup}
                      orientation="horizontal"
                      fallbackColor={stationColor}
                      badgeScale={0.85}
                      strokeWidthAdjust={1}
                    />
                  )}
                  {/* SN badge (badge mode) for passed stations — full opacity outside the faded group */}
                  {isPassed && showSnBadge && (
                    <StationNumberBadgeGroup
                      x={snBadgeX + (snDims.w * (1 - 0.85)) / 2}
                      y={snBadgeY + (snDims.h * (1 - 0.85)) / 2}
                      numbers={stationNumberGroup}
                      orientation="horizontal"
                      fallbackColor={stationColor}
                      badgeScale={0.85}
                    />
                  )}
                  <Group opacity={isPassed ? 0.5 : 1}>
                    {/* Dot or replace-dot badge (non-passed only) */}
                    {!isPassed &&
                      (showSnDot && snDotDims ? (
                        <StationNumberBadgeGroup
                          x={x - snDotDims.w / 2}
                          y={H_TRACK_Y - snDotDims.h / 2}
                          numbers={stationNumberGroup}
                          orientation="horizontal"
                          fallbackColor={stationColor}
                          strokeWidthAdjust={1}
                        />
                      ) : (
                        <Circle
                          x={x}
                          y={H_TRACK_Y}
                          radius={r}
                          fill="white"
                          stroke={stationColor}
                          strokeWidth={isXchg ? 3 : 2}
                        />
                      ))}

                    {/* SN badge inline to the left of the JP name; passed case rendered above */}
                    {!isPassed && showSnBadge && (
                      <StationNumberBadgeGroup
                        x={snBadgeX}
                        y={snBadgeY}
                        numbers={stationNumberGroup}
                        orientation="horizontal"
                        fallbackColor={stationColor}
                      />
                    )}

                    {/* Primary name — centered on station x */}
                    <Text
                      x={x - (jpW * (isPassed ? 0.85 : 1)) / 2}
                      y={jpNameY}
                      text={primaryName}
                      fontSize={isPassed ? Math.round(JP_FONT * 0.85) : JP_FONT}
                      fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                      fill="#222"
                    />

                    {/* Secondary name — centered on station x */}
                    {secondaryName && (
                      <Text
                        x={x - (enW * (isPassed ? 0.85 : 1)) / 2}
                        y={enNameY}
                        text={secondaryName}
                        fontSize={
                          isPassed ? Math.round(EN_FONT * 0.85) : EN_FONT
                        }
                        fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                        fill="#666"
                      />
                    )}

                    <HorizontalTransitLines
                      x={x - bw / 2}
                      y={badgeRowY}
                      lines={stTransits}
                      side="right"
                      showNames={showTransitNames}
                      lineStyles={transitLineStyles}
                    />
                  </Group>
                </Fragment>
              );
            })}
          </Layer>
        </Stage>
      );
    }

    // ── Multi-service vertical layout ────────────────────────────────────────

    if (multiService && services) {
      const N = services.length;
      const bundleHalfW = ((N - 1) / 2) * serviceTrackGap;

      const maxTransitWidth = Math.max(
        0,
        ...Object.values(transits).map(
          (lines) =>
            getHorizontalTransitLayout(
              lines,
              showTransitNames,
              verticalNameSide,
            ).width,
        ),
      );
      const maxNameW = 130;
      const rawCanvasW = Math.max(
        200,
        V_TRACK_X +
          bundleHalfW +
          serviceExchangeEdgeRadius +
          10 +
          maxTransitWidth +
          (maxTransitWidth > 0 ? 8 : 0) +
          maxNameW +
          V_RIGHT_MARGIN,
      );

      const vFadeLen = Math.round(vSpacing / 3);
      const vFadeExtra =
        vFadeLen + serviceFadeDotSpacing * FADE_OPACITIES.length;
      const vExtraT = hasMoreBefore ? vFadeExtra : 0;
      const vExtraB = hasMoreAfter ? vFadeExtra : 0;
      const rawCanvasH = Math.max(
        200,
        PADDING +
          vExtraT +
          verticalStationLayout.extent +
          PADDING +
          vExtraB,
      );
      const { w: canvasW, h: canvasH } = ceilCanvasDimensions(
        rawCanvasW,
        rawCanvasH,
      );

      // Bundle centre X
      const bundleCenterX =
        verticalNameSide === "left" ? rawCanvasW - V_TRACK_X : V_TRACK_X;
      // Track X for each service
      const trackXs = services.map(
        (_, si) => bundleCenterX + (si - (N - 1) / 2) * serviceTrackGap,
      );
      // Outermost track (farthest from names)
      const outerTrackX =
        verticalNameSide === "left" ? trackXs[0] : trackXs[N - 1];

      // Title and legend on the name side
      const titleBaseX =
        verticalNameSide === "left"
          ? V_RIGHT_MARGIN
          : bundleCenterX +
            bundleHalfW +
            serviceExchangeEdgeRadius +
            10;

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
                x={titleBaseX}
                y={8}
                color={lc}
                prefix={line.prefix}
                style={companyStyle}
              />
            )}
            <Text
              x={titleBaseX + (showLineBadge ? LI_SIZE + LI_GAP : 0)}
              y={showLineBadge ? 8 + (LI_SIZE - LINE_TITLE_FONT) / 2 : 8}
              text={line.name}
              fontSize={LINE_TITLE_FONT}
              fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
              fontStyle="bold"
              fill={lc}
            />

            {/* Service labels at track start — 縦書き, above first dot */}
            {services.map((svc, si) => {
              const tx = trackXs[si];
              const topY = PADDING + vExtraT + verticalFirstPosition;
              const labelFont = 9;
              const charH = labelFont + 1;
              const chars = [...svc.name];
              const textHeight =
                chars.length > 0 ? chars.length * charH - 1 : 0;
              const startY = topY - SVC_DOT_R - 4 - textHeight;
              return (
                <Fragment key={`svclab-${svc.id}`}>
                  {chars.map((char, ci) => {
                    const charTopY = startY + ci * charH;
                    if (char in VJ_LINE_WIDTHS) {
                      const barLen = VJ_LINE_WIDTHS[char] * labelFont;
                      return (
                        <Rect
                          key={ci}
                          x={tx - 0.5}
                          y={charTopY + (labelFont - barLen) / 2}
                          width={1}
                          height={barLen}
                          fill={svc.color}
                        />
                      );
                    }
                    if (shouldRotateVerticalGlyph(char)) {
                      return (
                        <Text
                          key={ci}
                          x={tx}
                          y={charTopY + labelFont / 2}
                          offsetX={labelFont / 2}
                          offsetY={labelFont / 2}
                          rotation={90}
                          text={char}
                          fontSize={labelFont}
                          fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                          fill={svc.color}
                          width={labelFont}
                          align="center"
                        />
                      );
                    }
                    return (
                      <Text
                        key={ci}
                        x={tx - labelFont / 2}
                        y={charTopY}
                        text={char}
                        fontSize={labelFont}
                        fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                        fill={svc.color}
                        width={labelFont}
                        align="center"
                      />
                    );
                  })}
                </Fragment>
              );
            })}

            {/* Service tracks + fade */}
            {services.map((svc, si) => {
              const tx = trackXs[si];
              return (
                <Fragment key={`svctrack-${svc.id}`}>
                  <KonvaLine
                    points={[
                      tx,
                      PADDING + vExtraT + verticalFirstPosition,
                      tx,
                      PADDING + vExtraT + verticalLastPosition,
                    ]}
                    stroke={svc.color}
                    strokeWidth={serviceTrackWidth}
                    lineCap="round"
                  />
                  {hasMoreBefore && (
                    <Fragment>
                      <KonvaLine
                        points={[
                          tx,
                          PADDING + vExtraT + verticalFirstPosition,
                          tx,
                          PADDING + vExtraT + verticalFirstPosition - vFadeLen,
                        ]}
                        stroke={svc.color}
                        strokeWidth={serviceTrackWidth}
                        lineCap="round"
                      />
                      {FADE_OPACITIES.map((opacity, idx) => (
                        <Circle
                          key={`fb-${si}-${idx}`}
                          x={tx}
                          y={
                            PADDING +
                            vExtraT +
                            verticalFirstPosition -
                            vFadeLen -
                            serviceFadeDotSpacing * (idx + 1)
                          }
                          radius={serviceFadeDotRadius}
                          fill={svc.color}
                          opacity={opacity}
                        />
                      ))}
                    </Fragment>
                  )}
                  {hasMoreAfter && (
                    <Fragment>
                      <KonvaLine
                        points={[
                          tx,
                          PADDING + vExtraT + verticalLastPosition,
                          tx,
                          PADDING +
                            vExtraT +
                            verticalLastPosition +
                            vFadeLen,
                        ]}
                        stroke={svc.color}
                        strokeWidth={serviceTrackWidth}
                        lineCap="round"
                      />
                      {FADE_OPACITIES.map((opacity, idx) => (
                        <Circle
                          key={`fa-${si}-${idx}`}
                          x={tx}
                          y={
                            PADDING +
                            vExtraT +
                            verticalLastPosition +
                            vFadeLen +
                            serviceFadeDotSpacing * (idx + 1)
                          }
                          radius={serviceFadeDotRadius}
                          fill={svc.color}
                          opacity={opacity}
                        />
                      ))}
                    </Fragment>
                  )}
                </Fragment>
              );
            })}

            {/* Stations */}
            {stations.map((station, i) => {
              const y = PADDING + vExtraT + verticalPositions[i];
              const stopsHere = services.some(
                (svc) => !!serviceStops[station.id]?.[svc.id],
              );
              if (!showPassedStations && !stopsHere) return null;
              const stTransits = transits[station.id] ?? [];
              const transitLayout = getHorizontalTransitLayout(
                stTransits,
                showTransitNames,
                verticalNameSide,
              );

              const stationNumberGroup = getStationNumbers(station.id);
              const showSnBadge =
                stationNumberMode === "badge" &&
                stationNumberGroup.length > 0;
              const snDims = stationNumberGroup.length > 0
                ? stationNumberGroupDimensions(stationNumberGroup, "vertical")
                : snBadgeDims(false);
              const stationColor = getStationColor(station, i);

              const jpNameY = y - JP_FONT / 2;
              const enNameY = jpNameY + JP_FONT + 1;
              const primaryName = stationName(station, primaryLangField);
              const secondaryName =
                showSecondaryLang && station[secondaryLangField]
                  ? station[secondaryLangField]!
                  : null;
              const nameBlockWidth = Math.max(
                measureTextWidth(primaryName, JP_FONT),
                secondaryName ? measureTextWidth(secondaryName, EN_FONT) : 0,
              );

              // Name/badge positions — same as single-service vertical,
              // but using outermost track as the boundary
              const innerBoundary =
                verticalNameSide === "right"
                  ? outerTrackX + serviceDotEdgeRadius + 10
                  : outerTrackX - serviceDotEdgeRadius - 10;
              const detailsLayout = layoutVerticalStationDetails(
                verticalNameSide,
                innerBoundary,
                showSnBadge ? snDims.w : 0,
                nameBlockWidth,
                stTransits.length > 0,
              );
              const transitAnchorX = detailsLayout.transitAnchorX;
              const snBadgeX = detailsLayout.badgeX;
              const nameX = detailsLayout.nameX;
              const nameTextWidth =
                verticalNameSide === "left" ? nameBlockWidth : undefined;
              const nameAlign: "left" | "right" =
                verticalNameSide === "left" ? "right" : "left";

              return (
                <Group key={station.id} opacity={stopsHere ? 1 : 0.5}>
                  {/* Per-service dots */}
                  {services.map((svc, si) => {
                    const status = serviceStops[station.id]?.[svc.id];
                    if (!status) return null;
                    const tx = trackXs[si];
                    return status === "special" ? (
                      <Circle
                        key={`dot-${svc.id}`}
                        x={tx}
                        y={y}
                        radius={SVC_DOT_R}
                        fill={svc.color}
                      />
                    ) : (
                      <Circle
                        key={`dot-${svc.id}`}
                        x={tx}
                        y={y}
                        radius={SVC_DOT_R}
                        fill="white"
                        stroke={svc.color}
                        strokeWidth={2}
                      />
                    );
                  })}

                  <HorizontalTransitLines
                    x={transitAnchorX}
                    y={y - transitLayout.height / 2}
                    lines={stTransits}
                    side={verticalNameSide}
                    showNames={showTransitNames}
                    lineStyles={transitLineStyles}
                  />

                  {/* Station number badge */}
                  {showSnBadge && (
                    <StationNumberBadgeGroup
                      x={snBadgeX}
                      y={y - snDims.h / 2}
                      numbers={stationNumberGroup}
                      orientation="vertical"
                      fallbackColor={stationColor}
                    />
                  )}

                  {/* Primary name */}
                  <Text
                    x={nameX}
                    y={jpNameY}
                    text={primaryName}
                    fontSize={JP_FONT}
                    fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                    fill="#222"
                    align={nameAlign}
                    width={nameTextWidth}
                    wrap="none"
                  />

                  {/* Secondary name */}
                  {secondaryName && (
                    <Text
                      x={nameX}
                      y={enNameY}
                      text={secondaryName}
                      fontSize={EN_FONT}
                      fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                      fill="#666"
                      align={nameAlign}
                      width={nameTextWidth}
                      wrap="none"
                    />
                  )}
                </Group>
              );
            })}
          </Layer>
        </Stage>
      );
    }

    // ── Vertical linear layout ────────────────────────────────────────────

    // Compute canvas width based on the widest transfer block + station name.
    const maxTransitWidth = Math.max(
      0,
      ...Object.values(transits).map(
        (lines) =>
          getHorizontalTransitLayout(
            lines,
            showTransitNames,
            verticalNameSide,
          ).width,
      ),
    );
    const maxNameW = 130;
    const rawCanvasW = Math.max(
      200,
      V_TRACK_X +
        lineExchangeEdgeRadius +
        10 +
        maxTransitWidth +
        (maxTransitWidth > 0 ? 8 : 0) +
        maxNameW +
        V_RIGHT_MARGIN,
    );
    const vFadeLen = Math.round(vSpacing / 3);
    const vFadeExtra = vFadeLen + fadeDotSpacing * FADE_OPACITIES.length;
    const vExtraT = hasMoreBefore ? vFadeExtra : 0;
    const vExtraB = hasMoreAfter ? vFadeExtra : 0;
    const rawCanvasH = Math.max(
      200,
      PADDING +
        vExtraT +
        verticalStationLayout.extent +
        PADDING +
        vExtraB,
    );
    const { w: canvasW, h: canvasH } = ceilCanvasDimensions(
      rawCanvasW,
      rawCanvasH,
    );

    // Track x position depends on name side
    const trackX =
      verticalNameSide === "left" ? rawCanvasW - V_TRACK_X : V_TRACK_X;
    // Title starts on the same side as the names
    const titleBaseX =
      verticalNameSide === "left"
        ? V_RIGHT_MARGIN
        : V_TRACK_X + lineExchangeEdgeRadius + 10;

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
              x={titleBaseX}
              y={8}
              color={lc}
              prefix={line.prefix}
              style={companyStyle}
            />
          )}
          <Text
            x={titleBaseX + (showLineBadge ? LI_SIZE + LI_GAP : 0)}
            y={showLineBadge ? 8 + (LI_SIZE - LINE_TITLE_FONT) / 2 : 8}
            text={line.name}
            fontSize={LINE_TITLE_FONT}
            fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
            fontStyle="bold"
            fill={lc}
          />
          {services?.length === 1 && (
            <ServiceNameLabel
              x={
                titleBaseX +
                (showLineBadge ? LI_SIZE + LI_GAP : 0) +
                measureTextWidth(line.name, LINE_TITLE_FONT, "bold") +
                4
              }
              y={showLineBadge ? 8 + (LI_SIZE - LINE_TITLE_FONT) / 2 : 8}
              name={services[0].name}
              color={services[0].color}
              style={serviceNameStyle}
            />
          )}

          {/* Track */}
          <SegmentedTrack
            stationPoints={verticalPositions.map((position) => ({
              x: trackX,
              y: PADDING + vExtraT + position,
            }))}
            colors={trackColors}
            fallbackColor={lc}
            strokeWidth={effectiveTrackWidth}
          />

          {/* Fade extension + dots — before first station */}
          {hasMoreBefore && (
            <Fragment>
              <KonvaLine
                points={[
                  trackX,
                  PADDING + vExtraT + verticalFirstPosition,
                  trackX,
                  PADDING +
                    vExtraT +
                    verticalFirstPosition -
                    vFadeLen,
                ]}
                stroke={firstTrackColor}
                strokeWidth={effectiveTrackWidth}
                lineCap="round"
              />
              {FADE_OPACITIES.map((opacity, idx) => (
                <Circle
                  key={`fade-before-${idx}`}
                  x={trackX}
                  y={
                    PADDING +
                    vExtraT +
                    verticalFirstPosition -
                    vFadeLen -
                    fadeDotSpacing * (idx + 1)
                  }
                  radius={fadeDotRadius}
                  fill={firstTrackColor}
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
                  trackX,
                  PADDING + vExtraT + verticalLastPosition,
                  trackX,
                  PADDING +
                    vExtraT +
                    verticalLastPosition +
                    vFadeLen,
                ]}
                stroke={lastTrackColor}
                strokeWidth={effectiveTrackWidth}
                lineCap="round"
              />
              {FADE_OPACITIES.map((opacity, idx) => (
                <Circle
                  key={`fade-after-${idx}`}
                  x={trackX}
                  y={
                    PADDING +
                    vExtraT +
                    verticalLastPosition +
                    vFadeLen +
                    fadeDotSpacing * (idx + 1)
                  }
                  radius={fadeDotRadius}
                  fill={lastTrackColor}
                  opacity={opacity}
                />
              ))}
            </Fragment>
          )}

          {/* Stations */}
          {stations.map((station, i) => {
            const y = PADDING + vExtraT + verticalPositions[i];
            const stationColor = getStationColor(station, i);
            const isXchg = (transits[station.id]?.length ?? 0) > 0;
            const r = isXchg ? XCHG_R : DOT_R;
            const stTransits = transits[station.id] ?? [];
            const transitLayout = getHorizontalTransitLayout(
              stTransits,
              showTransitNames,
              verticalNameSide,
            );

            const isPassed =
              (services?.length ?? 0) > 0 &&
              !services!.some((svc) => !!serviceStops[station.id]?.[svc.id]);
            if (!showPassedStations && isPassed) return null;

            const stationNumberGroup = getStationNumbers(station.id);
            const showSnBadge =
              stationNumberMode === "badge" && stationNumberGroup.length > 0;
            const showSnDot =
              stationNumberMode === "dot" && stationNumberGroup.length > 0;
            const snDims = stationNumberGroup.length > 0
              ? stationNumberGroupDimensions(
                  stationNumberGroup,
                  "vertical",
                  1,
                  false,
                  showSnDot ? 1 : 0,
                )
              : snBadgeDims(false);

            const jpNameY = y - JP_FONT / 2;
            const enNameY = jpNameY + JP_FONT + 1;
            const primaryName = stationName(station, primaryLangField);
            const secondaryName =
              showSecondaryLang && station[secondaryLangField]
                ? station[secondaryLangField]!
                : null;
            const primaryFontSize = isPassed
              ? Math.round(JP_FONT * 0.85)
              : JP_FONT;
            const secondaryFontSize = isPassed
              ? Math.round(EN_FONT * 0.85)
              : EN_FONT;
            const nameBlockWidth = Math.max(
              measureTextWidth(primaryName, primaryFontSize),
              secondaryName
                ? measureTextWidth(secondaryName, secondaryFontSize)
                : 0,
            );

            // Dot replacement: center badge on the dot position
            const snDotDims = showSnDot ? snDims : null;

            // ── Layout: name side determines badge/name x positions ──
            const innerBoundary =
              verticalNameSide === "right"
                ? trackX + getTrackEdgeRadius(r, effectiveTrackWidth) + 10
                : trackX - getTrackEdgeRadius(r, effectiveTrackWidth) - 10;
            const detailsLayout = layoutVerticalStationDetails(
              verticalNameSide,
              innerBoundary,
              showSnBadge ? snDims.w : 0,
              nameBlockWidth,
              stTransits.length > 0,
            );
            let transitAnchorX = detailsLayout.transitAnchorX;
            const snBadgeX = detailsLayout.badgeX;
            const nameX = detailsLayout.nameX;
            const nameTextWidth =
              verticalNameSide === "left" ? nameBlockWidth : undefined;
            const nameAlign: "left" | "right" =
              verticalNameSide === "left" ? "right" : "left";

            // Passed dot-replace layout: badge sits between track and name.
            // Right side: badge just right of track, name further right.
            // Left side: badge just left of track, name to the left of badge.
            let passedDotX = 0;
            let effectiveNameX = nameX;
            let effectiveNameTextWidth = nameTextWidth;
            if (isPassed && showSnDot && snDotDims) {
              const passedInnerBoundary =
                verticalNameSide === "right"
                  ? trackX +
                    getTrackEdgeRadius(r, effectiveTrackWidth) +
                    SN_BADGE_GAP
                  : trackX -
                    getTrackEdgeRadius(r, effectiveTrackWidth) -
                    SN_BADGE_GAP;
              const passedDetailsLayout = layoutVerticalStationDetails(
                verticalNameSide,
                passedInnerBoundary,
                snDotDims.w * 0.85,
                nameBlockWidth,
                stTransits.length > 0,
              );
              passedDotX = passedDetailsLayout.badgeX;
              effectiveNameX = passedDetailsLayout.nameX;
              effectiveNameTextWidth =
                verticalNameSide === "left" ? nameBlockWidth : undefined;
              transitAnchorX = passedDetailsLayout.transitAnchorX;
            }

            return (
              <Fragment key={station.id}>
                {/* Passed replace-dot badge: between track and name, clear of track line */}
                {isPassed && showSnDot && snDotDims && (
                  <StationNumberBadgeGroup
                    x={passedDotX}
                    y={y - (snDotDims.h * 0.85) / 2}
                    numbers={stationNumberGroup}
                    orientation="vertical"
                    fallbackColor={stationColor}
                    badgeScale={0.85}
                    strokeWidthAdjust={1}
                  />
                )}
                {/* SN badge (badge mode) for passed stations — full opacity outside the faded group */}
                {isPassed && showSnBadge && (
                  <StationNumberBadgeGroup
                    x={snBadgeX + (snDims.w * (1 - 0.85)) / 2}
                    y={y - (snDims.h * 0.85) / 2}
                    numbers={stationNumberGroup}
                    orientation="vertical"
                    fallbackColor={stationColor}
                    badgeScale={0.85}
                  />
                )}
                <Group opacity={isPassed ? 0.5 : 1}>
                  {!isPassed &&
                    (showSnDot && snDotDims ? (
                      <StationNumberBadgeGroup
                        x={trackX - snDotDims.w / 2}
                        y={y - snDotDims.h / 2}
                        numbers={stationNumberGroup}
                        orientation="vertical"
                        fallbackColor={stationColor}
                        strokeWidthAdjust={1}
                      />
                    ) : (
                      <Circle
                        x={trackX}
                        y={y}
                        radius={r}
                        fill="white"
                        stroke={stationColor}
                        strokeWidth={isXchg ? 3 : 2}
                      />
                    ))}

                  <HorizontalTransitLines
                    x={transitAnchorX}
                    y={y - transitLayout.height / 2}
                    lines={stTransits}
                    side={verticalNameSide}
                    showNames={showTransitNames}
                    lineStyles={transitLineStyles}
                  />

                  {/* Station number badge; passed case rendered above */}
                  {!isPassed && showSnBadge && (
                    <StationNumberBadgeGroup
                      x={snBadgeX}
                      y={y - snDims.h / 2}
                      numbers={stationNumberGroup}
                      orientation="vertical"
                      fallbackColor={stationColor}
                    />
                  )}

                  {/* Primary name */}
                  <Text
                    x={effectiveNameX}
                    y={jpNameY}
                    text={primaryName}
                    fontSize={primaryFontSize}
                    fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                    fill="#222"
                    align={nameAlign}
                    width={effectiveNameTextWidth}
                    wrap="none"
                  />

                  {/* Secondary name */}
                  {secondaryName && (
                    <Text
                      x={effectiveNameX}
                      y={enNameY}
                      text={secondaryName}
                      fontSize={secondaryFontSize}
                      fontFamily="NotoSansJP, Noto Sans JP, sans-serif"
                      fill="#666"
                      align={nameAlign}
                      width={effectiveNameTextWidth}
                      wrap="none"
                    />
                  )}
                </Group>
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
