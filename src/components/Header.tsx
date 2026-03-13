import {
  Box,
  Container,
  ActionIcon,
  Tooltip,
  Text,
  Menu,
  Notification,
  useMantineColorScheme,
} from "@mantine/core";
import { IconShare, IconSun, IconMoon } from "@tabler/icons-react";
import { IconTrain } from "@tabler/icons-react";
import { JP, US } from "country-flag-icons/react/3x2";
import { type ReactElement, useEffect, useState } from "react";
import { BsTwitter, BsCopy } from "react-icons/bs";
import { SiMisskey, SiMastodon, SiLine, SiX, SiReddit } from "react-icons/si";
import { useTranslations } from "@/i18n/useTranslation";
import { APP_VERSION } from "@/config";

interface HeaderProps {
  locale: string;
  onSwitchLocale: (locale: string) => void;
}

const Header = ({ locale, onSwitchLocale }: HeaderProps) => {
  const t = useTranslations("");
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  type Lang = { langName: string; lang: string; flag: ReactElement };
  const langs: Lang[] = [
    { langName: "日本語", lang: "ja", flag: <JP style={{ width: "2em" }} /> },
    { langName: "English", lang: "en", flag: <US style={{ width: "2em" }} /> },
  ];

  const [url, setUrl] = useState("https://example.com");
  useEffect(() => {
    setUrl(document.URL);
  });

  const shareText = t("header.tooltip.share-message", {
    name: t("header.title"),
  });
  const encodedShareText = encodeURIComponent(shareText);

  type ShareOption = {
    name: string;
    link: string | (() => void);
    icon: ReactElement;
    id: number;
  };
  const shareOptions: ShareOption[] = [
    {
      name: t("header.tooltip.share-options.copy"),
      link: () => navigator.clipboard.writeText(`${shareText}\n${url}`),
      icon: <BsCopy />,
      id: 201,
    },
    {
      name: t("header.tooltip.share-options.twitter"),
      link: `https://x.com/share?text=${encodedShareText}&url=${url}`,
      icon: <BsTwitter />,
      id: 1,
    },
    {
      name: t("header.tooltip.share-options.x"),
      link: `https://x.com/share?text=${encodedShareText}&url=${url}`,
      icon: <SiX />,
      id: 2,
    },
    {
      name: t("header.tooltip.share-options.reddit"),
      link: `https://www.reddit.com/submit?text=${encodedShareText}&url=${url}`,
      icon: <SiReddit />,
      id: 12,
    },
    {
      name: t("header.tooltip.share-options.misskey"),
      link: `https://misskey-hub.net/share/?text=${encodedShareText}&url=${url}&visibility=public&localOnly=0`,
      icon: <SiMisskey />,
      id: 21,
    },
    {
      name: t("header.tooltip.share-options.mastodon"),
      link: `https://donshare.net/share.html?text=${encodedShareText}&url=${url}`,
      icon: <SiMastodon />,
      id: 22,
    },
    {
      name: t("header.tooltip.share-options.line"),
      link: `https://social-plugins.line.me/lineit/share?text=${encodedShareText}&url=${url}`,
      icon: <SiLine />,
      id: 101,
    },
  ];

  const [isCopyMessageOpen, setIsCopyMessageOpen] = useState(false);

  const Flag = ({ country }: { country: string }) => {
    switch (country) {
      case "ja":
        return <JP style={{ width: "1.5em" }} />;
      case "en":
        return <US style={{ width: "1.5em" }} />;
      default:
        return <US style={{ width: "1.5em" }} />;
    }
  };

  return (
    <>
      <Box
        component="header"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "64px",
          zIndex: 200,
          backgroundColor: "var(--mantine-color-body)",
          borderBottom: "1px solid var(--mantine-color-default-border)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
        }}
      >
        <Container
          size="xl"
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
            padding: "0 16px",
          }}
        >
          {/* Title */}
          <Box
            style={{
              flexGrow: 1,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <IconTrain size={20} />
            <Text
              component="h1"
              style={{
                fontSize: "clamp(13px, 2vw, 16px)",
                fontWeight: 700,
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "keep-all",
              }}
            >
              {t("header.title")}
            </Text>
            <Text
              style={{
                fontSize: "11px",
                color: "var(--mantine-color-dimmed)",
                marginTop: "2px",
              }}
            >
              v{APP_VERSION}
            </Text>
          </Box>

          {/* Right actions */}
          <Box style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {/* Theme toggle */}
            <Tooltip
              label={
                colorScheme === "dark"
                  ? t("common.theme-light")
                  : t("common.theme-dark")
              }
            >
              <ActionIcon
                variant="transparent"
                size="lg"
                onClick={() => toggleColorScheme()}
                aria-label={
                  colorScheme === "dark"
                    ? t("common.theme-light")
                    : t("common.theme-dark")
                }
              >
                {colorScheme === "dark" ? (
                  <IconSun size={20} />
                ) : (
                  <IconMoon size={20} />
                )}
              </ActionIcon>
            </Tooltip>

            {/* Language Menu */}
            <Menu shadow="md" position="bottom-end" offset={12}>
              <Tooltip label={t("header.tooltip.lang")}>
                <Menu.Target>
                  <ActionIcon
                    variant="transparent"
                    size="lg"
                    aria-label={t("header.tooltip.lang")}
                  >
                    <Flag country={locale} />
                  </ActionIcon>
                </Menu.Target>
              </Tooltip>
              <Menu.Dropdown>
                {langs.map((e) => (
                  <Menu.Item
                    key={e.lang}
                    onClick={() => onSwitchLocale(e.lang)}
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      fontWeight: e.lang === locale ? 700 : undefined,
                    }}
                    leftSection={e.flag}
                  >
                    {e.langName}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>

            {/* Share Menu */}
            <Menu shadow="md" position="bottom-end" offset={12}>
              <Tooltip label={t("header.tooltip.share")}>
                <Menu.Target>
                  <ActionIcon
                    variant="transparent"
                    size="lg"
                    aria-label={t("header.tooltip.share")}
                  >
                    <IconShare size={20} />
                  </ActionIcon>
                </Menu.Target>
              </Tooltip>
              <Menu.Dropdown>
                {shareOptions.map((e) => (
                  <Menu.Item
                    key={e.id}
                    leftSection={e.icon}
                    onClick={() => {
                      if (typeof e.link === "string") {
                        window.open(e.link, "_blank");
                      } else {
                        setIsCopyMessageOpen(true);
                        e.link();
                      }
                    }}
                  >
                    {e.name}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </Box>
        </Container>
      </Box>

      {/* Copy toast */}
      {isCopyMessageOpen && (
        <Notification
          color="green"
          onClose={() => setIsCopyMessageOpen(false)}
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            zIndex: 1000,
          }}
        >
          {t("header.tooltip.copy")}
        </Notification>
      )}
    </>
  );
};

export default Header;
