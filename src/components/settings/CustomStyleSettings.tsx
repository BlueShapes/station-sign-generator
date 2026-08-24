import { useMemo, useState } from "react";
import {
  Accordion,
  ActionIcon,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCopy, IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import {
  BASE_SIGN_STYLE_IDS,
  CUSTOM_TEXT_PARTS,
  ROUTE_BADGE_TEMPLATE_IDS,
  STATION_NUMBER_BADGE_TEMPLATE_IDS,
  createCustomDefinition,
  duplicateCustomSignDefinition,
  type BaseSignStyleId,
  type CustomDefinitionKind,
  type CustomSignDefinition,
  type CustomSignLayout,
  type EmbeddedFont,
  type RouteBadgeTemplateId,
  type StationNumberBadgeTemplateId,
  updateCustomSignDefinition,
} from "@/customization/model";
import { useCustomizations } from "@/customization/store";
import type { BuiltinFontDef, UserFontEntry } from "@/db/useFontStore";
import { useTranslations } from "@/i18n/useTranslation";
import CustomStylePreview from "./CustomStylePreview";

type FontChoice = {
  value: string;
  label: string;
  family: string;
  userFont?: UserFontEntry;
  embeddedFont?: EmbeddedFont;
};

const KIND_KEYS: Record<CustomDefinitionKind, string> = {
  sign: "sign",
  "station-number-badge": "station-badge",
  "route-badge": "route-badge",
};

export default function CustomStyleSettings({
  builtinFonts,
  userFonts,
}: {
  builtinFonts: BuiltinFontDef[];
  userFonts: UserFontEntry[];
}) {
  const t = useTranslations();
  const { definitions, saveDefinition, deleteDefinition } = useCustomizations();
  const [opened, { open, close }] = useDisclosure(false);
  const [kind, setKind] = useState<CustomDefinitionKind>("sign");
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>("jreast");
  const [fontValue, setFontValue] = useState<string | null>(null);
  const [layout, setLayout] = useState<CustomSignLayout>({});
  const [saving, setSaving] = useState(false);
  const [editingDefinition, setEditingDefinition] =
    useState<CustomSignDefinition | null>(null);

  const fonts = useMemo<FontChoice[]>(() => {
    const choices: FontChoice[] = [
      ...builtinFonts.map((font) => ({
        value: `builtin:${font.id}`,
        label: font.name,
        family: font.family,
      })),
      ...userFonts.map((font) => ({
        value: `user:${font.id}`,
        label: font.name,
        family: font.family,
        userFont: font,
      })),
    ];
    const embeddedFonts = [
      ...(editingDefinition?.font ? [editingDefinition.font] : []),
      ...(editingDefinition?.fonts ?? []),
    ];
    embeddedFonts.forEach((font) => {
      if (!choices.some(({ family }) => family === font.family)) {
        choices.push({
          value: `embedded:${font.family}`,
          label: font.name,
          family: font.family,
          embeddedFont: font,
        });
      }
    });
    return choices;
  }, [builtinFonts, editingDefinition, userFonts]);

  const openCreator = (nextKind: CustomDefinitionKind) => {
    setEditingDefinition(null);
    setKind(nextKind);
    setName("");
    setFontValue(null);
    setLayout({});
    setTemplateId(
      nextKind === "sign"
        ? "jreast"
        : nextKind === "station-number-badge"
          ? "jreast"
          : "rounded-square",
    );
    open();
  };

  const openEditor = (definition: CustomSignDefinition) => {
    const fontChoice = [
      ...builtinFonts.map((font) => ({
        value: `builtin:${font.id}`,
        family: font.family,
      })),
      ...userFonts.map((font) => ({
        value: `user:${font.id}`,
        family: font.family,
      })),
    ].find(({ family }) => family === definition.fontFamily);
    setEditingDefinition(definition);
    setKind("sign");
    setName(definition.name);
    setTemplateId(definition.templateId);
    setFontValue(
      fontChoice?.value ??
        (definition.fontFamily ? `embedded:${definition.fontFamily}` : null),
    );
    setLayout(structuredClone(definition.layout));
    open();
  };

  const handleClose = () => {
    close();
    setEditingDefinition(null);
  };

  const handleDuplicate = async (definition: CustomSignDefinition) => {
    const copy = duplicateCustomSignDefinition(
      definition,
      t("settings.custom.copy-name", { name: definition.name }),
    );
    await saveDefinition(copy);
  };

  const templateOptions =
    kind === "sign"
      ? BASE_SIGN_STYLE_IDS.map((value) => ({
          value,
          label: t(`route.sign.${value}`),
        }))
      : kind === "station-number-badge"
        ? STATION_NUMBER_BADGE_TEMPLATE_IDS.map((value) => ({
            value,
            label: t(`settings.custom.template.station-badge.${value}`),
          }))
        : ROUTE_BADGE_TEMPLATE_IDS.map((value) => ({
            value,
            label: t(`settings.custom.template.route-badge.${value}`),
          }));
  const selectedFont = fonts.find(({ value }) => value === fontValue);

  const handleSave = async () => {
    if (!name.trim()) return;
    const usedFamilies = new Set([
      ...(selectedFont ? [selectedFont.family] : []),
      ...Object.values(layout)
        .map((part) => part?.fontFamily)
        .filter((family): family is string => !!family),
    ]);
    const existingEmbeddedFonts = [
      ...(editingDefinition?.font ? [editingDefinition.font] : []),
      ...(editingDefinition?.fonts ?? []),
    ];
    const embeddedFonts = [
      ...userFonts.map((font) => ({
        name: font.name,
        family: font.family,
        mimeType: font.mimeType,
        data: font.data.slice(0),
      })),
      ...existingEmbeddedFonts,
    ]
      .filter(
        (font, index, all) =>
          usedFamilies.has(font.family) &&
          all.findIndex(({ family }) => family === font.family) === index,
      )
      .map((font) => ({ ...font, data: font.data.slice(0) }));
    const selectedEmbeddedFont =
      selectedFont?.userFont ?? selectedFont?.embeddedFont;
    const options = {
      fontFamily: selectedFont?.family,
      font: selectedEmbeddedFont
        ? {
            name: selectedEmbeddedFont.name,
            family: selectedEmbeddedFont.family,
            mimeType: selectedEmbeddedFont.mimeType,
            data: selectedEmbeddedFont.data.slice(0),
          }
        : undefined,
      layout,
      fonts: embeddedFonts,
    };
    const createdDefinition =
      kind === "sign"
        ? createCustomDefinition(
            kind,
            name,
            templateId as BaseSignStyleId,
            options,
          )
        : kind === "station-number-badge"
          ? createCustomDefinition(
              kind,
              name,
              templateId as StationNumberBadgeTemplateId,
              options,
            )
          : createCustomDefinition(
              kind,
              name,
              templateId as RouteBadgeTemplateId,
              options,
            );
    const definition =
      editingDefinition && createdDefinition.kind === "sign"
        ? updateCustomSignDefinition(editingDefinition, {
            name: createdDefinition.name,
            templateId: createdDefinition.templateId,
            fontFamily: createdDefinition.fontFamily,
            font: createdDefinition.font,
            fonts: createdDefinition.fonts,
            layout: createdDefinition.layout,
          })
        : createdDefinition;
    setSaving(true);
    await saveDefinition(definition);
    setSaving(false);
    handleClose();
  };

  return (
    <Stack gap="lg">
      <Divider />
      <Stack gap={2}>
        <Title order={4}>{t("settings.custom.title")}</Title>
        <Text size="sm" c="dimmed">
          {t("settings.custom.description")}
        </Text>
      </Stack>

      {(["sign", "station-number-badge", "route-badge"] as const).map(
        (definitionKind) => {
          const key = KIND_KEYS[definitionKind];
          const items = definitions.filter(({ kind: itemKind }) =>
            itemKind === definitionKind,
          );
          return (
            <Stack key={definitionKind} gap="xs">
              <Group justify="space-between">
                <Title order={5}>{t(`settings.custom.${key}.title`)}</Title>
                <Button
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => openCreator(definitionKind)}
                >
                  {t(`settings.custom.${key}.create`)}
                </Button>
              </Group>
              {items.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("settings.custom.empty")}
                </Text>
              ) : (
                items.map((item) => (
                  <Paper key={item.id} withBorder p="sm">
                    <Group justify="space-between" wrap="nowrap">
                      <Stack gap={1}>
                        <Text size="sm" fw={600}>{item.name}</Text>
                        <Text size="xs" c="dimmed">
                          {item.templateId} · {item.fontFamily ?? t("settings.custom.template-font")}
                        </Text>
                        {(item.font || (item.fonts?.length ?? 0) > 0) && (
                          <Text size="xs" c="teal">
                            {t("settings.custom.font-embedded")}
                          </Text>
                        )}
                      </Stack>
                      <Group gap={4} wrap="nowrap">
                        {item.kind === "sign" && (
                          <>
                            <ActionIcon
                              variant="subtle"
                              aria-label={`${t("settings.custom.duplicate")}: ${item.name}`}
                              onClick={() => handleDuplicate(item)}
                            >
                              <IconCopy size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              aria-label={`${t("common.edit")}: ${item.name}`}
                              onClick={() => openEditor(item)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </>
                        )}
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          aria-label={`${t("common.delete")}: ${item.name}`}
                          onClick={() => deleteDefinition(item.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                ))
              )}
            </Stack>
          );
        },
      )}

      <Modal
        opened={opened}
        onClose={handleClose}
        size="xl"
        title={
          editingDefinition
            ? t("settings.custom.sign.edit")
            : t(`settings.custom.${KIND_KEYS[kind]}.create`)
        }
      >
        <Stack>
          <TextInput
            label={t("settings.custom.name")}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            required
          />
          <Select
            label={t("settings.custom.template-label")}
            value={templateId}
            data={templateOptions}
            onChange={(value) => value && setTemplateId(value)}
          />
          <Select
            label={t("settings.custom.font")}
            description={t("settings.custom.font-help")}
            value={fontValue}
            data={fonts}
            clearable
            searchable
            onChange={setFontValue}
          />

          <CustomStylePreview
            kind={kind}
            templateId={templateId}
            fontFamily={selectedFont?.family}
            layout={layout}
          />

          {kind === "sign" && (
            <Accordion variant="contained">
              <Accordion.Item value="advanced">
                <Accordion.Control>
                  {t("settings.custom.advanced.title")}
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack>
                    <Text size="sm" c="dimmed">
                      {t("settings.custom.advanced.description")}
                    </Text>
                    {CUSTOM_TEXT_PARTS.map((part) => (
                      <Paper key={part} withBorder p="sm">
                        <Stack gap="xs">
                          <Text size="sm" fw={600}>
                            {t(`settings.custom.parts.${part}`)}
                          </Text>
                          <Select
                            label={t("settings.custom.font")}
                            value={
                              fonts.find(({ family }) =>
                                family === layout[part]?.fontFamily,
                              )?.value ?? null
                            }
                            data={fonts}
                            clearable
                            searchable
                            onChange={(value) =>
                              setLayout((current) => ({
                                ...current,
                                [part]: {
                                  ...current[part],
                                  fontFamily: fonts.find(
                                    (font) => font.value === value,
                                  )?.family,
                                },
                              }))
                            }
                          />
                          <Group grow align="start">
                            <NumberInput
                              label={t("settings.custom.advanced.font-size")}
                              min={1}
                              value={layout[part]?.fontSize ?? ""}
                              onChange={(value) =>
                                setLayout((current) => ({
                                  ...current,
                                  [part]: {
                                    ...current[part],
                                    fontSize: typeof value === "number" ? value : undefined,
                                  },
                                }))
                              }
                            />
                            <NumberInput
                              label={t("settings.custom.advanced.letter-spacing")}
                              value={layout[part]?.letterSpacing ?? ""}
                              onChange={(value) =>
                                setLayout((current) => ({
                                  ...current,
                                  [part]: {
                                    ...current[part],
                                    letterSpacing: typeof value === "number" ? value : undefined,
                                  },
                                }))
                              }
                            />
                            <NumberInput
                              label={t("settings.custom.advanced.y-offset")}
                              value={layout[part]?.yOffset ?? ""}
                              onChange={(value) =>
                                setLayout((current) => ({
                                  ...current,
                                  [part]: {
                                    ...current[part],
                                    yOffset: typeof value === "number" ? value : undefined,
                                  },
                                }))
                              }
                            />
                          </Group>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!name.trim()} loading={saving} onClick={handleSave}>
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
