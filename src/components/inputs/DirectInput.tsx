import { type ChangeEvent, useState } from "react";
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
  Textarea,
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

interface DirectInputStationPropsWithHandleChange extends DirectInputStationProps {
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onUpdate?: (updates: Partial<DirectInputStationProps>) => void;
  onReset?: () => void;
  signStyle?: string;
}

const DirectInput: React.FC<DirectInputStationPropsWithHandleChange> = (
  props,
) => {
  const t = useTranslations();
  const fields: SignStyleFieldSpec =
    SIGN_STYLE_FIELDS[props.signStyle ?? "jreast"] ??
    SIGN_STYLE_FIELDS["jreast"];
  const show = (f: keyof Omit<SignStyleFieldSpec, "left" | "right">) =>
    fields[f] !== "hidden";
  const showLeft = (f: keyof AdjacentFieldSpec) => fields.left[f] !== "hidden";
  const showRight = (f: keyof AdjacentFieldSpec) =>
    fields.right[f] !== "hidden";

  const [resetModalOpen, setResetModalOpen] = useState(false);

  const handleSwap = () => {
    props.onUpdate?.({
      left: [...(props.right ?? [])],
      right: [...(props.left ?? [])],
    });
  };

  const handleColorChange = (name: string, color: string) => {
    props.onChange({
      target: { name, value: color },
    } as ChangeEvent<HTMLInputElement>);
  };

  const updateCurrentData = (name: string, value: unknown) => {
    props.onChange({
      target: { name, value },
    } as unknown as ChangeEvent<HTMLInputElement>);
  };

  const localLines: LocalLine[] = props.localLines ?? [];
  const lineSelectData = localLines.map((l) => ({
    value: l.prefix,
    label: l.prefix,
  }));

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
              props.onReset?.();
              setResetModalOpen(false);
            }}
          >
            {t("common.confirm")}
          </Button>
        </Group>
      </Modal>

      <Box style={{ width: "100%", padding: "25px" }}>
        <Grid gutter="md">
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
              value={props.direction ?? "left"}
              onChange={(n) => updateCurrentData("direction", n)}
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
          <Grid.Col
            span={12}
            style={{ display: "flex", alignItems: "center", gap: "12px" }}
          >
            <IconRuler size={20} style={{ flexShrink: 0 }} />
            <Slider
              defaultValue={props.ratio}
              label={(v) => v}
              labelAlwaysOn
              step={0.5}
              min={2.5}
              max={8}
              style={{ width: "100%" }}
              onChange={(v) => updateCurrentData("ratio", v)}
            />
          </Grid.Col>
        </Grid>
      </Box>

      <Box style={{ width: "100%" }}>
        <Grid gutter="md" justify="center">
          {/* Left station */}
          <Grid.Col span={{ base: 10, md: 3 }}>
            <Stack gap="md">
              <InputHead>
                <IconChevronsLeft size={20} />
                {t("input.direct.input-left")}
              </InputHead>
              {props.left.map((station, idx) => (
                <Stack key={station.id} gap="sm">
                  {idx > 0 && <Divider />}
                  <Group justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="delete"
                      onClick={() =>
                        updateCurrentData(
                          "left",
                          props.left.filter((_, i) => i !== idx),
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
                        updateCurrentData(
                          "left",
                          props.left.map((s, i) =>
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
                        updateCurrentData(
                          "left",
                          props.left.map((s, i) =>
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
                        updateCurrentData(
                          "left",
                          props.left.map((s, i) =>
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
                            updateCurrentData(
                              "left",
                              props.left.map((s, i) =>
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
                            updateCurrentData(
                              "left",
                              props.left.map((s, i) =>
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
                            updateCurrentData(
                              "left",
                              props.left.map((s, i) =>
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
                            updateCurrentData(
                              "left",
                              props.left.map((s, i) =>
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
                onClick={() =>
                  updateCurrentData("left", [
                    ...props.left,
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
                  name="primaryName"
                  label={t("input.direct.station")}
                  value={props.primaryName}
                  onChange={props.onChange}
                />
              )}
              {show("primaryNameFurigana") && (
                <TextInput
                  name="primaryNameFurigana"
                  label={t("input.direct.read")}
                  value={props.primaryNameFurigana}
                  onChange={props.onChange}
                />
              )}
              {show("secondaryName") && (
                <TextInput
                  name="secondaryName"
                  label={t("input.direct.en")}
                  value={props.secondaryName}
                  onChange={props.onChange}
                />
              )}
              {show("quaternaryName") && (
                <TextInput
                  name="quaternaryName"
                  label={t("input.direct.ch")}
                  value={props.quaternaryName}
                  onChange={props.onChange}
                />
              )}
              {show("tertiaryName") && (
                <TextInput
                  name="tertiaryName"
                  label={t("input.direct.kp")}
                  value={props.tertiaryName}
                  onChange={props.onChange}
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
                      value={props.numberPrimaryPrefix ?? null}
                      data={lineSelectData}
                      clearable
                      onChange={(v) =>
                        updateCurrentData("numberPrimaryPrefix", v ?? "")
                      }
                    />
                    <TextInput
                      name="numberPrimaryValue"
                      placeholder="26"
                      style={{ flex: 1 }}
                      value={props.numberPrimaryValue ?? ""}
                      onChange={props.onChange}
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
                      value={props.numberSecondaryPrefix ?? null}
                      data={lineSelectData}
                      clearable
                      onChange={(v) =>
                        updateCurrentData("numberSecondaryPrefix", v ?? "")
                      }
                    />
                    <TextInput
                      name="numberSecondaryValue"
                      placeholder="26"
                      style={{ flex: 1 }}
                      value={props.numberSecondaryValue ?? ""}
                      onChange={props.onChange}
                    />
                  </Group>
                </div>
              )}
              {show("threeLetterCode") && (
                <TextInput
                  name="threeLetterCode"
                  label={t("input.direct.trc")}
                  value={props.threeLetterCode}
                  onChange={props.onChange}
                />
              )}
              {show("note") && (
                <TextInput
                  name="note"
                  label={t("input.direct.note")}
                  value={props.note}
                  onChange={props.onChange}
                />
              )}
            </Stack>

            {/* Station area list */}
            <Box style={{ maxWidth: 220, marginTop: "16px" }}>
              <Text size="sm" fw={500} mb="xs">
                {t("input.direct.area")}
              </Text>
              <Stack gap="xs">
                {props.stationAreas?.map((e) => (
                  <Group key={e.id} gap="xs" align="center" wrap="nowrap">
                    <TextInput
                      style={{ minWidth: "68px", flex: 1 }}
                      placeholder={t("input.direct.area-name")}
                      value={e.name}
                      onChange={(i) => {
                        const nextAreas = props.stationAreas?.map((c) =>
                          e.id === c.id
                            ? {
                                id: c.id,
                                name: i.target.value,
                                isWhite: c.isWhite,
                              }
                            : c,
                        );
                        updateCurrentData("stationAreas", nextAreas);
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
                        const nextAreas = props.stationAreas?.map((c) =>
                          e.id === c.id
                            ? { id: c.id, name: c.name, isWhite: !c.isWhite }
                            : c,
                        );
                        updateCurrentData("stationAreas", nextAreas);
                      }}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="delete"
                      onClick={() => {
                        updateCurrentData(
                          "stationAreas",
                          props.stationAreas?.filter((c) => c.id !== e.id),
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
                  updateCurrentData(
                    "stationAreas",
                    props.stationAreas
                      ? [
                          ...props.stationAreas,
                          { id: uuidv7(), name: "", isWhite: true },
                        ]
                      : undefined,
                  );
                }}
              >
                {t("common.add")}
              </Button>
            </Box>

            {/* Color pickers */}
            <Stack gap="sm" mt="lg" style={{ maxWidth: 220 }}>
              <ColorInput
                label={t("input.direct.base-color")}
                value={props.baseColor}
                onChange={(color) => handleColorChange("baseColor", color)}
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
          </Grid.Col>

          {/* Right station */}
          <Grid.Col span={{ base: 10, md: 3 }}>
            <Stack gap="md">
              <InputHead>
                {t("input.direct.input-right")}
                <IconChevronsRight size={20} />
              </InputHead>
              {props.right.map((station, idx) => (
                <Stack key={station.id} gap="sm">
                  {idx > 0 && <Divider />}
                  <Group justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="delete"
                      onClick={() =>
                        updateCurrentData(
                          "right",
                          props.right.filter((_, i) => i !== idx),
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
                        updateCurrentData(
                          "right",
                          props.right.map((s, i) =>
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
                        updateCurrentData(
                          "right",
                          props.right.map((s, i) =>
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
                        updateCurrentData(
                          "right",
                          props.right.map((s, i) =>
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
                            updateCurrentData(
                              "right",
                              props.right.map((s, i) =>
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
                            updateCurrentData(
                              "right",
                              props.right.map((s, i) =>
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
                            updateCurrentData(
                              "right",
                              props.right.map((s, i) =>
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
                            updateCurrentData(
                              "right",
                              props.right.map((s, i) =>
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
                onClick={() =>
                  updateCurrentData("right", [
                    ...props.right,
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
                        updateCurrentData(
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
                        updateCurrentData(
                          "localLines",
                          localLines.map((l) =>
                            l.id === line.id
                              ? { ...l, prefix: e.target.value }
                              : l,
                          ),
                        )
                      }
                    />
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="delete"
                      onClick={() =>
                        updateCurrentData(
                          "localLines",
                          localLines.filter((l) => l.id !== line.id),
                        )
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
              <Button
                variant="outline"
                size="xs"
                mt="xs"
                onClick={() =>
                  updateCurrentData("localLines", [
                    ...localLines,
                    { id: uuidv7(), prefix: "", color: "#89ff12" },
                  ])
                }
              >
                {t("input.direct.local-lines-add")}
              </Button>
            </Stack>
          </Grid.Col>
        </Grid>
      </Box>

      <Box style={{ width: "100%", padding: "25px" }}>
        <Textarea autosize value={JSON.stringify(props, null, 2)} readOnly />
      </Box>
    </>
  );
};

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
