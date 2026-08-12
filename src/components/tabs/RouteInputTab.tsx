/*
 * JR East sign format — required data from DB:
 * Current station: primary_name, primary_name_furigana, secondary_name,
 *   tertiary_name, quaternary_name (language order is owned by the company),
 *   note, three_letter_code,
 *   station_number (value from station_numbers for this line),
 *   station_areas (from station_areas)
 * Adjacent stations (left/right by sort_order ±1 in station_lines):
 *   primary_name, primary_name_furigana, secondary_name,
 *   station_number (for same line)
 * Colors: line.line_color, company.company_color (as baseColor)
 * Display: ratio (from user), direction (from user)
 */

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type CSSProperties,
} from "react";
import type { Database } from "sql.js";
import {
  Alert,
  ActionIcon,
  Button,
  Grid,
  Group,
  Box,
  Select,
  MultiSelect,
  Paper,
  Title,
  Loader,
  Center,
  Stack,
  Text,
  SegmentedControl,
  Slider,
  Switch,
  Tooltip,
} from "@mantine/core";
import {
  IconDownload,
  IconEye,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowDown,
  IconArrowsHorizontal,
  IconArrowsLeftRight,
  IconRuler,
  IconMap,
  IconSignRight,
  IconLayoutColumns,
  IconLayoutRows,
  IconAlertTriangle,
} from "@tabler/icons-react";
import Konva from "konva";
import { useLocale, useTranslations } from "@/i18n/useTranslation";
import {
  getLineMapFontSpecs,
  getStationSignFontSpecs,
  waitForCanvasFonts,
} from "@/lib/fonts";
import { useCanvasFonts } from "@/lib/useCanvasFonts";
import { getLocalizedRailwayName } from "@/lib/localizedRailwayName";
import {
  createLineMapExportBlob,
  downloadBlob,
  type LineMapExportFormat,
} from "@/lib/lineMapExport";
import { getLineMapPngSizeOptions } from "@/lib/streamingPngExport";
import {
  getCompanyLanguages,
  getRailwayLanguageLabel,
} from "@/lib/railwayLanguages";
import { getAllLines } from "@/db/repositories/lines";
import { getAllCompanies } from "@/db/repositories/companies";
import {
  getAllStations,
  getStationsByLine,
  getStationLines,
  getResolvedStationNumber,
  getStationAreasWithZones,
} from "@/db/repositories/stations";
import {
  getConnectingStations,
  getTransferLineIds,
} from "@/db/repositories/station-transfers";
import {
  getServicesByLine,
  getServicesByThroughRoute,
  getServiceStopsByLine,
  getServiceStopsByThroughRoute,
} from "@/db/repositories/services";
import {
  getAllThroughRoutes,
  getRelativeLineDirectionAtStation,
  getThroughRoutePath,
} from "@/db/repositories/through-routes";
import type { Line, Station, Service, ThroughRoute } from "@/db/types";
import type DirectInputStationProps from "@/components/signs/DirectInputStationProps";
import type {
  AdjacentStationProps,
  Direction,
} from "@/components/signs/DirectInputStationProps";
import { SIGN_STYLE_FIELDS } from "@/components/signs/signStyles";
import { moveAdjacentStationId } from "./adjacentStationOrder";
import { moveOrderedId } from "./orderedIds";

import JrEastSign, {
  height as JrEastSignHeight,
  scale as JrEastSignBaseScale,
} from "@/components/signs/JrEastSign";
import JrEastBranchSign, {
  height as JrEastBranchSignHeight,
  scale as JrEastBranchSignBaseScale,
} from "@/components/signs/JrEastBranchSign";
import JrCentralSign, {
  height as JrCentralSignHeight,
  scale as JrCentralSignBaseScale,
} from "@/components/signs/JrCentralSign";
import JrWestSign, {
  height as JrWestSignHeight,
  scale as JrWestSignBaseScale,
} from "@/components/signs/JrWestSign";
import JrWestSignLarge, {
  height as JrWestSignLargeHeight,
  scale as JrWestSignLargeBaseScale,
} from "@/components/signs/JrWestSignLarge";
import MetroLongSign, {
  MetroLongForeignSign,
  height as MetroLongSignHeight,
  scale as MetroLongSignBaseScale,
} from "@/components/signs/MetroLongSign";
import {
  MetroMediumSign,
  ToeiLargeSign,
  ToeiMediumSign,
  scale as SubwaySignBaseScale,
  subwaySignDimensions,
} from "@/components/signs/SubwaySign";
import LineMapRenderer, {
  scale as LineMapScale,
  CIRCULAR_FONT_DEFAULT,
  JP_FONT,
  detectCircularOverlaps,
  getMapCanvasDimensions,
  getStationNumberGroupExtraExtent,
  type StationNumberMode,
  type StationNumberGroupMap,
  type StationNumberInfo,
  type StationNumberMap,
  type StationNameField,
  type ServiceInfo,
  type ServiceStopMap,
} from "@/components/signs/LineMapRenderer";
import MultiLineMapRenderer, {
  multiLineMapScale,
  type MultiLineRouteData,
  type MultiLineStationFontSize,
} from "@/components/signs/MultiLineMapRenderer";
import {
  applyParallelRouteLanes,
  layoutCircularMultiLineMap,
  layoutMultiLineMap,
} from "@/components/signs/multiLineMapLayout";
import {
  DEFAULT_TRACK_WIDTH,
  MAX_TRACK_WIDTH,
  MIN_TRACK_WIDTH,
  normalizeTrackWidth,
  shouldExpandStationNumberGroups,
} from "@/components/signs/lineMapGeometry";
import {
  isTransitSecondaryNameExportTooSmall,
} from "@/components/signs/transitLineLayout";
import CanvasFontLoading from "@/components/CanvasFontLoading";
import styles from "./RouteInputTab.module.css";

type SignStyle =
  | "jreast"
  | "jreastbranch"
  | "jrcentral"
  | "jrwest"
  | "jrwestlarge"
  | "metrolong"
  | "metroforeign"
  | "metromedium"
  | "toeimedium"
  | "toeilarge";
type TabMode = "sign" | "linemap" | "multiline-linemap";
type MapOrientation = "horizontal" | "vertical";
type AdjacentSide = "left" | "right";

const STATION_NAME_FIELDS: StationNameField[] = [
  "primary_name",
  "secondary_name",
  "tertiary_name",
  "quaternary_name",
];

const LANGUAGE_SLOT_LABEL_KEYS = [
  "route.linemap.lang-1st",
  "route.linemap.lang-2nd",
  "route.linemap.lang-3rd",
  "route.linemap.lang-4th",
] as const;

function getStationIdForLine(
  db: Database,
  stationIds: string[],
  lineId: string,
): string {
  return (
    stationIds.find((stationId) =>
      getStationLines(db, stationId).some(
        (stationLine) => stationLine.line_id === lineId,
      ),
    ) ?? stationIds[0] ?? ""
  );
}

type AdjacentCandidate = AdjacentStationProps & {
  optionValue: string;
  lineId: string;
  lineName: string;
  side: AdjacentSide;
};

type AdjacentOrderControlsProps = {
  candidates: AdjacentCandidate[];
  orderedIds: string[];
  onMove: (fromIndex: number, toIndex: number) => void;
  t: (key: string) => string;
};

function AdjacentOrderControls({
  candidates,
  orderedIds,
  onMove,
  t,
}: AdjacentOrderControlsProps) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" ta="center">
        {t("route.sign.adjacent-order")}
      </Text>
      {orderedIds.map((optionValue, index) => {
        const stationName =
          candidates.find((candidate) => candidate.optionValue === optionValue)
            ?.primaryName ?? optionValue;
        const moveUpLabel = `${t("route.sign.adjacent-move-up")}: ${stationName}`;
        const moveDownLabel =
          `${t("route.sign.adjacent-move-down")}: ${stationName}`;

        return (
          <Group key={optionValue} gap={4} wrap="nowrap">
            <Text size="xs" style={{ flex: 1 }} truncate>
              {index + 1}. {stationName}
            </Text>
            <Tooltip label={moveUpLabel}>
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label={moveUpLabel}
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
              >
                <IconArrowUp size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={moveDownLabel}>
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label={moveDownLabel}
                disabled={index === orderedIds.length - 1}
                onClick={() => onMove(index, index + 1)}
              >
                <IconArrowDown size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        );
      })}
    </Stack>
  );
}

type MultiLineOrderControlsProps = {
  lines: Line[];
  onMove: (fromIndex: number, toIndex: number) => void;
  t: (key: string) => string;
};

function MultiLineOrderControls({
  lines,
  onMove,
  t,
}: MultiLineOrderControlsProps) {
  return (
    <Stack
      gap={6}
      mt="md"
      className={styles.multiLineOrder}
      data-testid="multi-line-order"
    >
      <Text size="xs" c="dimmed" fw={600}>
        {t("route.sign.adjacent-order")}
      </Text>
      {lines.map((line, index) => {
        const moveUpLabel = `${t("route.sign.adjacent-move-up")}: ${line.name}`;
        const moveDownLabel =
          `${t("route.sign.adjacent-move-down")}: ${line.name}`;
        return (
          <Group
            key={line.id}
            gap="xs"
            wrap="nowrap"
            className={styles.multiLineOrderRow}
            data-line-id={line.id}
            data-root={index === 0 ? "true" : undefined}
          >
            <Text className={styles.multiLineOrderIndex} aria-hidden="true">
              {index + 1}
            </Text>
            <Box
              className={styles.multiLineSwatch}
              style={{ backgroundColor: line.line_color }}
              aria-hidden="true"
            />
            <Text
              size="sm"
              fw={index === 0 ? 700 : 500}
              truncate
              style={{ flex: 1 }}
            >
              {line.prefix ? `[${line.prefix}] ` : ""}
              {line.name}
            </Text>
            <Tooltip label={moveUpLabel}>
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label={moveUpLabel}
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
              >
                <IconArrowUp size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={moveDownLabel}>
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label={moveDownLabel}
                disabled={index === lines.length - 1}
                onClick={() => onMove(index, index + 1)}
              >
                <IconArrowDown size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        );
      })}
    </Stack>
  );
}

const SIGN_STYLES: Record<
  SignStyle,
  { Component: typeof JrEastSign; height: number; scale: number }
> = {
  jreast: {
    Component: JrEastSign,
    height: JrEastSignHeight,
    scale: JrEastSignBaseScale,
  },
  jreastbranch: {
    Component: JrEastBranchSign,
    height: JrEastBranchSignHeight,
    scale: JrEastBranchSignBaseScale,
  },
  jrcentral: {
    Component: JrCentralSign,
    height: JrCentralSignHeight,
    scale: JrCentralSignBaseScale,
  },
  jrwest: {
    Component: JrWestSign,
    height: JrWestSignHeight,
    scale: JrWestSignBaseScale,
  },
  jrwestlarge: {
    Component: JrWestSignLarge,
    height: JrWestSignLargeHeight,
    scale: JrWestSignLargeBaseScale,
  },
  metrolong: {
    Component: MetroLongSign,
    height: MetroLongSignHeight,
    scale: MetroLongSignBaseScale,
  },
  metroforeign: {
    Component: MetroLongForeignSign,
    height: MetroLongSignHeight,
    scale: MetroLongSignBaseScale,
  },
  metromedium: {
    Component: MetroMediumSign,
    height: subwaySignDimensions.metroMedium.height,
    scale: SubwaySignBaseScale,
  },
  toeimedium: {
    Component: ToeiMediumSign,
    height: subwaySignDimensions.toeiMedium.height,
    scale: SubwaySignBaseScale,
  },
  toeilarge: {
    Component: ToeiLargeSign,
    height: subwaySignDimensions.toeiLarge.height,
    scale: SubwaySignBaseScale,
  },
};

interface RouteInputTabProps {
  db: Database | null;
  loading: boolean;
}

