import type { ReactNode } from "react";
import {
  Badge,
  Box,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from "@mantine/core";
import {
  IconBrandGithub,
  IconBrandX,
  IconBug,
  IconCode,
  IconExternalLink,
  IconLicense,
  IconWorld,
} from "@tabler/icons-react";
import { SiMisskey } from "react-icons/si";
import { useTranslations } from "@/i18n/useTranslation";
import styles from "./Footer.module.css";

type FooterLink = {
  label: string;
  description: string;
  href: string;
  icon: ReactNode;
};

type RouteColor = "green" | "blue";
type MarkerShape = "circle" | "square";

function LinkGroup({
  title,
  description,
  icon,
  links,
  color,
  markerShape,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  links: FooterLink[];
  color: RouteColor;
  markerShape: MarkerShape;
}) {
  return (
    <Box className={styles.linkSection}>
      <Group gap="sm" align="flex-start" mb="md" wrap="nowrap">
        <ThemeIcon variant="light" color={color} size="lg" radius="md">
          {icon}
        </ThemeIcon>
        <Box>
          <Title order={2} fz="sm" fw={700} lh={1.3}>
            {title}
          </Title>
          <Text size="xs" c="dimmed" mt={3}>
            {description}
          </Text>
        </Box>
      </Group>

      <Box
        className={`${styles.route} ${
          color === "green" ? styles.profileRoute : styles.developmentRoute
        }`}
      >
        {links.map((link) => (
          <UnstyledButton
            component="a"
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.stationLink}
          >
            <Box
              className={`${styles.stationMarker} ${
                markerShape === "circle"
                  ? styles.circleMarker
                  : styles.squareMarker
              }`}
              aria-hidden="true"
            >
              {link.icon}
            </Box>
            <Box className={styles.stationLabel}>
              <Text size="sm" fw={600} lh={1.35}>
                {link.label}
              </Text>
              <Text size="xs" c="dimmed" lh={1.4} mt={2}>
                {link.description}
              </Text>
            </Box>
            <IconExternalLink
              size={15}
              className={styles.externalIcon}
              aria-hidden="true"
            />
          </UnstyledButton>
        ))}
      </Box>
    </Box>
  );
}

export default function Footer() {
  const t = useTranslations();

  const profileLinks: FooterLink[] = [
    {
      label: t("footer.links.website"),
      description: "aosankaku.github.io",
      href: "https://aosankaku.github.io",
      icon: <IconWorld size={18} />,
    },
    {
      label: "X / Twitter",
      description: "@ao_sankaku",
      href: "https://x.com/ao_sankaku",
      icon: <IconBrandX size={18} />,
    },
    {
      label: "Misskey",
      description: "@aosankaku@crafters.aosankaku.net",
      href: "https://crafters.aosankaku.net/@aosankaku",
      icon: <SiMisskey size={17} />,
    },
  ];

  const developmentLinks: FooterLink[] = [
    {
      label: t("footer.development.repository"),
      description: t("footer.development.repository-description"),
      href: "https://github.com/BlueShapes/station-sign-generator",
      icon: <IconBrandGithub size={18} />,
    },
    {
      label: t("footer.development.issues"),
      description: t("footer.development.issues-description"),
      href: "https://github.com/BlueShapes/station-sign-generator/issues",
      icon: <IconBug size={18} />,
    },
  ];

  return (
    <Box component="footer" className={styles.footer}>
      <Container size="xl" px={0}>
        <Paper withBorder radius="lg" className={styles.shell}>
          <Box className={styles.routeLine} aria-hidden="true" />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0}>
            <LinkGroup
              title={t("footer.links.title")}
              description={t("footer.links.description")}
              icon={<IconWorld size={19} />}
              links={profileLinks}
              color="green"
              markerShape="circle"
            />
            <LinkGroup
              title={t("footer.development.title")}
              description={t("footer.development.description")}
              icon={<IconCode size={19} />}
              links={developmentLinks}
              color="blue"
              markerShape="square"
            />
          </SimpleGrid>

          <Box className={styles.legal}>
            <Text size="xs" c="dimmed" className={styles.notice}>
              {t("footer.notice")}
            </Text>
            <Group justify="space-between" align="center" gap="md" mt="lg">
              <Box>
                <Text size="sm" fw={600}>
                  © 2025 BlueShapes
                </Text>
                <Text size="xs" c="dimmed">
                  Blue Triangle and sysnote8
                </Text>
              </Box>
              <Badge
                variant="light"
                color="gray"
                leftSection={<IconLicense size={13} />}
              >
                MIT License
              </Badge>
            </Group>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
