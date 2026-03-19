import { useState, useRef, useEffect } from "react";
import type { Database } from "sql.js";
import {
  Button,
  Box,
  Stack,
  Text,
  Group,
  Title,
  Select,
  TextInput,
  NumberInput,
  ColorInput,
  Modal,
  Badge,
  ActionIcon,
  Loader,
  Center,
  Switch,
  Divider,
  Table,
  Alert,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconDownload,
  IconUpload,
  IconArrowUp,
  IconArrowDown,
  IconAlertCircle,
  IconDatabaseImport,
  IconLink,
} from "@tabler/icons-react";
import { v7 as uuidv7 } from "uuid";
import { useTranslations } from "@/i18n/useTranslation";
import {
  downloadDatabase,
  overwriteDatabaseInPlace,
  mergeDatabase,
  validateImportDatabase,
} from "@/db/init";
import {
  getAllCompanies,
  upsertCompany,
  deleteCompany,
} from "@/db/repositories/companies";
import { getAllLines, upsertLine, deleteLine } from "@/db/repositories/lines";
import {
  getAllSpecialZones,
  upsertSpecialZone,
  deleteSpecialZone,
} from "@/db/repositories/special-zones";
import {
  getAllStations,
  getStationsByLine,
  upsertStation,
  deleteStationFromLine,
  getStationLines,
  upsertStationLine,
  getStationNumbers,
  upsertStationNumber,
  getStationAreas,
  syncStationAreas,
} from "@/db/repositories/stations";
import type {
  Company,
  Line,
  Station,
  StationArea,
  SpecialZone,
} from "@/db/types";

interface EditRoutesTabProps {
  db: Database | null;
  persist: () => void;
}

// ── Special Zone Form Modal ───────────────────────────────────────────────────

interface SpecialZoneFormProps {
  db: Database;
  zone?: SpecialZone;
  onSave: () => void;
  onClose: () => void;
}

function SpecialZoneForm({ db, zone, onSave, onClose }: SpecialZoneFormProps) {
  const t = useTranslations();
  const [name, setName] = useState(zone?.name ?? "");
  const [abbreviation, setAbbreviation] = useState(zone?.abbreviation ?? "");
  const [isBlack, setIsBlack] = useState((zone?.is_black ?? 0) === 1);

  const handleSave = () => {
    if (!name.trim() || !abbreviation.trim()) return;
    upsertSpecialZone(db, {
      id: zone?.id ?? uuidv7(),
      name: name.trim(),
      abbreviation: abbreviation.trim().charAt(0),
      is_black: isBlack ? 1 : 0,
    });
    onSave();
    onClose();
  };

  return (
    <Stack gap="md">
      <TextInput
        label={t("route.special-zone.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <TextInput
        label={t("route.special-zone.abbreviation")}
        value={abbreviation}
        onChange={(e) => setAbbreviation(e.target.value.charAt(0))}
        maxLength={1}
        required
      />
      <Switch
        label={t("route.special-zone.is-black")}
        checked={isBlack}
        onChange={(e) => setIsBlack(e.currentTarget.checked)}
      />
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t("common.close")}
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name.trim() || !abbreviation.trim()}
        >
          {t("common.save")}
        </Button>
      </Group>
    </Stack>
  );
}

// ── Station Number Badge Preview ──────────────────────────────────────────────

function StationNumberBadgePreview({
  color,
  style,
  prefix = "JY",
  value = "01",
  compact = false,
}: {
  color: string;
  style: string;
  prefix?: string;
  value?: string;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const scale = compact ? 1.125 : 1.5;
    const badgeSize = 30 * scale;
    const cssW = compact ? 75 : 120;
    const cssH = compact ? 57 : 75;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssW, cssH);

      if (style === "jreast") {
        const bx = (cssW - badgeSize) / 2;
        const by = (cssH - badgeSize) / 2;

        // White fill inside the badge
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeSize, badgeSize, 2 * scale);
        ctx.fill();

        // Colored outline
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeSize, badgeSize, 2 * scale);
        ctx.stroke();

        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = `600 ${11 * scale}px "HindSemiBold", Arial, sans-serif`;
        ctx.fillText(prefix, bx + badgeSize / 2, by + 4 * scale);

        ctx.font = `600 ${17 * scale}px "HindSemiBold", Arial, sans-serif`;
        ctx.fillText(value, bx + badgeSize / 2, by + 14 * scale);
      }

      ctx.restore();
    };

    document.fonts.ready.then(draw);
  }, [color, style, prefix, value, compact]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}

// ── Company Form Modal ────────────────────────────────────────────────────────

