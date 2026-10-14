import {
  Fieldset,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
} from "@mantine/core";
import {
  CUSTOM_TEXT_PARTS,
  type CustomSignLayout,
  type TextPartLayout,
} from "@/customization/model";
import { useTranslations } from "@/i18n/useTranslation";

export interface SignFontOption {
  value: string;
  label: string;
  family: string;
}

interface SignTextLayoutEditorProps {
  fonts: readonly SignFontOption[];
  layout: CustomSignLayout;
  onChange: (layout: CustomSignLayout) => void;
}

export default function SignTextLayoutEditor({
  fonts,
  layout,
  onChange,
}: SignTextLayoutEditorProps) {
  const t = useTranslations();
  const fontOptions = fonts.map(({ value, label }) => ({ value, label }));

  const updatePart = (
    part: (typeof CUSTOM_TEXT_PARTS)[number],
    patch: Partial<TextPartLayout>,
  ) => {
    onChange({
      ...layout,
      [part]: {
        ...layout[part],
        ...patch,
      },
    });
  };

  return (
    <Stack gap="sm">
      {CUSTOM_TEXT_PARTS.map((part) => (
        <Fieldset
          key={part}
          legend={t(`settings.custom.parts.${part}`)}
          p="sm"
          radius="sm"
          style={{ minWidth: 0 }}
        >
          <Stack gap="xs">
            <Select
              label={t("settings.custom.font")}
              value={
                fonts.find(({ family }) => family === layout[part]?.fontFamily)
                  ?.value ?? null
              }
              data={fontOptions}
              clearable
              searchable
              onChange={(value) =>
                updatePart(part, {
                  fontFamily: fonts.find((font) => font.value === value)?.family,
                })
              }
            />
            <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
              <NumberInput
                label={t("settings.custom.advanced.font-size")}
                min={1}
                value={layout[part]?.fontSize ?? ""}
                onChange={(value) =>
                  updatePart(part, {
                    fontSize:
                      typeof value === "number" &&
                      Number.isFinite(value) &&
                      value > 0
                        ? value
                        : undefined,
                  })
                }
              />
              <NumberInput
                label={t("settings.custom.advanced.letter-spacing")}
                value={layout[part]?.letterSpacing ?? ""}
                onChange={(value) =>
                  updatePart(part, {
                    letterSpacing:
                      typeof value === "number" && Number.isFinite(value)
                        ? value
                        : undefined,
                  })
                }
              />
              <NumberInput
                label={t("settings.custom.advanced.y-offset")}
                value={layout[part]?.yOffset ?? ""}
                onChange={(value) =>
                  updatePart(part, {
                    yOffset:
                      typeof value === "number" && Number.isFinite(value)
                        ? value
                        : undefined,
                  })
                }
              />
            </SimpleGrid>
          </Stack>
        </Fieldset>
      ))}
    </Stack>
  );
}
