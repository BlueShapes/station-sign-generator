import { type ChangeEvent, useState, useEffect, useRef, memo } from "react";
import {
  Button,
  TextInput,
  ActionIcon,
  Slider,
  Box,
  Grid,
  Stack,
  Switch,
  SegmentedControl,
  Group,
  Text,
  ColorInput,
  ColorSwatch,
  Select,
  Modal,
  Divider,
} from "@mantine/core";
import {
  IconTrash,
  IconRefresh,
  IconArrowsHorizontal,
  IconArrowLeft,
  IconArrowRight,
  IconRuler,
  IconChevronsLeft,
  IconChevronsRight,
  IconTrain,
  IconTypography,
  IconTypographyOff,
} from "@tabler/icons-react";
import type DirectInputStationProps from "../signs/DirectInputStationProps";
import type { LocalLine } from "../signs/DirectInputStationProps";
import { SIGN_STYLE_FIELDS } from "../signs/signStyles";
import type {
  SignStyleFieldSpec,
  AdjacentFieldSpec,
} from "../signs/signStyles";
import styled from "styled-components";
import { v7 as uuidv7 } from "uuid";
import { useTranslations } from "@/i18n/useTranslation";

const DEBOUNCE_MS = 400;

interface DirectInputProps {
  initialData: DirectInputStationProps;
  onUpdate: (data: DirectInputStationProps) => void;
  onReset?: () => void;
  signStyle?: string;
}

