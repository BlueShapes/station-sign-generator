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

import { useState, useEffect, useRef } from "react";
import type { Database } from "sql.js";
import {
  Button,
  Grid,
  Box,
  Select,
  Title,
  Loader,
  Center,
  Stack,
  Text,
  SegmentedControl,
  Slider,
} from "@mantine/core";
import {
  IconDownload,
  IconEye,
  IconArrowLeft,
  IconArrowRight,
  IconArrowsHorizontal,
  IconRuler,
} from "@tabler/icons-react";
import Konva from "konva";
import { useTranslations } from "@/i18n/useTranslation";
import { getAllLines } from "@/db/repositories/lines";
import { getAllCompanies } from "@/db/repositories/companies";
import {
  getStationsByLine,
  getStationNumbers,
  getStationAreas,
} from "@/db/repositories/stations";
import type { Line, Station } from "@/db/types";
import type DirectInputStationProps from "@/components/signs/DirectInputStationProps";
import type { Direction } from "@/components/signs/DirectInputStationProps";

import JrEastSign, {
  height as JrEastSignHeight,
  scale as JrEastSignBaseScale,
} from "@/components/signs/JrEastSign";

interface RouteInputTabProps {
  db: Database | null;
  loading: boolean;
}

export default function RouteInputTab({ db, loading }: RouteInputTabProps) {
  const t = useTranslations();
  const ref = useRef<Konva.Stage>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [direction, setDirection] = useState<Direction>("left");
  const [ratio, setRatio] = useState(4.5);
  const [signData, setSignData] = useState<DirectInputStationProps | null>(
    null,
  );
  const [saveSize, setSaveSize] = useState(JrEastSignBaseScale);
  const [saveSizeList, setSaveSizeList] = useState<
    { label: string; value: number }[]
  >([]);

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
      return;
    }
    const stns = getStationsByLine(db, selectedLineId);
    setStations(stns);
    setSelectedStationId(null);
  }, [db, selectedLineId]);

  // Build sign data when station changes
  useEffect(() => {
    if (!db || !selectedLineId || !selectedStationId) {
      setSignData(null);
      return;
    }

    const idx = stations.findIndex((s) => s.id === selectedStationId);
    if (idx === -1) {
      setSignData(null);
      return;
    }

    const currentStation = stations[idx];
    const leftStation = idx > 0 ? stations[idx - 1] : null;
    const rightStation = idx < stations.length - 1 ? stations[idx + 1] : null;

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

    // Get station areas
    const areas = getStationAreas(db, currentStation.id);

    // Get line info
    const line = lines.find((l) => l.id === selectedLineId);

    // Get company color
    let baseColor = "#36ab33";
    if (line?.company_id) {
      const companies = getAllCompanies(db);
      const company = companies.find((c) => c.id === line.company_id);
      if (company) {
        baseColor = company.company_color;
      }
    }

    const linePrefix = line?.prefix ?? "";

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
        name: a.name,
        isWhite: a.is_white === 1,
      })),
      left: leftStation
        ? [
            {
              id: leftStation.id,
              primaryName: leftStation.primary_name,
              primaryNameFurigana: leftStation.primary_name_furigana ?? "",
              secondaryName: leftStation.secondary_name ?? "",
              numberPrimaryPrefix: linePrefix,
              numberPrimaryValue: leftNums[0]?.value ?? "",
            },
          ]
        : [],
      right: rightStation
        ? [
            {
              id: rightStation.id,
              primaryName: rightStation.primary_name,
              primaryNameFurigana: rightStation.primary_name_furigana ?? "",
              secondaryName: rightStation.secondary_name ?? "",
              numberPrimaryPrefix: linePrefix,
              numberPrimaryValue: rightNums[0]?.value ?? "",
            },
          ]
        : [],
      baseColor,
      localLines: line
        ? [{ id: line.id, prefix: line.prefix, color: line.line_color }]
        : [],
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
  ]);

  // Update canvas size list
  useEffect(() => {
    const canvasHeight = JrEastSignHeight;
    const canvasWidth = canvasHeight * ratio;
    const sizes = ["SS", "S", "M", "L", "XL", "XXL"];
    const result = sizes.map((label, i) => ({
      label: `${Math.round(canvasWidth * (i + 1))} × ${canvasHeight * (i + 1)} (${label})`,
      value: i + 1,
    }));
    setSaveSizeList(result);
  }, [ratio]);

  const handleSave = () => {
    if (!signData) return;
    if (ref.current) {
      const uri = ref.current.toDataURL({
        pixelRatio: saveSize / JrEastSignBaseScale,
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
        {/* Controls */}
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              label={t("route.sign.style")}
              value="jreast"
              data={[{ value: "jreast", label: t("route.sign.jreast") }]}
              readOnly
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
                label: s.primary_name,
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
                { value: "both", label: <IconArrowsHorizontal size={16} /> },
                { value: "right", label: <IconArrowRight size={16} /> },
              ]}
            />
          </Grid.Col>
        </Grid>

        {/* Ratio slider */}
        <Box style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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

        {/* Preview */}
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
            <JrEastSign {...signData} ref={ref} />

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
                  onClick={handleSave}
                  style={{ fontWeight: 700 }}
                  leftSection={<IconDownload />}
                >
                  {t("input.save")}
                </Button>
              </Grid.Col>
            </Grid>
          </>
        )}
      </Stack>
    </Box>
  );
}
