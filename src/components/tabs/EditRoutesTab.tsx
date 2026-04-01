import { useState, useRef, useEffect, useMemo } from "react";
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
  IconX,
} from "@tabler/icons-react";
import { v7 as uuidv7 } from "uuid";
import { useTranslations } from "@/i18n/useTranslation";
import { waitForCanvasFonts } from "@/lib/fonts";
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
  getServicesByLine,
  upsertService,
  deleteService,
  getServiceStopsByLine,
  upsertStationServiceStop,
  setStationServiceStop,
} from "@/db/repositories/services";
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
  getResolvedStationNumber,
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
  Service,
  ServiceStopStatus,
} from "@/db/types";

const TOKYO_METRO_COLOR = "#00a3d9";

function buildStationNumberSourceOptions(
  currentLine: Line | undefined,
  parentLine: Line | undefined,
  t: ReturnType<typeof useTranslations>,
) {
  const options = [
    {
      value: currentLine?.id ?? "",
      label: t("route.station.number-source-current", {
        prefix: currentLine?.prefix || "—",
        name: currentLine?.name ?? "—",
      }),
    },
  ];

  if (parentLine) {
    options.push({
      value: parentLine.id,
      label: t("route.station.number-source-parent", {
        prefix: parentLine.prefix || "—",
        name: parentLine.name,
      }),
    });
  }

  return options;
}

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
  threeLetterCode,
  compact = false,
}: {
  color: string;
  style: string;
  prefix?: string;
  value?: string;
  threeLetterCode?: string | null;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const isMetroCompact = compact && style === "tokyometro";
    const scale = isMetroCompact ? 1.45 : compact ? 1.125 : 1.5;
    const badgeSize = 30 * scale; // inner badge = 30×30 sign units
    // With TRC: outer frame adds 12 above + 3 below the inner badge (sign units)
    const trcH = 12 * scale;
    const outerPadX = 3 * scale;
    const outerPadBot = 3 * scale;
    const trcExtension = threeLetterCode ? Math.ceil(trcH + outerPadBot) : 0;
    const cssW = isMetroCompact ? 94 : compact ? 75 : 120;
    const cssH = (isMetroCompact ? 68 : compact ? 57 : 75) + trcExtension;
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
      const badgeFont =
        style === "tokyometro"
          ? '"JostTrispaceHybrid", Arial, sans-serif'
          : '"HindSemiBold", Arial, sans-serif';

      if (style === "tokyometro") {
        const radius = badgeSize / 2;
        const cx = cssW / 2;
        const cy = isMetroCompact ? cssH / 2 - 1.5 : cssH / 2;
        const strokeWidth = 3 * scale + 1 + (isMetroCompact ? 0 : 1);
        const strokeRadius = radius - strokeWidth / 2 + (isMetroCompact ? 0 : 0.5);
        const metroTextSize = 11 * scale + (isMetroCompact ? 0 : 1);
        const metroValueTextSize = metroTextSize - (isMetroCompact ? 2 : 0);
        const metroTextOffsetY = isMetroCompact ? 0.5 * scale : 0;

        // White fill circle
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Colored stroke — same 3-unit thickness as JR East
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.arc(cx, cy, strokeRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Prefix text at top of circle
          ctx.fillStyle = "#000000";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.font = `600 ${metroTextSize}px ${badgeFont}`;
          ctx.fillText(prefix, cx, cy - radius + 5 * scale + metroTextOffsetY);

          // Number text below prefix
          ctx.font = `700 ${metroValueTextSize}px ${badgeFont}`;
          ctx.fillText(value, cx, cy - radius + 14 * scale + metroTextOffsetY);
      } else if (style === "jreast") {
        if (threeLetterCode) {
          // Outer frame: 36×45 sign units → (badgeSize + 2*outerPadX) × (trcH + badgeSize + outerPadBot)
          const outerW = badgeSize + 2 * outerPadX;
          const outerH = trcH + badgeSize + outerPadBot;
          const ox = (cssW - outerW) / 2;
          const oy = (cssH - outerH) / 2;
          const ix = ox + outerPadX; // inner badge left
          const iy = oy + trcH; // inner badge top

          // White base fill for the entire outer frame
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.roundRect(ox, oy, outerW, outerH, 4 * scale);
          ctx.fill();

          // Black fill for TRC strip (top portion)
          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.roundRect(ox, oy, outerW, trcH, [4 * scale, 4 * scale, 0, 0]);
          ctx.fill();

          // White fill for inner badge
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.roundRect(ix, iy, badgeSize, badgeSize, 2 * scale);
          ctx.fill();

          // Outer black frame stroke (approximates the layered black rects in the sign)
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 3 * scale;
          ctx.beginPath();
          ctx.roundRect(ox, oy, outerW, outerH, 4 * scale);
          ctx.stroke();

          // Inner colored outline
          ctx.strokeStyle = color;
          ctx.lineWidth = 3 * scale;
          ctx.beginPath();
          ctx.roundRect(ix, iy, badgeSize, badgeSize, 2 * scale);
          ctx.stroke();

          // TRC text (white), 1 unit below outer frame top, centered over inner width
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.font = `800 ${12.2 * scale}px "HindSemiBold", Arial, sans-serif`;
          ctx.fillText(threeLetterCode, ix + badgeSize / 2, oy + 1 * scale);

          // Prefix (+4 from inner badge top, same as non-TRC)
          ctx.fillStyle = "#000000";
          ctx.font = `600 ${11 * scale}px "HindSemiBold", Arial, sans-serif`;
          ctx.fillText(prefix, ix + badgeSize / 2, iy + 4 * scale);

          // Number (+14 from inner badge top, same as non-TRC)
          ctx.font = `600 ${17 * scale}px "HindSemiBold", Arial, sans-serif`;
          ctx.fillText(value, ix + badgeSize / 2, iy + 14 * scale);
        } else {
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
      }

      ctx.restore();
    };

    waitForCanvasFonts().then(draw).catch(draw);
  }, [color, style, prefix, value, threeLetterCode, compact]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}