interface CompanyFormProps {
  db: Database;
  company?: Company;
  onSave: () => void;
  onClose: () => void;
}

function CompanyForm({ db, company, onSave, onClose }: CompanyFormProps) {
  const t = useTranslations();
  const [name, setName] = useState(company?.name ?? "");
  const [color, setColor] = useState(company?.company_color ?? "#36ab33");
  const [stationNumberStyle, setStationNumberStyle] = useState(
    company?.station_number_style ?? "jreast",
  );

  const handleSave = () => {
    if (!name.trim()) return;
    upsertCompany(db, {
      id: company?.id ?? uuidv7(),
      name: name.trim(),
      company_color: color,
      station_number_style: stationNumberStyle,
    });
    onSave();
    onClose();
  };

  return (
    <Stack gap="md">
      <TextInput
        label={t("route.company.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <ColorInput
        label={t("route.company.color")}
        value={color}
        onChange={setColor}
        format="hex"
        swatches={[
          "#36ab33",
          "#005bac",
          "#e60012",
          "#f97f00",
          "#000000",
          "#ffffff",
        ]}
      />
      <Select
        label={t("route.company.station-number-style")}
        value={stationNumberStyle}
        onChange={(v) => setStationNumberStyle(v ?? "jreast")}
        data={[
          {
            value: "jreast",
            label: t("route.company.station-number-style-jreast"),
          },
        ]}
      />
      <Group align="center" gap="md">
        <StationNumberBadgePreview color={color} style={stationNumberStyle} />
        <Text size="xs" c="dimmed">
          {t("route.company.station-number-style-preview")}
        </Text>
      </Group>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t("common.close")}
        </Button>
        <Button onClick={handleSave} disabled={!name.trim()}>
          {t("common.save")}
        </Button>
      </Group>
    </Stack>
  );
}

// ── Line Form Modal ───────────────────────────────────────────────────────────

interface LineFormProps {
  db: Database;
  line?: Line;
  companies: Company[];
  onSave: () => void;
  onClose: () => void;
}

function LineForm({ db, line, companies, onSave, onClose }: LineFormProps) {
  const t = useTranslations();
  const [name, setName] = useState(line?.name ?? "");
  const [prefix, setPrefix] = useState(line?.prefix ?? "");
  const [color, setColor] = useState(line?.line_color ?? "#9fff00");
  const [companyId, setCompanyId] = useState<string | null>(
    line?.company_id ?? null,
  );
  const [priority, setPriority] = useState<number | string>(
    line?.priority ?? "",
  );
  const [isLoop, setIsLoop] = useState((line?.is_loop ?? 0) === 1);

  const handleSave = () => {
    if (!name.trim() || !prefix.trim()) return;
    upsertLine(db, {
      id: line?.id ?? uuidv7(),
      name: name.trim(),
      prefix: prefix.trim(),
      line_color: color,
      company_id: companyId,
      priority: priority === "" ? null : Number(priority),
      is_loop: isLoop ? 1 : 0,
    });
    onSave();
    onClose();
  };

  return (
    <Stack gap="md">
      <TextInput
        label={t("route.line.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <TextInput
        label={t("route.line.prefix")}
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
        required
      />
      <ColorInput
        label={t("route.line.color")}
        value={color}
        onChange={setColor}
        format="hex"
        swatches={["#9fff00", "#ffffff", "#000000", "#ffdd00", "#f97f00"]}
      />
      <Select
        label={t("route.line.company")}
        value={companyId}
        onChange={setCompanyId}
        data={companies.map((c) => ({ value: c.id, label: c.name }))}
        clearable
        placeholder="—"
      />
      <NumberInput
        label={t("route.line.priority")}
        value={priority}
        onChange={setPriority}
        placeholder="—"
      />
      <Switch
        label={t("route.line.is-loop")}
        checked={isLoop}
        onChange={(e) => setIsLoop(e.currentTarget.checked)}
      />
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t("common.close")}
        </Button>
        <Button onClick={handleSave} disabled={!name.trim() || !prefix.trim()}>
          {t("common.save")}
        </Button>
      </Group>
    </Stack>
  );
}

// ── Station Form Modal ────────────────────────────────────────────────────────

interface StationFormProps {
  db: Database;
  station?: Station;
  lineId: string;
  maxSortOrder: number;
  specialZones: SpecialZone[];
  onSave: () => void;
  onClose: () => void;
}

function StationForm({
  db,
  station,
  lineId,
  maxSortOrder,
  specialZones,
  onSave,
  onClose,
}: StationFormProps) {
  const t = useTranslations();

  const existingNums = station ? getStationNumbers(db, station.id, lineId) : [];
  const existingAreas = station ? getStationAreas(db, station.id) : [];

  const [primaryName, setPrimaryName] = useState(station?.primary_name ?? "");
  const [furigana, setFurigana] = useState(
    station?.primary_name_furigana ?? "",
  );
  const [secondaryName, setSecondaryName] = useState(
    station?.secondary_name ?? "",
  );
  const [tertiaryName, setTertiaryName] = useState(
    station?.tertiary_name ?? "",
  );
  const [quaternaryName, setQuaternaryName] = useState(
    station?.quaternary_name ?? "",
  );
  const [note, setNote] = useState(station?.note ?? "");
  const [trc, setTrc] = useState(station?.three_letter_code ?? "");
  const [stationNumber, setStationNumber] = useState(
    existingNums[0]?.value ?? "",
  );
  const [areas, setAreas] = useState<StationArea[]>(existingAreas);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const handleAddZone = () => {
    if (!selectedZoneId) return;
    // Avoid duplicates
    if (areas.some((a) => a.zone_id === selectedZoneId)) return;
    setAreas((prev) => [
      ...prev,
      {
        id: uuidv7(),
        station_id: station?.id ?? "",
        zone_id: selectedZoneId,
        sort_order: prev.length,
      },
    ]);
    setSelectedZoneId(null);
  };

  const handleSave = () => {
    if (!primaryName.trim()) return;

    const stationId = station?.id ?? uuidv7();

    // Upsert station
    upsertStation(db, {
      id: stationId,
      primary_name: primaryName.trim(),
      primary_name_furigana: furigana.trim() || null,
      secondary_name: secondaryName.trim() || null,
      tertiary_name: tertiaryName.trim() || null,
      quaternary_name: quaternaryName.trim() || null,
      quinary_name: null,
      note: note.trim() || null,
      three_letter_code: trc.trim() || null,
      sort_order: station?.sort_order ?? null,
    });

    // If new station, add to line
    if (!station) {
      upsertStationLine(db, {
        id: uuidv7(),
        station_id: stationId,
        line_id: lineId,
        sort_order: maxSortOrder + 1,
      });
    }

    // Upsert station number for this line
    if (stationNumber.trim()) {
      db.run(
        `DELETE FROM station_numbers WHERE station_id = ? AND line_id = ?`,
        [stationId, lineId],
      );
      upsertStationNumber(db, {
        id: uuidv7(),
        station_id: stationId,
        line_id: lineId,
        value: stationNumber.trim(),
      });
    } else {
      db.run(
        `DELETE FROM station_numbers WHERE station_id = ? AND line_id = ?`,
        [stationId, lineId],
      );
    }

    // Sync areas
    syncStationAreas(
      db,
      stationId,
      areas.map((a, i) => ({ ...a, sort_order: i })),
    );

    onSave();
    onClose();
  };

  const zoneSelectData = specialZones
    .filter((z) => !areas.some((a) => a.zone_id === z.id))
    .map((z) => ({
      value: z.id,
      label: `${z.abbreviation} — ${z.name}`,
    }));

  return (
    <Stack gap="md">
      <TextInput
        label={t("route.station.name")}
        value={primaryName}
        onChange={(e) => setPrimaryName(e.target.value)}
        required
      />
      <TextInput
        label={t("route.station.furigana")}
        value={furigana}
        onChange={(e) => setFurigana(e.target.value)}
      />
      <TextInput
        label={t("route.station.en")}
        value={secondaryName}
        onChange={(e) => setSecondaryName(e.target.value)}
      />
      <TextInput
        label={t("route.station.ko")}
        value={tertiaryName}
        onChange={(e) => setTertiaryName(e.target.value)}
      />
      <TextInput
        label={t("route.station.zh")}
        value={quaternaryName}
        onChange={(e) => setQuaternaryName(e.target.value)}
      />
      <TextInput
        label={t("route.station.note")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <TextInput
        label={t("route.station.trc")}
        value={trc}
        onChange={(e) => setTrc(e.target.value)}
        maxLength={3}
      />
      <TextInput
        label={t("route.station.number")}
        value={stationNumber}
        onChange={(e) => setStationNumber(e.target.value)}
      />

      <Divider label={t("route.station.areas")} labelPosition="left" />
      <Stack gap="xs">
        {areas.map((area) => {
          const zone = specialZones.find((z) => z.id === area.zone_id);
          return (
            <Group key={area.id} gap="xs" align="center" wrap="nowrap">
              <Badge
                variant={zone?.is_black === 1 ? "filled" : "outline"}
                color="dark"
                style={{ minWidth: 32 }}
              >
                {zone?.abbreviation ?? "?"}
              </Badge>
              <Text size="sm" style={{ flex: 1 }}>
                {zone?.name ?? area.zone_id}
              </Text>
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() =>
                  setAreas((prev) => prev.filter((a) => a.id !== area.id))
                }
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          );
        })}
        {zoneSelectData.length > 0 && (
          <Group gap="xs" align="flex-end">
            <Select
              style={{ flex: 1 }}
              value={selectedZoneId}
              onChange={setSelectedZoneId}
              data={zoneSelectData}
              placeholder={t("route.station.areas")}
              clearable
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddZone}
              disabled={!selectedZoneId}
            >
              {t("common.add")}
            </Button>
          </Group>
        )}
      </Stack>

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t("common.close")}
        </Button>
        <Button onClick={handleSave} disabled={!primaryName.trim()}>
          {t("common.save")}
        </Button>
      </Group>
    </Stack>
  );
}

