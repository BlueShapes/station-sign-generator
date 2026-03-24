/*
 * JR East sign format — required data from DB:
 * Current station: primary_name, primary_name_furigana, secondary_name,
 *   tertiary_name (Korean), quaternary_name (Chinese), note, three_letter_code,
 *   station_number (value from station_numbers for this line),
 *   station_areas (from station_areas)
 * Adjacent stations (left/right by sort_order ±1 in station_lines):
 *   primary_name, primary_name_furigana, secondary_name,
 *   station_number (for same line)
 * Colors: line.line_color, company.company_color (as baseColor)
 * Display: ratio (from user), direction (from user)
 */

import { useState, useEffect, useRef, useMemo } from "react";
import type { Database } from "sql.js";
import {
  Alert,
  Button,
  Divider,
  Grid,
  Group,
  Box,
  Select,
  MultiSelect,
  Title,
  Loader,
  Center,
  Stack,
  Text,
  SegmentedControl,
  Slider,
  Switch,
} from "@mantine/core";
import {
  IconDownload,
  IconEye,
  IconArrowLeft,
  IconArrowRight,
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
import { useTranslations } from "@/i18n/useTranslation";
import { getAllLines } from "@/db/repositories/lines";
import { getAllCompanies } from "@/db/repositories/companies";
import {
  getStationsByLine,
  getStationLines,
  getStationNumbers,
  getStationAreasWithZones,
} from "@/db/repositories/stations";
import {
  getServicesByLine,
  getServiceStopsByLine,
} from "@/db/repositories/services";
import type { Line, Station, Service } from "@/db/types";
import type DirectInputStationProps from "@/components/signs/DirectInputStationProps";
import type { Direction } from "@/components/signs/DirectInputStationProps";
import { SIGN_STYLE_FIELDS } from "@/components/signs/signStyles";

import JrEastSign, {
  height as JrEastSignHeight,
  scale as JrEastSignBaseScale,
} from "@/components/signs/JrEastSign";
import JrWestSign, {
  height as JrWestSignHeight,
  scale as JrWestSignBaseScale,
} from "@/components/signs/JrWestSign";
import JrWestSignLarge, {
  height as JrWestSignLargeHeight,
  scale as JrWestSignLargeBaseScale,
} from "@/components/signs/JrWestSignLarge";
import LineMapRenderer, {
  scale as LineMapScale,
  CIRCULAR_FONT_DEFAULT,
  JP_FONT,
  detectCircularOverlaps,
  getMapCanvasDimensions,
  type StationNumberMode,
  type StationNumberMap,
  type StationNameField,
  type ServiceInfo,
  type ServiceStopMap,
} from "@/components/signs/LineMapRenderer";

type SignStyle = "jreast" | "jrwest" | "jrwestlarge";
type TabMode = "sign" | "linemap";
type MapOrientation = "horizontal" | "vertical";
type PassedStationMode = "show" | "hide-gap" | "hide-trim";

const SIGN_STYLES: Record<
  SignStyle,
  { Component: typeof JrEastSign; height: number; scale: number }
> = {
  jreast: {
    Component: JrEastSign,
    height: JrEastSignHeight,
    scale: JrEastSignBaseScale,
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
};

interface RouteInputTabProps {
  db: Database | null;
  loading: boolean;
}

export default function RouteInputTab({ db, loading }: RouteInputTabProps) {
  const t = useTranslations();
  const signRef = useRef<Konva.Stage>(null);
  const mapRef = useRef<Konva.Stage>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

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
  const [saveSize, setSaveSize] = useState(JrEastSignBaseScale);
  const [saveSizeList, setSaveSizeList] = useState<
    { label: string; value: number }[]
  >([]);

  // ── Line map mode state ──────────────────────────────────────────────────
  const [tabMode, setTabMode] = useState<TabMode>("sign");
  const [mapOrientation, setMapOrientation] =
    useState<MapOrientation>("horizontal");
  const [mapStartId, setMapStartId] = useState<string | null>(null);
  const [mapEndId, setMapEndId] = useState<string | null>(null);
  const [mapShowFadeBefore, setMapShowFadeBefore] = useState(true);
  const [mapShowFadeAfter, setMapShowFadeAfter] = useState(true);
  const [mapTransits, setMapTransits] = useState<Record<string, Line[]>>({});
  /** null = show all transit lines; array = show only these line IDs */
  const [mapTransitFilter, setMapTransitFilter] = useState<string[] | null>(
    null,
  );
  const [mapFontSize, setMapFontSize] = useState(CIRCULAR_FONT_DEFAULT);
  const [mapSaveSize, setMapSaveSize] = useState(LineMapScale);
  const [mapStationNumberMode, setMapStationNumberMode] =
    useState<StationNumberMode>("none");
  const [mapStationNumbers, setMapStationNumbers] = useState<
    Record<
      string,
      { prefix: string; value: string; threeLetterCode?: string | null }
    >
  >({});
  const [mapNameStyle, setMapNameStyle] = useState<
    "normal" | "above" | "below"
  >("normal");
  const [mapStationSpacing, setMapStationSpacing] = useState(90);
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

  // Load lines when db becomes available
  useEffect(() => {
    if (!db) return;
    setLines(getAllLines(db));
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
    setMapStartId(stns[0]?.id ?? null);
    setMapEndId(stns[stns.length - 1]?.id ?? null);
    setMapTransitFilter(null);
  }, [db, selectedLineId]);

  // Load services and service stops when line changes
  useEffect(() => {
    if (!db || !selectedLineId) {
      setMapServices([]);
      setMapSelectedServiceIds([]);
      setMapServiceStops({});
      return;
    }
    const svcs = getServicesByLine(db, selectedLineId);
    setMapServices(svcs);
    setMapSelectedServiceIds([]);
    // Build serviceStops map: stationId → serviceId → status
    const rawStops = getServiceStopsByLine(db, selectedLineId);
    const stopMap: ServiceStopMap = {};
    for (const s of rawStops) {
      if (!stopMap[s.station_id]) stopMap[s.station_id] = {};
      stopMap[s.station_id][s.service_id] = s.status;
    }
    setMapServiceStops(stopMap);
  }, [db, selectedLineId]);

  // Reset center square line selection when station or primary line changes
  useEffect(() => {
    setCenterSquareLineIds(
      selectedLineId && selectedStationId ? [selectedLineId] : [],
    );
  }, [selectedStationId, selectedLineId]);

  // Enforce constraints when services have passed stations
  useEffect(() => {
    if (mapSelectedServiceIds.length === 0) return;
    const startIdx = mapStartId
      ? stations.findIndex((s) => s.id === mapStartId)
      : 0;
    const endIdx = mapEndId
      ? stations.findIndex((s) => s.id === mapEndId)
      : stations.length - 1;
    const lo = Math.min(startIdx < 0 ? 0 : startIdx, endIdx < 0 ? 0 : endIdx);
    const hi = Math.max(startIdx < 0 ? 0 : startIdx, endIdx < 0 ? 0 : endIdx);
    const rangeStations = stations.slice(lo, hi + 1);
    const hasPassedStations =
      mapSelectedServiceIds.length >= 2 ||
      rangeStations.some(
        (s) =>
          !mapSelectedServiceIds.some((id) => !!mapServiceStops[s.id]?.[id]),
      );
    if (hasPassedStations)
      setMapNameStyle((s) => (s === "normal" ? "above" : s));
    if (mapSelectedServiceIds.length >= 2)
      setMapStationNumberMode((s) => (s === "dot" ? "none" : s));
  }, [mapSelectedServiceIds, stations, mapStartId, mapEndId, mapServiceStops]);

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
    const isLoop = line?.is_loop === 1;

    // For loop lines, wrap around at the ends
    const leftStation =
      idx > 0
        ? stations[idx - 1]
        : isLoop
          ? stations[stations.length - 1]
          : null;
    const rightStation =
      idx < stations.length - 1
        ? stations[idx + 1]
        : isLoop
          ? stations[0]
          : null;

    // Get station numbers
    const currentNums = getStationNumbers(
      db,
      currentStation.id,
      selectedLineId,
    );
    const leftNums = leftStation
      ? getStationNumbers(db, leftStation.id, selectedLineId)
      : [];
    const rightNums = rightStation
      ? getStationNumbers(db, rightStation.id, selectedLineId)
      : [];

    // Get station areas with zone details
    const areas = getStationAreasWithZones(db, currentStation.id);

    // Get company color and station number style
    let baseColor = "#3a9200";
    let stationNumberStyle: string | undefined;
    if (line?.company_id) {
      const companies = getAllCompanies(db);
      const company = companies.find((c) => c.id === line.company_id);
      if (company) {
        baseColor = company.company_color;
        stationNumberStyle = company.station_number_style;
      }
    }

    const linePrefix = line?.prefix ?? "";

    // All lines this station belongs to
    const stationLineRecords = getStationLines(db, currentStation.id);
    const allStationLines = lines.filter((l) =>
      stationLineRecords.some((sl) => sl.line_id === l.id),
    );
    setStationLines(allStationLines);

    // Center square colors — map selected line IDs to their colors
    const centerColors =
      centerSquareLineIds.length > 0
        ? (centerSquareLineIds
            .map((id) => allStationLines.find((l) => l.id === id)?.line_color)
            .filter(Boolean) as string[])
        : line
          ? [line.line_color]
          : [];

    const data: DirectInputStationProps = {
      primaryName: currentStation.primary_name,
      primaryNameFurigana: currentStation.primary_name_furigana ?? "",
      secondaryName: currentStation.secondary_name ?? "",
      tertiaryName: currentStation.tertiary_name ?? undefined,
      quaternaryName: currentStation.quaternary_name ?? undefined,
      note: currentStation.note ?? "",
      threeLetterCode: currentStation.three_letter_code ?? undefined,
      numberPrimaryPrefix: linePrefix,
      numberPrimaryValue: currentNums[0]?.value ?? "",
      stationAreas: areas.map((a) => ({
        id: a.id,
        name: a.zone_abbreviation,
        isWhite: a.zone_is_black === 0,
      })),
      left: (flipped ? rightStation : leftStation)
        ? [
            {
              id: (flipped ? rightStation : leftStation)!.id,
              primaryName: (flipped ? rightStation : leftStation)!.primary_name,
              primaryNameFurigana:
                (flipped ? rightStation : leftStation)!.primary_name_furigana ??
                "",
              secondaryName:
                (flipped ? rightStation : leftStation)!.secondary_name ?? "",
              numberPrimaryPrefix: linePrefix,
              numberPrimaryValue:
                (flipped ? rightNums : leftNums)[0]?.value ?? "",
            },
          ]
        : [],
      right: (flipped ? leftStation : rightStation)
        ? [
            {
              id: (flipped ? leftStation : rightStation)!.id,
              primaryName: (flipped ? leftStation : rightStation)!.primary_name,
              primaryNameFurigana:
                (flipped ? leftStation : rightStation)!.primary_name_furigana ??
                "",
              secondaryName:
                (flipped ? leftStation : rightStation)!.secondary_name ?? "",
              numberPrimaryPrefix: linePrefix,
              numberPrimaryValue:
                (flipped ? leftNums : rightNums)[0]?.value ?? "",
            },
          ]
        : [],
      baseColor,
      stationNumberStyle,
      centerSquareColors: centerColors,
      localLines: [
        ...allStationLines.filter((l) => l.id === selectedLineId),
        ...allStationLines.filter((l) => l.id !== selectedLineId),
      ].map((l) => ({ id: l.id, prefix: l.prefix, color: l.line_color })),
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

  // Compute transit lines for all stations when in line map mode
  useEffect(() => {
    if (!db || !selectedLineId || stations.length === 0) {
      setMapTransits({});
      return;
    }
    const result: Record<string, Line[]> = {};
    for (const station of stations) {
      const slRecords = getStationLines(db, station.id);
      const otherLines = lines.filter(
        (l) =>
          l.id !== selectedLineId &&
          slRecords.some((sl) => sl.line_id === l.id),
      );
      if (otherLines.length > 0) result[station.id] = otherLines;
    }
    setMapTransits(result);
  }, [db, selectedLineId, stations, lines]);

  // ── Derived: stations in selected map range (respects direction) ─────────
  const { mapStations, mapHasMoreBefore, mapHasMoreAfter } = useMemo(() => {
    if (stations.length === 0)
      return {
        mapStations: [],
        mapHasMoreBefore: false,
        mapHasMoreAfter: false,
      };
    const startIdx = mapStartId
      ? stations.findIndex((s) => s.id === mapStartId)
      : 0;
    const endIdx = mapEndId
      ? stations.findIndex((s) => s.id === mapEndId)
      : stations.length - 1;
    const si = startIdx === -1 ? 0 : startIdx;
    const ei = endIdx === -1 ? stations.length - 1 : endIdx;
    const reversed = si > ei;
    const sliced = reversed
      ? stations.slice(ei, si + 1).reverse()
      : stations.slice(si, ei + 1);
    // "More before/after" tracks whether the route continues beyond each
    // displayed end in the direction of travel.
    const hasMoreBefore = reversed ? si < stations.length - 1 : si > 0;
    const hasMoreAfter = reversed ? ei > 0 : ei < stations.length - 1;
    return {
      mapStations: sliced,
      mapHasMoreBefore: hasMoreBefore,
      mapHasMoreAfter: hasMoreAfter,
    };
  }, [stations, mapStartId, mapEndId]);

  const selectedLine = lines.find((l) => l.id === selectedLineId) ?? null;
  const isLoopLine = selectedLine?.is_loop === 1;
  // When the user opts into linear rendering for a loop line, treat it as non-loop.
  const effectiveIsLoop = isLoopLine && !mapForceLinear;
  const mapCompanyStyle = useMemo(() => {
    if (!db || !selectedLine?.company_id) return undefined;
    return getAllCompanies(db).find((c) => c.id === selectedLine.company_id)
      ?.station_number_style;
  }, [db, selectedLine?.company_id]);

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
    if (!db || !selectedLineId || stations.length === 0)
      return {} as Record<string, string>;
    const prefix = selectedLine?.prefix ?? "";
    const result: Record<string, string> = {};
    for (const s of stations) {
      const nums = getStationNumbers(db, s.id, selectedLineId);
      const num = nums[0];
      const badge = num && prefix ? `[${prefix}${num.value}] ` : "";
      result[s.id] = `${badge}${s.primary_name}`;
    }
    return result;
  }, [db, selectedLineId, selectedLine?.prefix, stations]);

  // Load station numbers for map range
  useEffect(() => {
    if (!db || !selectedLineId || mapStations.length === 0) {
      setMapStationNumbers({});
      return;
    }
    const linePrefix = lines.find((l) => l.id === selectedLineId)?.prefix ?? "";
    const result: Record<
      string,
      { prefix: string; value: string; threeLetterCode?: string | null }
    > = {};
    for (const station of mapStations) {
      const nums = getStationNumbers(db, station.id, selectedLineId);
      if (nums.length > 0) {
        result[station.id] = {
          prefix: linePrefix,
          value: nums[0].value,
          threeLetterCode: station.three_letter_code,
        };
      }
    }
    setMapStationNumbers(result);
  }, [db, selectedLineId, mapStations, lines]);

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
      ...mapStations.map((s) => [...(s[mapPrimaryLang] ?? "")].length),
    );
    return maxCharCount > 0 ? maxCharCount * (JP_FONT + 1) - 1 : 60;
  }, [mapStations, mapPrimaryLang]);

  // Apply transit filter before passing to renderer
  const filteredMapTransits = useMemo<Record<string, Line[]>>(
    () =>
      mapTransitFilter === null
        ? mapTransits
        : Object.fromEntries(
            Object.entries(mapTransits).map(([stationId, tlines]) => [
              stationId,
              tlines.filter((tl) => mapTransitFilter.includes(tl.id)),
            ]),
          ),
    [mapTransits, mapTransitFilter],
  );

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
    );
    return [1, 2, 3, 4].map((mult) => ({
      label: `${w * mult} × ${h * mult} (${["SS", "M", "L", "XL"][mult - 1]})`,
      value: LineMapScale * mult,
    }));
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
  ]);

  const handleSaveSign = () => {
    if (!signData) return;
    if (signRef.current) {
      const { scale: baseScale } = SIGN_STYLES[signStyle];
      const uri = signRef.current.toDataURL({
        pixelRatio: saveSize / baseScale,
      });
      const link = document.createElement("a");
      link.download = `${signData.primaryName}.png`;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error(t("error.on-save"));
    }
  };

  const handleSaveMap = () => {
    if (!mapRef.current || !selectedLine) return;
    const uri = mapRef.current.toDataURL({
      pixelRatio: mapSaveSize / LineMapScale,
    });
    const link = document.createElement("a");
    link.download = `${selectedLine.name}_路線図.png`;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <Box style={{ padding: "16px" }}>
      <Stack gap="md">
        {/* Mode toggle */}
        <Group>
          <SegmentedControl
            value={tabMode}
            onChange={(v) => setTabMode(v as TabMode)}
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
            ]}
          />
        </Group>

        {/* ── Sign mode controls ────────────────────────────────────────── */}
        {tabMode === "sign" && (
          <>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label={t("route.sign.style")}
                  value={signStyle}
                  onChange={(v) => v && setSignStyle(v as SignStyle)}
                  data={[
                    { value: "jreast", label: t("route.sign.jreast") },
                    { value: "jrwest", label: t("route.sign.jrwest") },
                    {
                      value: "jrwestlarge",
                      label: t("route.sign.jrwestlarge"),
                    },
                  ]}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label={t("route.line.title")}
                  value={selectedLineId}
                  onChange={setSelectedLineId}
                  data={lines.map((l) => ({
                    value: l.id,
                    label: `[${l.prefix}] ${l.name}`,
                  }))}
                  placeholder={t("route.line.select")}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label={t("route.station.title")}
                  value={selectedStationId}
                  onChange={setSelectedStationId}
                  data={stations.map((s) => ({
                    value: s.id,
                    label: stationLabelMap[s.id] ?? s.primary_name,
                  }))}
                  placeholder={
                    selectedLineId
                      ? t("route.station.select")
                      : t("route.station.empty")
                  }
                  disabled={!selectedLineId}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Text size="sm" fw={500} mb={4}>
                  {t("route.sign.direction")}
                </Text>
                <SegmentedControl
                  value={direction}
                  onChange={(v) => setDirection(v as Direction)}
                  data={[
                    { value: "left", label: <IconArrowLeft size={16} /> },
                    {
                      value: "both",
                      label: <IconArrowsHorizontal size={16} />,
                    },
                    { value: "right", label: <IconArrowRight size={16} /> },
                  ]}
                />
              </Grid.Col>
              {SIGN_STYLE_FIELDS[signStyle]?.centerSquareColors !==
                "hidden" && (
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <MultiSelect
                    label={t("route.sign.center-colors")}
                    value={centerSquareLineIds}
                    onChange={(v) =>
                      setCenterSquareLineIds(
                        v.length > 0 ? v.slice(0, 4) : centerSquareLineIds,
                      )
                    }
                    data={stationLines.map((l) => ({
                      value: l.id,
                      label: `[${l.prefix}] ${l.name}`,
                    }))}
                    disabled={!selectedStationId}
                    maxValues={4}
                  />
                </Grid.Col>
              )}
            </Grid>

            {/* Station navigation + flip */}
            <Group gap="sm">
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
              <Box
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <IconRuler size={20} style={{ flexShrink: 0 }} />
                <Slider
                  value={ratio}
                  label={(v) => v}
                  labelAlwaysOn
                  step={0.5}
                  min={2.5}
                  max={8}
                  style={{ width: "100%" }}
                  onChange={setRatio}
                />
              </Box>
            )}

            {/* Sign preview */}
            {signData && (
              <>
                <Title
                  order={2}
                  style={{
                    fontSize: "1.2em",
                    padding: "10px 0 5px 5px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <IconEye size="1.6em" />
                  {t("common.preview")}
                </Title>
                {(() => {
                  const { Component: SignComponent } = SIGN_STYLES[signStyle];
                  return (
                    <SignComponent
                      {...signData}
                      direction={direction}
                      ref={signRef}
                    />
                  );
                })()}

                {/* Download controls */}
                <Grid gutter="md" style={{ padding: "10px" }}>
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
                    style={{ display: "flex", justifyContent: "center" }}
                  >
                    <Button
                      color="green"
                      size="lg"
                      variant="filled"
                      onClick={handleSaveSign}
                      style={{ fontWeight: 700 }}
                      leftSection={<IconDownload />}
                    >
                      {t("input.save")}
                    </Button>
                  </Grid.Col>
                </Grid>
              </>
            )}
          </>
        )}

        {/* ── Line map mode controls ────────────────────────────────────── */}
        {tabMode === "linemap" && (
          <>
            {/* ── Route ── */}
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label={t("route.line.title")}
                  value={selectedLineId}
                  onChange={setSelectedLineId}
                  data={lines.map((l) => ({
                    value: l.id,
                    label: `[${l.prefix}] ${l.name}`,
                  }))}
                  placeholder={t("route.line.select")}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label={t("route.linemap.range-start")}
                  value={mapStartId}
                  onChange={setMapStartId}
                  data={stations.map((s) => ({
                    value: s.id,
                    label: stationLabelMap[s.id] ?? s.primary_name,
                  }))}
                  placeholder={
                    selectedLineId
                      ? t("route.station.select")
                      : t("route.station.empty")
                  }
                  disabled={!selectedLineId}
                />
              </Grid.Col>
              <Grid.Col
                span={{ base: 12, sm: 6, md: 1 }}
                style={{ display: "flex", alignItems: "flex-end" }}
              >
                <Button
                  variant="default"
                  fullWidth
                  disabled={!selectedLineId}
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
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label={t("route.linemap.range-end")}
                  value={mapEndId}
                  onChange={setMapEndId}
                  data={stations.map((s) => ({
                    value: s.id,
                    label: stationLabelMap[s.id] ?? s.primary_name,
                  }))}
                  placeholder={
                    selectedLineId
                      ? t("route.station.select")
                      : t("route.station.empty")
                  }
                  disabled={!selectedLineId}
                />
              </Grid.Col>
            </Grid>

            {/* ── Services ── */}
            {mapServices.length >= 2 && (
              <>
                <Divider
                  label={t("route.linemap.services")}
                  labelPosition="left"
                />
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
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
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
              </>
            )}

            {/* ── Layout ── */}
            {selectedLine && (
              <>
                <Divider
                  label={t("route.linemap.orientation")}
                  labelPosition="left"
                />
                <Grid gutter="md">
                  {isLoopLine && (
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
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
                      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
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
                      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
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
                    <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
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
                    <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
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
                </Grid>
              </>
            )}

            {/* ── Display ── */}
            {selectedLine && (
              <>
                <Divider
                  label={t("route.linemap.station-number-mode")}
                  labelPosition="left"
                />
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                    <Select
                      label={t("route.linemap.primary-lang")}
                      value={mapPrimaryLang}
                      onChange={(v) =>
                        v && setMapPrimaryLang(v as StationNameField)
                      }
                      data={[
                        {
                          value: "primary_name",
                          label: t("route.linemap.lang-1st"),
                        },
                        {
                          value: "secondary_name",
                          label: t("route.linemap.lang-2nd"),
                        },
                        {
                          value: "tertiary_name",
                          label: t("route.linemap.lang-3rd"),
                        },
                        {
                          value: "quaternary_name",
                          label: t("route.linemap.lang-4th"),
                        },
                      ]}
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
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                    <Select
                      label={t("route.linemap.secondary-lang")}
                      value={mapSecondaryLang}
                      onChange={(v) =>
                        v && setMapSecondaryLang(v as StationNameField)
                      }
                      disabled={!mapShowSecondaryLang}
                      data={[
                        {
                          value: "primary_name",
                          label: t("route.linemap.lang-1st"),
                        },
                        {
                          value: "secondary_name",
                          label: t("route.linemap.lang-2nd"),
                        },
                        {
                          value: "tertiary_name",
                          label: t("route.linemap.lang-3rd"),
                        },
                        {
                          value: "quaternary_name",
                          label: t("route.linemap.lang-4th"),
                        },
                      ]}
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
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
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
                        value={
                          mapTransitFilter ?? allTransitLines.map((l) => l.id)
                        }
                        onChange={(v) =>
                          setMapTransitFilter(
                            v.length === allTransitLines.length ? null : v,
                          )
                        }
                        data={allTransitLines.map((l) => ({
                          value: l.id,
                          label: `[${l.prefix}] ${l.name}`,
                        }))}
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
              </>
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
              <>
                <Title
                  order={2}
                  style={{
                    fontSize: "1.2em",
                    padding: "10px 0 5px 5px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <IconEye size="1.6em" />
                  {t("common.preview")}
                </Title>

                <Box className="map-preview" style={{ overflowX: "auto" }}>
                  <LineMapRenderer
                    ref={mapRef}
                    stations={mapDisplayStations}
                    line={selectedLine}
                    isLoop={effectiveIsLoop}
                    transits={filteredMapTransits}
                    orientation={mapOrientation}
                    nameStyle={mapNameStyle}
                    verticalNameSide={mapVerticalNameSide}
                    circularFontSize={mapFontSize}
                    stationNumberMode={mapStationNumberMode}
                    stationNumbers={mapStationNumbers}
                    stationSpacing={mapStationSpacing}
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
                      mapServiceInfos.length >= 1 ? mapServiceInfos : undefined
                    }
                    serviceStops={mapServiceStops}
                    showPassedStations={mapPassedMode !== "hide-gap"}
                    serviceNameStyle={mapServiceNameStyle}
                  />
                </Box>

                {/* Download controls */}
                <Grid gutter="md" style={{ padding: "10px" }}>
                  <Grid.Col span={{ base: 12, sm: 7, lg: 9 }}>
                    <Select
                      label={t("input.image-size")}
                      value={String(mapSaveSize)}
                      onChange={(v) => v && setMapSaveSize(Number(v))}
                      data={mapSaveSizeList.map((e) => ({
                        value: String(e.value),
                        label: e.label,
                      }))}
                    />
                  </Grid.Col>
                  <Grid.Col
                    span={{ base: 12, sm: 5, lg: 3 }}
                    style={{ display: "flex", justifyContent: "center" }}
                  >
                    <Button
                      color="green"
                      size="lg"
                      variant="filled"
                      onClick={handleSaveMap}
                      style={{ fontWeight: 700 }}
                      leftSection={<IconDownload />}
                    >
                      {t("input.save")}
                    </Button>
                  </Grid.Col>
                </Grid>
              </>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
}
