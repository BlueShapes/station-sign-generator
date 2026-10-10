import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Database } from "sql.js";
import {
  Alert,
  Anchor,
  Box,
  Button,
  Checkbox,
  ColorSwatch,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { useTranslations } from "@/i18n/useTranslation";
import type { Company } from "@/db/types";
import { persistDatabase } from "@/db/init";
import { importMtrRoutes } from "@/db/importMtr";
import {
  MTR_JSON_MAX_BYTES,
  parseMtrJson,
  type MtrImportError,
  type MtrMap,
  type MtrVersion,
} from "@/lib/mtrImport";
import { fetchMtrMap, getMtrApiUrl } from "@/lib/mtrMapApi";

const MTR_VERSIONS: { value: MtrVersion; label: string }[] = [
  { value: "4.0.5", label: "4.0.5" },
  { value: "4.1.0-beta.2", label: "4.1.0-beta.2" },
  { value: "3.2.2-hotfix-2", label: "3.2.2-hotfix-2" },
];

type SourceMode = "url" | "json";
const MAX_MTR_DIMENSION = 2_147_483_647;

function getUrlDimension(value: string): number | null {
  try {
    const rawDimension = new URL(value).searchParams.get("dimension");
    if (rawDimension === null || !/^\d+$/.test(rawDimension)) return null;
    const parsedDimension = Number(rawDimension);
    return Number.isSafeInteger(parsedDimension) && parsedDimension <= MAX_MTR_DIMENSION
      ? parsedDimension
      : null;
  } catch {
    return null;
  }
}

interface MtrImportModalProps {
  opened: boolean;
  onClose: () => void;
  db: Database;
  companies: Company[];
  onImported: () => void;
}

function errorMessageKey(error: unknown, fallback: string): string {
  const code = (error as Partial<MtrImportError> | null)?.code;
  const supported = new Set([
    "invalid-json",
    "invalid-data",
    "no-routes",
    "too-large",
    "invalid-url",
    "fetch-failed",
    "timeout",
    "import-failed",
  ]);
  return code && supported.has(code) ? `error.${code}` : fallback;
}

export function MtrImportModal({
  opened,
  onClose,
  db,
  companies,
  onImported,
}: MtrImportModalProps) {
  const t = useTranslations("mtr-import");
  const [source, setSource] = useState<SourceMode>("url");
  const [version, setVersion] = useState<MtrVersion>("4.0.5");
  const [mapUrl, setMapUrl] = useState("");
  const [dimension, setDimension] = useState<number | string>(0);
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<MtrMap | null>(null);
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(
    new Set(),
  );
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ routes: number; stations: number } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const importingRef = useRef(false);

  const resetPreviewState = useCallback(() => {
    setPreview(null);
    setSelectedRouteIds(new Set());
    setErrorKey(null);
    setSuccess(null);
  }, []);

  const cancelPendingFetch = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(false);
  }, []);

  const invalidateInput = useCallback(() => {
    cancelPendingFetch();
    resetPreviewState();
  }, [cancelPendingFetch, resetPreviewState]);

  useEffect(() => {
    if (!opened) {
      cancelPendingFetch();
      resetPreviewState();
    }
  }, [opened, cancelPendingFetch, resetPreviewState]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
    },
    [],
  );

  const safeDimension =
    typeof dimension === "number" &&
    Number.isSafeInteger(dimension) &&
    dimension >= 0 &&
    dimension <= MAX_MTR_DIMENSION
      ? dimension
      : null;
  const endpoint = useMemo(() => {
    if (!mapUrl.trim() || safeDimension === null) return null;
    try {
      return getMtrApiUrl(mapUrl, version, safeDimension);
    } catch {
      return null;
    }
  }, [mapUrl, version, safeDimension]);

  const showMap = (map: MtrMap) => {
    if (!map.routes.length) {
      setErrorKey("error.no-routes");
      return;
    }
    setPreview(map);
    setSelectedRouteIds(new Set(map.routes.map((route) => route.id)));
    setErrorKey(null);
    setSuccess(null);
  };

  const handleFetch = async () => {
    if (!endpoint || safeDimension === null) {
      setErrorKey("error.invalid-url");
      return;
    }

    cancelPendingFetch();
    resetPreviewState();
    const requestId = requestIdRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);

    try {
      const map = await fetchMtrMap(endpoint, version, controller.signal);
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      showMap(map);
    } catch (err) {
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      setErrorKey(errorMessageKey(err, "error.fetch-failed"));
    } finally {
      if (requestId === requestIdRef.current) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleParse = () => {
    invalidateInput();
    try {
      showMap(parseMtrJson(json, version, safeDimension ?? 0));
    } catch (err) {
      setErrorKey(errorMessageKey(err, "error.invalid-data"));
    }
  };

  const handleImport = () => {
    if (!preview || selectedRouteIds.size === 0 || importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    try {
      const result = importMtrRoutes(
        db,
        preview,
        [...selectedRouteIds],
        companyId,
        () => persistDatabase(db, true),
      );
      setPreview(null);
      setSelectedRouteIds(new Set());
      setErrorKey(null);
      setSuccess({ routes: result.routes, stations: result.stations });
      onImported();
    } catch (err) {
      setErrorKey(errorMessageKey(err, "error.import-failed"));
      setSuccess(null);
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  };

  const setSourceMode = (value: string) => {
    invalidateInput();
    setSource(value as SourceMode);
  };

  const companyOptions = [
    { value: "", label: t("no-company") },
    ...companies.map((company) => ({ value: company.id, label: company.name })),
  ];
  const stationLabelsById = new Map<string, string>(
    (preview?.stations ?? []).map((station) => [
      station.id,
      station.names.find((name) => name.trim()) || station.id,
    ]),
  );
  const canParseJson = json.trim().length > 0 && safeDimension !== null && !importing;

  return (
    <Modal
      opened={opened}
      onClose={() => {
        cancelPendingFetch();
        resetPreviewState();
        onClose();
      }}
      title={t("title")}
      centered
      size="lg"
      scrollAreaComponent={ScrollArea.Autosize}
      withCloseButton={!importing}
      closeOnEscape={!importing}
      closeOnClickOutside={!importing}
    >
      <Stack gap="md">
        <Text size="sm">{t("description")}</Text>
        <Text size="xs" c="dimmed">{t("note")}</Text>

        <Select
          label={t("version")}
          data={MTR_VERSIONS}
          value={version}
          onChange={(value) => {
            if (!value || !MTR_VERSIONS.some((item) => item.value === value)) return;
            invalidateInput();
            setVersion(value as MtrVersion);
          }}
          disabled={importing}
          allowDeselect={false}
        />

        <SegmentedControl
          fullWidth
          value={source}
          onChange={setSourceMode}
          data={[
            { label: t("source-url"), value: "url" },
            { label: t("source-json"), value: "json" },
          ]}
          disabled={importing}
        />

        <NumberInput
          label={t("dimension")}
          value={dimension}
          onChange={(value) => {
            invalidateInput();
            setDimension(value);
          }}
          min={0}
          max={MAX_MTR_DIMENSION}
          step={1}
          allowDecimal={false}
          allowNegative={false}
          disabled={importing}
        />

        {source === "url" ? (
          <Stack gap="sm">
            <Textarea
              label={t("url")}
              value={mapUrl}
              onChange={(event) => {
                const value = event.currentTarget.value.slice(0, 2048);
                invalidateInput();
                setMapUrl(value);
                const urlDimension = getUrlDimension(value);
                if (urlDimension !== null) setDimension(urlDimension);
              }}
              maxLength={2048}
              minRows={1}
              maxRows={1}
              autosize={false}
              disabled={importing}
            />
            {endpoint && (
              <Box>
                <Text size="xs" c="dimmed" mb={4}>{t("endpoint")}</Text>
                <Anchor
                  href={endpoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {endpoint}
                </Anchor>
              </Box>
            )}
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              {t("manual-help")}
            </Alert>
            <Group justify="flex-end">
              <Button onClick={() => void handleFetch()} loading={loading} disabled={!endpoint || importing}>
                {t("fetch")}
              </Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="sm">
            <Textarea
              label={t("json")}
              value={json}
              onChange={(event) => {
                const next = event.currentTarget.value;
                invalidateInput();
                if (new TextEncoder().encode(next).byteLength > MTR_JSON_MAX_BYTES) {
                  setErrorKey("error.too-large");
                  return;
                }
                setJson(next);
              }}
              maxLength={MTR_JSON_MAX_BYTES}
              minRows={8}
              maxRows={14}
              autosize
              disabled={importing}
            />
            <Group justify="flex-end">
              <Button onClick={handleParse} disabled={!canParseJson}>
                {t("parse")}
              </Button>
            </Group>
          </Stack>
        )}

        {errorKey && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {t(errorKey)}
          </Alert>
        )}
        {success && (
          <Alert color="green" variant="light">
            {t("success", {
              routes: String(success.routes),
              stations: String(success.stations),
            })}
          </Alert>
        )}

        {preview && (
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>{t("routes")}</Text>
              <Group gap="xs">
                <Button
                  size="compact-sm"
                  variant="subtle"
                  onClick={() => setSelectedRouteIds(new Set(preview.routes.map((route) => route.id)))}
                  disabled={importing}
                >
                  {t("select-all")}
                </Button>
                <Button
                  size="compact-sm"
                  variant="subtle"
                  onClick={() => setSelectedRouteIds(new Set())}
                  disabled={importing}
                >
                  {t("select-none")}
                </Button>
              </Group>
            </Group>
            {preview.skippedRoutes > 0 && (
              <Alert color="yellow" variant="light">
                {t("skipped", { count: String(preview.skippedRoutes) })}
              </Alert>
            )}
            <ScrollArea.Autosize mah="min(42vh, 420px)" type="auto" offsetScrollbars>
              <Stack gap={6} pr="xs">
                {preview.routes.map((route) => {
                  const routeName = route.names.find((name) => name.trim()) || route.id;
                  const firstStationId = route.stationIds[0] ?? "";
                  const lastStationId = route.stationIds[route.stationIds.length - 1] ?? "";
                  return (
                    <Checkbox
                      key={route.id}
                      checked={selectedRouteIds.has(route.id)}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setSelectedRouteIds((current) => {
                          const next = new Set(current);
                          if (checked) next.add(route.id);
                          else next.delete(route.id);
                          return next;
                        });
                      }}
                      disabled={importing}
                      label={
                        <Group gap="xs" wrap="nowrap">
                          <ColorSwatch color={route.color} size={16} />
                          <Box style={{ minWidth: 0 }}>
                            <Text size="sm" lineClamp={1}>{routeName}</Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {stationLabelsById.get(firstStationId) || firstStationId || "—"}
                              {" → "}
                              {stationLabelsById.get(lastStationId) || lastStationId || "—"}
                            </Text>
                          </Box>
                          <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                            {t("stations-count", { count: String(route.stationIds.length) })}
                          </Text>
                        </Group>
                      }
                    />
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
            <Select
              label={t("company")}
              data={companyOptions}
              value={companyId ?? ""}
              onChange={(value) => setCompanyId(value || null)}
              disabled={importing}
              allowDeselect={false}
            />
            <Group justify="flex-end">
              <Button
                onClick={handleImport}
                loading={importing}
                disabled={selectedRouteIds.size === 0}
              >
                {t("import", { count: String(selectedRouteIds.size) })}
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

export default MtrImportModal;
