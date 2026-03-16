import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
} from "react";
import {
  Button,
  Grid,
  Box,
  Select,
  Title,
  Alert,
  Modal,
  Textarea,
  Group,
} from "@mantine/core";
import {
  IconDownload,
  IconEye,
  IconAlertTriangle,
  IconCopy,
  IconCheck,
  IconUpload,
  IconFileImport,
} from "@tabler/icons-react";
import Konva from "konva";
import DirectInput from "@/components/inputs/DirectInput";
import Footer from "@/components/Footer";
import { useTranslations } from "@/i18n/useTranslation";
import { useDatabase } from "@/db/useDatabase";
import { DEFAULT_DATA } from "@/db/seed";
import type DirectInputStationProps from "@/components/signs/DirectInputStationProps";
import { SIGN_STYLE_FIELDS } from "@/components/signs/signStyles";

// You have to import height and scale for every child station sign component!!!
import JrEastSign, {
  height as JrEastSignHeight,
  scale as JrEastSignBaseScale,
} from "@/components/signs/JrEastSign";
import JrWestSign, {
  height as JrWestSignHeight,
  scale as JrWestSignBaseScale,
} from "@/components/signs/JrWestSign";

function validateDirectInputData(text: string): DirectInputStationProps {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("expected a JSON object");
  }
  const d = parsed as Record<string, unknown>;
  if (typeof d.primaryName !== "string")
    throw new Error("missing field: primaryName");
  if (typeof d.primaryNameFurigana !== "string")
    throw new Error("missing field: primaryNameFurigana");
  if (typeof d.secondaryName !== "string")
    throw new Error("missing field: secondaryName");
  if (!Array.isArray(d.left)) throw new Error("missing field: left");
  if (!Array.isArray(d.right)) throw new Error("missing field: right");
  if (typeof d.baseColor !== "string")
    throw new Error("missing field: baseColor");
  if (typeof d.ratio !== "number") throw new Error("missing field: ratio");
  return parsed as DirectInputStationProps;
}

