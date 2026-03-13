import "@mantine/core/styles.css";

import { useState, useEffect, useRef } from "react";
import {
  MantineProvider,
  createTheme,
  localStorageColorSchemeManager,
  Button,
  Grid,
  Box,
  Select,
  Title,
  Loader,
  Center,
  Stack,
  Text,
} from "@mantine/core";
import { IconDownload, IconEye } from "@tabler/icons-react";
import Konva from "konva";
import DirectInput from "@/components/inputs/DirectInput";
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
const colorSchemeManager = localStorageColorSchemeManager({
  key: "ssg-color-scheme",
});

const LOCALE_URLS: Record<string, string> = {
  ja: "/",
  en: "/en/",
};

interface StationSignAppProps {
  locale: string;
  allMessages: Record<string, Record<string, unknown>>;
}

function AppContent({
  locale,
  onSwitchLocale,
}: {
  locale: string;
  onSwitchLocale: (l: string) => void;
}) {
  const ref = useRef<Konva.Stage>(null);
  const t = useTranslations();

  const {
    data: currentData,
    loading: dbLoading,
    update: setCurrentData,
    reset: resetData,
  } = useDatabase();

  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    document.fonts.ready.then(() => setFontsLoaded(true));
  }, []);

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

  if (!fontsLoaded || dbLoading || !currentData) {
    const loadingText = !fontsLoaded
      ? t("common.loading-fonts")
      : t("common.loading");
    return (
      <>
        <Header locale={locale} onSwitchLocale={onSwitchLocale} />
        <Center style={{ height: "100vh" }}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="sm" c="dimmed">
              {loadingText}
            </Text>
          </Stack>
        </Center>
      </>
    );
  }

  return (
    <>
      <Header locale={locale} onSwitchLocale={onSwitchLocale} />
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
        {...currentData}
        onChange={handleChangeDirect}
        onReset={resetData}
      />
      <Footer />
    </>
  );
}

export default function StationSignApp({
  locale,
  allMessages,
}: StationSignAppProps) {
  const [currentLocale, setCurrentLocale] = useState(locale);

  const handleSwitchLocale = (newLocale: string) => {
    setCurrentLocale(newLocale);
    const url = LOCALE_URLS[newLocale] ?? `/${newLocale}/`;
    history.pushState({}, "", url);
    document.documentElement.lang = newLocale;
  };

  const messages = allMessages[currentLocale] ?? allMessages[locale] ?? {};

  return (
    <TranslationProvider messages={messages} locale={currentLocale}>
      <MantineProvider
        theme={theme}
        colorSchemeManager={colorSchemeManager}
        defaultColorScheme="auto"
      >
        <AppContent
          locale={currentLocale}
          onSwitchLocale={handleSwitchLocale}
        />
      </MantineProvider>
    </TranslationProvider>
  );
}