// ── Link Existing Station Form Modal ─────────────────────────────────────────

interface LinkExistingStationFormProps {
  db: Database;
  lineId: string;
  maxSortOrder: number;
  specialZones: SpecialZone[];
  alreadyOnLineIds: Set<string>;
  onSave: () => void;
  onClose: () => void;
}

function LinkExistingStationForm({
  db,
  lineId,
  maxSortOrder,
  specialZones,
  alreadyOnLineIds,
  onSave,
  onClose,
}: LinkExistingStationFormProps) {
  const t = useTranslations();
  const allStations = getAllStations(db);
  const available = allStations.filter((s) => !alreadyOnLineIds.has(s.id));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stationNumber, setStationNumber] = useState("");

  const selectedStation = available.find((s) => s.id === selectedId) ?? null;
  const selectedAreas = selectedStation
    ? getStationAreas(db, selectedStation.id)
    : [];

  const handleSave = () => {
    if (!selectedId) return;
    upsertStationLine(db, {
      id: uuidv7(),
      station_id: selectedId,
      line_id: lineId,
      sort_order: maxSortOrder + 1,
    });
    if (stationNumber.trim()) {
      db.run(
        `DELETE FROM station_numbers WHERE station_id = ? AND line_id = ?`,
        [selectedId, lineId],
      );
      upsertStationNumber(db, {
        id: uuidv7(),
        station_id: selectedId,
        line_id: lineId,
        value: stationNumber.trim(),
      });
    }
    onSave();
    onClose();
  };

  const infoRows: [string, string | null | undefined][] = [
    [t("route.station.furigana"), selectedStation?.primary_name_furigana],
    [t("route.station.en"), selectedStation?.secondary_name],
    [t("route.station.ko"), selectedStation?.tertiary_name],
    [t("route.station.zh"), selectedStation?.quaternary_name],
    [t("route.station.note"), selectedStation?.note],
    [t("route.station.trc"), selectedStation?.three_letter_code],
  ];

  return (
    <Stack gap="md">
      <Select
        label={t("route.station.select-existing")}
        data={available.map((s) => ({
          value: s.id,
          label: s.secondary_name
            ? `${s.primary_name} (${s.secondary_name})`
            : s.primary_name,
        }))}
        value={selectedId}
        onChange={setSelectedId}
        searchable
        required
        placeholder="—"
      />

      {selectedStation && (
        <>
          <Divider
            label={t("route.station.inherited-info")}
            labelPosition="left"
          />
          <Stack gap="xs">
            {infoRows
              .filter(([, val]) => val)
              .map(([label, val]) => (
                <Group key={label} gap="xs">
                  <Text
                    size="sm"
                    c="dimmed"
                    style={{ width: 140, flexShrink: 0 }}
                  >
                    {label}
                  </Text>
                  <Text size="sm">{val}</Text>
                </Group>
              ))}
            {selectedAreas.length > 0 && (
              <Group gap="xs" align="center">
                <Text
                  size="sm"
                  c="dimmed"
                  style={{ width: 140, flexShrink: 0 }}
                >
                  {t("route.station.areas")}
                </Text>
                <Group gap="xs">
                  {selectedAreas.map((area) => {
                    const zone = specialZones.find(
                      (z) => z.id === area.zone_id,
                    );
                    return (
                      <Badge
                        key={area.id}
                        variant={zone?.is_black === 1 ? "filled" : "outline"}
                        color="dark"
                      >
                        {zone?.abbreviation ?? "?"}
                      </Badge>
                    );
                  })}
                </Group>
              </Group>
            )}
          </Stack>
        </>
      )}

      <TextInput
        label={t("route.station.number")}
        value={stationNumber}
        onChange={(e) => setStationNumber(e.target.value)}
      />

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t("common.close")}
        </Button>
        <Button onClick={handleSave} disabled={!selectedId}>
          {t("common.save")}
        </Button>
      </Group>
    </Stack>
  );
}

