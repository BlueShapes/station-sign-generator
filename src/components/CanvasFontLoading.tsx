import { Center, Loader, Stack, Text } from "@mantine/core";
import { useTranslations } from "@/i18n/useTranslation";

export default function CanvasFontLoading({
  show,
  minHeight = 180,
}: {
  show: boolean;
  minHeight?: number;
}) {
  const t = useTranslations();

  return (
    <Center mih={minHeight} aria-busy="true" aria-live="polite">
      {show && (
        <Stack align="center" gap="sm">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            {t("common.loading-fonts")}
          </Text>
        </Stack>
      )}
    </Center>
  );
}