export default function SimpleInputTab() {
  const ref = useRef<Konva.Stage>(null);
  const t = useTranslations();

  const {
    data: savedData,
    update: saveData,
    reset: resetData,
    isCorrupted,
  } = useDatabase();
  const [corruptedDismissed, setCorruptedDismissed] = useState(false);

  // previewData drives the canvas (updated via debounced onUpdate from DirectInput)
  const [previewData, setPreviewData] =
    useState<DirectInputStationProps>(savedData);

  // Track latest data for download filename without triggering re-renders
  const latestDataRef = useRef<DirectInputStationProps>(savedData);

  // directInputKey forces DirectInput to remount (used on reset)
  const [directInputKey, setDirectInputKey] = useState(0);
  const [directInputInitialData, setDirectInputInitialData] =
    useState<DirectInputStationProps>(savedData);

  const handleUpdate = useCallback(
    (data: DirectInputStationProps) => {
      latestDataRef.current = data;
      setPreviewData(data);
      saveData(data);
    },
    [saveData],
  );

  const handleReset = useCallback(() => {
    resetData();
    latestDataRef.current = DEFAULT_DATA;
    setPreviewData(DEFAULT_DATA);
    setDirectInputInitialData(DEFAULT_DATA);
    setDirectInputKey((k) => k + 1);
  }, [resetData]);

  // Import / export state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCopy = useCallback(async () => {
    const json = JSON.stringify(latestDataRef.current, null, 2);
    await navigator.clipboard.writeText(json);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, []);

  const handleExportDownload = useCallback(() => {
    const data = latestDataRef.current;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.primaryName || "station"}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleImportSubmit = useCallback(() => {
    try {
      const imported = validateDirectInputData(importText);
      latestDataRef.current = imported;
      setPreviewData(imported);
      saveData(imported);
      setDirectInputInitialData(imported);
      setDirectInputKey((k) => k + 1);
      setImportModalOpen(false);
      setImportText("");
      setImportError(null);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    }
  }, [importText, saveData]);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setImportText(text);
        setImportError(null);
      }
    };
    reader.readAsText(file);
    // Reset file input so the same file can be re-selected
    e.target.value = "";
  }, []);

  type ImageSize = { label: string; value: number };

  const [currentStyle, setCurrentStyle] = useState<"jreast" | "jrwest">(
    () =>
      (sessionStorage.getItem("sign-style-v1") as "jreast" | "jrwest") ??
      "jreast",
  );

  useEffect(() => {
    sessionStorage.setItem("sign-style-v1", currentStyle);
  }, [currentStyle]);
  const [currentBaseScale, setCurrentBaseScale] = useState(1);
  const [currentCanvasHeight, setCurrentCanvasHeight] = useState(0);

  useEffect(() => {
    switch (currentStyle) {
      case "jrwest":
        setCurrentBaseScale(JrWestSignBaseScale);
        setCurrentCanvasHeight(JrWestSignHeight);
        break;
      case "jreast":
      default:
        setCurrentBaseScale(JrEastSignBaseScale);
        setCurrentCanvasHeight(JrEastSignHeight);
        break;
    }
  }, [currentStyle]);

  const currentCanvasWidth =
    currentCanvasHeight *
    (SIGN_STYLE_FIELDS[currentStyle]?.fixedRatio ?? previewData.ratio ?? 4.5);
  const [saveSize, setSaveSize] = useState(JrEastSignBaseScale);
  const [saveSizeList, setSaveSizeList] = useState<ImageSize[]>([]);

  useEffect(() => {
    const sizes = ["SS", "S", "M", "L", "XL", "XXL"];
    const result: ImageSize[] = sizes.map((label, i) => ({
      label: `${Math.round(currentCanvasWidth * (i + 1))} × ${currentCanvasHeight * (i + 1)} (${label})`,
      value: i + 1,
    }));
    setSaveSizeList(result);
  }, [currentCanvasWidth, currentCanvasHeight]);

  const handleSave = () => {
    if (ref.current) {
      const uri = ref.current.toDataURL({
        pixelRatio: saveSize / currentBaseScale,
      });
      const link = document.createElement("a");
      link.download = `${latestDataRef.current.primaryName}.png`;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error(t("error.on-save"));
    }
  };

  return (
    <>
      {/* Import JSON modal */}
      <Modal
        opened={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setImportText("");
          setImportError(null);
        }}
        title={t("input.direct.import-modal-title")}
        centered
      >
        <input
          type="file"
          accept=".json,application/json"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          leftSection={<IconUpload size={16} />}
          mb="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          {t("input.direct.import-file-label")}
        </Button>
        <Textarea
          label={t("input.direct.import-paste-label")}
          placeholder={t("input.direct.import-paste-placeholder")}
          value={importText}
          onChange={(e) => {
            setImportText(e.currentTarget.value);
            setImportError(null);
          }}
          autosize
          minRows={6}
          maxRows={14}
          styles={{ input: { fontFamily: "monospace", fontSize: "12px" } }}
        />
        {importError && (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" mt="sm">
            {t("input.direct.import-error", { detail: importError })}
          </Alert>
        )}
        <Group mt="lg" justify="flex-end">
          <Button
            variant="default"
            onClick={() => {
              setImportModalOpen(false);
              setImportText("");
              setImportError(null);
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleImportSubmit}
            disabled={importText.trim() === ""}
          >
            {t("input.direct.import-submit")}
          </Button>
        </Group>
      </Modal>

      {isCorrupted && !corruptedDismissed && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="orange"
          withCloseButton
          onClose={() => setCorruptedDismissed(true)}
          mb="sm"
        >
          {t("error.corrupted-cache")}
        </Alert>
      )}
      <Box style={{ padding: "10px 5px 0" }}>
        <Select
          label={t("route.sign.style")}
          value={currentStyle}
          onChange={(v) => v && setCurrentStyle(v as "jreast" | "jrwest")}
          data={[
            { value: "jreast", label: t("route.sign.jreast") },
            { value: "jrwest", label: t("route.sign.jrwest") },
          ]}
          style={{ maxWidth: 240 }}
        />
      </Box>
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
      {currentStyle === "jrwest" ? (
        <JrWestSign {...previewData} ref={ref} />
      ) : (
        <JrEastSign {...previewData} ref={ref} />
      )}
      <Box style={{ width: "100%", padding: "25px" }}>
        <Grid gutter="md" style={{ padding: "10px", overflow: "hidden" }}>
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
      </Box>
      <DirectInput
        key={directInputKey}
        initialData={directInputInitialData}
        onUpdate={handleUpdate}
        onReset={handleReset}
        signStyle={currentStyle}
      />
      <Box style={{ width: "100%", padding: "25px" }}>
        <Group gap="sm" wrap="wrap">
          <Button
            variant="outline"
            leftSection={
              copyDone ? <IconCheck size={16} /> : <IconCopy size={16} />
            }
            color={copyDone ? "green" : undefined}
            onClick={handleExportCopy}
          >
            {copyDone
              ? t("input.direct.export-copy-done")
              : t("input.direct.export-copy")}
          </Button>
          <Button
            variant="outline"
            leftSection={<IconDownload size={16} />}
            onClick={handleExportDownload}
          >
            {t("input.direct.export-download")}
          </Button>
          <Button
            variant="outline"
            leftSection={<IconFileImport size={16} />}
            onClick={() => setImportModalOpen(true)}
          >
            {t("input.direct.import")}
          </Button>
        </Group>
      </Box>
      <Footer />
    </>
  );
}