export default function RouteInputTab({ db, loading }: RouteInputTabProps) {
  const t = useTranslations();
  const locale = useLocale();
  const signRef = useRef<Konva.Stage>(null);
  const mapRef = useRef<Konva.Stage>(null);
  const multiLineMapRef = useRef<Konva.Stage>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [throughRoutes, setThroughRoutes] = useState<ThroughRoute[]>([]);
  const [selectedThroughRouteId, setSelectedThroughRouteId] = useState<
    string | null
  >(null);

  // ── Sign mode state ──────────────────────────────────────────────────────
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [direction, setDirection] = useState<Direction>("left");
  const [flipped, setFlipped] = useState(false);
  const [ratio, setRatio] = useState(4.5);
  const [signData, setSignData] = useState<DirectInputStationProps | null>(
    null,
  );
  const [centerSquareLineIds, setCenterSquareLineIds] = useState<string[]>([]);
  const [stationLines, setStationLines] = useState<Line[]>([]);
  const [signStyle, setSignStyle] = useState<SignStyle>("jreast");
  const adjacentSelectionLimit =
    SIGN_STYLE_FIELDS[signStyle]?.maxAdjacentCount ?? 2;
  const [saveSize, setSaveSize] = useState(JrEastSignBaseScale);
  const [saveSizeList, setSaveSizeList] = useState<
    { label: string; value: number }[]
  >([]);
  const [selectedLeftAdjacentIds, setSelectedLeftAdjacentIds] = useState<
    string[]
  >([]);
  const [selectedRightAdjacentIds, setSelectedRightAdjacentIds] = useState<
    string[]
  >([]);
  const [leftAdjacentDropdownOpened, setLeftAdjacentDropdownOpened] =
    useState(false);
  const [rightAdjacentDropdownOpened, setRightAdjacentDropdownOpened] =
    useState(false);

  useEffect(() => {
    setSelectedLeftAdjacentIds((ids) => ids.slice(0, adjacentSelectionLimit));
    setSelectedRightAdjacentIds((ids) => ids.slice(0, adjacentSelectionLimit));
  }, [adjacentSelectionLimit]);

  // ── Line map mode state ──────────────────────────────────────────────────
  const [tabMode, setTabMode] = useState<TabMode>("sign");
  const [mapOrientation, setMapOrientation] =
    useState<MapOrientation>("horizontal");
  const [mapStartId, setMapStartId] = useState<string | null>(null);
  const [mapEndId, setMapEndId] = useState<string | null>(null);
  const [mapShowFadeBefore, setMapShowFadeBefore] = useState(true);
  const [mapShowFadeAfter, setMapShowFadeAfter] = useState(true);
  const [mapTransits, setMapTransits] = useState<Record<string, Line[]>>({});
  const [mapTransitFilter, setMapTransitFilter] = useState<string[]>([]);
  const [mapShowTransitNames, setMapShowTransitNames] = useState(true);
  const [mapFontSize, setMapFontSize] = useState(CIRCULAR_FONT_DEFAULT);
  const [mapSaveSize, setMapSaveSize] = useState(LineMapScale);
  const [mapExportFormat, setMapExportFormat] =
    useState<LineMapExportFormat>("png");
  const [mapExporting, setMapExporting] = useState(false);
  const [mapExportError, setMapExportError] = useState<string | null>(null);
  const [mapStationNumberMode, setMapStationNumberMode] =
    useState<StationNumberMode>("none");
  const [mapStationNumbers, setMapStationNumbers] =
    useState<StationNumberMap>({});
  const [mapStationNumberGroups, setMapStationNumberGroups] =
    useState<StationNumberGroupMap>({});
  const [mapNameStyle, setMapNameStyle] = useState<
    "normal" | "above" | "below"
  >("normal");
  const [mapStationSpacing, setMapStationSpacing] = useState(75);
  const [mapTrackWidth, setMapTrackWidth] = useState(DEFAULT_TRACK_WIDTH);
  const [mapPrimaryLang, setMapPrimaryLang] =
    useState<StationNameField>("primary_name");
  const [mapSecondaryLang, setMapSecondaryLang] =
    useState<StationNameField>("secondary_name");
  const [mapShowSecondaryLang, setMapShowSecondaryLang] = useState(true);
  const [mapForceLinear, setMapForceLinear] = useState(false);
  const [mapVerticalNameSide, setMapVerticalNameSide] = useState<
    "left" | "right"
  >("right");
  const [mapServices, setMapServices] = useState<Service[]>([]);
  const [mapSelectedServiceIds, setMapSelectedServiceIds] = useState<string[]>(
    [],
  );
  const [mapServiceStops, setMapServiceStops] = useState<ServiceStopMap>({});
  type PassedStationMode = "show" | "hide-gap" | "hide-trim";
  const [mapPassedMode, setMapPassedMode] = useState<PassedStationMode>("show");
  const [mapServiceNameStyle, setMapServiceNameStyle] = useState<
    "paren" | "badge"
  >("paren");
  const [multiSelectedLineIds, setMultiSelectedLineIds] = useState<string[]>(
    [],
  );
  const [multiStationNumberMode, setMultiStationNumberMode] =
    useState<StationNumberMode>("dot");
  const [multiStationFontSize, setMultiStationFontSize] =
    useState<MultiLineStationFontSize>("large");
  const [multiTransitFilter, setMultiTransitFilter] = useState<string[]>([]);

  // Load lines when db becomes available
  useEffect(() => {
    if (!db) return;
    setLines(getAllLines(db));
    setThroughRoutes(getAllThroughRoutes(db));
  }, [db]);

  // Load stations when line changes
  useEffect(() => {
    if (!db || !selectedLineId) {
      setStations([]);
      setSelectedStationId(null);
      setMapStartId(null);
      setMapEndId(null);
      return;
    }
    const stns = getStationsByLine(db, selectedLineId);
    setStations(stns);
    setSelectedStationId(null);
    setMapTransitFilter([]);
  }, [db, selectedLineId]);

  // Load services and service stops when the selected line/through route changes.
  useEffect(() => {
    if (!db || (!selectedLineId && !selectedThroughRouteId)) {
      setMapServices([]);
      setMapSelectedServiceIds([]);
      setMapServiceStops({});
      return;
    }
    const svcs = selectedThroughRouteId
      ? getServicesByThroughRoute(db, selectedThroughRouteId)
      : getServicesByLine(db, selectedLineId!);
    setMapServices(svcs);
    setMapSelectedServiceIds([]);
    // Build serviceStops map: stationId → serviceId → status
    const rawStops = selectedThroughRouteId
      ? getServiceStopsByThroughRoute(db, selectedThroughRouteId)
      : getServiceStopsByLine(db, selectedLineId!);
    const stopMap: ServiceStopMap = {};
    for (const s of rawStops) {
      if (!stopMap[s.station_id]) stopMap[s.station_id] = {};
      stopMap[s.station_id][s.service_id] = s.status;
    }
    setMapServiceStops(stopMap);
  }, [db, selectedLineId, selectedThroughRouteId]);

  // Reset center square line selection when station or primary line changes
  useEffect(() => {
    setCenterSquareLineIds(
      selectedLineId && selectedStationId ? [selectedLineId] : [],
    );
  }, [selectedStationId, selectedLineId]);

  const adjacentOptions = useMemo(() => {
    if (!db || !selectedLineId || !selectedStationId) {
      return {
        left: [] as AdjacentCandidate[],
        right: [] as AdjacentCandidate[],
      };
    }

    const result: Record<AdjacentSide, AdjacentCandidate[]> = {
      left: [],
      right: [],
    };
    const companyColorById = new Map(
      getAllCompanies(db).map((company) => [company.id, company.company_color]),
    );

    const stationContexts = [
      {
        stationId: selectedStationId,
        stationLines: getStationLines(db, selectedStationId),
      },
      ...getConnectingStations(db, selectedStationId).map((station) => ({
        stationId: station.id,
        stationLines: getStationLines(db, station.id),
      })),
];

    for (const stationContext of stationContexts) {
      for (const stationLine of stationContext.stationLines) {
        const line = lines.find(
          (candidate) => candidate.id === stationLine.line_id,
        );
        if (!line) continue;

        const lineStations = getStationsByLine(db, line.id);
        const stationIndex = lineStations.findIndex(
          (station) => station.id === stationContext.stationId,
        );
        if (stationIndex === -1) continue;

        const isLoop = line.is_loop === 1;
        const previousStation =
          stationIndex > 0
            ? lineStations[stationIndex - 1]
            : isLoop
              ? lineStations[lineStations.length - 1]
              : null;
        const nextStation =
          stationIndex < lineStations.length - 1
            ? lineStations[stationIndex + 1]
            : isLoop
              ? lineStations[0]
              : null;

        const buildCandidate = (
          station: Station | null,
          side: AdjacentSide,
        ): AdjacentCandidate | null => {
          if (!station) return null;
          const stationNumber = getResolvedStationNumber(
            db,
            station.id,
            line.id,
          );
          return {
            optionValue: `${side}:${line.id}:${station.id}`,
            lineId: line.id,
            lineName: line.name,
            side,
            id: `${line.id}:${station.id}`,
            primaryName: station.primary_name,
            primaryNameFurigana: station.primary_name_furigana ?? "",
            secondaryName: station.secondary_name ?? "",
            arrowColor: line.company_id
              ? companyColorById.get(line.company_id)
              : undefined,
            numberPrimaryPrefix: stationNumber?.prefix ?? "",
            numberPrimaryValue: stationNumber?.value ?? "",
            numberPrimaryColor: stationNumber?.line_color,
            numberPrimaryStyle: stationNumber?.station_number_style,
          };
        };

        const relativeDirection =
          stationContext.stationId === selectedStationId
            ? getRelativeLineDirectionAtStation(
                db,
                selectedLineId,
                line.id,
                selectedStationId,
              )
            : null;
        const addCandidate = (station: Station | null, side: AdjacentSide) => {
          const candidate = buildCandidate(station, side);
          if (
            candidate &&
            !result[side].some(
              (existing) => existing.optionValue === candidate.optionValue,
            )
          ) {
            result[side].push(candidate);
          }
        };

        if (relativeDirection === "reverse") {
          addCandidate(nextStation, "left");
          addCandidate(previousStation, "right");
        } else if (relativeDirection === "forward") {
          addCandidate(previousStation, "left");
          addCandidate(nextStation, "right");
        } else {
          // A single junction does not contain enough information to infer
          // orientation. Offer both neighbours for explicit user selection.
          addCandidate(previousStation, "left");
          addCandidate(nextStation, "left");
          addCandidate(previousStation, "right");
          addCandidate(nextStation, "right");
        }
      }
    }

    return result;
  }, [db, selectedLineId, selectedStationId, lines]);

  useEffect(() => {
    const defaultLeft =
      adjacentOptions.left.find((candidate) => candidate.lineId === selectedLineId)
        ?.optionValue ?? null;
    const defaultRight =
      adjacentOptions.right.find((candidate) => candidate.lineId === selectedLineId)
        ?.optionValue ?? null;

    setSelectedLeftAdjacentIds(defaultLeft ? [defaultLeft] : []);
    setSelectedRightAdjacentIds(defaultRight ? [defaultRight] : []);
    setLeftAdjacentDropdownOpened(false);
    setRightAdjacentDropdownOpened(false);
  }, [adjacentOptions, selectedLineId, selectedStationId]);

  const orderedLeftAdjacentIds = selectedLeftAdjacentIds;
  const orderedRightAdjacentIds = selectedRightAdjacentIds;

  // Build sign data when station changes
  useEffect(() => {
    if (!db || !selectedLineId || !selectedStationId) {
      setSignData(null);
      setStationLines([]);
      return;
    }

    const idx = stations.findIndex((s) => s.id === selectedStationId);
    if (idx === -1) {
      setSignData(null);
      return;
    }

    const currentStation = stations[idx];
    const line = lines.find((l) => l.id === selectedLineId);

    // Get station numbers
    const currentNum = getResolvedStationNumber(
      db,
      currentStation.id,
      selectedLineId,
    );

    // Get station areas with zone details
    const areas = getStationAreasWithZones(db, currentStation.id);

    // Get company color. Station-number appearance comes from the resolved
    // source line, which may differ from the selected line (for example a
    // branch inheriting its parent line's number).
    let baseColor = "#3a9200";
    let stationNumberStyle: string | undefined;
    const companies = getAllCompanies(db);
    if (line?.company_id) {
      const company = companies.find((c) => c.id === line.company_id);
      if (company) {
        baseColor = company.company_color;
        stationNumberStyle = company.station_number_style;
      }
    }

    // Lines belonging to this station plus lines reachable through explicit
    // connections to distinct stations.
    const stationLineRecords = getStationLines(db, currentStation.id);
    const transferLineIds = new Set(
      getTransferLineIds(db, currentStation.id),
    );
    const allStationLines = lines.filter((l) =>
      stationLineRecords.some((stationLine) => stationLine.line_id === l.id) ||
      transferLineIds.has(l.id),
    );
    setStationLines(allStationLines);

    const currentNumbers = signStyle === "jreastbranch"
      ? [
          selectedLineId,
          ...allStationLines
            .map((stationLine) => stationLine.id)
            .filter((lineId) => lineId !== selectedLineId),
        ]
          .map((lineId) =>
            getResolvedStationNumber(db, currentStation.id, lineId),
          )
          .filter((number): number is NonNullable<typeof number> => !!number)
          .filter(
            (number, index, numbers) =>
              numbers.findIndex(
                (candidate) => candidate.line_id === number.line_id,
              ) === index,
          )
          .slice(0, 3)
      : currentNum
        ? [currentNum]
        : [];
    stationNumberStyle =
      currentNumbers[0]?.station_number_style ?? stationNumberStyle;

    // Center square colors — map selected line IDs to their colors
    const centerColors =
      centerSquareLineIds.length > 0
        ? (centerSquareLineIds
            .map((id) => allStationLines.find((l) => l.id === id)?.line_color)
            .filter(Boolean) as string[])
        : line
          ? [line.line_color]
          : [];

    const selectedLeftStations = orderedLeftAdjacentIds
      .map((optionValue) =>
        adjacentOptions.left.find((candidate) => candidate.optionValue === optionValue),
      )
      .filter((candidate): candidate is AdjacentCandidate => !!candidate)
      .slice(0, adjacentSelectionLimit);
    const selectedRightStations = orderedRightAdjacentIds
      .map((optionValue) =>
        adjacentOptions.right.find((candidate) => candidate.optionValue === optionValue),
      )
      .filter((candidate): candidate is AdjacentCandidate => !!candidate)
      .slice(0, adjacentSelectionLimit);

    const data: DirectInputStationProps = {
      primaryName: currentStation.primary_name,
      primaryNameFurigana: currentStation.primary_name_furigana ?? "",
      secondaryName: currentStation.secondary_name ?? "",
      tertiaryName: currentStation.tertiary_name ?? undefined,
      quaternaryName: currentStation.quaternary_name ?? undefined,
      note: currentStation.note ?? "",
      threeLetterCode: currentStation.three_letter_code ?? undefined,
      numberPrimaryPrefix: currentNumbers[0]?.prefix ?? "",
      numberPrimaryValue: currentNumbers[0]?.value ?? "",
      numberPrimaryColor: currentNumbers[0]?.line_color,
      numberPrimaryStyle: currentNumbers[0]?.station_number_style,
      numberSecondaryPrefix: currentNumbers[1]?.prefix ?? "",
      numberSecondaryValue: currentNumbers[1]?.value ?? "",
      numberSecondaryColor: currentNumbers[1]?.line_color,
      numberSecondaryStyle: currentNumbers[1]?.station_number_style,
      numberTertiaryPrefix: currentNumbers[2]?.prefix ?? "",
      numberTertiaryValue: currentNumbers[2]?.value ?? "",
      numberTertiaryColor: currentNumbers[2]?.line_color,
      numberTertiaryStyle: currentNumbers[2]?.station_number_style,
      stationAreas: areas.map((a) => ({
        id: a.id,
        name: a.zone_abbreviation,
        isWhite: a.zone_is_black === 0,
      })),
      left: (flipped ? selectedRightStations : selectedLeftStations).map(
        (station) => ({
          id: station.id,
          primaryName: station.primaryName,
          primaryNameFurigana: station.primaryNameFurigana,
          secondaryName: station.secondaryName,
          arrowColor: station.arrowColor,
          numberPrimaryPrefix: station.numberPrimaryPrefix,
          numberPrimaryValue: station.numberPrimaryValue,
          numberPrimaryColor: station.numberPrimaryColor,
          numberPrimaryStyle: station.numberPrimaryStyle,
        }),
      ),
      right: (flipped ? selectedLeftStations : selectedRightStations).map(
        (station) => ({
          id: station.id,
          primaryName: station.primaryName,
          primaryNameFurigana: station.primaryNameFurigana,
          secondaryName: station.secondaryName,
          arrowColor: station.arrowColor,
          numberPrimaryPrefix: station.numberPrimaryPrefix,
          numberPrimaryValue: station.numberPrimaryValue,
          numberPrimaryColor: station.numberPrimaryColor,
          numberPrimaryStyle: station.numberPrimaryStyle,
        }),
      ),
      baseColor,
      stationNumberStyle,
      centerSquareColors: centerColors,
      localLines: [
        ...allStationLines.filter((l) => l.id === selectedLineId),
        ...allStationLines.filter((l) => l.id !== selectedLineId),
      ].map((l) => ({
        id: l.id,
        prefix: l.prefix,
        color: l.line_color,
        stationNumberStyle:
          companies.find((company) => company.id === l.company_id)
            ?.station_number_style ?? "jreast",
      })),
      ratio,
      direction,
    };

    setSignData(data);
  }, [
    db,
    selectedLineId,
    selectedStationId,
    stations,
    lines,
    ratio,
    direction,
    flipped,
    centerSquareLineIds,
    adjacentOptions,
    adjacentSelectionLimit,
    orderedLeftAdjacentIds,
    orderedRightAdjacentIds,
    signStyle,
  ]);

  // Update canvas size list
  useEffect(() => {
    const { height: canvasHeight, scale: baseScale } = SIGN_STYLES[signStyle];
    const effectiveRatio = SIGN_STYLE_FIELDS[signStyle]?.fixedRatio ?? ratio;
    const canvasWidth = canvasHeight * effectiveRatio;
    const sizes = ["SS", "S", "M", "L", "XL", "XXL"];
    const result = sizes.map((label, i) => ({
      label: `${Math.round(canvasWidth * (i + 1))} × ${canvasHeight * (i + 1)} (${label})`,
      value: i + 1,
    }));
    setSaveSizeList(result);
    setSaveSize(baseScale);
  }, [ratio, signStyle]);

  const selectedThroughRoute =
    throughRoutes.find((route) => route.id === selectedThroughRouteId) ?? null;

  const throughRoutePath = useMemo(() => {
    if (!db || !selectedThroughRouteId) {
      return {
        stations: [] as Station[],
        edgeLineIds: [] as string[],
        lineIds: [] as string[],
        stationIdGroups: [] as string[][],
      };
    }

    const stationById = new Map(
      getAllStations(db).map((station) => [station.id, station]),
    );
    const { stationIds, edgeLineIds, lineIds, stationIdGroups } = getThroughRoutePath(
      db,
      selectedThroughRouteId,
    );

    return {
      stations: stationIds
        .map((stationId) => stationById.get(stationId))
        .filter((station): station is Station => !!station),
      edgeLineIds,
      lineIds,
      stationIdGroups:
        stationIdGroups ?? stationIds.map((stationId) => [stationId]),
    };
  }, [db, selectedThroughRouteId]);

  const mapSourceStations = selectedThroughRouteId
    ? throughRoutePath.stations
    : stations;
  const mapSourceStationIdGroups = useMemo(
    () =>
      selectedThroughRouteId
        ? throughRoutePath.stationIdGroups
        : stations.map((station) => [station.id]),
    [selectedThroughRouteId, throughRoutePath.stationIdGroups, stations],
  );
  const mapSourceEdgeLineIds = useMemo(
    () =>
      selectedThroughRouteId
        ? throughRoutePath.edgeLineIds
        : Array.from(
            { length: Math.max(0, stations.length - 1) },
            () => selectedLineId ?? "",
          ),
    [selectedThroughRouteId, throughRoutePath.edgeLineIds, stations, selectedLineId],
  );
  const mapRouteLineIds = useMemo(
    () =>
      selectedThroughRouteId
        ? throughRoutePath.lineIds
        : selectedLineId
          ? [selectedLineId]
          : [],
    [selectedThroughRouteId, throughRoutePath.lineIds, selectedLineId],
  );

  useEffect(() => {
    setMapStartId(mapSourceStations[0]?.id ?? null);
    setMapEndId(mapSourceStations[mapSourceStations.length - 1]?.id ?? null);
    setMapTransitFilter([]);
  }, [selectedLineId, selectedThroughRouteId, mapSourceStations]);

  // Express services on both ordinary lines and through routes share the same
  // route-map rendering constraints.
  useEffect(() => {
    if (mapSelectedServiceIds.length === 0) return;
    const startIdx = mapStartId
      ? mapSourceStations.findIndex((station) => station.id === mapStartId)
      : 0;
    const endIdx = mapEndId
      ? mapSourceStations.findIndex((station) => station.id === mapEndId)
      : mapSourceStations.length - 1;
    const lo = Math.min(startIdx < 0 ? 0 : startIdx, endIdx < 0 ? 0 : endIdx);
    const hi = Math.max(startIdx < 0 ? 0 : startIdx, endIdx < 0 ? 0 : endIdx);
    const rangeStations = mapSourceStations.slice(lo, hi + 1);
    const hasPassedStations =
      mapSelectedServiceIds.length >= 2 ||
      rangeStations.some(
        (station) =>
          !mapSelectedServiceIds.some(
            (id) => !!mapServiceStops[station.id]?.[id],
          ),
      );
    if (hasPassedStations) {
      setMapNameStyle((style) => (style === "normal" ? "above" : style));
    }
    if (mapSelectedServiceIds.length >= 2) {
      setMapStationNumberMode((mode) => (mode === "dot" ? "none" : mode));
    }
  }, [
    mapSelectedServiceIds,
    mapSourceStations,
    mapStartId,
    mapEndId,
    mapServiceStops,
  ]);

  // Compute transit lines for all stations when in line map mode
  useEffect(() => {
    if (!db || mapRouteLineIds.length === 0 || mapSourceStations.length === 0) {
      setMapTransits({});
      return;
    }
    const result: Record<string, Line[]> = {};
    const routeLineIdSet = new Set(mapRouteLineIds);
    for (const [index, station] of mapSourceStations.entries()) {
      const stationIds = mapSourceStationIdGroups[index] ?? [station.id];
      const transferLineIds = new Set(
        stationIds.flatMap((stationId) => getTransferLineIds(db, stationId)),
      );
      const stationLineRecords = stationIds.flatMap((stationId) =>
        getStationLines(db, stationId),
      );
      const otherLines = lines.filter(
        (l) =>
          !routeLineIdSet.has(l.id) &&
          (stationLineRecords.some(
            (stationLine) => stationLine.line_id === l.id,
          ) ||
            transferLineIds.has(l.id)),
      );
      if (otherLines.length > 0) result[station.id] = otherLines;
    }
    setMapTransits(result);
  }, [
    db,
    mapRouteLineIds,
    mapSourceStations,
    mapSourceStationIdGroups,
    lines,
  ]);

  // ── Derived: stations in selected map range (respects direction) ─────────
  const {
    mapStations,
    mapEdgeLineIds,
    mapStationIdGroups,
    mapHasMoreBefore,
    mapHasMoreAfter,
  } = useMemo(() => {
    if (mapSourceStations.length === 0)
      return {
        mapStations: [],
        mapEdgeLineIds: [] as string[],
        mapStationIdGroups: [] as string[][],
        mapHasMoreBefore: false,
        mapHasMoreAfter: false,
      };
    const startIdx = mapStartId
      ? mapSourceStations.findIndex((s) => s.id === mapStartId)
      : 0;
    const endIdx = mapEndId
      ? mapSourceStations.findIndex((s) => s.id === mapEndId)
      : mapSourceStations.length - 1;
    const si = startIdx === -1 ? 0 : startIdx;
    const ei = endIdx === -1 ? mapSourceStations.length - 1 : endIdx;
    const reversed = si > ei;
    const sliced = reversed
      ? mapSourceStations.slice(ei, si + 1).reverse()
      : mapSourceStations.slice(si, ei + 1);
    const slicedEdgeLineIds = reversed
      ? mapSourceEdgeLineIds.slice(ei, si).reverse()
      : mapSourceEdgeLineIds.slice(si, ei);
    const slicedStationIdGroups = reversed
      ? mapSourceStationIdGroups.slice(ei, si + 1).reverse()
      : mapSourceStationIdGroups.slice(si, ei + 1);
    // "More before/after" tracks whether the route continues beyond each
    // displayed end in the direction of travel.
    const hasMoreBefore = reversed
      ? si < mapSourceStations.length - 1
      : si > 0;
    const hasMoreAfter = reversed
      ? ei > 0
      : ei < mapSourceStations.length - 1;
    return {
      mapStations: sliced,
      mapEdgeLineIds: slicedEdgeLineIds,
      mapStationIdGroups: slicedStationIdGroups,
      mapHasMoreBefore: hasMoreBefore,
      mapHasMoreAfter: hasMoreAfter,
    };
  }, [
    mapSourceStations,
    mapSourceStationIdGroups,
    mapSourceEdgeLineIds,
    mapStartId,
    mapEndId,
  ]);

  const selectedBaseLine = lines.find((l) => l.id === selectedLineId) ?? null;
  const firstThroughLine = selectedThroughRouteId
    ? lines.find((line) => line.id === throughRoutePath.lineIds[0]) ?? null
    : null;
  const selectedLine: Line | null = selectedThroughRoute
    ? {
        ...(firstThroughLine ?? {
          id: selectedThroughRoute.id,
          company_id: null,
          secondary_name: null,
          tertiary_name: null,
          quaternary_name: null,
          line_color: "#333333",
          prefix: "",
          priority: null,
          is_loop: 0,
          parent_line_id: null,
        }),
        id: selectedThroughRoute.id,
        name: selectedThroughRoute.name,
        prefix: "",
        is_loop: 0,
        parent_line_id: null,
      }
    : selectedBaseLine;
  const mapRouteSelectValue = selectedThroughRouteId
    ? `through:${selectedThroughRouteId}`
    : selectedLineId
      ? `line:${selectedLineId}`
      : null;
  const mapRouteSelectData = [
    {
      group: t("route.line.title"),
      items: lines.map((routeLine) => ({
        value: `line:${routeLine.id}`,
        label: `[${routeLine.prefix}] ${routeLine.name}`,
      })),
    },
    ...(throughRoutes.length > 0
      ? [
          {
            group: t("route.through-route.title"),
            items: throughRoutes.map((route) => ({
              value: `through:${route.id}`,
              label: route.name,
            })),
          },
        ]
      : []),
  ];
  const isLoopLine = selectedLine?.is_loop === 1;
  // When the user opts into linear rendering for a loop line, treat it as non-loop.
  const effectiveIsLoop = isLoopLine && !mapForceLinear;
  const routeCompanies = useMemo(() => (db ? getAllCompanies(db) : []), [db]);
  const mapCompany = routeCompanies.find(
    (company) => company.id === selectedLine?.company_id,
  );
  const mapCompanyStyle = mapCompany?.station_number_style;
  const signFontSpecs = getStationSignFontSpecs(signStyle, mapCompanyStyle);
  const signFonts = useCanvasFonts(signFontSpecs, tabMode === "sign");
  const mapLineIndicatorStyles = useMemo(() => {
    const styleByCompanyId = new Map(
      routeCompanies.map((company) => [
        company.id,
        company.station_number_style,
      ]),
    );
    return Object.fromEntries(
      lines.map((routeLine) => [
        routeLine.id,
        routeLine.company_id
          ? (styleByCompanyId.get(routeLine.company_id) ?? "jreast")
          : "jreast",
      ]),
    );
  }, [lines, routeCompanies]);
  const mapFontSpecs = getLineMapFontSpecs([
    mapCompanyStyle,
    ...multiSelectedLineIds.map((lineId) => mapLineIndicatorStyles[lineId]),
    ...Object.values(mapStationNumbers).map((number) => number.style),
    ...Object.values(mapStationNumberGroups)
      .flat()
      .map((number) => number.style),
  ]);
  const mapFonts = useCanvasFonts(
    mapFontSpecs,
    tabMode === "linemap" || tabMode === "multiline-linemap",
  );
  const mapLanguageOptions = getCompanyLanguages(mapCompany).map(
    (language, index) => ({
      value: STATION_NAME_FIELDS[index],
      label: `${t(LANGUAGE_SLOT_LABEL_KEYS[index])} (${getRailwayLanguageLabel(language)})`,
    }),
  );
  const multiSelectedLines = useMemo(
    () =>
      multiSelectedLineIds
        .map((lineId) => lines.find((line) => line.id === lineId))
        .filter((line): line is Line => !!line),
    [multiSelectedLineIds, lines],
  );
  // Inclusion and order are manual. The first selected line is the visual
  // spine and owns the filename/company-language context.
  const multiRootLine = multiSelectedLines[0] ?? null;
  const multiCompany = routeCompanies.find(
    (company) => company.id === multiRootLine?.company_id,
  );
  const multiLanguageOptions = getCompanyLanguages(multiCompany).map(
    (language, index) => ({
      value: STATION_NAME_FIELDS[index],
      label: `${t(LANGUAGE_SLOT_LABEL_KEYS[index])} (${getRailwayLanguageLabel(language)})`,
    }),
  );
  const multiLineRoutes = useMemo((): MultiLineRouteData[] => {
    if (!db || !multiRootLine) return [];
    const selectedIds = new Set(multiSelectedLineIds);
    const orderedLines = multiSelectedLines;

    return orderedLines.map((line) => {
      const routeStations = getStationsByLine(db, line.id);
      const stationNumbers: StationNumberMap = {};
      const transits: Record<string, Line[]> = {};
      for (const station of routeStations) {
        const number = getResolvedStationNumber(db, station.id, line.id);
        if (number) {
          stationNumbers[station.id] = {
            prefix: number.prefix,
            value: number.value,
            threeLetterCode: station.three_letter_code,
            color: number.line_color,
            style: number.station_number_style,
          };
        }
        const transferIds = new Set(getTransferLineIds(db, station.id));
        const stationLineIds = new Set(
          getStationLines(db, station.id).map((stationLine) => stationLine.line_id),
        );
        const stationTransits = lines.filter(
          (candidate) =>
            !selectedIds.has(candidate.id) &&
            (stationLineIds.has(candidate.id) || transferIds.has(candidate.id)),
        );
        if (stationTransits.length > 0) transits[station.id] = stationTransits;
      }
      const companyStyle = routeCompanies.find(
        (company) => company.id === line.company_id,
      )?.station_number_style;
      return {
        line,
        stations: routeStations,
        stationNumbers,
        transits,
        companyStyle,
      };
    });
  }, [
    db,
    multiRootLine,
    multiSelectedLineIds,
    multiSelectedLines,
    mapLineIndicatorStyles,
    lines,
    routeCompanies,
  ]);
  const multiTransitLines = useMemo(() => {
    const seen = new Set<string>();
    const result: Line[] = [];
    for (const route of multiLineRoutes) {
      for (const stationTransits of Object.values(route.transits)) {
        for (const transit of stationTransits) {
          if (seen.has(transit.id)) continue;
          seen.add(transit.id);
          result.push(transit);
        }
      }
    }
    return result;
  }, [multiLineRoutes]);
  const filteredMultiLineRoutes = useMemo(
    () =>
      multiLineRoutes.map((route) => ({
        ...route,
        transits: Object.fromEntries(
          Object.entries(route.transits).map(([stationId, stationTransits]) => [
            stationId,
            stationTransits.filter((line) => multiTransitFilter.includes(line.id)),
          ]),
        ),
      })),
    [multiLineRoutes, multiTransitFilter],
  );
  const multiMapSaveSizeList = useMemo(() => {
    if (!multiRootLine) return [];
    const layoutInputs = multiLineRoutes.map(({ line, stations: routeStations }) => ({
        lineId: line.id,
        parentLineId: line.parent_line_id,
        stationIds: routeStations.map((station) => station.id),
        isLoop: !!line.is_loop,
      }));
    const loopRoot = multiLineRoutes.find((route) => !!route.line.is_loop)?.line;
    const layoutRootId = loopRoot?.id ?? multiRootLine.id;
    const laneGap = Math.max(16, normalizeTrackWidth(mapTrackWidth) + 4);
    const dimensions = loopRoot
      ? layoutCircularMultiLineMap(
          layoutInputs,
          layoutRootId,
          mapStationSpacing,
          laneGap,
        )
      : applyParallelRouteLanes(
          layoutMultiLineMap(layoutInputs, layoutRootId, mapStationSpacing),
          layoutInputs,
          laneGap,
        );
    return getLineMapPngSizeOptions(dimensions.width, dimensions.height);
  }, [multiLineRoutes, multiRootLine, mapStationSpacing, mapTrackWidth]);

  const lineById = useMemo(
    () => new Map(lines.map((routeLine) => [routeLine.id, routeLine])),
    [lines],
  );
  const mapTrackColors = useMemo(
    () =>
      mapEdgeLineIds.map(
        (lineId) =>
          lineById.get(lineId)?.line_color ??
          selectedLine?.line_color ??
          "#333333",
      ),
    [mapEdgeLineIds, lineById, selectedLine],
  );
  const mapStationLineIds = useMemo(
    () =>
      mapStations.map((_, index) => {
        if (mapEdgeLineIds.length === 0) return mapRouteLineIds[0] ?? "";
        return (
          mapEdgeLineIds[Math.min(index, mapEdgeLineIds.length - 1)] ?? ""
        );
      }),
    [mapStations, mapEdgeLineIds, mapRouteLineIds],
  );
  const mapStationColors = useMemo(
    () =>
      Object.fromEntries(
        mapStations.map((station, index) => [
          station.id,
          lineById.get(mapStationLineIds[index] ?? "")?.line_color ??
            selectedLine?.line_color ??
            "#333333",
        ]),
      ),
    [mapStations, mapStationLineIds, lineById, selectedLine],
  );

  // Derive ServiceInfo list (1+ services) for renderer
  const mapServiceInfos = useMemo((): ServiceInfo[] => {
    if (mapSelectedServiceIds.length < 1) return [];
    return mapSelectedServiceIds
      .map((id) => mapServices.find((s) => s.id === id))
      .filter((s): s is Service => !!s)
      .map((s) => ({ id: s.id, name: s.name, color: s.color }));
  }, [mapSelectedServiceIds, mapServices]);

  // Filter stations for "hide-trim" mode: exclude passed stations from the list
  const mapDisplayStations = useMemo(() => {
    if (mapPassedMode !== "hide-trim" || mapServiceInfos.length === 0)
      return mapStations;
    return mapStations.filter((s) =>
      mapServiceInfos.some((svc) => !!mapServiceStops[s.id]?.[svc.id]),
    );
  }, [mapPassedMode, mapStations, mapServiceInfos, mapServiceStops]);

  // True when any selected service skips at least one station in the current range
  const mapHasPassedStations = useMemo(() => {
    if (mapSelectedServiceIds.length === 0) return false;
    if (mapSelectedServiceIds.length >= 2) return true;
    return mapStations.some(
      (s) => !mapServiceInfos.some((svc) => !!mapServiceStops[s.id]?.[svc.id]),
    );
  }, [
    mapSelectedServiceIds.length,
    mapStations,
    mapServiceInfos,
    mapServiceStops,
  ]);

  // Build label map: stationId -> "[JY01] 東京" format for dropdowns
  const stationLabelMap = useMemo(() => {
    if (!db || mapSourceStations.length === 0)
      return {} as Record<string, string>;
    const result: Record<string, string> = {};
    for (const [index, s] of mapSourceStations.entries()) {
      const edgeIndex = Math.min(index, mapSourceEdgeLineIds.length - 1);
      const lineId =
        mapSourceEdgeLineIds[edgeIndex] ?? mapRouteLineIds[0] ?? selectedLineId;
      const stationId = lineId
        ? getStationIdForLine(
            db,
            mapSourceStationIdGroups[index] ?? [s.id],
            lineId,
          )
        : s.id;
      const num = lineId
        ? getResolvedStationNumber(db, stationId, lineId)
        : null;
      const badge = num?.prefix ? `[${num.prefix}${num.value}] ` : "";
      result[s.id] = `${badge}${s.primary_name}`;
    }
    return result;
  }, [
    db,
    mapSourceStations,
    mapSourceStationIdGroups,
    mapSourceEdgeLineIds,
    mapRouteLineIds,
    selectedLineId,
  ]);

  // Load station numbers for map range
  useEffect(() => {
    if (!db || mapStations.length === 0) {
      setMapStationNumbers({});
      setMapStationNumberGroups({});
      return;
    }
    const result: StationNumberMap = {};
    const groups: StationNumberGroupMap = {};
    const stationById = new Map(
      getAllStations(db).map((station) => [station.id, station]),
    );
    const toStationNumberInfo = (
      lineId: string,
      station: Station,
    ): StationNumberInfo | null => {
      const number = getResolvedStationNumber(db, station.id, lineId);
      if (!number) return null;
      return {
        prefix: number.prefix,
        value: number.value,
        threeLetterCode: station.three_letter_code,
        color: number.line_color,
        style: number.station_number_style,
      };
    };

    for (const [index, station] of mapStations.entries()) {
      const lineId = mapStationLineIds[index];
      if (!lineId) continue;
      const stationIds = mapStationIdGroups[index] ?? [station.id];
      const displayStationId = getStationIdForLine(db, stationIds, lineId);
      const displayNumber = toStationNumberInfo(lineId, {
        ...station,
        id: displayStationId,
      });
      if (displayNumber) result[station.id] = displayNumber;

      const incomingLineId = mapEdgeLineIds[index - 1];
      const outgoingLineId = mapEdgeLineIds[index];
      if (
        !selectedThroughRouteId ||
        !incomingLineId ||
        !outgoingLineId ||
        incomingLineId === outgoingLineId
      ) {
        continue;
      }
      const incomingStationId = getStationIdForLine(
        db,
        stationIds,
        incomingLineId,
      );
      const outgoingStationId = getStationIdForLine(
        db,
        stationIds,
        outgoingLineId,
      );
      const incomingResolved = getResolvedStationNumber(
        db,
        incomingStationId,
        incomingLineId,
      );
      const outgoingResolved = getResolvedStationNumber(
        db,
        outgoingStationId,
        outgoingLineId,
      );
      if (
        !incomingResolved ||
        !outgoingResolved ||
        incomingResolved.id === outgoingResolved.id
      ) {
        continue;
      }
      groups[station.id] = [
        {
          prefix: incomingResolved.prefix,
          value: incomingResolved.value,
          threeLetterCode:
            stationById.get(incomingStationId)?.three_letter_code,
          color: incomingResolved.line_color,
          style: incomingResolved.station_number_style,
        },
        {
          prefix: outgoingResolved.prefix,
          value: outgoingResolved.value,
          threeLetterCode:
            stationById.get(outgoingStationId)?.three_letter_code,
          color: outgoingResolved.line_color,
          style: outgoingResolved.station_number_style,
        },
      ];
    }
    setMapStationNumbers(result);
    setMapStationNumberGroups(groups);
  }, [
    db,
    mapStations,
    mapStationIdGroups,
    mapStationLineIds,
    mapEdgeLineIds,
    selectedThroughRouteId,
    mapLineIndicatorStyles,
  ]);

  // All unique transit lines that appear in the current map range
  const allTransitLines = useMemo(() => {
    const seen = new Set<string>();
    const result: Line[] = [];
    for (const station of mapStations) {
      for (const tl of mapTransits[station.id] ?? []) {
        if (!seen.has(tl.id)) {
          seen.add(tl.id);
          result.push(tl);
        }
      }
    }
    return result;
  }, [mapStations, mapTransits]);

  // Max 縦書き text height (Konva units) — used to size canvas when nameStyle is above/below
  const mapMaxNameExtent = useMemo(() => {
    if (mapStations.length === 0) return 60;
    const maxCharCount = Math.max(
      ...mapStations.map((station) =>
        Math.max(
          [...(station[mapPrimaryLang] ?? "")].length,
          mapShowSecondaryLang
            ? [...(station[mapSecondaryLang] ?? "")].length
            : 0,
        ),
      ),
    );
    return maxCharCount > 0 ? maxCharCount * (JP_FONT + 1) - 1 : 60;
  }, [
    mapStations,
    mapPrimaryLang,
    mapSecondaryLang,
    mapShowSecondaryLang,
  ]);

  // Apply transit filter before passing to renderer
  const filteredMapTransits = useMemo<Record<string, Line[]>>(
    () =>
      Object.fromEntries(
        Object.entries(mapTransits).map(([stationId, tlines]) => [
          stationId,
          tlines.filter((tl) => mapTransitFilter.includes(tl.id)),
        ]),
      ),
    [mapTransits, mapTransitFilter],
  );
  const mapStationNumberExtraExtent =
    shouldExpandStationNumberGroups(
      mapStationNumberMode,
      mapOrientation,
      mapNameStyle,
    )
      ? getStationNumberGroupExtraExtent(
          mapStationNumberGroups,
          mapOrientation,
          mapStationNumberMode === "dot" ? 1 : 0,
        )
      : 0;

  // Save size options for line map (multiples of native canvas resolution)
  const mapSaveSizeList = useMemo(() => {
    const { w, h } = getMapCanvasDimensions(
      mapStations.length,
      effectiveIsLoop,
      mapOrientation,
      filteredMapTransits,
      mapNameStyle,
      mapMaxNameExtent,
      mapStationSpacing,
      mapForceLinear ? true : mapHasMoreBefore && mapShowFadeBefore,
      mapForceLinear ? true : mapHasMoreAfter && mapShowFadeAfter,
      mapShowTransitNames,
      mapTrackWidth,
      mapStationNumberExtraExtent,
    );
    return getLineMapPngSizeOptions(w, h);
  }, [
    mapStations.length,
    effectiveIsLoop,
    mapOrientation,
    filteredMapTransits,
    mapNameStyle,
    mapMaxNameExtent,
    mapStationSpacing,
    mapForceLinear,
    mapHasMoreBefore,
    mapShowFadeBefore,
    mapHasMoreAfter,
    mapShowFadeAfter,
    mapShowTransitNames,
    mapTrackWidth,
    mapStationNumberExtraExtent,
  ]);

  // Overlap warnings for circular maps
  const overlapWarnings = useMemo<string[]>(() => {
    if (!effectiveIsLoop || mapStations.length === 0) return [];
    return detectCircularOverlaps(
      mapStations,
      filteredMapTransits,
      mapFontSize,
      mapStationNumberMode,
      mapStationNumbers,
      mapPrimaryLang,
      mapSecondaryLang,
      mapShowSecondaryLang,
      mapShowTransitNames,
      mapTrackWidth,
    );
  }, [
    effectiveIsLoop,
    mapStations,
    filteredMapTransits,
    mapFontSize,
    mapStationNumberMode,
    mapStationNumbers,
    mapPrimaryLang,
    mapSecondaryLang,
    mapShowSecondaryLang,
    mapShowTransitNames,
    mapTrackWidth,
  ]);

  const hasVisibleTransitSecondaryNames =
    mapShowTransitNames &&
    mapDisplayStations.some((station) =>
      filteredMapTransits[station.id]?.some(
        (transitLine) => !!transitLine.secondary_name?.trim(),
      ),
    );
  const mapDownloadTextTooSmall =
    mapExportFormat === "png" &&
    hasVisibleTransitSecondaryNames &&
    isTransitSecondaryNameExportTooSmall(mapSaveSize);
  const mapDownloadWarningText = mapDownloadTextTooSmall
    ? t("route.linemap.download-text-warning")
    : null;

  const handleSaveSign = async () => {
    if (!signData) return;
    if (signRef.current) {
      await waitForCanvasFonts(signFontSpecs).catch(() => undefined);
      const { scale: baseScale } = SIGN_STYLES[signStyle];
      const uri = signRef.current.toDataURL({
        pixelRatio: saveSize / baseScale,
      });
      const link = document.createElement("a");
      const filename = getLocalizedRailwayName(
        locale,
        getCompanyLanguages(mapCompany),
        [
          signData.primaryName,
          signData.secondaryName,
          signData.tertiaryName,
          signData.quaternaryName,
        ],
        "station",
      );
      link.download = `${filename}.png`;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error(t("error.on-save"));
    }
  };

  const saveLineMapStage = async (
    stage: Konva.Stage,
    filename: string,
    baseScale: number,
  ) => {
    setMapExporting(true);
    setMapExportError(null);
    try {
      await waitForCanvasFonts(mapFontSpecs).catch(() => undefined);
      const blob = await createLineMapExportBlob({
        stage,
        format: mapExportFormat,
        pixelRatio: mapSaveSize / baseScale,
      });
      downloadBlob(blob, `${filename}.${mapExportFormat}`);
    } catch (error) {
      console.error("Line-map export failed", error);
      setMapExportError(t("route.linemap.export-error"));
    } finally {
      setMapExporting(false);
    }
  };

  const handleSaveMap = async () => {
    if (!mapRef.current || !selectedLine) return;
    const filename = getLocalizedRailwayName(
      locale,
      getCompanyLanguages(mapCompany),
      [
        selectedLine.name,
        selectedLine.secondary_name,
        selectedLine.tertiary_name,
        selectedLine.quaternary_name,
      ],
      "line",
    );
    await saveLineMapStage(
      mapRef.current,
      `${filename}_${t("route.linemap.filename-suffix")}`,
      LineMapScale,
    );
  };

  const handleSaveMultiLineMap = async () => {
    if (!multiLineMapRef.current || !multiRootLine) return;
    const filename = getLocalizedRailwayName(
      locale,
      getCompanyLanguages(multiCompany),
      [
        multiRootLine.name,
        multiRootLine.secondary_name,
        multiRootLine.tertiary_name,
        multiRootLine.quaternary_name,
      ],
      "line",
    );
    await saveLineMapStage(
      multiLineMapRef.current,
      `${filename}_${t("route.linemap.filename-suffix")}`,
      multiLineMapScale,
    );
  };

  if (loading) {
    return (
      <Center style={{ height: "300px" }}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            {t("common.loading")}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (lines.length === 0) {
    return (
      <Center style={{ padding: "60px 20px" }}>
        <Text c="dimmed" ta="center">
          {t("route.no-routes")}
        </Text>
      </Center>
    );
  }

  return (
    <Box className={styles.routeInputShell}>
      <Stack gap="md">
        {/* Mode toggle */}
        <Group className={styles.modeBar}>
          <SegmentedControl
            className={styles.modeControl}
            value={tabMode}
            onChange={(value) => {
              const nextMode = value as TabMode;
              setTabMode(nextMode);
              if (
                nextMode === "multiline-linemap" &&
                multiSelectedLineIds.length === 0 &&
                selectedLineId
              ) {
                // Carry over only the currently selected line. Additional
                // lines remain an explicit user choice.
                setMultiSelectedLineIds([selectedLineId]);
              }
            }}
            data={[
              {
                value: "sign",
                label: (
                  <Group gap={6}>
                    <IconSignRight size={16} />
                    {t("route.mode.sign")}
                  </Group>
                ),
              },
              {
                value: "linemap",
                label: (
                  <Group gap={6}>
                    <IconMap size={16} />
                    {t("route.mode.linemap")}
                  </Group>
                ),
              },
              {
                value: "multiline-linemap",
                label: (
                  <Group gap={6}>
                    <IconMap size={16} />
                    {t("route.mode.multiline-linemap")}
                  </Group>
                ),
              },
            ]}
          />
        </Group>

        {/* ── Sign mode controls ────────────────────────────────────────── */}
        {tabMode === "sign" && (
          <Stack gap="lg" className={styles.signWorkspace}>
            <Paper withBorder radius="lg" className={styles.formatBar}>
              <Select
                className={styles.formatControl}
                label={t("route.sign.style")}
                value={signStyle}
                onChange={(value) => value && setSignStyle(value as SignStyle)}
                data={[
                  { value: "jreast", label: t("route.sign.jreast") },
                  {
                    value: "jreastbranch",
                    label: t("route.sign.jreastbranch"),
                  },
                  { value: "jrcentral", label: t("route.sign.jrcentral") },
                  { value: "jrwest", label: t("route.sign.jrwest") },
                  {
                    value: "jrwestlarge",
                    label: t("route.sign.jrwestlarge"),
                  },
                  { value: "metrolong", label: t("route.sign.metrolong") },
                  {
                    value: "metroforeign",
                    label: t("route.sign.metroforeign"),
                  },
                  {
                    value: "metromedium",
                    label: t("route.sign.metromedium"),
                  },
                  {
                    value: "toeimedium",
                    label: t("route.sign.toeimedium"),
                  },
                  { value: "toeilarge", label: t("route.sign.toeilarge") },
                ]}
              />
              <Box className={styles.directionControl}>
                <Text size="sm" fw={500} mb={4}>
                  {t("route.sign.direction")}
                </Text>
                <SegmentedControl
                  value={direction}
                  onChange={(value) => setDirection(value as Direction)}
                  data={[
                    { value: "left", label: <IconArrowLeft size={16} /> },
                    {
                      value: "both",
                      label: <IconArrowsHorizontal size={16} />,
                    },
                    { value: "right", label: <IconArrowRight size={16} /> },
                  ]}
                />
              </Box>
            </Paper>

            <Box
              className={styles.signComposer}
              style={
                {
                  "--route-accent": selectedBaseLine?.line_color ?? "#228be6",
                } as CSSProperties
              }
            >
              <Paper
                withBorder
                radius="lg"
                className={`${styles.stationCard} ${styles.leftStationCard}`}
              >
                <Group className={styles.stationCardHeader} gap="sm" wrap="nowrap">
                  <Box className={styles.stationNode} aria-hidden="true">
                    <IconArrowLeft size={16} />
                  </Box>
                  <Text fw={700}>{t("input.direct.input-left")}</Text>
                </Group>
                <Stack gap={4}>
                  <MultiSelect
                    label={t("route.sign.prev-station")}
                    value={selectedLeftAdjacentIds}
                    onChange={(value) => {
                      setSelectedLeftAdjacentIds(
                        value.slice(0, adjacentSelectionLimit),
                      );
                      if (value.length >= adjacentSelectionLimit) {
                        setLeftAdjacentDropdownOpened(false);
                      }
                    }}
                    dropdownOpened={leftAdjacentDropdownOpened}
                    onDropdownOpen={() => setLeftAdjacentDropdownOpened(true)}
                    onDropdownClose={() => setLeftAdjacentDropdownOpened(false)}
                    data={adjacentOptions.left.map((candidate) => ({
                      value: candidate.optionValue,
                      label: `${candidate.primaryName}（${candidate.lineName}）`,
                    }))}
                    placeholder={t("route.sign.adjacent-select", {
                      count: String(adjacentSelectionLimit),
                    })}
                    disabled={!selectedStationId}
                    maxValues={adjacentSelectionLimit}
                    clearable
                  />
                  {selectedLeftAdjacentIds.length >= 2 && (
                    <AdjacentOrderControls
                      candidates={adjacentOptions.left}
                      orderedIds={orderedLeftAdjacentIds}
                      onMove={(fromIndex, toIndex) =>
                        setSelectedLeftAdjacentIds((ids) =>
                          moveAdjacentStationId(ids, fromIndex, toIndex)
                        )
                      }
                      t={t}
                    />
                  )}
                </Stack>
              </Paper>

              <Paper
                withBorder
                radius="lg"
                className={`${styles.stationCard} ${styles.currentStationCard}`}
              >
                <Group className={styles.stationCardHeader} gap="sm" wrap="nowrap">
                  <Box className={styles.stationNode} aria-hidden="true">
                    <IconSignRight size={17} />
                  </Box>
                  <Text fw={700}>{t("input.direct.input-current")}</Text>
                </Group>
                <Stack gap="sm">
                  <Select
                    label={t("route.line.title")}
                    value={selectedLineId}
                    onChange={(value) => {
                      setSelectedLineId(value);
                      if (value) setSelectedThroughRouteId(null);
                    }}
                    data={lines.map((line) => ({
                      value: line.id,
                      label: `[${line.prefix}] ${line.name}`,
                    }))}
                    placeholder={t("route.line.select")}
                    clearable
                  />
                  <Select
                    label={t("route.station.title")}
                    value={selectedStationId}
                    onChange={setSelectedStationId}
                    data={stations.map((station) => ({
                      value: station.id,
                      label: stationLabelMap[station.id] ?? station.primary_name,
                    }))}
                    placeholder={
                      selectedLineId
                        ? t("route.station.select")
                        : t("route.station.empty")
                    }
                    disabled={!selectedLineId}
                    clearable
                  />
                  {SIGN_STYLE_FIELDS[signStyle]?.centerSquareColors !==
                    "hidden" && (
                    <MultiSelect
                      label={t("route.sign.center-colors")}
                      value={centerSquareLineIds}
                      onChange={(value) =>
                        setCenterSquareLineIds(
                          value.length > 0
                            ? value.slice(0, 4)
                            : centerSquareLineIds,
                        )
                      }
                      data={stationLines.map((line) => ({
                        value: line.id,
                        label: `[${line.prefix}] ${line.name}`,
                      }))}
                      disabled={!selectedStationId}
                      maxValues={4}
                    />
                  )}
                </Stack>
              </Paper>

              <Paper
                withBorder
                radius="lg"
                className={`${styles.stationCard} ${styles.rightStationCard}`}
              >
                <Group className={styles.stationCardHeader} gap="sm" wrap="nowrap">
                  <Box className={styles.stationNode} aria-hidden="true">
                    <IconArrowRight size={16} />
                  </Box>
                  <Text fw={700}>{t("input.direct.input-right")}</Text>
                </Group>
                <Stack gap={4}>
                  <MultiSelect
                    label={t("route.sign.next-station")}
                    value={selectedRightAdjacentIds}
                    onChange={(value) => {
                      setSelectedRightAdjacentIds(
                        value.slice(0, adjacentSelectionLimit),
                      );
                      if (value.length >= adjacentSelectionLimit) {
                        setRightAdjacentDropdownOpened(false);
                      }
                    }}
                    dropdownOpened={rightAdjacentDropdownOpened}
                    onDropdownOpen={() => setRightAdjacentDropdownOpened(true)}
                    onDropdownClose={() => setRightAdjacentDropdownOpened(false)}
                    data={adjacentOptions.right.map((candidate) => ({
                      value: candidate.optionValue,
                      label: `${candidate.primaryName}（${candidate.lineName}）`,
                    }))}
                    placeholder={t("route.sign.adjacent-select", {
                      count: String(adjacentSelectionLimit),
                    })}
                    disabled={!selectedStationId}
                    maxValues={adjacentSelectionLimit}
                    clearable
                  />
                  {selectedRightAdjacentIds.length >= 2 && (
                    <AdjacentOrderControls
                      candidates={adjacentOptions.right}
                      orderedIds={orderedRightAdjacentIds}
                      onMove={(fromIndex, toIndex) =>
                        setSelectedRightAdjacentIds((ids) =>
                          moveAdjacentStationId(ids, fromIndex, toIndex)
                        )
                      }
                      t={t}
                    />
                  )}
                </Stack>
              </Paper>
            </Box>

            {/* Station navigation + flip */}
            <Paper withBorder radius="lg" className={styles.adjustmentBar}>
              <Group gap="sm" className={styles.stationNavigation}>
              <Button
                variant="outline"
                size="sm"
                leftSection={<IconArrowLeft size={16} />}
                disabled={!selectedStationId || stations.length === 0}
                onClick={() => {
                  const idx = stations.findIndex(
                    (s) => s.id === selectedStationId,
                  );
                  if (idx > 0) setSelectedStationId(stations[idx - 1].id);
                  else if (
                    lines.find((l) => l.id === selectedLineId)?.is_loop === 1
                  )
                    setSelectedStationId(stations[stations.length - 1].id);
                }}
              >
                {t("route.sign.prev-station")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                rightSection={<IconArrowRight size={16} />}
                disabled={!selectedStationId || stations.length === 0}
                onClick={() => {
                  const idx = stations.findIndex(
                    (s) => s.id === selectedStationId,
                  );
                  if (idx < stations.length - 1)
                    setSelectedStationId(stations[idx + 1].id);
                  else if (
                    lines.find((l) => l.id === selectedLineId)?.is_loop === 1
                  )
                    setSelectedStationId(stations[0].id);
                }}
              >
                {t("route.sign.next-station")}
              </Button>
              <Button
                variant={flipped ? "filled" : "outline"}
                size="sm"
                leftSection={<IconArrowsLeftRight size={16} />}
                disabled={!selectedStationId}
                onClick={() => setFlipped((f) => !f)}
              >
                {t("route.sign.flip")}
              </Button>
              </Group>

              {/* Ratio slider — hidden for fixed-ratio styles */}
              {SIGN_STYLE_FIELDS[signStyle]?.fixedRatio === undefined && (
                <Box className={styles.ratioControl}>
                  <IconRuler size={20} className={styles.ratioIcon} />
                  <Slider
                    value={ratio}
                    label={(value) => value}
                    labelAlwaysOn
                    step={0.5}
                    min={2.5}
                    max={8}
                    className={styles.ratioSlider}
                    onChange={setRatio}
                  />
                </Box>
              )}
            </Paper>

            {/* Sign preview */}
            <Paper withBorder radius="xl" className={styles.previewPanel}>
              <Group justify="space-between" align="center" mb="md">
                <Title order={2} className={styles.previewTitle}>
                  <IconEye size="1.6em" />
                  {t("common.preview")}
                </Title>
                {selectedBaseLine && (
                  <Box
                    className={styles.previewLineSwatch}
                    style={{ backgroundColor: selectedBaseLine.line_color }}
                    aria-hidden="true"
                  />
                )}
              </Group>
              {signData ? (
                <>
                {signFonts.ready ? (
                  (() => {
                    const { Component: SignComponent } = SIGN_STYLES[signStyle];
                    return (
                      <SignComponent
                        {...signData}
                        direction={direction}
                        ref={signRef}
                      />
                    );
                  })()
                ) : (
                  <CanvasFontLoading show={signFonts.showLoader} />
                )}

                {/* Download controls */}
                <Grid gutter="md" className={styles.downloadControls}>
                  <Grid.Col span={{ base: 12, sm: 7, lg: 9 }}>
                    <Select
                      label={t("input.image-size")}
                      value={String(saveSize)}
                      onChange={(v) => v && setSaveSize(Number(v))}
                      data={saveSizeList.map((e) => ({
                        value: String(e.value),
                        label: e.label.trim(),
                      }))}
                    />
                  </Grid.Col>
                  <Grid.Col
                    span={{ base: 12, sm: 5, lg: 3 }}
                    className={styles.downloadButtonColumn}
                  >
                    <Button
                      color="green"
                      size="lg"
                      variant="filled"
                      onClick={handleSaveSign}
                      disabled={!signFonts.ready}
                      fullWidth
                      style={{ fontWeight: 700 }}
                      leftSection={<IconDownload />}
                    >
                      {t("input.save")}
                    </Button>
                  </Grid.Col>
                </Grid>
                </>
              ) : (
                <Box className={styles.emptyPreview}>
                  <Text>{t("input.direct.input-left")}</Text>
                  <Text fw={700}>{t("input.direct.input-current")}</Text>
                  <Text>{t("input.direct.input-right")}</Text>
                </Box>
              )}
            </Paper>
          </Stack>
        )}

        {/* ── Line map mode controls ────────────────────────────────────── */}
        {tabMode === "linemap" && (
          <Stack
            gap="lg"
            className={styles.linemapWorkspace}
            style={
              {
                "--route-accent": selectedLine?.line_color ?? "#228be6",
              } as CSSProperties
            }
          >
            {/* ── Route ── */}
            <Paper withBorder radius="lg" className={styles.mapSourcePanel}>
              <Group className={styles.mapSectionHeader} gap="sm">
                <Box className={styles.mapSectionIcon} aria-hidden="true">
                  <IconMap size={18} />
                </Box>
                <Title order={2}>{t("route.linemap.section-route")}</Title>
              </Group>
              <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 12, md: 4 }}>
                <Select
                  label={t("route.line.title")}
                  value={mapRouteSelectValue}
                  onChange={(value) => {
                    if (value?.startsWith("line:")) {
                      setSelectedLineId(value.slice("line:".length));
                      setSelectedThroughRouteId(null);
                    } else if (value?.startsWith("through:")) {
                      setSelectedThroughRouteId(value.slice("through:".length));
                      setSelectedLineId(null);
                    } else {
                      setSelectedLineId(null);
                      setSelectedThroughRouteId(null);
                    }
                  }}
                  data={mapRouteSelectData}
                  placeholder={t("route.line.select")}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 5, md: 4 }}>
                <Select
                  label={t("route.linemap.range-start")}
                  value={mapStartId}
                  onChange={setMapStartId}
                  data={mapSourceStations.map((s) => ({
                    value: s.id,
                    label: stationLabelMap[s.id] ?? s.primary_name,
                  }))}
                  placeholder={
                    selectedLine
                      ? t("route.station.select")
                      : t("route.station.empty")
                  }
                  disabled={!selectedLine}
                />
              </Grid.Col>
              <Grid.Col
                span={{ base: 12, sm: 2, md: 1 }}
                style={{ display: "flex", alignItems: "flex-end" }}
              >
                <Button
                  variant="default"
                  fullWidth
                  disabled={!selectedLine}
                  onClick={() => {
                    const tmp = mapStartId;
                    setMapStartId(mapEndId);
                    setMapEndId(tmp);
                  }}
                  title={t("route.linemap.swap")}
                >
                  <IconArrowsLeftRight size={16} />
                </Button>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 5, md: 3 }}>
                <Select
                  label={t("route.linemap.range-end")}
                  value={mapEndId}
                  onChange={setMapEndId}
                  data={mapSourceStations.map((s) => ({
                    value: s.id,
                    label: stationLabelMap[s.id] ?? s.primary_name,
                  }))}
                  placeholder={
                    selectedLine
                      ? t("route.station.select")
                      : t("route.station.empty")
                  }
                  disabled={!selectedLine}
                />
              </Grid.Col>
              </Grid>
            </Paper>

            {/* ── Services ── */}
            {(mapServices.length >= 2 ||
              (!!selectedThroughRouteId && mapServices.length >= 1)) && (
              <Paper withBorder radius="lg" className={styles.mapSettingsPanel}>
                <Group className={styles.mapSectionHeader} gap="sm">
                  <Box className={styles.mapSectionIndex} aria-hidden="true">
                    <IconArrowsHorizontal size={17} />
                  </Box>
                  <Title order={2}>{t("route.linemap.services")}</Title>
                </Group>
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <MultiSelect
                      label={t("route.linemap.services")}
                      value={mapSelectedServiceIds}
                      onChange={setMapSelectedServiceIds}
                      data={mapServices.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                      placeholder={t("route.linemap.services-placeholder")}
                    />
                  </Grid.Col>
                  {mapSelectedServiceIds.length >= 1 && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 5 }}>
                      <Text size="sm" fw={500} mb={4}>
                        {t("route.linemap.show-passed-stations")}
                      </Text>
                      <SegmentedControl
                        value={mapPassedMode}
                        onChange={(v) =>
                          setMapPassedMode(v as PassedStationMode)
                        }
                        data={[
                          {
                            label: t("route.linemap.passed-show"),
                            value: "show",
                          },
                          {
                            label: t("route.linemap.passed-hide-gap"),
                            value: "hide-gap",
                          },
                          {
                            label: t("route.linemap.passed-hide-trim"),
                            value: "hide-trim",
                          },
                        ]}
                        size="xs"
                        fullWidth
                      />
                    </Grid.Col>
                  )}
                  {mapSelectedServiceIds.length === 1 && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                      <Text size="sm" fw={500} mb={4}>
                        {t("route.linemap.service-name-style")}
                      </Text>
                      <SegmentedControl
                        value={mapServiceNameStyle}
                        onChange={(v) =>
                          setMapServiceNameStyle(v as "paren" | "badge")
                        }
                        data={[
                          {
                            label: t("route.linemap.service-name-paren"),
                            value: "paren",
                          },
                          {
                            label: t("route.linemap.service-name-badge"),
                            value: "badge",
                          },
                        ]}
                        size="xs"
                      />
                    </Grid.Col>
                  )}
                </Grid>
              </Paper>
            )}

            {/* ── Layout ── */}
            {selectedLine && (
              <Box className={styles.mapSettingsGrid}>
                <Paper withBorder radius="lg" className={styles.mapSettingsPanel}>
                <Group className={styles.mapSectionHeader} gap="sm">
                  <Box className={styles.mapSectionIndex} aria-hidden="true">
                    <IconRuler size={17} />
                  </Box>
                  <Title order={2}>{t("route.linemap.section-layout")}</Title>
                </Group>
                <Grid gutter="md">
                  {isLoopLine && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                      <Text size="sm" fw={500} mb={4}>
                        {t("route.linemap.loop-render-mode")}
                      </Text>
                      <Switch
                        label={t("route.linemap.loop-as-linear")}
                        checked={mapForceLinear}
                        onChange={(e) =>
                          setMapForceLinear(e.currentTarget.checked)
                        }
                      />
                    </Grid.Col>
                  )}
                  {(!isLoopLine || mapForceLinear) && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Text size="sm" fw={500} mb={4}>
                        {t("route.linemap.orientation")}
                      </Text>
                      <SegmentedControl
                        value={mapOrientation}
                        onChange={(v) => setMapOrientation(v as MapOrientation)}
                        data={[
                          {
                            value: "horizontal",
                            label: (
                              <Group gap={4}>
                                <IconLayoutRows size={16} />
                                {t("route.linemap.horizontal")}
                              </Group>
                            ),
                          },
                          {
                            value: "vertical",
                            label: (
                              <Group gap={4}>
                                <IconLayoutColumns size={16} />
                                {t("route.linemap.vertical")}
                              </Group>
                            ),
                          },
                        ]}
                      />
                    </Grid.Col>
                  )}
                  {(!isLoopLine || mapForceLinear) &&
                    mapOrientation === "horizontal" && (
                      <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                        <Text size="sm" fw={500} mb={4}>
                          {t("route.linemap.name-style")}
                        </Text>
                        <SegmentedControl
                          value={mapNameStyle}
                          onChange={(v) =>
                            setMapNameStyle(v as "normal" | "above" | "below")
                          }
                          data={[
                            {
                              value: "normal",
                              label: t("route.linemap.name-style-normal"),
                              disabled: mapHasPassedStations,
                            },
                            {
                              value: "above",
                              label: t("route.linemap.name-style-above"),
                            },
                            {
                              value: "below",
                              label: t("route.linemap.name-style-below"),
                            },
                          ]}
                        />
                      </Grid.Col>
                    )}
                  {(!isLoopLine || mapForceLinear) &&
                    mapOrientation === "vertical" && (
                      <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                        <Text size="sm" fw={500} mb={4}>
                          {t("route.linemap.name-side")}
                        </Text>
                        <SegmentedControl
                          value={mapVerticalNameSide}
                          onChange={(v) =>
                            setMapVerticalNameSide(v as "left" | "right")
                          }
                          data={[
                            {
                              value: "left",
                              label: (
                                <Group gap={4}>
                                  <IconArrowLeft size={16} />
                                  {t("route.linemap.name-side-left")}
                                </Group>
                              ),
                            },
                            {
                              value: "right",
                              label: (
                                <Group gap={4}>
                                  {t("route.linemap.name-side-right")}
                                  <IconArrowRight size={16} />
                                </Group>
                              ),
                            },
                          ]}
                        />
                      </Grid.Col>
                    )}
                  {effectiveIsLoop && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                      <Text size="sm" fw={500} mb={8}>
                        {t("route.linemap.font-size")}
                      </Text>
                      <Box
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <IconRuler size={20} style={{ flexShrink: 0 }} />
                        <Slider
                          value={mapFontSize}
                          label={(v) => `${v}px`}
                          labelAlwaysOn
                          step={1}
                          min={6}
                          max={16}
                          style={{ width: "100%" }}
                          onChange={setMapFontSize}
                        />
                      </Box>
                    </Grid.Col>
                  )}
                  {!effectiveIsLoop && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                      <Text size="sm" fw={500} mb={8}>
                        {t("route.linemap.station-spacing")}
                      </Text>
                      <Box
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <IconRuler size={20} style={{ flexShrink: 0 }} />
                        <Slider
                          value={mapStationSpacing}
                          label={(v) => `${v}`}
                          labelAlwaysOn
                          step={1}
                          min={30}
                          max={150}
                          style={{ width: "100%" }}
                          onChange={setMapStationSpacing}
                          marks={[
                            { value: 60, label: "60" },
                            { value: 90, label: "90" },
                          ]}
                        />
                      </Box>
                    </Grid.Col>
                  )}
                  <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                    <Text size="sm" fw={500} mb={8}>
                      {t("route.linemap.line-width")}
                    </Text>
                    <Box
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <IconRuler size={20} style={{ flexShrink: 0 }} />
                      <Slider
                        value={mapTrackWidth}
                        label={(value) => `${value}`}
                        labelAlwaysOn
                        step={1}
                        min={MIN_TRACK_WIDTH}
                        max={MAX_TRACK_WIDTH}
                        style={{ width: "100%" }}
                        onChange={setMapTrackWidth}
                        marks={[
                          { value: DEFAULT_TRACK_WIDTH, label: "6" },
                          { value: 18, label: "18" },
                          { value: MAX_TRACK_WIDTH, label: "30" },
                        ]}
                      />
                    </Box>
                  </Grid.Col>
                </Grid>
                </Paper>

                {/* ── Display ── */}
                <Paper withBorder radius="lg" className={styles.mapSettingsPanel}>
                <Group className={styles.mapSectionHeader} gap="sm">
                  <Box className={styles.mapSectionIndex} aria-hidden="true">
                    <IconEye size={17} />
                  </Box>
                  <Title order={2}>{t("route.linemap.section-content")}</Title>
                </Group>
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                    <Select
                      label={t("route.linemap.primary-lang")}
                      value={mapPrimaryLang}
                      onChange={(v) =>
                        v && setMapPrimaryLang(v as StationNameField)
                      }
                      data={mapLanguageOptions}
                    />
                    {mapStations.length > 0 && (
                      <Text size="xs" c="dimmed" mt={4} truncate>
                        {mapStations
                          .slice(0, 3)
                          .map((s) => s[mapPrimaryLang] || "—")
                          .join(" · ")}
                      </Text>
                    )}
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                    <Select
                      label={t("route.linemap.secondary-lang")}
                      value={mapSecondaryLang}
                      onChange={(v) =>
                        v && setMapSecondaryLang(v as StationNameField)
                      }
                      disabled={!mapShowSecondaryLang}
                      data={mapLanguageOptions}
                    />
                    <Group mt={6} gap="xs">
                      <Switch
                        label={t("route.linemap.show-secondary-lang")}
                        checked={mapShowSecondaryLang}
                        onChange={(e) =>
                          setMapShowSecondaryLang(e.currentTarget.checked)
                        }
                        size="xs"
                      />
                    </Group>
                    {mapShowSecondaryLang && mapStations.length > 0 && (
                      <Text size="xs" c="dimmed" mt={2} truncate>
                        {mapStations
                          .slice(0, 3)
                          .map((s) => s[mapSecondaryLang] || "—")
                          .join(" · ")}
                      </Text>
                    )}
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
                    <Text size="sm" fw={500} mb={4}>
                      {t("route.linemap.station-number-mode")}
                    </Text>
                    <SegmentedControl
                      value={mapStationNumberMode}
                      onChange={(v) =>
                        setMapStationNumberMode(v as StationNumberMode)
                      }
                      data={[
                        {
                          value: "none",
                          label: t("route.linemap.station-number-none"),
                        },
                        {
                          value: "badge",
                          label: t("route.linemap.station-number-badge"),
                        },
                        {
                          value: "dot",
                          label: t("route.linemap.station-number-dot"),
                          disabled: mapSelectedServiceIds.length >= 2,
                        },
                      ]}
                    />
                  </Grid.Col>
                  {allTransitLines.length > 0 && (
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <MultiSelect
                        label={t("route.linemap.transit-filter")}
                        value={mapTransitFilter}
                        onChange={setMapTransitFilter}
                        data={allTransitLines.map((l) => ({
                          value: l.id,
                          label: l.prefix ? `[${l.prefix}] ${l.name}` : l.name,
                        }))}
                      />
                      <Switch
                        mt="xs"
                        label={t("route.linemap.transit-show-names")}
                        checked={mapShowTransitNames}
                        onChange={(event) =>
                          setMapShowTransitNames(event.currentTarget.checked)
                        }
                        disabled={mapTransitFilter.length === 0}
                        size="xs"
                      />
                    </Grid.Col>
                  )}
                  {(mapHasMoreBefore || mapHasMoreAfter) && (
                    <Grid.Col span={{ base: 12 }}>
                      <Text size="sm" fw={500} mb={6}>
                        {t("route.linemap.continuation")}
                      </Text>
                      <Group gap="md">
                        {mapHasMoreBefore && (
                          <Switch
                            label={t("route.linemap.continuation-before")}
                            checked={mapShowFadeBefore}
                            onChange={(e) =>
                              setMapShowFadeBefore(e.currentTarget.checked)
                            }
                            size="xs"
                          />
                        )}
                        {mapHasMoreAfter && (
                          <Switch
                            label={t("route.linemap.continuation-after")}
                            checked={mapShowFadeAfter}
                            onChange={(e) =>
                              setMapShowFadeAfter(e.currentTarget.checked)
                            }
                            size="xs"
                          />
                        )}
                      </Group>
                    </Grid.Col>
                  )}
                </Grid>
                </Paper>
              </Box>
            )}

            {/* Overlap warning */}
            {overlapWarnings.length > 0 && (
              <Alert
                icon={<IconAlertTriangle size={16} />}
                color="yellow"
                title={t("route.linemap.overlap-warning-title")}
              >
                {t("route.linemap.overlap-warning")}
              </Alert>
            )}

            {/* Map preview */}
            {selectedLine && mapStations.length > 0 && (
              <Paper withBorder radius="xl" className={styles.mapPreviewPanel}>
                <Group justify="space-between" align="center" mb="md">
                  <Title order={2} className={styles.previewTitle}>
                  <IconEye size="1.6em" />
                  {t("common.preview")}
                  </Title>
                  <Box
                    className={styles.previewLineSwatch}
                    style={{ backgroundColor: selectedLine.line_color }}
                    aria-hidden="true"
                  />
                </Group>

                {mapFonts.ready ? (
                  <Box className={`map-preview ${styles.mapPreviewViewport}`}>
                    <LineMapRenderer
                      ref={mapRef}
                      stations={mapDisplayStations}
                      line={selectedLine}
                      isLoop={effectiveIsLoop}
                      transits={filteredMapTransits}
                      transitLineStyles={mapLineIndicatorStyles}
                      showTransitNames={mapShowTransitNames}
                      orientation={mapOrientation}
                      nameStyle={mapNameStyle}
                      verticalNameSide={mapVerticalNameSide}
                      circularFontSize={mapFontSize}
                      stationNumberMode={mapStationNumberMode}
                      stationNumbers={mapStationNumbers}
                      stationNumberGroups={mapStationNumberGroups}
                      trackColors={
                        selectedThroughRouteId ? mapTrackColors : undefined
                      }
                      stationColors={
                        selectedThroughRouteId ? mapStationColors : undefined
                      }
                      stationSpacing={mapStationSpacing}
                      trackWidth={mapTrackWidth}
                      primaryLangField={mapPrimaryLang}
                      secondaryLangField={mapSecondaryLang}
                      showSecondaryLang={mapShowSecondaryLang}
                      hasMoreBefore={
                        mapForceLinear
                          ? true
                          : mapHasMoreBefore && mapShowFadeBefore
                      }
                      hasMoreAfter={
                        mapForceLinear
                          ? true
                          : mapHasMoreAfter && mapShowFadeAfter
                      }
                      companyStyle={mapCompanyStyle}
                      services={
                        mapServiceInfos.length >= 1
                          ? mapServiceInfos
                          : undefined
                      }
                      serviceStops={mapServiceStops}
                      showPassedStations={mapPassedMode !== "hide-gap"}
                      serviceNameStyle={mapServiceNameStyle}
                    />
                  </Box>
                ) : (
                  <CanvasFontLoading show={mapFonts.showLoader} />
                )}

                {/* Download controls */}
                <Grid gutter="md" className={styles.downloadControls}>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Select
                      label={t("route.linemap.export-format")}
                      value={mapExportFormat}
                      onChange={(value) => {
                        if (!value) return;
                        setMapExportFormat(value as LineMapExportFormat);
                        setMapExportError(null);
                      }}
                      data={[
                        { value: "png", label: t("route.linemap.format-png") },
                        { value: "svg", label: t("route.linemap.format-svg") },
                        { value: "pdf", label: t("route.linemap.format-pdf") },
                      ]}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Select
                      label={t("input.image-size")}
                      value={String(mapSaveSize)}
                      onChange={(v) => v && setMapSaveSize(Number(v))}
                      disabled={mapExportFormat !== "png"}
                      description={
                        mapExportFormat === "png"
                          ? undefined
                          : t("route.linemap.vector-size-note")
                      }
                      data={mapSaveSizeList.map((e) => ({
                        value: String(e.value),
                        label: e.label,
                      }))}
                    />
                  </Grid.Col>
                  <Grid.Col
                    span={{ base: 12, sm: 4 }}
                    className={styles.downloadButtonColumn}
                  >
                    <Tooltip
                      label={mapDownloadWarningText ?? ""}
                      disabled={!mapDownloadWarningText}
                      multiline
                      w={280}
                      withArrow
                    >
                      <Button
                        color={mapDownloadTextTooSmall ? "yellow" : "green"}
                        size="lg"
                        variant="filled"
                        onClick={handleSaveMap}
                        disabled={!mapFonts.ready || mapExporting}
                        loading={mapExporting}
                        fullWidth
                        style={{ fontWeight: 700, minWidth: 0 }}
                        leftSection={
                          mapDownloadTextTooSmall ? (
                            <IconAlertTriangle />
                          ) : (
                            <IconDownload />
                          )
                        }
                        title={mapDownloadWarningText ?? undefined}
                        aria-label={
                          mapDownloadWarningText
                            ? `${t("input.save")}: ${mapDownloadWarningText}`
                            : t("input.save")
                        }
                      >
                        {t("input.save")}
                      </Button>
                    </Tooltip>
                  </Grid.Col>
                </Grid>
                {mapExportError && (
                  <Alert mt="sm" color="red" icon={<IconAlertTriangle size={16} />}>
                    {mapExportError}
                  </Alert>
                )}
              </Paper>
            )}
          </Stack>
        )}

        {/* ── Multiple-line map controls ──────────────────────────────── */}
        {tabMode === "multiline-linemap" && (
          <Stack
            gap="lg"
            className={styles.linemapWorkspace}
            style={
              {
                "--route-accent": multiRootLine?.line_color ?? "#228be6",
              } as CSSProperties
            }
          >
            <Paper withBorder radius="lg" className={styles.mapSourcePanel}>
              <Group className={styles.mapSectionHeader} gap="sm">
                <Box className={styles.mapSectionIcon} aria-hidden="true">
                  <IconMap size={18} />
                </Box>
                <Title order={2}>{t("route.mode.multiline-linemap")}</Title>
              </Group>
              <MultiSelect
                label={t("route.line.title")}
                value={multiSelectedLineIds}
                onChange={(lineIds) => {
                  setMultiSelectedLineIds(lineIds);
                  setMultiTransitFilter([]);
                }}
                data={lines.map((line) => ({
                  value: line.id,
                  label: line.prefix ? `[${line.prefix}] ${line.name}` : line.name,
                }))}
                placeholder={t("route.line.select")}
                searchable
                clearable
              />
              {multiSelectedLines.length > 0 && (
                <MultiLineOrderControls
                  lines={multiSelectedLines}
                  onMove={(fromIndex, toIndex) =>
                    setMultiSelectedLineIds((lineIds) =>
                      moveOrderedId(lineIds, fromIndex, toIndex)
                    )
                  }
                  t={t}
                />
              )}
            </Paper>

            {multiRootLine && (
              <Box className={styles.mapSettingsGrid}>
                <Paper withBorder radius="lg" className={styles.mapSettingsPanel}>
                  <Group className={styles.mapSectionHeader} gap="sm">
                    <Box className={styles.mapSectionIndex} aria-hidden="true">
                      <IconRuler size={17} />
                    </Box>
                    <Title order={2}>{t("route.linemap.section-layout")}</Title>
                  </Group>
                  <Stack gap="xl">
                    <Box>
                      <Text size="sm" fw={500} mb={8}>
                        {t("route.linemap.station-spacing")}
                      </Text>
                      <Group gap="md" wrap="nowrap">
                        <IconRuler size={20} />
                        <Slider
                          value={mapStationSpacing}
                          label={(value) => `${value}`}
                          labelAlwaysOn
                          step={1}
                          min={45}
                          max={150}
                          style={{ width: "100%" }}
                          onChange={setMapStationSpacing}
                          marks={[
                            { value: 60, label: "60" },
                            { value: 90, label: "90" },
                          ]}
                        />
                      </Group>
                    </Box>
                    <Box>
                      <Text size="sm" fw={500} mb={8}>
                        {t("route.linemap.line-width")}
                      </Text>
                      <Group gap="md" wrap="nowrap">
                        <IconRuler size={20} />
                        <Slider
                          value={mapTrackWidth}
                          label={(value) => `${value}`}
                          labelAlwaysOn
                          step={1}
                          min={MIN_TRACK_WIDTH}
                          max={MAX_TRACK_WIDTH}
                          style={{ width: "100%" }}
                          onChange={setMapTrackWidth}
                          marks={[
                            { value: DEFAULT_TRACK_WIDTH, label: "6" },
                            { value: 18, label: "18" },
                            { value: MAX_TRACK_WIDTH, label: "30" },
                          ]}
                        />
                      </Group>
                    </Box>
                  </Stack>
                </Paper>

                <Paper withBorder radius="lg" className={styles.mapSettingsPanel}>
                  <Group className={styles.mapSectionHeader} gap="sm">
                    <Box className={styles.mapSectionIndex} aria-hidden="true">
                      <IconEye size={17} />
                    </Box>
                    <Title order={2}>{t("route.linemap.section-content")}</Title>
                  </Group>
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label={t("route.linemap.primary-lang")}
                        value={mapPrimaryLang}
                        onChange={(value) =>
                          value && setMapPrimaryLang(value as StationNameField)
                        }
                        data={multiLanguageOptions}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label={t("route.linemap.secondary-lang")}
                        value={mapSecondaryLang}
                        onChange={(value) =>
                          value && setMapSecondaryLang(value as StationNameField)
                        }
                        disabled={!mapShowSecondaryLang}
                        data={multiLanguageOptions}
                      />
                      <Switch
                        mt={6}
                        label={t("route.linemap.show-secondary-lang")}
                        checked={mapShowSecondaryLang}
                        onChange={(event) =>
                          setMapShowSecondaryLang(event.currentTarget.checked)
                        }
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Text size="sm" fw={500} mb={4}>
                        {t("route.linemap.font-size")}
                      </Text>
                      <SegmentedControl
                        fullWidth
                        value={multiStationFontSize}
                        onChange={(value) =>
                          setMultiStationFontSize(
                            value as MultiLineStationFontSize,
                          )
                        }
                        data={[
                          {
                            value: "small",
                            label: t("route.linemap.font-size-small"),
                          },
                          {
                            value: "medium",
                            label: t("route.linemap.font-size-medium"),
                          },
                          {
                            value: "large",
                            label: t("route.linemap.font-size-large"),
                          },
                        ]}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12 }}>
                      <Text size="sm" fw={500} mb={4}>
                        {t("route.linemap.station-number-mode")}
                      </Text>
                      <SegmentedControl
                        value={multiStationNumberMode}
                        onChange={(value) =>
                          setMultiStationNumberMode(value as StationNumberMode)
                        }
                        data={[
                          {
                            value: "none",
                            label: t("route.linemap.station-number-none"),
                          },
                          {
                            value: "badge",
                            label: t("route.linemap.station-number-badge"),
                          },
                          {
                            value: "dot",
                            label: t("route.linemap.station-number-dot"),
                          },
                        ]}
                      />
                    </Grid.Col>
                    {multiTransitLines.length > 0 && (
                      <Grid.Col span={{ base: 12 }}>
                        <MultiSelect
                          label={t("route.linemap.transit-filter")}
                          value={multiTransitFilter}
                          onChange={setMultiTransitFilter}
                          data={multiTransitLines.map((line) => ({
                            value: line.id,
                            label: line.prefix
                              ? `[${line.prefix}] ${line.name}`
                              : line.name,
                          }))}
                        />
                        <Switch
                          mt="xs"
                          label={t("route.linemap.transit-show-names")}
                          checked={mapShowTransitNames}
                          onChange={(event) =>
                            setMapShowTransitNames(event.currentTarget.checked)
                          }
                          disabled={multiTransitFilter.length === 0}
                          size="xs"
                        />
                      </Grid.Col>
                    )}
                  </Grid>
                </Paper>
              </Box>
            )}

            {multiRootLine && filteredMultiLineRoutes.length > 0 && (
              <Paper withBorder radius="xl" className={styles.mapPreviewPanel}>
                <Group justify="space-between" align="center" mb="md">
                  <Title order={2} className={styles.previewTitle}>
                    <IconEye size="1.6em" />
                    {t("common.preview")}
                  </Title>
                  <Group gap={4} aria-hidden="true">
                    {multiSelectedLines.map((line) => (
                      <Box
                        key={line.id}
                        className={styles.previewLineSwatch}
                        style={{ backgroundColor: line.line_color, width: 38 }}
                      />
                    ))}
                  </Group>
                </Group>

                {mapFonts.ready ? (
                  <Box className={`map-preview ${styles.mapPreviewViewport}`}>
                    <MultiLineMapRenderer
                      ref={multiLineMapRef}
                      routes={filteredMultiLineRoutes}
                      rootLineId={multiRootLine.id}
                      stationSpacing={mapStationSpacing}
                      trackWidth={mapTrackWidth}
                      stationNumberMode={multiStationNumberMode}
                      primaryLangField={mapPrimaryLang}
                      secondaryLangField={mapSecondaryLang}
                      showSecondaryLang={mapShowSecondaryLang}
                      showTransitNames={mapShowTransitNames}
                      lineStyles={mapLineIndicatorStyles}
                      stationFontSize={multiStationFontSize}
                    />
                  </Box>
                ) : (
                  <CanvasFontLoading show={mapFonts.showLoader} />
                )}

                <Grid gutter="md" className={styles.downloadControls}>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Select
                      label={t("route.linemap.export-format")}
                      value={mapExportFormat}
                      onChange={(value) => {
                        if (!value) return;
                        setMapExportFormat(value as LineMapExportFormat);
                        setMapExportError(null);
                      }}
                      data={[
                        { value: "png", label: t("route.linemap.format-png") },
                        { value: "svg", label: t("route.linemap.format-svg") },
                        { value: "pdf", label: t("route.linemap.format-pdf") },
                      ]}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Select
                      label={t("input.image-size")}
                      value={String(mapSaveSize)}
                      onChange={(value) => value && setMapSaveSize(Number(value))}
                      disabled={mapExportFormat !== "png"}
                      description={
                        mapExportFormat === "png"
                          ? undefined
                          : t("route.linemap.vector-size-note")
                      }
                      data={multiMapSaveSizeList.map((size) => ({
                        value: String(size.value),
                        label: size.label,
                      }))}
                    />
                  </Grid.Col>
                  <Grid.Col
                    span={{ base: 12, sm: 4 }}
                    className={styles.downloadButtonColumn}
                  >
                    <Button
                      color="green"
                      size="lg"
                      variant="filled"
                      onClick={handleSaveMultiLineMap}
                      disabled={!mapFonts.ready || mapExporting}
                      loading={mapExporting}
                      fullWidth
                      style={{ fontWeight: 700, minWidth: 0 }}
                      leftSection={<IconDownload />}
                    >
                      {t("input.save")}
                    </Button>
                  </Grid.Col>
                </Grid>
                {mapExportError && (
                  <Alert mt="sm" color="red" icon={<IconAlertTriangle size={16} />}>
                    {mapExportError}
                  </Alert>
                )}
              </Paper>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
