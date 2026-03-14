import "@mantine/core/styles.css";

import { useState, useEffect } from "react";
import {
  MantineProvider,
  createTheme,
  localStorageColorSchemeManager,
  Loader,
  Center,
  Stack,
  Text,
  Tabs,
  Box,
} from "@mantine/core";
import Header from "@/components/Header";
import { TranslationProvider } from "@/i18n/TranslationProvider";
import { useTranslations } from "@/i18n/useTranslation";
import { useRouteDb } from "@/db/useRouteDb";
import SimpleInputTab from "@/components/tabs/SimpleInputTab";
import RouteInputTab from "@/components/tabs/RouteInputTab";
import EditRoutesTab from "@/components/tabs/EditRoutesTab";

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
  const t = useTranslations();
  const { db, loading: dbLoading, persist } = useRouteDb();

  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    document.fonts.ready.then(() => setFontsLoaded(true));
  }, []);

  if (!fontsLoaded) {
    return (
      <>
        <Header locale={locale} onSwitchLocale={onSwitchLocale} />
        <Center style={{ height: "100vh" }}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="sm" c="dimmed">
              {t("common.loading-fonts")}
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
      <Box style={{ width: "100%" }}>
        <Tabs defaultValue="simple" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="simple">{t("tabs.simple")}</Tabs.Tab>
            <Tabs.Tab value="route-input">{t("tabs.route-input")}</Tabs.Tab>
            <Tabs.Tab value="route-edit">{t("tabs.route-edit")}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="simple">
            <SimpleInputTab />
          </Tabs.Panel>

          <Tabs.Panel value="route-input">
            <RouteInputTab db={db} loading={dbLoading} />
          </Tabs.Panel>

          <Tabs.Panel value="route-edit">
            <EditRoutesTab db={db} persist={persist} />
          </Tabs.Panel>
        </Tabs>
      </Box>
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
