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
import { BR, CN, CZ, DE, ES, GB, HK, IN, JP, MY, PL, PT, RO, RU, TW } from "country-flag-icons/react/3x2";
import { createElement, type ReactElement, useEffect, useState } from "react";
import { BsTwitter, BsCopy } from "react-icons/bs";
import { FaFacebook, FaTelegramPlane, FaVk, FaWhatsapp } from "react-icons/fa";
import { SiMisskey, SiMastodon, SiLine, SiX, SiReddit } from "react-icons/si";
import { useTranslations } from "@/i18n/useTranslation";
import { APP_VERSION } from "@/config";
import { getShareServices, type ShareService } from "@/config/shareServices";
import { SUPPORTED_LOCALES } from "@/i18n/locales";

const FLAG_COMPONENTS = { BR, CN, CZ, DE, ES, GB, HK, IN, JP, MY, PL, PT, RO, RU, TW };

interface HeaderProps {
  locale: string;
  onSwitchLocale: (locale: string) => void;
}

const Header = ({ locale, onSwitchLocale }: HeaderProps) => {
  const t = useTranslations("");
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  const [url, setUrl] = useState("https://example.com");
  useEffect(() => {
    setUrl(document.URL);
  }, []);

  const shareText = t("header.tooltip.share-message", {
    name: t("header.title"),
  });
  const encodedShareText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(url);
  const encodedMessage = encodeURIComponent(`${shareText}\n${url}`);

  type ShareOption = {
    name: string;
    link: string | (() => void);
    icon: ReactElement;
  };

  const shareOptions: Record<ShareService, ShareOption> = {
    copy: {
      name: t("header.tooltip.share-options.copy"),
      link: () => navigator.clipboard.writeText(`${shareText}\n${url}`),
      icon: <BsCopy />,
    },
    twitter: {
      name: t("header.tooltip.share-options.twitter"),
      link: `https://x.com/share?text=${encodedShareText}&url=${encodedUrl}`,
      icon: <BsTwitter />,
    },
    x: {
      name: t("header.tooltip.share-options.x"),
      link: `https://x.com/share?text=${encodedShareText}&url=${encodedUrl}`,
      icon: <SiX />,
    },
    reddit: {
      name: t("header.tooltip.share-options.reddit"),
      link: `https://www.reddit.com/submit?title=${encodedShareText}&url=${encodedUrl}`,
      icon: <SiReddit />,
    },
    misskey: {
      name: t("header.tooltip.share-options.misskey"),
      link: `https://misskey-hub.net/share/?text=${encodedShareText}&url=${encodedUrl}&visibility=public&localOnly=0`,
      icon: <SiMisskey />,
    },
    mastodon: {
      name: t("header.tooltip.share-options.mastodon"),
      link: `https://donshare.net/share.html?text=${encodedShareText}&url=${encodedUrl}`,
      icon: <SiMastodon />,
    },
    line: {
      name: t("header.tooltip.share-options.line"),
      link: `https://social-plugins.line.me/lineit/share?text=${encodedShareText}&url=${encodedUrl}`,
      icon: <SiLine />,
    },
    facebook: {
      name: t("header.tooltip.share-options.facebook"),
      link: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: <FaFacebook />,
    },
    whatsapp: {
      name: t("header.tooltip.share-options.whatsapp"),
      link: `https://api.whatsapp.com/send?text=${encodedMessage}`,
      icon: <FaWhatsapp />,
    },
    telegram: {
      name: t("header.tooltip.share-options.telegram"),
      link: `https://t.me/share/url?url=${encodedUrl}&text=${encodedShareText}`,
      icon: <FaTelegramPlane />,
    },
    vk: {
      name: t("header.tooltip.share-options.vk"),
      link: `https://vk.com/share.php?url=${encodedUrl}&title=${encodedShareText}`,
      icon: <FaVk />,
    },
  };

  const visibleShareServices = getShareServices(locale);

  const [isCopyMessageOpen, setIsCopyMessageOpen] = useState(false);

  const Flag = ({ locale, width }: { locale: string; width: string }) => {
    const language = SUPPORTED_LOCALES.find(({ code }) => code === locale);
    const FlagComponent = FLAG_COMPONENTS[language?.flag ?? "GB"];
    return createElement(FlagComponent, { style: { width } });
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
                    <Flag locale={locale} width="1.5em" />
                  </ActionIcon>
                </Menu.Target>
              </Tooltip>
              <Menu.Dropdown style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {SUPPORTED_LOCALES.map((language) => (
                  <Menu.Item
                    key={language.code}
                    onClick={() => onSwitchLocale(language.code)}
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      fontWeight: language.code === locale ? 700 : undefined,
                    }}
                    leftSection={<Flag locale={language.code} width="2em" />}
                  >
                    {language.nativeName}
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
                {visibleShareServices.map((service) => {
                  const option = shareOptions[service];
                  return (
                    <Menu.Item
                      key={service}
                      leftSection={option.icon}
                      onClick={() => {
                        if (typeof option.link === "string") {
                          window.open(option.link, "_blank", "noopener,noreferrer");
                        } else {
                          setIsCopyMessageOpen(true);
                          option.link();
                        }
                      }}
                    >
                      {option.name}
                    </Menu.Item>
                  );
                })}
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
