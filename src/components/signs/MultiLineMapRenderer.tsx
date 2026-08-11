import { Fragment, forwardRef, useMemo } from "react";
import Konva from "konva";
import {
  Circle,
  Group,
  Layer,
  Line as KonvaLine,
  Rect,
  Stage,
  Text,
} from "react-konva";
import type { Line, Station } from "@/db/types";
import {
  DOT_R,
  C_DIAG,
  C_LABEL_GAP,
  C_TICK_LEN,
  EN_FONT,
  HorizontalTransitLines,
  JP_FONT,
  LI_GAP,
  LI_SIZE,
  LINE_TITLE_FONT,
  LineIndicatorBadge,
  SN_BADGE_GAP,
  StationNumberBadgeGroup,
  getHorizontalTransitLayout,
  measureTextWidth,
  snBadgeDims,
  stationNumberGroupDimensions,
  type StationNameField,
  type StationNumberInfo,
  type StationNumberMap,
  type StationNumberMode,
} from "@/components/signs/LineMapRenderer";
import { shouldShowLineIndicatorBadge } from "@/components/signs/lineIndicatorStyle";
import { layoutHorizontalStationDetails } from "@/components/signs/transitLineLayout";
import {
  getTrackEdgeRadius,
  layoutConnectedMarkers,
  normalizeTrackWidth,
} from "@/components/signs/lineMapGeometry";
import {
  applyParallelRouteLanes,
  getParallelRouteIdsByStation,
  layoutCircularMultiLineMap,
  layoutMultiLineMap,
  orderParallelRouteIdsByVerticalPosition,
  type MultiLineLayoutInput,
  type MultiLinePathLayout,
} from "@/components/signs/multiLineMapLayout";

export const multiLineMapScale = 2;
const FONT = "NotoSansJP, Noto Sans JP, sans-serif";
export const MULTI_LINE_STATION_NAME_SCALE = 1.3;
const MULTI_LINE_JP_FONT = JP_FONT * MULTI_LINE_STATION_NAME_SCALE;
const MULTI_LINE_EN_FONT = EN_FONT * MULTI_LINE_STATION_NAME_SCALE;

export interface MultiLineRouteData {
  line: Line;
  stations: Station[];
  stationNumbers: StationNumberMap;
  transits: Record<string, Line[]>;
  companyStyle?: string;
}

interface MultiLineMapRendererProps {
  routes: MultiLineRouteData[];
  rootLineId: string;
  stationSpacing?: number;
  trackWidth?: number;
  stationNumberMode?: StationNumberMode;
  primaryLangField?: StationNameField;
  secondaryLangField?: StationNameField;
  showSecondaryLang?: boolean;
  showTransitNames?: boolean;
  lineStyles?: Record<string, string>;
}

interface StationItem {
  path: MultiLinePathLayout;
  route: MultiLineRouteData;
  station: Station;
  x: number;
  y: number;
  parallelLineIds: string[];
  onLoop: boolean;
}

function ConnectedStationDots({
  x,
  y,
  routes,
}: {
  x: number;
  y: number;
  routes: MultiLineRouteData[];
}) {
  const radius = DOT_R;
  const strokeWidth = 2;
  const connected = layoutConnectedMarkers(
    routes.map(() => radius * 2),
    routes.map(() => strokeWidth / 2),
  );
  const top = y - connected.extent / 2;
  return (
    <Fragment>
      {routes.map((route, index) => (
        <Circle
          key={route.line.id}
          x={x}
          y={top + connected.positions[index] + radius}
          radius={radius}
          fill="white"
          stroke={route.line.line_color}
          strokeWidth={strokeWidth}
        />
      ))}
    </Fragment>
  );
}

