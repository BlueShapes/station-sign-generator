import { useState, useEffect, useRef, useCallback } from "react";
import { Button, Grid, Box, Select, Title, Alert } from "@mantine/core";
import { IconDownload, IconEye, IconAlertTriangle } from "@tabler/icons-react";
import Konva from "konva";
import DirectInput from "@/components/inputs/DirectInput";
import Footer from "@/components/Footer";
import { useTranslations } from "@/i18n/useTranslation";
import { useDatabase } from "@/db/useDatabase";
import { DEFAULT_DATA } from "@/db/seed";
import type DirectInputStationProps from "@/components/signs/DirectInputStationProps";

// You have to import height and scale for every child station sign component!!!
import JrEastSign, {
  height as JrEastSignHeight,
  scale as JrEastSignBaseScale,
} from "@/components/signs/JrEastSign";

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

  type ImageSize = { label: string; value: number };

  const [currentStyle] = useState("jreast");
  const [currentBaseScale, setCurrentBaseScale] = useState(1);
  const [currentCanvasHeight, setCurrentCanvasHeight] = useState(0);

  useEffect(() => {
    switch (currentStyle) {
      case "jreast":
        setCurrentBaseScale(JrEastSignBaseScale);
        setCurrentCanvasHeight(JrEastSignHeight);
        break;
      default:
        setCurrentBaseScale(1);
        setCurrentCanvasHeight(0);
        break;
    }
  }, [currentStyle]);

  const currentCanvasWidth = currentCanvasHeight * (previewData.ratio ?? 4.5);
  const [saveSize, setSaveSize] = useState(JrEastSignBaseScale);
  const [saveSizeList, setSaveSizeList] = useState<ImageSize[]>([]);

  useEffect(() => {
    const sizes = ["SS", "S", "M", "L", "XL", "XXL"];
    const result: ImageSize[] = sizes.map((label, i) => ({
      label: `${currentCanvasWidth * (i + 1)} × ${currentCanvasHeight * (i + 1)} (${label})`,
      value: i + 1,
    }));
    setSaveSizeList(result);
  }, [currentCanvasHeight, previewData.ratio]);

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
      <JrEastSign {...previewData} ref={ref} />
      <Box style={{ width: "100%", padding: "25px" }}>
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
      </Box>
      <DirectInput
        key={directInputKey}
        initialData={directInputInitialData}
        onUpdate={handleUpdate}
        onReset={handleReset}
      />
      <Footer />
    </>
  );
}