// ── Main EditRoutesTab ────────────────────────────────────────────────────────

export default function EditRoutesTab({ db, persist }: EditRoutesTabProps) {
  const t = useTranslations();
  const [, setRefreshKey] = useState(0);

  const refresh = () => {
    persist();
    setRefreshKey((k) => k + 1);
  };

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportBinary, setPendingImportBinary] =
    useState<Uint8Array | null>(null);
  const [
    importModalOpened,
    { open: openImportModal, close: closeImportModal },
  ] = useDisclosure(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const binary = new Uint8Array(ev.target!.result as ArrayBuffer);
      if (fileInputRef.current) fileInputRef.current.value = "";

      const result = await validateImportDatabase(binary);
      if (!result.valid) {
        const msg =
          result.reason === "invalid-file"
            ? t("route.import-error.invalid-file")
            : result.reason === "missing-table"
              ? t("route.import-error.missing-table", {
                  detail: result.detail ?? "",
                })
              : t("route.import-error.missing-column", {
                  detail: result.detail ?? "",
                });
        setImportError(msg);
        return;
      }

      setImportError(null);
      setPendingImportBinary(binary);
      openImportModal();
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLoadSample = async () => {
    try {
      const res = await fetch("/sample.sqlite");
      if (!res.ok) throw new Error("fetch failed");
      const binary = new Uint8Array(await res.arrayBuffer());
      setImportError(null);
      setPendingImportBinary(binary);
      openImportModal();
    } catch {
      setImportError(t("route.import-error.invalid-file"));
    }
  };

  const handleImportOverwrite = async () => {
    if (!pendingImportBinary || !db) return;
    setImporting(true);
    await overwriteDatabaseInPlace(pendingImportBinary, db);
    setPendingImportBinary(null);
    setImporting(false);
    closeImportModal();
    refresh();
  };

  const handleImportMerge = async () => {
    if (!pendingImportBinary) return;
    setImporting(true);
    await mergeDatabase(pendingImportBinary);
    setPendingImportBinary(null);
    setImporting(false);
    closeImportModal();
    refresh();
  };

  // Special zone state
  const [zoneModalOpened, { open: openZoneModal, close: closeZoneModal }] =
    useDisclosure(false);
  const [editingZone, setEditingZone] = useState<SpecialZone | undefined>(
    undefined,
  );

  // Company state
  const [
    companyModalOpened,
    { open: openCompanyModal, close: closeCompanyModal },
  ] = useDisclosure(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>(
    undefined,
  );

  // Line state
  const [lineModalOpened, { open: openLineModal, close: closeLineModal }] =
    useDisclosure(false);
  const [editingLine, setEditingLine] = useState<Line | undefined>(undefined);
  const [lineCompanyFilter, setLineCompanyFilter] = useState<string | null>(
    null,
  );

  // Station state
  const [
    stationModalOpened,
    { open: openStationModal, close: closeStationModal },
  ] = useDisclosure(false);
  const [
    linkStationModalOpened,
    { open: openLinkStationModal, close: closeLinkStationModal },
  ] = useDisclosure(false);
  const [editingStation, setEditingStation] = useState<Station | undefined>(
    undefined,
  );
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  if (!db) {
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

  // Read data from DB (re-reads on refreshKey change)
  const specialZones = getAllSpecialZones(db);
  const companies = getAllCompanies(db);
  const allLines = getAllLines(db);
  const filteredLines = lineCompanyFilter
    ? allLines.filter((l) => l.company_id === lineCompanyFilter)
    : allLines;
  const stationsInLine = selectedLineId
    ? getStationsByLine(db, selectedLineId)
    : [];
  const alreadyOnLineIds = new Set(stationsInLine.map((s) => s.id));
  const selectedLine = allLines.find((l) => l.id === selectedLineId);

  const handleDeleteZone = (id: string) => {
    if (!window.confirm(t("route.special-zone.delete-confirm"))) return;
    deleteSpecialZone(db, id);
    refresh();
  };

  const handleDeleteCompany = (id: string) => {
    if (!window.confirm(t("route.company.delete-confirm"))) return;
    deleteCompany(db, id);
    refresh();
  };

  const handleDeleteLine = (id: string) => {
    if (!window.confirm(t("route.line.delete-confirm"))) return;
    deleteLine(db, id);
    refresh();
  };

  const handleDeleteStation = (stationId: string) => {
    if (!selectedLineId) return;
    if (!window.confirm(t("route.station.delete-confirm"))) return;
    deleteStationFromLine(db, stationId, selectedLineId);
    refresh();
  };

  const handleReorderStation = (
    stationId: string,
    direction: "up" | "down",
  ) => {
    if (!selectedLineId) return;
    const stationLines = stationsInLine
      .map((s) => {
        const sls = getStationLines(db, s.id);
        return sls.find((sl) => sl.line_id === selectedLineId);
      })
      .filter(Boolean);

    const idx = stationLines.findIndex((sl) => sl!.station_id === stationId);
    if (idx === -1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= stationLines.length) return;

    const a = stationLines[idx]!;
    const b = stationLines[swapIdx]!;

    const tempOrder = a.sort_order;
    upsertStationLine(db, { ...a, sort_order: b.sort_order });
    upsertStationLine(db, { ...b, sort_order: tempOrder });

    refresh();
  };

  const maxSortOrder =
    stationsInLine.length > 0
      ? Math.max(
          ...stationsInLine.map((s) => {
            const sls = getStationLines(db, s.id);
            const sl = sls.find((sl) => sl.line_id === selectedLineId);
            return sl?.sort_order ?? 0;
          }),
        )
      : 0;

  return (
    <Box style={{ padding: "16px" }}>
      {/* Hidden file input for SQLite import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".sqlite,.sqlite3,.db"
        style={{ display: "none" }}
        onChange={handleImportFileChange}
      />

      {/* Toolbar: Import / Download */}
      <Group justify="flex-end" mb={importError ? "xs" : "lg"} gap="sm">
        <Button
          variant="outline"
          leftSection={<IconDatabaseImport size={16} />}
          onClick={() => void handleLoadSample()}
        >
          {t("route.import-sample")}
        </Button>
        <Button
          variant="outline"
          leftSection={<IconUpload size={16} />}
          onClick={() => fileInputRef.current?.click()}
        >
          {t("route.import-sqlite")}
        </Button>
        <Button
          variant="outline"
          leftSection={<IconDownload size={16} />}
          onClick={() => downloadDatabase(db, "station-signs.sqlite")}
        >
          {t("route.download-sqlite")}
        </Button>
      </Group>

      {importError && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          mb="lg"
          withCloseButton
          onClose={() => setImportError(null)}
        >
          {importError}
        </Alert>
      )}

      <Stack gap="xl">
        {/* ── Special Zones section ── */}
        <Box>
          <Group justify="space-between" mb="md">
            <Title order={3}>{t("route.special-zone.title")}</Title>
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditingZone(undefined);
                openZoneModal();
              }}
            >
              {t("route.special-zone.add")}
            </Button>
          </Group>

          {specialZones.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t("route.special-zone.empty")}
            </Text>
          ) : (
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("route.special-zone.abbreviation")}</Table.Th>
                  <Table.Th>{t("route.special-zone.name")}</Table.Th>
                  <Table.Th>{t("route.special-zone.is-black")}</Table.Th>
                  <Table.Th style={{ width: 100 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {specialZones.map((zone) => (
                  <Table.Tr key={zone.id}>
                    <Table.Td>
                      <Badge
                        variant={zone.is_black === 1 ? "filled" : "outline"}
                        color="dark"
                      >
                        {zone.abbreviation}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{zone.name}</Table.Td>
                    <Table.Td>
                      <Switch checked={zone.is_black === 1} readOnly />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => {
                            setEditingZone(zone);
                            openZoneModal();
                          }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteZone(zone.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Box>

        <Divider />

        {/* ── Companies section ── */}
        <Box>
          <Group justify="space-between" mb="md">
            <Title order={3}>{t("route.company.title")}</Title>
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditingCompany(undefined);
                openCompanyModal();
              }}
            >
              {t("route.company.add")}
            </Button>
          </Group>

          {companies.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t("route.company.empty")}
            </Text>
          ) : (
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("route.company.name")}</Table.Th>
                  <Table.Th>{t("route.company.color")}</Table.Th>
                  <Table.Th style={{ width: 100 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {companies.map((company) => (
                  <Table.Tr key={company.id}>
                    <Table.Td>{company.name}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Box
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            backgroundColor: company.company_color,
                            border: "1px solid #ccc",
                          }}
                        />
                        <Text size="sm">{company.company_color}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => {
                            setEditingCompany(company);
                            openCompanyModal();
                          }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteCompany(company.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Box>

        <Divider />

        {/* ── Lines section ── */}
        <Box>
          <Group justify="space-between" mb="md">
            <Title order={3}>{t("route.line.title")}</Title>
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditingLine(undefined);
                openLineModal();
              }}
            >
              {t("route.line.add")}
            </Button>
          </Group>

          <Select
            label={t("route.line.company")}
            value={lineCompanyFilter}
            onChange={setLineCompanyFilter}
            data={[
              { value: "", label: t("route.line.all") },
              ...companies.map((c) => ({ value: c.id, label: c.name })),
            ]}
            mb="md"
            clearable
            placeholder={t("route.line.all")}
          />

          {filteredLines.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t("route.line.empty")}
            </Text>
          ) : (
            <Box style={{ overflowX: "auto" }}>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t("route.line.name")}</Table.Th>
                    <Table.Th>{t("route.line.prefix")}</Table.Th>
                    <Table.Th>{t("route.line.color")}</Table.Th>
                    <Table.Th>{t("route.line.company")}</Table.Th>
                    <Table.Th>{t("route.line.is-loop")}</Table.Th>
                    <Table.Th style={{ width: 100 }}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredLines.map((line) => {
                    const company = companies.find(
                      (c) => c.id === line.company_id,
                    );
                    return (
                      <Table.Tr key={line.id}>
                        <Table.Td>{line.name}</Table.Td>
                        <Table.Td>
                          <Badge variant="outline">{line.prefix}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Box
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 4,
                                backgroundColor: line.line_color,
                                border: "1px solid #ccc",
                              }}
                            />
                            <Text size="sm">{line.line_color}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>{company?.name ?? "—"}</Table.Td>
                        <Table.Td>
                          <Switch checked={line.is_loop === 1} readOnly />
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => {
                                setEditingLine(line);
                                openLineModal();
                              }}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleDeleteLine(line.id)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Box>
          )}
        </Box>

        <Divider />

        {/* ── Stations section ── */}
        <Box>
          <Group justify="space-between" mb="md">
            <Title order={3}>{t("route.station.title")}</Title>
            <Group gap="sm">
              <Button
                size="sm"
                variant="outline"
                leftSection={<IconLink size={16} />}
                disabled={!selectedLineId}
                onClick={openLinkStationModal}
              >
                {t("route.station.add-existing")}
              </Button>
              <Button
                size="sm"
                leftSection={<IconPlus size={16} />}
                disabled={!selectedLineId}
                onClick={() => {
                  setEditingStation(undefined);
                  openStationModal();
                }}
              >
                {t("route.station.add")}
              </Button>
            </Group>
          </Group>

          <Select
            label={t("route.line.title")}
            value={selectedLineId}
            onChange={setSelectedLineId}
            data={allLines.map((l) => ({
              value: l.id,
              label: `[${l.prefix}] ${l.name}`,
            }))}
            placeholder={t("route.line.select")}
            mb="md"
            clearable
          />

          {!selectedLineId ? (
            <Text c="dimmed" size="sm">
              {t("route.station.empty")}
            </Text>
          ) : stationsInLine.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t("route.station.no-station")}
            </Text>
          ) : (
            (() => {
              const stationsWithNums = stationsInLine.map((station) => ({
                station,
                nums: getStationNumbers(db, station.id, selectedLineId!),
              }));
              const seen = new Set<string>();
              const duplicateNumbers = new Set<string>();
              for (const { nums } of stationsWithNums) {
                for (const n of nums) {
                  if (seen.has(n.value)) duplicateNumbers.add(n.value);
                  else seen.add(n.value);
                }
              }
              return (
                <>
                  {duplicateNumbers.size > 0 && (
                    <Alert
                      icon={<IconAlertCircle size={16} />}
                      color="yellow"
                      mb="sm"
                      py="xs"
                    >
                      {t("route.station.duplicate-number-warning", {
                        numbers: [...duplicateNumbers].join(", "),
                      })}
                    </Alert>
                  )}
                  <Table withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 60 }}>#</Table.Th>
                        <Table.Th style={{ width: 85 }}>
                          {t("route.station.number")}
                        </Table.Th>
                        <Table.Th>{t("route.station.name")}</Table.Th>
                        <Table.Th style={{ width: 140 }}></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {stationsWithNums.map(({ station, nums }, idx) => {
                        const isDuplicate =
                          !!nums[0]?.value &&
                          duplicateNumbers.has(nums[0].value);
                        return (
                          <Table.Tr key={station.id}>
                            <Table.Td>
                              <Badge variant="light" size="sm">
                                {idx + 1}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} align="center" wrap="nowrap">
                                {nums[0]?.value ? (
                                  <StationNumberBadgePreview
                                    color={
                                      selectedLine?.line_color ?? "#000000"
                                    }
                                    style={
                                      companies.find(
                                        (c) =>
                                          c.id === selectedLine?.company_id,
                                      )?.station_number_style ?? "jreast"
                                    }
                                    prefix={selectedLine?.prefix ?? ""}
                                    value={nums[0].value}
                                    compact
                                  />
                                ) : (
                                  <Badge variant="light" color="gray" size="sm">
                                    —
                                  </Badge>
                                )}
                                {isDuplicate && (
                                  <IconAlertCircle
                                    size={16}
                                    color="var(--mantine-color-yellow-6)"
                                  />
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text size="sm" fw={600}>
                                  {station.primary_name}
                                </Text>
                                {station.primary_name_furigana && (
                                  <Text size="xs" c="dimmed">
                                    {station.primary_name_furigana}
                                  </Text>
                                )}
                                {station.secondary_name && (
                                  <Text size="xs" c="dimmed">
                                    {station.secondary_name}
                                  </Text>
                                )}
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <ActionIcon
                                  variant="subtle"
                                  disabled={idx === 0}
                                  onClick={() =>
                                    handleReorderStation(station.id, "up")
                                  }
                                >
                                  <IconArrowUp size={16} />
                                </ActionIcon>
                                <ActionIcon
                                  variant="subtle"
                                  disabled={idx === stationsInLine.length - 1}
                                  onClick={() =>
                                    handleReorderStation(station.id, "down")
                                  }
                                >
                                  <IconArrowDown size={16} />
                                </ActionIcon>
                                <ActionIcon
                                  variant="subtle"
                                  onClick={() => {
                                    setEditingStation(station);
                                    openStationModal();
                                  }}
                                >
                                  <IconEdit size={16} />
                                </ActionIcon>
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  onClick={() =>
                                    handleDeleteStation(station.id)
                                  }
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </>
              );
            })()
          )}
        </Box>
      </Stack>

      {/* ── Import confirmation modal ── */}
      <Modal
        opened={importModalOpened}
        onClose={() => {
          if (!importing) {
            setPendingImportBinary(null);
            closeImportModal();
          }
        }}
        title={t("route.import-modal.title")}
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t("route.import-modal.description")}</Text>
          <Stack gap="xs">
            <Text size="xs" c="dimmed">
              {t("route.import-modal.overwrite-desc")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("route.import-modal.merge-desc")}
            </Text>
          </Stack>
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setPendingImportBinary(null);
                closeImportModal();
              }}
              disabled={importing}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="outline"
              loading={importing}
              onClick={() => void handleImportMerge()}
            >
              {t("route.import-modal.merge")}
            </Button>
            <Button
              color="red"
              loading={importing}
              onClick={() => void handleImportOverwrite()}
            >
              {t("route.import-modal.overwrite")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Special Zone Modal ── */}
      <Modal
        opened={zoneModalOpened}
        onClose={closeZoneModal}
        title={
          editingZone
            ? t("route.special-zone.edit")
            : t("route.special-zone.add")
        }
        centered
      >
        <SpecialZoneForm
          db={db}
          zone={editingZone}
          onSave={refresh}
          onClose={closeZoneModal}
        />
      </Modal>

      {/* ── Modals ── */}
      <Modal
        opened={companyModalOpened}
        onClose={closeCompanyModal}
        title={
          editingCompany ? t("route.company.edit") : t("route.company.add")
        }
        centered
      >
        <CompanyForm
          db={db}
          company={editingCompany}
          onSave={refresh}
          onClose={closeCompanyModal}
        />
      </Modal>

      <Modal
        opened={lineModalOpened}
        onClose={closeLineModal}
        title={editingLine ? t("route.line.edit") : t("route.line.add")}
        centered
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <LineForm
          db={db}
          line={editingLine}
          companies={companies}
          onSave={refresh}
          onClose={closeLineModal}
        />
      </Modal>

      {selectedLine && (
        <Modal
          opened={stationModalOpened}
          onClose={closeStationModal}
          title={
            editingStation ? t("route.station.edit") : t("route.station.add")
          }
          centered
          size="lg"
        >
          <StationForm
            db={db}
            station={editingStation}
            lineId={selectedLine.id}
            maxSortOrder={maxSortOrder}
            specialZones={specialZones}
            onSave={refresh}
            onClose={closeStationModal}
          />
        </Modal>
      )}

      {selectedLine && (
        <Modal
          opened={linkStationModalOpened}
          onClose={closeLinkStationModal}
          title={t("route.station.link-title")}
          centered
          size="lg"
        >
          <LinkExistingStationForm
            db={db}
            lineId={selectedLine.id}
            maxSortOrder={maxSortOrder}
            specialZones={specialZones}
            alreadyOnLineIds={alreadyOnLineIds}
            onSave={refresh}
            onClose={closeLinkStationModal}
          />
        </Modal>
      )}
    </Box>
  );
}
