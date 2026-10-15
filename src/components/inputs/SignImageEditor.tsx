import {
  Accordion, Button, Fieldset, Group, Image, NumberInput,
  Select, SimpleGrid, Stack, Text,
} from "@mantine/core";
import { useImageStore } from "@/db/useImageStore";
import { useTranslations } from "@/i18n/useTranslation";
import {
  createSignImagePlacement, MAX_SIGN_IMAGES, type SignImagePlacement,
} from "@/customization/signImages";

interface SignImageEditorProps {
  value: readonly SignImagePlacement[];
  onChange: (images: SignImagePlacement[]) => void;
  onReset?: () => void;
  disabled?: boolean;
}

export default function SignImageEditor({ value, onChange, onReset, disabled }: SignImageEditorProps) {
  const t = useTranslations();
  const { images } = useImageStore();
  const options = images.map((image) => ({ value: image.id, label: image.name }));
  const update = (id: string, patch: Partial<SignImagePlacement>) =>
    onChange(value.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  return (
    <Accordion variant="contained" data-testid="sign-image-settings">
      <Accordion.Item value="images">
        <Accordion.Control>{t("sign-images.title")}</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="sm">
            <Text size="sm" c="dimmed">{t("sign-images.help")}</Text>
            {images.length === 0 && <Text size="sm">{t("sign-images.empty")}</Text>}
            {value.map((placement, index) => {
              const image = images.find(({ id }) => id === placement.imageId);
              return (
                <Fieldset key={placement.id} legend={t("sign-images.item", { number: String(index + 1) })} p="sm" style={{ minWidth: 0 }}>
                  <Stack gap="xs">
                    <Select
                      label={t("sign-images.image")}
                      value={placement.imageId}
                      data={image ? options : [...options, { value: placement.imageId, label: t("sign-images.missing"), disabled: true }]}
                      searchable
                      disabled={disabled}
                      onChange={(imageId) => imageId && update(placement.id, { imageId })}
                    />
                    {image && <Image src={image.objectUrl} alt={image.name} w={64} h={48} fit="contain" />}
                    <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="xs">
                      {(["width", "height", "x", "y", "rotation", "opacity"] as const).map((field) => (
                        <NumberInput
                          key={field}
                          label={t(`sign-images.${field}`)}
                          value={field === "opacity" ? Math.round(placement.opacity * 100) : placement[field]}
                          min={field === "width" || field === "height" ? 0.1 : field === "opacity" ? 0 : field === "rotation" ? -360 : -10000}
                          max={field === "opacity" ? 100 : field === "rotation" ? 360 : 10000}
                          decimalScale={2}
                          step={field === "width" || field === "height" ? 1 : field === "opacity" ? 5 : 1}
                          disabled={disabled}
                          onChange={(number) => {
                            if (typeof number === "number" && Number.isFinite(number)) {
                              update(placement.id, { [field]: field === "opacity" ? number / 100 : number });
                            }
                          }}
                        />
                      ))}
                    </SimpleGrid>
                    <Group justify="flex-end">
                      <Button size="xs" variant="subtle" color="red" disabled={disabled} onClick={() => onChange(value.filter(({ id }) => id !== placement.id))}>
                        {t("common.delete")}
                      </Button>
                    </Group>
                  </Stack>
                </Fieldset>
              );
            })}
            <Group>
              <Button size="sm" variant="light" disabled={disabled || images.length === 0 || value.length >= MAX_SIGN_IMAGES} onClick={() => onChange([...value, createSignImagePlacement(images[0])])}>
                {t("sign-images.add")}
              </Button>
              {onReset && <Button size="sm" variant="subtle" disabled={disabled} onClick={onReset}>{t("sign-images.reset")}</Button>}
            </Group>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
