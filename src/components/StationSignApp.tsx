import "react-color-palette/css";
import "@mantine/core/styles.css";

import { useState, useEffect, useRef } from "react";
import {
  MantineProvider,
  createTheme,
  Button,
  Grid,
  Box,
  Select,
  Title,
  Loader,
  Center,
} from "@mantine/core";
import { IconDownload, IconEye } from "@tabler/icons-react";
import Konva from "konva";
import DirectInput from "@/components/inputs/DirectInput";
import InputStationInfo from "@/components/InputStationInfo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { TranslationProvider } from "@/i18n/TranslationProvider";
import { useTranslations } from "@/i18n/useTranslation";
import { useDatabase } from "@/db/useDatabase";

// You have to import height and scale for every child station sign component!!!
import JrEastSign, {
  height as JrEastSignHeight,
  scale as JrEastSignBaseScale,
} from "@/components/signs/JrEastSign";

const theme = createTheme({});

interface StationSignAppProps {
  locale: string;
  messages: Record<string, unknown>;
}

function AppContent({ locale }: { locale: string }) {
  const ref = useRef<Konva.Stage>(null);
  const t = useTranslations();

  const {
    data: currentData,
    loading: dbLoading,
    update: setCurrentData,
  } = useDatabase();

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

  const currentCanvasWidth = currentCanvasHeight * (currentData?.ratio ?? 4.5);
  const [saveSize, setSaveSize] = useState(JrEastSignBaseScale);
  const [saveSizeList, setSaveSizeList] = useState<ImageSize[]>([]);

  useEffect(() => {
    const sizes = ["SS", "S", "M", "L", "XL", "XXL"];
    const result: ImageSize[] = sizes.map((label, i) => ({
      label: `${currentCanvasWidth * (i + 1)} × ${currentCanvasHeight * (i + 1)} (${label})`,
      value: i + 1,
    }));
    setSaveSizeList(result);
  }, [currentCanvasHeight, currentData?.ratio]);

  const handleSave = () => {
    if (!currentData) return;
    if (ref.current) {
      const uri = ref.current.toDataURL({
        pixelRatio: saveSize / currentBaseScale,
      });
      const link = document.createElement("a");
      link.download = `${currentData.primaryName}.png`;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error(t("error.on-save"));
    }
  };

  const handleChangeDirect = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!currentData) return;
    const { name, value } = e.target;
    setCurrentData({
      ...currentData,
      [name]: typeof value === "string" ? value.slice(0, 120) : value,
    });
  };

  // =====test=====
  const [test, setTest] = useState({ text: "あいうえお", text2: "かきくけこ" });

  const handleChangeTest = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setTest({ ...test, [name]: value });
  };
  // ===============

  if (dbLoading || !currentData) {
    return (
      <>
        <Header locale={locale} />
        <Center style={{ height: "100vh" }}>
          <Loader size="lg" />
        </Center>
      </>
    );
  }

  return (
    <>
      <Header locale={locale} />
      {/* Toolbar spacer */}
      <div style={{ height: "64px" }} />
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
      <JrEastSign {...currentData} ref={ref} />
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
              color="secondary"
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
      <DirectInput {...currentData} onChange={handleChangeDirect} />
      <InputStationInfo
        text={test.text}
        text2={test.text2}
        onChange={handleChangeTest}
      />
      <Footer />
    </>
  );
}

export default function StationSignApp({
  locale,
  messages,
}: StationSignAppProps) {
  return (
    <TranslationProvider messages={messages} locale={locale}>
      <MantineProvider theme={theme} forceColorScheme="dark">
        <AppContent locale={locale} />
      </MantineProvider>
    </TranslationProvider>
  );
}