const MultiLineMapRenderer = forwardRef<Konva.Stage, MultiLineMapRendererProps>(
  function MultiLineMapRenderer(
    {
      routes,
      rootLineId,
      stationSpacing = 75,
      trackWidth = 6,
      stationNumberMode = "dot",
      primaryLangField = "primary_name",
      secondaryLangField = "secondary_name",
      showSecondaryLang = true,
      showTransitNames = true,
      lineStyles = {},
    },
    ref,
  ) {
    const effectiveTrackWidth = normalizeTrackWidth(trackWidth);
    const laneGap = Math.max(16, effectiveTrackWidth + 4);
    const routeInputs: MultiLineLayoutInput[] = routes.map(({ line, stations }) => ({
      lineId: line.id,
      parentLineId: line.parent_line_id,
      stationIds: stations.map((station) => station.id),
      isLoop: !!line.is_loop,
    }));
    const routeById = new Map(routes.map((route) => [route.line.id, route]));
    // A selected loop always owns the circular geometry. Manual ordering still
    // controls lane stacking and titles, but must not flatten a loop merely
    // because a companion line was selected first.
    const rootRoute = routes.find((route) => !!route.line.is_loop) ??
      routeById.get(rootLineId) ?? routes[0];
    const isCircular = !!rootRoute?.line.is_loop;
    const layout = useMemo(() => {
      if (isCircular) {
        return layoutCircularMultiLineMap(
          routeInputs,
          rootRoute.line.id,
          stationSpacing,
          laneGap,
        );
      }
      return applyParallelRouteLanes(
        layoutMultiLineMap(routeInputs, rootRoute.line.id, stationSpacing),
        routeInputs,
        laneGap,
      );
    }, [isCircular, laneGap, rootRoute, routes, stationSpacing]);

    const parallelByStation = getParallelRouteIdsByStation(routeInputs);
    const stationById = new Map(
      routes.flatMap((route) => route.stations).map((station) => [station.id, station]),
    );
    const selectedLineIds = new Set(routes.map((route) => route.line.id));
    const rootStationIds = new Set(rootRoute?.stations.map((station) => station.id) ?? []);
    const occurrences = new Map<
      string,
      Array<{ path: MultiLinePathLayout; x: number; y: number }>
    >();
    for (const path of layout.paths) {
      for (const point of path.points) {
        const values = occurrences.get(point.stationId) ?? [];
        values.push({ path, x: point.x, y: point.y });
        occurrences.set(point.stationId, values);
      }
    }

    const stationItems: StationItem[] = [];
    const renderedStations = new Set<string>();
    for (const path of layout.paths) {
      const route = routeById.get(path.lineId);
      if (!route) continue;
      for (const point of path.points) {
        if (renderedStations.has(point.stationId)) continue;
        const station = stationById.get(point.stationId);
        if (!station) continue;
        renderedStations.add(point.stationId);
        const parallelLineIds = parallelByStation.get(point.stationId) ?? [];
        const points = occurrences.get(point.stationId) ?? [];
        const x = parallelLineIds.length > 1
          ? points.reduce((sum, value) => sum + value.x, 0) / points.length
          : point.x;
        const y = parallelLineIds.length > 1
          ? points.reduce((sum, value) => sum + value.y, 0) / points.length
          : point.y;
        stationItems.push({
          path,
          route,
          station,
          x,
          y,
          parallelLineIds,
          onLoop: isCircular && rootStationIds.has(point.stationId),
        });
      }
    }

    const titleItems = routes.map((route) => {
      const style = route.companyStyle ?? "jreast";
      const showBadge = shouldShowLineIndicatorBadge(route.line.prefix);
      const width =
        (showBadge ? LI_SIZE + LI_GAP : 0) +
        measureTextWidth(route.line.name, LINE_TITLE_FONT, "bold");
      return { route, style, showBadge, width };
    });
    const totalTitleWidth = titleItems.reduce(
      (sum, item, index) => sum + item.width + (index > 0 ? 30 : 0),
      0,
    );
    let runningTitleX = isCircular && layout.loopCenter
      ? layout.loopCenter.x - totalTitleWidth / 2
      : 50;
    const positionedTitles = titleItems.map((item, index) => {
      if (index > 0) runningTitleX += 30;
      const positioned = { ...item, x: runningTitleX };
      runningTitleX += item.width;
      return positioned;
    });

    const getStationRoutes = (item: StationItem) => {
      const ids = item.parallelLineIds.length > 1
        ? item.parallelLineIds
        : [item.route.line.id];
      const verticallyOrderedIds = orderParallelRouteIdsByVerticalPosition(
        ids,
        (occurrences.get(item.station.id) ?? []).map(({ path, y }) => ({
          lineId: path.lineId,
          y,
        })),
      );
      return verticallyOrderedIds
        .map((lineId) => routeById.get(lineId))
        .filter((route): route is MultiLineRouteData => !!route);
    };
    const getStationNumbers = (item: StationItem): StationNumberInfo[] => {
      const stationRoutes = getStationRoutes(item);
      const numbers = stationRoutes.flatMap((route) => {
        const number = route.stationNumbers[item.station.id];
        return number?.value
          ? [{ ...number, color: number.color ?? route.line.line_color }]
          : [];
      });
      if (stationRoutes.length < 2 || !item.station.three_letter_code) {
        return numbers;
      }

      // A three-letter code identifies the station, not each serving line.
      // In the vertical connected form the first badge owns the shared header;
      // subsequent badges contribute only their line prefix and station number.
      return numbers.map((number) => ({
        ...number,
        threeLetterCode: null,
      }));
    };
    const getStationTransits = (item: StationItem): Line[] => {
      const seen = new Set<string>();
      return getStationRoutes(item).flatMap((route) => route.transits[item.station.id] ?? [])
        .filter((line) => {
          if (selectedLineIds.has(line.id) || seen.has(line.id)) return false;
          seen.add(line.id);
          return true;
        });
    };

    const renderMarker = (
      item: StationItem,
      numbers: StationNumberInfo[],
    ) => {
      const stationRoutes = getStationRoutes(item);
      if (stationNumberMode === "dot" && numbers.length > 0) {
        const orientation = stationRoutes.length > 1 ? "vertical" : "horizontal";
        const dimensions = stationNumberGroupDimensions(
          numbers,
          orientation,
          1,
          false,
          1,
          stationRoutes.length > 1 ? item.station.three_letter_code : null,
        );
        return (
          <StationNumberBadgeGroup
            x={item.x - dimensions.w / 2}
            y={item.y - dimensions.h / 2}
            numbers={numbers}
            orientation={orientation}
            fallbackColor={item.route.line.line_color}
            strokeWidthAdjust={1}
            sharedThreeLetterCode={
              stationRoutes.length > 1 ? item.station.three_letter_code : null
            }
          />
        );
      }
      if (stationRoutes.length > 1) {
        return (
          <ConnectedStationDots
            x={item.x}
            y={item.y}
            routes={stationRoutes}
          />
        );
      }
      return (
        <Circle
          x={item.x}
          y={item.y}
          radius={DOT_R}
          fill="white"
          stroke={item.route.line.line_color}
          strokeWidth={2}
        />
      );
    };

    const renderLinearStation = (item: StationItem) => {
      const { path, route, station, x, y } = item;
      const stationRoutes = getStationRoutes(item);
      const numbers = getStationNumbers(item);
      const verticalGroup = stationRoutes.length > 1;
      const orientation = verticalGroup ? "vertical" : "horizontal";
      const showSnBadge = stationNumberMode === "badge" && numbers.length > 0;
      const showSnDot = stationNumberMode === "dot" && numbers.length > 0;
      const labelAbove = isCircular && layout.loopCenter
        ? x < layout.loopCenter.x
        : path.labelSide === "above";
      const stationTransits = getStationTransits(item);
      const markerRadius = DOT_R;
      const transitLayout = getHorizontalTransitLayout(
        stationTransits,
        showTransitNames,
        "right",
      );
      const primaryName = station[primaryLangField] ?? "";
      const secondaryName = showSecondaryLang ? station[secondaryLangField] : null;
      const primaryWidth = measureTextWidth(primaryName, MULTI_LINE_JP_FONT);
      const secondaryWidth = secondaryName
        ? measureTextWidth(secondaryName, MULTI_LINE_EN_FONT)
        : 0;
      const dimensions = numbers.length > 0
        ? stationNumberGroupDimensions(
            numbers,
            orientation,
            1,
            false,
            showSnDot ? 1 : 0,
            verticalGroup ? station.three_letter_code : null,
          )
        : snBadgeDims(false);
      const markerEdgeRadius = getTrackEdgeRadius(markerRadius, effectiveTrackWidth);
      const effectiveMarkerRadius = showSnDot || stationRoutes.length > 1
        ? Math.max(markerEdgeRadius, dimensions.h / 2)
        : markerEdgeRadius;
      let numberY = 0;
      let primaryNameY: number;
      let secondaryNameY: number;
      let transitY: number;

      if (showSnBadge) {
        numberY = labelAbove
          ? y - markerEdgeRadius - 8 - dimensions.h
          : y + markerEdgeRadius + 8;
        const details = layoutHorizontalStationDetails(
          labelAbove ? "above" : "below",
          labelAbove ? numberY : numberY + dimensions.h,
          SN_BADGE_GAP,
          MULTI_LINE_JP_FONT,
          secondaryName ? MULTI_LINE_EN_FONT : 0,
          stationTransits.length > 0 ? transitLayout.height : 0,
        );
        primaryNameY = details.primaryNameY;
        secondaryNameY = details.secondaryNameY;
        transitY = details.transitY;
      } else {
        const details = layoutHorizontalStationDetails(
          labelAbove ? "above" : "below",
          labelAbove ? y - effectiveMarkerRadius : y + effectiveMarkerRadius,
          labelAbove ? 8 : 6,
          MULTI_LINE_JP_FONT,
          secondaryName ? MULTI_LINE_EN_FONT : 0,
          stationTransits.length > 0 ? transitLayout.height : 0,
        );
        primaryNameY = details.primaryNameY;
        secondaryNameY = details.secondaryNameY;
        transitY = details.transitY;
      }

      return (
        <Fragment key={station.id}>
          {renderMarker(item, numbers)}
          {showSnBadge && (
            <StationNumberBadgeGroup
              x={x - dimensions.w / 2}
              y={numberY}
              numbers={numbers}
              orientation={orientation}
              fallbackColor={route.line.line_color}
              sharedThreeLetterCode={
                verticalGroup ? station.three_letter_code : null
              }
            />
          )}
          <Text x={x - primaryWidth / 2} y={primaryNameY} text={primaryName} fontFamily={FONT} fontSize={MULTI_LINE_JP_FONT} fill="#222" />
          {secondaryName && (
            <Text x={x - secondaryWidth / 2} y={secondaryNameY} text={secondaryName} fontFamily={FONT} fontSize={MULTI_LINE_EN_FONT} fill="#666" />
          )}
          <HorizontalTransitLines
            x={x - transitLayout.width / 2}
            y={transitY}
            lines={stationTransits}
            side="right"
            showNames={showTransitNames}
            lineStyles={lineStyles}
          />
        </Fragment>
      );
    };

    const renderCircularStation = (item: StationItem) => {
      const center = layout.loopCenter!;
      const numbers = getStationNumbers(item);
      const stationRoutes = getStationRoutes(item);
      const orientation = stationRoutes.length > 1 ? "vertical" : "horizontal";
      const dimensions = numbers.length > 0
        ? stationNumberGroupDimensions(
            numbers,
            orientation,
            1,
            false,
            stationNumberMode === "dot" ? 1 : 0,
            stationRoutes.length > 1 ? item.station.three_letter_code : null,
          )
        : snBadgeDims(false);
      const stationTransits = getStationTransits(item);
      const radius = DOT_R;
      const dx = item.x - center.x;
      const dy = item.y - center.y;
      const distance = Math.hypot(dx, dy) || 1;
      const cosA = dx / distance;
      const sinA = dy / distance;
      const markerExtent = stationNumberMode === "dot" && numbers.length > 0
        ? Math.abs(cosA) * dimensions.w / 2 + Math.abs(sinA) * dimensions.h / 2
        : getTrackEdgeRadius(radius, effectiveTrackWidth);
      const labelDistance = distance - markerExtent - C_TICK_LEN;
      const anchorX = center.x + cosA * labelDistance;
      const anchorY = center.y + sinA * labelDistance;
      const primaryName = item.station[primaryLangField] ?? "";
      const secondaryName = showSecondaryLang ? item.station[secondaryLangField] : null;
      const primaryWidth = measureTextWidth(primaryName, MULTI_LINE_JP_FONT);
      const secondaryWidth = secondaryName
        ? measureTextWidth(secondaryName, MULTI_LINE_EN_FONT)
        : 0;
      const transitLayout = getHorizontalTransitLayout(stationTransits, showTransitNames, "right");
      const blockWidth = Math.max(primaryWidth, secondaryWidth, transitLayout.width);
      const blockHeight = MULTI_LINE_JP_FONT +
        (secondaryName ? MULTI_LINE_EN_FONT + 2 : 0) +
        (stationTransits.length ? transitLayout.height + 3 : 0);
      const showSnBadge = stationNumberMode === "badge" && numbers.length > 0;
      const isRight = cosA > C_DIAG;
      const isLeft = cosA < -C_DIAG;
      const isTop = !isRight && !isLeft && sinA < 0;
      let blockX: number;
      let blockY: number;
      let badgeX = 0;
      let badgeY = 0;

      if (isRight) {
        badgeX = anchorX - C_LABEL_GAP - dimensions.w;
        badgeY = anchorY - dimensions.h / 2;
        const blockRight = showSnBadge
          ? badgeX - SN_BADGE_GAP
          : anchorX - C_LABEL_GAP;
        blockX = blockRight - blockWidth;
        blockY = anchorY - blockHeight / 2;
      } else if (isLeft) {
        badgeX = anchorX + C_LABEL_GAP;
        badgeY = anchorY - dimensions.h / 2;
        blockX = showSnBadge
          ? badgeX + dimensions.w + SN_BADGE_GAP
          : anchorX + C_LABEL_GAP;
        blockY = anchorY - blockHeight / 2;
      } else if (isTop) {
        badgeX = anchorX - dimensions.w / 2;
        badgeY = anchorY + C_LABEL_GAP;
        blockX = anchorX - blockWidth / 2;
        blockY = showSnBadge
          ? badgeY + dimensions.h + 2
          : anchorY + C_LABEL_GAP;
      } else {
        badgeX = anchorX - dimensions.w / 2;
        badgeY = anchorY - C_LABEL_GAP - dimensions.h;
        blockX = anchorX - blockWidth / 2;
        blockY = showSnBadge
          ? badgeY - 2 - blockHeight
          : anchorY - C_LABEL_GAP - blockHeight;
      }
      const textAlign = isRight ? "right" : isLeft ? "left" : "center";

      return (
        <Fragment key={item.station.id}>
          {renderMarker(item, numbers)}
          {showSnBadge && (
            <StationNumberBadgeGroup
              x={badgeX}
              y={badgeY}
              numbers={numbers}
              orientation={orientation}
              fallbackColor={item.route.line.line_color}
              sharedThreeLetterCode={
                stationRoutes.length > 1
                  ? item.station.three_letter_code
                  : null
              }
            />
          )}
          <Text x={blockX} y={blockY} width={blockWidth} text={primaryName} fontFamily={FONT} fontSize={MULTI_LINE_JP_FONT} fill="#222" align={textAlign} />
          {secondaryName && (
            <Text x={blockX} y={blockY + MULTI_LINE_JP_FONT + 2} width={blockWidth} text={secondaryName} fontFamily={FONT} fontSize={MULTI_LINE_EN_FONT} fill="#666" align={textAlign} />
          )}
          <HorizontalTransitLines
            x={isRight ? blockX + blockWidth - transitLayout.width : blockX}
            y={blockY + MULTI_LINE_JP_FONT + (secondaryName ? MULTI_LINE_EN_FONT + 4 : 2)}
            lines={stationTransits}
            side="right"
            showNames={showTransitNames}
            lineStyles={lineStyles}
          />
        </Fragment>
      );
    };

    return (
      <Stage
        ref={ref}
        width={layout.width * multiLineMapScale}
        height={layout.height * multiLineMapScale}
        scaleX={multiLineMapScale}
        scaleY={multiLineMapScale}
        listening={false}
      >
        <Layer>
          <Rect width={layout.width} height={layout.height} fill="#fff" />

          {positionedTitles.map(({ route, x, style, showBadge }) => (
            <Group key={route.line.id} x={x} y={isCircular && layout.loopCenter ? layout.loopCenter.y - LI_SIZE / 2 : 18}>
              {showBadge && (
                <LineIndicatorBadge x={0} y={0} color={route.line.line_color} prefix={route.line.prefix} style={style} />
              )}
              <Text
                x={showBadge ? LI_SIZE + LI_GAP : 0}
                y={showBadge ? (LI_SIZE - LINE_TITLE_FONT) / 2 : 0}
                text={route.line.name}
                fontFamily={FONT}
                fontSize={LINE_TITLE_FONT}
                fontStyle="bold"
                fill={route.line.line_color}
              />
            </Group>
          ))}

          {layout.paths.map((path) => {
            const route = routeById.get(path.lineId);
            if (!route || path.trackPoints.length < 4) return null;
            const points = path.closed
              ? [...path.trackPoints, path.points[0].x, path.points[0].y]
              : path.trackPoints;
            return (
              <KonvaLine
                key={`track-${path.lineId}`}
                points={points}
                stroke={route.line.line_color}
                strokeWidth={effectiveTrackWidth}
                lineCap="round"
                lineJoin="round"
              />
            );
          })}

          {stationItems.map((item) =>
            item.onLoop ? renderCircularStation(item) : renderLinearStation(item)
          )}

          {rootRoute && !isCircular && (
            <Rect x={0} y={layout.height - 2} width={layout.width} height={2} fill={rootRoute.line.line_color} opacity={0.16} />
          )}
        </Layer>
      </Stage>
    );
  },
);

export default MultiLineMapRenderer;
