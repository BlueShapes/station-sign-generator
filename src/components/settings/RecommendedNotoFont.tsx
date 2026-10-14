import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react';
import { getRecommendedNotoFont } from '@/lib/fontCatalog';
import { SUPPORTED_LOCALES } from '@/i18n/locales';
import { useLocale, useTranslations } from '@/i18n/useTranslation';
import type { FontStatus } from '@/db/useFontStore';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RecommendedNotoFont({
  status,
  onLoad,
}: {
  status: Record<string, FontStatus>;
  onLoad: (id: string) => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const font = getRecommendedNotoFont(locale);

  if (!font) return null;

  const fontStatus = status[font.id] ?? 'idle';
  const language = SUPPORTED_LOCALES.find(({ code }) => code === locale)?.nativeName ?? locale;

  return (
    <Paper
      component="section"
      aria-label={t('settings.fonts.recommended-title')}
      withBorder
      p="md"
      radius="sm"
    >
      <Stack gap="sm">
        <Title order={5}>{t('settings.fonts.recommended-title')}</Title>
        <Text size="sm">
          {t('settings.fonts.recommended-description', { language, font: font.name })}
        </Text>

        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text size="sm" fw={500}>{font.name}</Text>
            <Text size="xs" c="dimmed">{formatBytes(font.sizeApprox)}</Text>
            {font.license && (
              <Anchor
                size="xs"
                href={font.license.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ overflowWrap: 'anywhere' }}
              >
                {font.license.name}
              </Anchor>
            )}
          </Stack>

          <Group gap="xs" wrap="wrap">
            {fontStatus === 'idle' && (
              <Badge color="gray" size="sm">{t('settings.fonts.status.idle')}</Badge>
            )}
            {fontStatus === 'loading' && (
              <Badge color="blue" size="sm" leftSection={<Loader size={10} color="blue" />}>
                {t('settings.fonts.status.loading')}
              </Badge>
            )}
            {fontStatus === 'loaded' && (
              <Badge color="green" size="sm" leftSection={<IconCheck size={10} />}>
                {t('settings.fonts.status.loaded')}
              </Badge>
            )}
            {fontStatus === 'error' && (
              <Badge color="red" size="sm" leftSection={<IconX size={10} />}>
                {t('settings.fonts.status.error')}
              </Badge>
            )}
            {fontStatus !== 'loaded' && (
              <Button
                size="xs"
                variant="light"
                loading={fontStatus === 'loading'}
                disabled={fontStatus === 'loading'}
                onClick={() => { void onLoad(font.id); }}
              >
                {t('settings.fonts.recommended-load')}
              </Button>
            )}
          </Group>
        </Group>

        {fontStatus === 'error' && (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
            {t('settings.fonts.recommended-error')}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