const DirectInput = memo(function DirectInput({
  initialData,
  onUpdate,
  onReset,
  signStyle,
}: DirectInputProps) {
  const t = useTranslations();
  const fields: SignStyleFieldSpec =
    SIGN_STYLE_FIELDS[signStyle ?? "jreast"] ?? SIGN_STYLE_FIELDS["jreast"];
  const show = (f: keyof Omit<SignStyleFieldSpec, "left" | "right">) =>
    fields[f] !== "hidden";
  const showLeft = (f: keyof AdjacentFieldSpec) => fields.left[f] !== "hidden";
  const showRight = (f: keyof AdjacentFieldSpec) =>
    fields.right[f] !== "hidden";

  const [formData, setFormData] =
    useState<DirectInputStationProps>(initialData);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Debounce propagation to parent
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const timer = setTimeout(() => {
      onUpdateRef.current(formData);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [formData]);

  const updateField = (name: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [name]:
        typeof value === "string" ? (value as string).slice(0, 120) : value,
    }));
  };

  const updateDirection = (newDirection: string) => {
    const updated = {
      ...formData,
      direction: newDirection as DirectInputStationProps["direction"],
    };
    setFormData(updated);
    onUpdateRef.current(updated);
  };

  const handleSwap = () => {
    setFormData((prev) => ({
      ...prev,
      left: [...(prev.right ?? [])],
      right: [...(prev.left ?? [])],
    }));
  };

  const localLines: LocalLine[] = formData.localLines ?? [];
  const lineSelectData = localLines
    .filter((l) => l.prefix !== "")
    .map((l) => ({ value: l.prefix, label: l.prefix }));

  return (
    <>
      {/* Reset confirmation modal */}
      <Modal
        opened={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={t("input.direct.reset-title")}
        centered
      >
        <Text size="sm">{t("input.direct.reset-confirm")}</Text>
        <Group mt="lg" justify="flex-end">
          <Button variant="default" onClick={() => setResetModalOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            color="red"
            onClick={() => {
              onReset?.();
              setResetModalOpen(false);
            }}
          >
            {t("common.confirm")}
          </Button>
        </Group>
      </Modal>

      <Box style={{ width: "100%", padding: "25px" }}>
        <Grid gutter="md" style={{ overflow: "hidden" }}>
          <Grid.Col
            span={{ base: 12, sm: "auto" }}
            style={{
              display: "flex",
              justifyContent: "flex-start",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <SegmentedControl
              value={formData.direction ?? "left"}
              onChange={updateDirection}
              data={[
                { value: "left", label: <IconArrowLeft size={16} /> },
                { value: "both", label: <IconArrowsHorizontal size={16} /> },
                { value: "right", label: <IconArrowRight size={16} /> },
              ]}
            />
            <Button
              variant="outline"
              onClick={handleSwap}
              leftSection={<IconRefresh size={16} />}
            >
              {t("input.direct.swaplr")}
            </Button>
            <Button
              variant="outline"
              color="red"
              onClick={() => setResetModalOpen(true)}
              leftSection={<IconTrash size={16} />}
            >
              {t("input.direct.reset")}
            </Button>
          </Grid.Col>
          {show("ratio") && (
            <Grid.Col
              span={12}
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <IconRuler size={20} style={{ flexShrink: 0 }} />
              <Slider
                value={formData.ratio ?? 4.5}
                label={(v) => v}
                labelAlwaysOn
                step={0.5}
                min={2.5}
                max={8}
                style={{ width: "100%" }}
                onChange={(v) => updateField("ratio", v)}
              />
            </Grid.Col>
          )}
        </Grid>
      </Box>

      <Box style={{ width: "100%" }}>
        <Grid gutter="md" justify="center" style={{ overflow: "hidden" }}>
          {/* Left station */}
          <Grid.Col span={{ base: 10, md: 3 }}>
            <Stack gap="md">
              <InputHead>
                <IconChevronsLeft size={20} />
                {t("input.direct.input-left")}
              </InputHead>
              {formData.left.map((station, idx) => (
                <Stack key={station.id} gap="sm">
                  {idx > 0 && <Divider />}
                  <Group justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="delete"
                      onClick={() =>
                        updateField(
                          "left",
                          formData.left.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                  {showLeft("primaryName") && (
                    <TextInput
                      label={t("input.direct.lstation")}
                      value={station.primaryName}
                      onChange={(e) =>
                        updateField(
                          "left",
                          formData.left.map((s, i) =>
                            i === idx
                              ? { ...s, primaryName: e.target.value }
                              : s,
                          ),
                        )
                      }
                    />
                  )}
                  {showLeft("primaryNameFurigana") && (
                    <TextInput
                      label={t("input.direct.lread")}
                      value={station.primaryNameFurigana}
                      onChange={(e) =>
                        updateField(
                          "left",
                          formData.left.map((s, i) =>
                            i === idx
                              ? { ...s, primaryNameFurigana: e.target.value }
                              : s,
                          ),
                        )
                      }
                    />
                  )}
                  {showLeft("secondaryName") && (
                    <TextInput
                      label={t("input.direct.len")}
                      value={station.secondaryName}
                      onChange={(e) =>
                        updateField(
                          "left",
                          formData.left.map((s, i) =>
                            i === idx
                              ? { ...s, secondaryName: e.target.value }
                              : s,
                          ),
                        )
                      }
                    />
                  )}
                  {showLeft("numberPrimary") && (
                    <div>
                      <Text size="sm" fw={500} mb={4}>
                        {t("input.direct.lnum")}
                      </Text>
                      <Group gap="xs">
                        <Select
                          placeholder="JY"
                          style={{ width: "90px" }}
                          value={station.numberPrimaryPrefix ?? null}
                          data={lineSelectData}
                          clearable
                          onChange={(v) =>
                            updateField(
                              "left",
                              formData.left.map((s, i) =>
                                i === idx
                                  ? { ...s, numberPrimaryPrefix: v ?? "" }
                                  : s,
                              ),
                            )
                          }
                        />
                        <TextInput
                          placeholder="25"
                          style={{ flex: 1 }}
                          value={station.numberPrimaryValue ?? ""}
                          onChange={(e) =>
                            updateField(
                              "left",
                              formData.left.map((s, i) =>
                                i === idx
                                  ? { ...s, numberPrimaryValue: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                      </Group>
                    </div>
                  )}
                  {showLeft("numberSecondary") && (
                    <div>
                      <Text size="sm" fw={500} mb={4}>
                        {t("input.direct.lnum2")}
                      </Text>
                      <Group gap="xs">
                        <Select
                          placeholder="JY"
                          style={{ width: "90px" }}
                          value={station.numberSecondaryPrefix ?? null}
                          data={lineSelectData}
                          clearable
                          onChange={(v) =>
                            updateField(
                              "left",
                              formData.left.map((s, i) =>
                                i === idx
                                  ? { ...s, numberSecondaryPrefix: v ?? "" }
                                  : s,
                              ),
                            )
                          }
                        />
                        <TextInput
                          placeholder="25"
                          style={{ flex: 1 }}
                          value={station.numberSecondaryValue ?? ""}
                          onChange={(e) =>
                            updateField(
                              "left",
                              formData.left.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      numberSecondaryValue: e.target.value,
                                    }
                                  : s,
                              ),
                            )
                          }
                        />
                      </Group>
                    </div>
                  )}
                </Stack>
              ))}
              <Button
                variant="outline"
                size="xs"
                disabled={
                  fields.maxAdjacentCount !== undefined &&
                  formData.left.length >= fields.maxAdjacentCount
                }
                onClick={() =>
                  updateField("left", [
                    ...formData.left,
                    { id: uuidv7(), primaryName: "", secondaryName: "" },
                  ])
                }
              >
                {t("common.add")}
              </Button>
            </Stack>
          </Grid.Col>

          {/* Current station */}
          <Grid.Col span={{ base: 10, md: 3 }}>
            <Stack gap="md">
              <InputHead>
                <IconTrain size={20} />
                {t("input.direct.input-current")}
              </InputHead>
              {show("primaryName") && (
                <TextInput
                  label={t("input.direct.station")}
                  value={formData.primaryName}
                  onChange={(e) => updateField("primaryName", e.target.value)}
                />
              )}
              {show("primaryNameFurigana") && (
                <TextInput
                  label={t("input.direct.read")}
                  value={formData.primaryNameFurigana}
                  onChange={(e) =>
                    updateField("primaryNameFurigana", e.target.value)
                  }
                />
              )}
              {show("secondaryName") && (
                <TextInput
                  label={t("input.direct.en")}
                  value={formData.secondaryName}
                  onChange={(e) => updateField("secondaryName", e.target.value)}
                />
              )}
              {show("quaternaryName") && (
                <TextInput
                  label={t("input.direct.ch")}
                  value={formData.quaternaryName}
                  onChange={(e) =>
                    updateField("quaternaryName", e.target.value)
                  }
                />
              )}
              {show("tertiaryName") && (
                <TextInput
                  label={t("input.direct.kp")}
                  value={formData.tertiaryName}
                  onChange={(e) => updateField("tertiaryName", e.target.value)}
                />
              )}
              {show("numberPrimary") && (
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    {t("input.direct.num")}
                  </Text>
                  <Group gap="xs">
                    <Select
                      placeholder="JY"
                      style={{ width: "90px" }}
                      value={formData.numberPrimaryPrefix ?? null}
                      data={lineSelectData}
                      clearable
                      onChange={(v) =>
                        updateField("numberPrimaryPrefix", v ?? "")
                      }
                    />
                    <TextInput
                      placeholder="26"
                      style={{ flex: 1 }}
                      value={formData.numberPrimaryValue ?? ""}
                      onChange={(e) =>
                        updateField("numberPrimaryValue", e.target.value)
                      }
                    />
                  </Group>
                </div>
              )}
              {show("numberSecondary") && (
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    {t("input.direct.num2")}
                  </Text>
                  <Group gap="xs">
                    <Select
                      placeholder="JS"
                      style={{ width: "90px" }}
                      value={formData.numberSecondaryPrefix ?? null}
                      data={lineSelectData}
                      clearable
                      onChange={(v) =>
                        updateField("numberSecondaryPrefix", v ?? "")
                      }
                    />
                    <TextInput
                      placeholder="26"
                      style={{ flex: 1 }}
                      value={formData.numberSecondaryValue ?? ""}
                      onChange={(e) =>
                        updateField("numberSecondaryValue", e.target.value)
                      }
                    />
                  </Group>
                </div>
              )}
              {show("threeLetterCode") && (
                <TextInput
                  label={t("input.direct.trc")}
                  value={formData.threeLetterCode}
                  onChange={(e) =>
                    updateField("threeLetterCode", e.target.value)
                  }
                />
              )}
              {show("note") && (
                <TextInput
                  label={t("input.direct.note")}
                  value={formData.note}
                  onChange={(e) => updateField("note", e.target.value)}
                />
              )}
            </Stack>

            {/* Station area list */}
            {show("stationAreas") && (
              <Box style={{ maxWidth: 220, marginTop: "16px" }}>
                <Text size="sm" fw={500} mb="xs">
                  {t("input.direct.area")}
                </Text>
                <Stack gap="xs">
                  {formData.stationAreas?.map((e) => (
                    <Group key={e.id} gap="xs" align="center" wrap="nowrap">
                      <TextInput
                        style={{ minWidth: "68px", flex: 1 }}
                        placeholder={t("input.direct.area-name")}
                        value={e.name}
                        onChange={(i) => {
                          const nextAreas = formData.stationAreas?.map((c) =>
                            e.id === c.id
                              ? {
                                  id: c.id,
                                  name: i.target.value,
                                  isWhite: c.isWhite,
                                }
                              : c,
                          );
                          updateField("stationAreas", nextAreas);
                        }}
                      />
                      {e.isWhite ? (
                        <IconTypographyOff size={18} />
                      ) : (
                        <IconTypography size={18} />
                      )}
                      <Switch
                        checked={e.isWhite}
                        onChange={() => {
                          const nextAreas = formData.stationAreas?.map((c) =>
                            e.id === c.id
                              ? { id: c.id, name: c.name, isWhite: !c.isWhite }
                              : c,
                          );
                          updateField("stationAreas", nextAreas);
                        }}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="delete"
                        onClick={() => {
                          updateField(
                            "stationAreas",
                            formData.stationAreas?.filter((c) => c.id !== e.id),
                          );
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>
                <Button
                  variant="filled"
                  mt="xs"
                  onClick={() => {
                    updateField("stationAreas", [
                      ...(formData.stationAreas ?? []),
                      { id: uuidv7(), name: "", isWhite: true },
                    ]);
                  }}
                >
                  {t("common.add")}
                </Button>
              </Box>
            )}

            {/* Color pickers */}
            {show("baseColor") && (
              <Stack gap="sm" mt="lg" style={{ maxWidth: 220 }}>
                <ColorInput
                  label={t("input.direct.base-color")}
                  value={formData.baseColor}
                  onChange={(color) => updateField("baseColor", color)}
                  format="hex"
                  swatches={[
                    "#36ab33",
                    "#005bac",
                    "#e60012",
                    "#f97f00",
                    "#000000",
                    "#ffffff",
                  ]}
                />
              </Stack>
            )}

            {/* Center square colors */}
            {show("centerSquareColors") && (
              <Stack gap="xs" mt="md" style={{ maxWidth: 220 }}>
                <Text size="sm" fw={500}>
                  {t("input.direct.center-colors")}
                </Text>
                {(formData.centerSquareColors ?? []).map((color, idx) => (
                  <Group key={idx} gap="xs" wrap="nowrap">
                    <ColorInput
                      style={{ flex: 1 }}
                      value={color}
                      format="hex"
                      swatches={localLines.map((l) => l.color)}
                      onChange={(v) => {
                        const next = [...(formData.centerSquareColors ?? [])];
                        next[idx] = v;
                        updateField("centerSquareColors", next);
                      }}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="delete"
                      disabled={(formData.centerSquareColors ?? []).length <= 1}
                      onClick={() => {
                        const next = (formData.centerSquareColors ?? []).filter(
                          (_, i) => i !== idx,
                        );
                        updateField("centerSquareColors", next);
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                ))}
                <Button
                  variant="outline"
                  size="xs"
                  disabled={(formData.centerSquareColors ?? []).length >= 4}
                  onClick={() => {
                    updateField("centerSquareColors", [
                      ...(formData.centerSquareColors ?? []),
                      localLines[0]?.color ?? formData.baseColor,
                    ]);
                  }}
                >
                  {t("common.add")}
                </Button>
              </Stack>
            )}
          </Grid.Col>

          {/* Right station */}
          <Grid.Col span={{ base: 10, md: 3 }}>
            <Stack gap="md">
              <InputHead>
                {t("input.direct.input-right")}
                <IconChevronsRight size={20} />
              </InputHead>
              {formData.right.map((station, idx) => (
                <Stack key={station.id} gap="sm">
                  {idx > 0 && <Divider />}
                  <Group justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="delete"
                      onClick={() =>
                        updateField(
                          "right",
                          formData.right.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                  {showRight("primaryName") && (
                    <TextInput
                      label={t("input.direct.rstation")}
                      value={station.primaryName}
                      onChange={(e) =>
                        updateField(
                          "right",
                          formData.right.map((s, i) =>
                            i === idx
                              ? { ...s, primaryName: e.target.value }
                              : s,
                          ),
                        )
                      }
                    />
                  )}
                  {showRight("primaryNameFurigana") && (
                    <TextInput
                      label={t("input.direct.rread")}
                      value={station.primaryNameFurigana}
                      onChange={(e) =>
                        updateField(
                          "right",
                          formData.right.map((s, i) =>
                            i === idx
                              ? { ...s, primaryNameFurigana: e.target.value }
                              : s,
                          ),
                        )
                      }
                    />
                  )}
                  {showRight("secondaryName") && (
                    <TextInput
                      label={t("input.direct.ren")}
                      value={station.secondaryName}
                      onChange={(e) =>
                        updateField(
                          "right",
                          formData.right.map((s, i) =>
                            i === idx
                              ? { ...s, secondaryName: e.target.value }
                              : s,
                          ),
                        )
                      }
                    />
                  )}
                  {showRight("numberPrimary") && (
                    <div>
                      <Text size="sm" fw={500} mb={4}>
                        {t("input.direct.rnum")}
                      </Text>
                      <Group gap="xs">
                        <Select
                          placeholder="JY"
                          style={{ width: "90px" }}
                          value={station.numberPrimaryPrefix ?? null}
                          data={lineSelectData}
                          clearable
                          onChange={(v) =>
                            updateField(
                              "right",
                              formData.right.map((s, i) =>
                                i === idx
                                  ? { ...s, numberPrimaryPrefix: v ?? "" }
                                  : s,
                              ),
                            )
                          }
                        />
                        <TextInput
                          placeholder="27"
                          style={{ flex: 1 }}
                          value={station.numberPrimaryValue ?? ""}
                          onChange={(e) =>
                            updateField(
                              "right",
                              formData.right.map((s, i) =>
                                i === idx
                                  ? { ...s, numberPrimaryValue: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                      </Group>
                    </div>
                  )}
                  {showRight("numberSecondary") && (
                    <div>
                      <Text size="sm" fw={500} mb={4}>
                        {t("input.direct.rnum2")}
                      </Text>
                      <Group gap="xs">
                        <Select
                          placeholder="JY"
                          style={{ width: "90px" }}
                          value={station.numberSecondaryPrefix ?? null}
                          data={lineSelectData}
                          clearable
                          onChange={(v) =>
                            updateField(
                              "right",
                              formData.right.map((s, i) =>
                                i === idx
                                  ? { ...s, numberSecondaryPrefix: v ?? "" }
                                  : s,
                              ),
                            )
                          }
                        />
                        <TextInput
                          placeholder="27"
                          style={{ flex: 1 }}
                          value={station.numberSecondaryValue ?? ""}
                          onChange={(e) =>
                            updateField(
                              "right",
                              formData.right.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      numberSecondaryValue: e.target.value,
                                    }
                                  : s,
                              ),
                            )
                          }
                        />
                      </Group>
                    </div>
                  )}
                </Stack>
              ))}
              <Button
                variant="outline"
                size="xs"
                disabled={
                  fields.maxAdjacentCount !== undefined &&
                  formData.right.length >= fields.maxAdjacentCount
                }
                onClick={() =>
                  updateField("right", [
                    ...formData.right,
                    { id: uuidv7(), primaryName: "", secondaryName: "" },
                  ])
                }
              >
                {t("common.add")}
              </Button>

              {/* Lines management */}
              <Divider mt="xl" mb="sm" />
              <Text size="sm" fw={700} mb="xs">
                {t("input.direct.local-lines")}
              </Text>
              <Stack gap="xs">
                {localLines.map((line) => (
                  <Group key={line.id} gap="xs" wrap="nowrap">
                    <ColorSwatch
                      color={line.color}
                      size={20}
                      style={{ flexShrink: 0 }}
                    />
                    <ColorInput
                      value={line.color}
                      style={{ width: "110px" }}
                      format="hex"
                      onChange={(color) =>
                        updateField(
                          "localLines",
                          localLines.map((l) =>
                            l.id === line.id ? { ...l, color } : l,
                          ),
                        )
                      }
                    />
                    <TextInput
                      placeholder={t("input.direct.local-lines-prefix")}
                      style={{ flex: 1 }}
                      value={line.prefix}
                      onChange={(e) =>
                        updateField(
                          "localLines",
                          localLines.map((l) =>
                            l.id === line.id
                              ? { ...l, prefix: e.target.value }
                              : l,
                          ),
                        )
                      }
                    />
                    {(fields.localLinesMin === undefined ||
                      localLines.length > fields.localLinesMin) && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="delete"
                        onClick={() =>
                          updateField(
                            "localLines",
                            localLines.filter((l) => l.id !== line.id),
                          )
                        }
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                ))}
              </Stack>
              {(fields.localLinesMax === undefined ||
                localLines.length < fields.localLinesMax) && (
                <Button
                  variant="outline"
                  size="xs"
                  mt="xs"
                  onClick={() =>
                    updateField("localLines", [
                      ...localLines,
                      { id: uuidv7(), prefix: "", color: "#9fff00" },
                    ])
                  }
                >
                  {t("input.direct.local-lines-add")}
                </Button>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Box>
    </>
  );
});

const InputHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 10px;
  font-weight: 700;
  padding-top: 30px;
  gap: 6px;
`;

export default DirectInput;
