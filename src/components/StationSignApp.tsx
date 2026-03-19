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
import {
  IconKeyboard,
  IconRoute,
  IconPencil,
  IconSettings,
} from "@tabler/icons-react";
import Header from "@/components/Header";
import { TranslationProvider } from "@/i18n/TranslationProvider";
import { useTranslations } from "@/i18n/useTranslation";
import { useRouteDb } from "@/db/useRouteDb";
import SimpleInputTab from "@/components/tabs/SimpleInputTab";
import RouteInputTab from "@/components/tabs/RouteInputTab";
import EditRoutesTab from "@/components/tabs/EditRoutesTab";
import SettingsTab from "@/components/tabs/SettingsTab";

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
    Promise.all([
      document.fonts.load("900 1em NotoSansJP"),
      document.fonts.load("1em NotoSansTC"),
      document.fonts.load("1em NotoSansKR"),
      document.fonts.load("1em OverusedGrotesk"),
      document.fonts.load("600 1em HindSemiBold"),
    ]).then(() => setFontsLoaded(true));
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
        <Tabs defaultValue="simple" keepMounted={false} className="ssg-tabs">
          <Tabs.List>
            <Tabs.Tab value="simple" leftSection={<IconKeyboard size={16} />}>
              {t("tabs.simple")}
            </Tabs.Tab>
            <Tabs.Tab value="route-input" leftSection={<IconRoute size={16} />}>
              {t("tabs.route-input")}
            </Tabs.Tab>
            <Tabs.Tab value="route-edit" leftSection={<IconPencil size={16} />}>
              {t("tabs.route-edit")}
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              {t("tabs.settings")}
            </Tabs.Tab>
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

          <Tabs.Panel value="settings">
            <SettingsTab />
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
