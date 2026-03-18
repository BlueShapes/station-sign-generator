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

export interface LineMapRendererProps {
  stations: Station[];
  line: Line;
  isLoop: boolean;
  /** Ignored when isLoop is true; circular lines are always rendered as a circle */
  orientation: "horizontal" | "vertical";
  /** Map from stationId to the other lines serving that station */
  transits: Record<string, Line[]>;
  /** JP font size for the circular layout only (default: JP_FONT) */
  circularFontSize?: number;
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
    const stagger = i % 2 === 0 ? 0 : C_STAGGER;
    const labelR = C_RADIUS + r + C_TICK_LEN + stagger;
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
): { w: number; h: number } {
  if (isLoop) return { w: C_SIZE, h: C_SIZE };
  const n = stationCount;
  if (orientation === "horizontal") {
    return {
      w: Math.max(300, PADDING * 2 + (n - 1) * H_SPACING),
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
    h: Math.max(200, PADDING * 2 + (n - 1) * V_SPACING),
  };
}

/** Returns primary names of stations whose labels overlap another label. */
export function detectCircularOverlaps(
  stations: Station[],
  transits: Record<string, Line[]>,
  jpFont: number,
): string[] {
  const bounds = computeCircularBounds(stations, transits, jpFont);
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
const JP_FONT = 9;
const EN_FONT = 6;
const LINE_TITLE_FONT = 12;
const BADGE_H = 8;
const BADGE_W = 22;
const BADGE_GAP = 2;

// Horizontal
const H_SPACING = 90;
const H_HEIGHT = 210;
const H_TRACK_Y = 105;

// Vertical
const V_SPACING = 62;
const V_TRACK_X = 50;
const V_RIGHT_MARGIN = 30;

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

// ── Helper: measure rendered text width via Konva ───────────────────────────

function measureTextWidth(
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
    { stations, line, isLoop, orientation, transits, circularFontSize },
    ref,
  ) => {
    const [stageKey, setStageKey] = useState(0);

    // Re-render once fonts are ready (same pattern as JrEastSign)
    useEffect(() => {
      document.fonts.ready.then(() => setStageKey((k) => k + 1));
    }, []);

    // Also re-key when data changes so Konva re-renders correctly
    useEffect(() => {
      setStageKey((k) => k + 1);
    }, [stations, line.id, orientation, isLoop]);

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

        // Alternate label radii to stagger adjacent stations and prevent overlap
        const stagger = i % 2 === 0 ? 0 : C_STAGGER;
        const labelR = C_RADIUS + r + C_TICK_LEN + stagger;
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
            {stationData.map((sd, i) => (
              <Circle
                key={`dot-${i}`}
                x={sd.dotX}
                y={sd.dotY}
                radius={sd.r}
                fill="white"
                stroke={lc}
                strokeWidth={sd.isXchg ? 3 : 2}
              />
            ))}

            {/* Labels — rendered last so they sit on top */}
            {stations.map((station, i) => {
              const sd = stationData[i];
              const stTransits = transits[station.id] ?? [];
              const nBadges = stTransits.length;
              const bw = badgesWidth(nBadges);

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
                bRowY: number;

              if (sd.isRight) {
                // Text to the right, vertically centered on tick end
                jpX = sd.tickEndX + C_LABEL_GAP;
                jpY = sd.tickEndY - totalLabelH / 2;
                enX = jpX;
                enY = jpY + cJpFont + 2;
                bRowX = jpX;
                bRowY = enY + enBlockH;
              } else if (sd.isLeft) {
                // Text to the left, right-aligned against tick end
                jpX = sd.tickEndX - jpW - C_LABEL_GAP;
                jpY = sd.tickEndY - totalLabelH / 2;
                enX = sd.tickEndX - enW - C_LABEL_GAP;
                enY = jpY + cJpFont + 2;
                bRowX = sd.tickEndX - bw - C_LABEL_GAP;
                bRowY = enY + enBlockH;
              } else if (sd.isTop) {
                // Text above tick end (further from center = lower y)
                // Reading order top→bottom: JP, EN, badges (badges closest to dot)
                jpY = sd.tickEndY - totalLabelH - C_LABEL_GAP;
                jpX = sd.tickEndX - jpW / 2;
                enX = sd.tickEndX - enW / 2;
                enY = jpY + cJpFont + 2;
                bRowX = sd.tickEndX - bw / 2;
                bRowY = enY + enBlockH;
              } else {
                // Bottom: text below tick end
                jpY = sd.tickEndY + C_LABEL_GAP;
                jpX = sd.tickEndX - jpW / 2;
                enX = sd.tickEndX - enW / 2;
                enY = jpY + cJpFont + 2;
                bRowX = sd.tickEndX - bw / 2;
                bRowY = enY + enBlockH;
              }

              return (
                <Fragment key={`label-${station.id}`}>
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

    // ── Horizontal linear layout ──────────────────────────────────────────

    if (orientation === "horizontal") {
      const canvasW = Math.max(300, PADDING * 2 + (n - 1) * H_SPACING);
      const canvasH = H_HEIGHT;

      return (
        <Stage
          ref={ref}
          key={stageKey}
          width={canvasW * scale}
          height={canvasH * scale}
          scaleX={scale}
          scaleY={scale}
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
                PADDING + (n - 1) * H_SPACING,
                H_TRACK_Y,
              ]}
              stroke={lc}
              strokeWidth={TRACK_W}
              lineCap="round"
            />

            {/* Stations */}
            {stations.map((station, i) => {
              const x = PADDING + i * H_SPACING;
              const isXchg = (transits[station.id]?.length ?? 0) > 0;
              const r = isXchg ? XCHG_R : DOT_R;
              const above = i % 2 === 0;
              const stTransits = transits[station.id] ?? [];
              const nBadges = stTransits.length;
              const bw = badgesWidth(nBadges);

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

              return (
                <Fragment key={station.id}>
                  <Circle
                    x={x}
                    y={H_TRACK_Y}
                    radius={r}
                    fill="white"
                    stroke={lc}
                    strokeWidth={isXchg ? 3 : 2}
                  />

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
    const canvasH = Math.max(200, PADDING * 2 + (n - 1) * V_SPACING);

    return (
      <Stage
        ref={ref}
        key={stageKey}
        width={canvasW * scale}
        height={canvasH * scale}
        scaleX={scale}
        scaleY={scale}
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
              PADDING + (n - 1) * V_SPACING,
            ]}
            stroke={lc}
            strokeWidth={TRACK_W}
            lineCap="round"
          />

          {/* Stations */}
          {stations.map((station, i) => {
            const y = PADDING + i * V_SPACING;
            const isXchg = (transits[station.id]?.length ?? 0) > 0;
            const r = isXchg ? XCHG_R : DOT_R;
            const stTransits = transits[station.id] ?? [];
            const nBadges = stTransits.length;

            // Badges start right after the dot
            const badgesStartX = V_TRACK_X + r + 10;
            // Name starts after badges
            const nameX =
              badgesStartX + badgesWidth(nBadges) + (nBadges > 0 ? 6 : 0);

            const jpNameY = y - JP_FONT / 2;
            const enNameY = jpNameY + JP_FONT + 1;

            return (
              <Fragment key={station.id}>
                <Circle
                  x={V_TRACK_X}
                  y={y}
                  radius={r}
                  fill="white"
                  stroke={lc}
                  strokeWidth={isXchg ? 3 : 2}
                />

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