// ── Line Indicator Badge Preview ──────────────────────────────────────────────

function LineIndicatorBadgePreview({
  color,
  prefix,
  style,
  compact = false,
}: {
  color: string;
  prefix: string;
  style: string;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const isMetroCompact = compact && style === "tokyometro";
    const scale = isMetroCompact ? 1.25 : compact ? 1.125 : 1.5;
    const badgeSize = 30 * scale;
    const cssSize = isMetroCompact ? 46 : compact ? 48 : 64;
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssSize, cssSize);

      const bx = (cssSize - badgeSize) / 2;
      const by = (cssSize - badgeSize) / 2;
      const strokeWidth = 3 * scale;

      if (style === "tokyometro") {
        const radius = badgeSize / 2;
        const cx = cssSize / 2;
        const cy = cssSize / 2;
        const outerPad = isMetroCompact ? 1.2 * scale : 2.5 * scale;
        const metroStrokeWidth = strokeWidth * 2.5;
        const strokeRadius = radius - metroStrokeWidth / 2;

        // White margin around the badge keeps it legible on dark themes.
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, cy, radius + outerPad, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = metroStrokeWidth;
        ctx.beginPath();
        ctx.arc(cx, cy, strokeRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // White rounded background with narrow padding
        const pad = 3 * scale;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(
          bx - pad,
          by - pad,
          badgeSize + pad * 2,
          badgeSize + pad * 2,
          4 * scale,
        );
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeSize, badgeSize, 2 * scale);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeSize, badgeSize, 2 * scale);
        ctx.stroke();
      }

      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `${style === "tokyometro" ? 700 : 600} ${style === "tokyometro" ? 13.6 * scale : 21 * scale}px ${style === "tokyometro" ? '"JostTrispaceHybrid", Arial, sans-serif' : '"HindSemiBold", Arial, sans-serif'}`;
      const m = ctx.measureText(prefix);
      const textH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      ctx.fillText(
        prefix,
        cssSize / 2,
        cssSize / 2 + m.actualBoundingBoxAscent - textH / 2,
      );

      ctx.restore();
    };

    waitForCanvasFonts().then(draw).catch(draw);
  }, [color, prefix, style, compact]);

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
  const [color, setColor] = useState(
    company?.company_color ??
    (company?.name === "東京メトロ" ? TOKYO_METRO_COLOR : "#3a9200"),
  );
  const [colorDirty, setColorDirty] = useState(false);
  const [stationNumberStyle, setStationNumberStyle] = useState(
    company?.station_number_style ?? "jreast",
  );

  useEffect(() => {
    if (company || colorDirty) return;
    setColor(name.trim() === "東京メトロ" ? TOKYO_METRO_COLOR : "#3a9200");
  }, [company, colorDirty, name]);

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
        onChange={(value) => {
          setColorDirty(true);
          setColor(value);
        }}
        format="hex"
        swatches={[
          "#3a9200",
          "#005bac",
          "#e60012",
          "#f97f00",
          TOKYO_METRO_COLOR,
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
          {
            value: "tokyometro",
            label: t("route.company.station-number-style-tokyometro"),
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
  const [color, setColor] = useState(line?.line_color ?? "#8cc800");
  const [companyId, setCompanyId] = useState<string | null>(
    line?.company_id ?? null,
  );
  const [priority, setPriority] = useState<number | string>(
    line?.priority ?? "",
  );
  const [isLoop, setIsLoop] = useState((line?.is_loop ?? 0) === 1);

  const [draftServices, setDraftServices] = useState<
    { id: string | null; name: string; color: string }[]
  >(() =>
    line
      ? getServicesByLine(db, line.id).map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
      }))
      : [{ id: null, name: t("route.service.local"), color: color }],
  );
  const [deletedServiceIds, setDeletedServiceIds] = useState<string[]>([]);
  const [newSvcName, setNewSvcName] = useState("");

  const handleAddSvc = () => {
    if (!newSvcName.trim()) return;
    setDraftServices((prev) => [
      ...prev,
      { id: null, name: newSvcName.trim(), color: color },
    ]);
    setNewSvcName("");
  };

  const handleRemoveSvc = (idx: number) => {
    const svc = draftServices[idx];
    if (svc?.id) setDeletedServiceIds((prev) => [...prev, svc.id!]);
    setDraftServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const lineId = line?.id ?? uuidv7();
    upsertLine(db, {
      id: lineId,
      name: name.trim(),
      prefix: prefix.trim(),
      line_color: color,
      company_id: companyId,
      priority: priority === "" ? null : Number(priority),
      is_loop: isLoop ? 1 : 0,
      parent_line_id: line?.parent_line_id ?? null,
    });
    for (const id of deletedServiceIds) {
      deleteService(db, id);
    }
    const stationsOnLine = line ? getStationsByLine(db, lineId) : [];
    draftServices.forEach((svc, i) => {
      const svcId = svc.id ?? uuidv7();
      upsertService(db, {
        id: svcId,
        line_id: lineId,
        name: svc.name.trim() || t("route.service.local"),
        color: svc.color,
        sort_order: i,
      });
      // For newly added services on an existing line, seed stops for all stations
      if (!svc.id && line) {
        for (const station of stationsOnLine) {
          upsertStationServiceStop(db, {
            id: uuidv7(),
            station_id: station.id,
            service_id: svcId,
            status: "stop",
          });
        }
      }
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
      />
      <ColorInput
        label={t("route.line.color")}
        value={color}
        onChange={setColor}
        format="hex"
        swatches={["#8cc800", "#ffffff", "#000000", "#ffdd00", "#f97f00"]}
      />
      {prefix.trim() && (
        <Group align="center" gap="md">
          <LineIndicatorBadgePreview
            color={color}
            prefix={prefix.trim()}
            style={
              companies.find((c) => c.id === companyId)?.station_number_style ??
              ""
            }
          />
          <Text size="xs" c="dimmed">
            {t("route.line.prefix-preview")}
          </Text>
        </Group>
      )}
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
      <Divider label={t("route.service.title")} labelPosition="left" />
      <Stack gap="xs">
        {draftServices.map((svc, i) => (
          <Group key={i} gap="xs" align="center">
            <ColorInput
              size="xs"
              value={svc.color}
              onChange={(c) => {
                const updated = [...draftServices];
                updated[i] = { ...updated[i]!, color: c };
                setDraftServices(updated);
              }}
              format="hex"
              withEyeDropper={false}
              style={{ width: 100 }}
            />
            <TextInput
              size="xs"
              value={svc.name}
              onChange={(e) => {
                const updated = [...draftServices];
                updated[i] = { ...updated[i]!, name: e.target.value };
                setDraftServices(updated);
              }}
              style={{ flex: 1 }}
            />
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              onClick={() => handleRemoveSvc(i)}
            >
              <IconX size={14} />
            </ActionIcon>
          </Group>
        ))}
        <Group gap="xs">
          <TextInput
            size="xs"
            placeholder={t("route.service.add-placeholder")}
            value={newSvcName}
            onChange={(e) => setNewSvcName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSvc();
            }}
            style={{ flex: 1 }}
          />
          <ActionIcon
            size="sm"
            onClick={handleAddSvc}
            disabled={!newSvcName.trim()}
          >
            <IconPlus size={12} />
          </ActionIcon>
        </Group>
      </Stack>
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
  const allLines = useMemo(() => getAllLines(db), [db]);
  const currentLine = allLines.find((l) => l.id === lineId);
  const parentLine = currentLine?.parent_line_id
    ? allLines.find((l) => l.id === currentLine.parent_line_id)
    : undefined;

  const existingNums = station ? getStationNumbers(db, station.id, lineId) : [];
  const resolvedNum = station
    ? getResolvedStationNumber(db, station.id, lineId)
    : null;
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
    existingNums[0]?.value ?? resolvedNum?.value ?? "",
  );
  const [stationNumberSourceLineId, setStationNumberSourceLineId] = useState(
    existingNums[0]?.line_id ??
      resolvedNum?.line_id ??
      currentLine?.id ??
      lineId,
  );
  const [areas, setAreas] = useState<StationArea[]>(existingAreas);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const stationNumberSourceOptions = buildStationNumberSourceOptions(
    currentLine,
    parentLine,
    t,
  );

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

    // If new station, add to line and seed service stops
    if (!station) {
      upsertStationLine(db, {
        id: uuidv7(),
        station_id: stationId,
        line_id: lineId,
        sort_order: maxSortOrder + 1,
      });
      for (const svc of getServicesByLine(db, lineId)) {
        upsertStationServiceStop(db, {
          id: uuidv7(),
          station_id: stationId,
          service_id: svc.id,
          status: "stop",
        });
      }
    }

    // Clear the direct number for this line before applying the selected source.
    // When the parent line is selected, the current line should resolve via fallback.
    db.run(
      `DELETE FROM station_numbers WHERE station_id = ? AND line_id = ?`,
      [stationId, lineId],
    );

    // Upsert station number for the selected display line
    if (stationNumber.trim()) {
      db.run(
        `DELETE FROM station_numbers WHERE station_id = ? AND line_id = ?`,
        [stationId, stationNumberSourceLineId],
      );
      upsertStationNumber(db, {
        id: uuidv7(),
        station_id: stationId,
        line_id: stationNumberSourceLineId,
        value: stationNumber.trim(),
      });
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
      <Select
        label={t("route.station.number-source")}
        data={stationNumberSourceOptions}
        value={stationNumberSourceLineId}
        onChange={(value) =>
          setStationNumberSourceLineId(value ?? currentLine?.id ?? lineId)
        }
        disabled={stationNumberSourceOptions.length <= 1}
        description={
          stationNumberSourceOptions.length <= 1
            ? t("route.station.number-source-current-only")
            : t("route.station.number-source-help")
        }
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
  const allLines = useMemo(() => getAllLines(db), [db]);
  const currentLine = allLines.find((l) => l.id === lineId);
  const parentLine = currentLine?.parent_line_id
    ? allLines.find((l) => l.id === currentLine.parent_line_id)
    : undefined;
  const allStations = getAllStations(db);
  const available = allStations.filter((s) => !alreadyOnLineIds.has(s.id));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stationNumber, setStationNumber] = useState("");
  const [stationNumberSourceLineId, setStationNumberSourceLineId] = useState(
    currentLine?.id ?? lineId,
  );

  const selectedStation = available.find((s) => s.id === selectedId) ?? null;
  const selectedAreas = selectedStation
    ? getStationAreas(db, selectedStation.id)
    : [];
  const stationNumberSourceOptions = buildStationNumberSourceOptions(
    currentLine,
    parentLine,
    t,
  );

  const handleSave = () => {
    if (!selectedId) return;
    upsertStationLine(db, {
      id: uuidv7(),
      station_id: selectedId,
      line_id: lineId,
      sort_order: maxSortOrder + 1,
    });
    for (const svc of getServicesByLine(db, lineId)) {
      upsertStationServiceStop(db, {
        id: uuidv7(),
        station_id: selectedId,
        service_id: svc.id,
        status: "stop",
      });
    }
    db.run(`DELETE FROM station_numbers WHERE station_id = ? AND line_id = ?`, [
      selectedId,
      lineId,
    ]);
    if (stationNumber.trim()) {
      db.run(
        `DELETE FROM station_numbers WHERE station_id = ? AND line_id = ?`,
        [selectedId, stationNumberSourceLineId],
      );
      upsertStationNumber(db, {
        id: uuidv7(),
        station_id: selectedId,
        line_id: stationNumberSourceLineId,
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
      <Select
        label={t("route.station.number-source")}
        data={stationNumberSourceOptions}
        value={stationNumberSourceLineId}
        onChange={(value) =>
          setStationNumberSourceLineId(value ?? currentLine?.id ?? lineId)
        }
        disabled={stationNumberSourceOptions.length <= 1}
        description={
          stationNumberSourceOptions.length <= 1
            ? t("route.station.number-source-current-only")
            : t("route.station.number-source-help")
        }
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
  const [newServiceName, setNewServiceName] = useState("");

  // Shared confirm modal
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] =
    useDisclosure(false);
  const [confirmPending, setConfirmPending] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const openConfirmModal = (message: string, onConfirm: () => void) => {
    setConfirmPending({ message, onConfirm });
    openConfirm();
  };
  const handleConfirmOk = () => {
    confirmPending?.onConfirm();
    setConfirmPending(null);
    closeConfirm();
  };

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
  const lineServices: Service[] = selectedLineId
    ? getServicesByLine(db, selectedLineId)
    : [];
  const serviceStopMap = new Map<string, ServiceStopStatus>(
    (selectedLineId ? getServiceStopsByLine(db, selectedLineId) : []).map(
      (s) => [`${s.station_id}:${s.service_id}`, s.status],
    ),
  );

  const handleDeleteZone = (id: string) => {
    openConfirmModal(t("route.special-zone.delete-confirm"), () => {
      deleteSpecialZone(db, id);
      refresh();
    });
  };

  const handleDeleteCompany = (id: string) => {
    openConfirmModal(t("route.company.delete-confirm"), () => {
      deleteCompany(db, id);
      refresh();
    });
  };

  const handleDeleteLine = (id: string) => {
    openConfirmModal(t("route.line.delete-confirm"), () => {
      deleteLine(db, id);
      refresh();
    });
  };

  const handleDeleteStation = (stationId: string) => {
    if (!selectedLineId) return;
    openConfirmModal(t("route.station.delete-confirm"), () => {
      deleteStationFromLine(db, stationId, selectedLineId);
      refresh();
    });
  };

  const handleAddService = () => {
    if (!selectedLineId || !newServiceName.trim()) return;
    const serviceId = uuidv7();
    upsertService(db, {
      id: serviceId,
      line_id: selectedLineId,
      name: newServiceName.trim(),
      color: selectedLine?.line_color ?? "#8cc800",
      sort_order: lineServices.length,
    });
    for (const station of stationsInLine) {
      upsertStationServiceStop(db, {
        id: uuidv7(),
        station_id: station.id,
        service_id: serviceId,
        status: "stop",
      });
    }
    setNewServiceName("");
    refresh();
  };

  const handleDeleteService = (serviceId: string) => {
    openConfirmModal(t("route.service.delete-confirm"), () => {
      deleteService(db, serviceId);
      refresh();
    });
  };

  const handleSetServiceStop = (
    stationId: string,
    serviceId: string,
    status: "pass" | ServiceStopStatus,
  ) => {
    setStationServiceStop(db, uuidv7(), stationId, serviceId, status);
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
            <ScrollArea>
              <Table
                withTableBorder
                withColumnBorders
                style={{ minWidth: 400 }}
              >
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
            </ScrollArea>
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
            <ScrollArea>
              <Table
                withTableBorder
                withColumnBorders
                style={{ minWidth: 360 }}
              >
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
            </ScrollArea>
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
            <ScrollArea>
              <Table
                withTableBorder
                withColumnBorders
                style={{ minWidth: 500 }}
              >
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
                          {line.prefix && company?.station_number_style ? (
                            <LineIndicatorBadgePreview
                              color={line.line_color}
                              prefix={line.prefix}
                              style={company.station_number_style}
                              compact
                            />
                          ) : (
                            <Text size="sm" c="dimmed">
                              {line.prefix || "—"}
                            </Text>
                          )}
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
            </ScrollArea>
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

          {selectedLineId && (
            <Box mb="md">
              <Group gap="xs" align="center" wrap="wrap">
                <Text size="sm" fw={600}>
                  {t("route.service.title")}:
                </Text>
                {lineServices.map((svc) => (
                  <Group
                    key={svc.id}
                    gap={4}
                    px="xs"
                    py={2}
                    style={{
                      border: "1px solid var(--mantine-color-default-border)",
                      borderRadius: "var(--mantine-radius-sm)",
                    }}
                  >
                    <Box
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: svc.color,
                        flexShrink: 0,
                      }}
                    />
                    <Text size="xs">{svc.name}</Text>
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      color="red"
                      onClick={() => handleDeleteService(svc.id)}
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  </Group>
                ))}
                <Group gap={4}>
                  <TextInput
                    size="xs"
                    placeholder={t("route.service.add-placeholder")}
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddService();
                    }}
                    style={{ width: 120 }}
                  />
                  <ActionIcon
                    size="sm"
                    onClick={handleAddService}
                    disabled={!newServiceName.trim()}
                  >
                    <IconPlus size={12} />
                  </ActionIcon>
                </Group>
              </Group>
            </Box>
          )}

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
                  <ScrollArea>
                    <Table
                      withTableBorder
                      withColumnBorders
                      style={{
                        minWidth: 380 + lineServices.length * 100,
                      }}
                    >
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: 60 }}>#</Table.Th>
                          <Table.Th style={{ width: 85 }}>
                            {t("route.station.number")}
                          </Table.Th>
                          <Table.Th>{t("route.station.name")}</Table.Th>
                          {lineServices.map((svc) => (
                            <Table.Th
                              key={svc.id}
                              style={{ width: 100, textAlign: "center" }}
                            >
                              <Group justify="center" gap={4}>
                                <Box
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    backgroundColor: svc.color,
                                    flexShrink: 0,
                                  }}
                                />
                                <Text size="xs" fw={600}>
                                  {svc.name}
                                </Text>
                              </Group>
                            </Table.Th>
                          ))}
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
                                        getResolvedStationNumber(
                                          db,
                                          station.id,
                                          selectedLineId!,
                                        )?.line_color ??
                                        selectedLine?.line_color ??
                                        "#000000"
                                      }
                                      style={
                                        companies.find(
                                          (c) =>
                                            c.id === selectedLine?.company_id,
                                        )?.station_number_style ?? "jreast"
                                      }
                                      prefix={
                                        getResolvedStationNumber(
                                          db,
                                          station.id,
                                          selectedLineId!,
                                        )?.prefix ?? selectedLine?.prefix ?? ""
                                      }
                                      value={nums[0].value}
                                      threeLetterCode={
                                        station.three_letter_code
                                      }
                                      compact
                                    />
                                  ) : (
                                    <Badge
                                      variant="light"
                                      color="gray"
                                      size="sm"
                                    >
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
                              {lineServices.map((svc) => {
                                const stopStatus: "pass" | ServiceStopStatus =
                                  serviceStopMap.get(
                                    `${station.id}:${svc.id}`,
                                  ) ?? "pass";
                                return (
                                  <Table.Td
                                    key={svc.id}
                                    style={{ textAlign: "center" }}
                                  >
                                    <Button.Group>
                                      <Button
                                        size="compact-xs"
                                        variant={
                                          stopStatus === "pass"
                                            ? "filled"
                                            : "subtle"
                                        }
                                        color="gray"
                                        onClick={() =>
                                          handleSetServiceStop(
                                            station.id,
                                            svc.id,
                                            "pass",
                                          )
                                        }
                                        px={6}
                                      >
                                        ×
                                      </Button>
                                      <Button
                                        size="compact-xs"
                                        variant={
                                          stopStatus === "stop"
                                            ? "filled"
                                            : "subtle"
                                        }
                                        color={svc.color}
                                        onClick={() =>
                                          handleSetServiceStop(
                                            station.id,
                                            svc.id,
                                            "stop",
                                          )
                                        }
                                        px={6}
                                      >
                                        ○
                                      </Button>
                                      <Button
                                        size="compact-xs"
                                        variant={
                                          stopStatus === "special"
                                            ? "filled"
                                            : "subtle"
                                        }
                                        color="orange"
                                        onClick={() =>
                                          handleSetServiceStop(
                                            station.id,
                                            svc.id,
                                            "special",
                                          )
                                        }
                                        px={6}
                                      >
                                        ◇
                                      </Button>
                                    </Button.Group>
                                  </Table.Td>
                                );
                              })}
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
                  </ScrollArea>
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

      {/* ── Confirm modal ── */}
      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title={t("common.confirm-title")}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">{confirmPending?.message}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeConfirm}>
              {t("common.cancel")}
            </Button>
            <Button color="red" onClick={handleConfirmOk}>
              {t("common.delete")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
