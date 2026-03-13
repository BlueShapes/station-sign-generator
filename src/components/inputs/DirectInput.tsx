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
  Modal,
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
import { SIGN_STYLE_FIELDS } from "../signs/signStyles";
import type { SignStyleFieldSpec } from "../signs/signStyles";
import styled from "styled-components";
import { v7 as uuidv7 } from "uuid";
import { useTranslations } from "@/i18n/useTranslation";

interface DirectInputStationPropsWithHandleChange extends DirectInputStationProps {
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
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
  const show = (f: keyof SignStyleFieldSpec) => fields[f] !== "hidden";

  const [resetModalOpen, setResetModalOpen] = useState(false);

  const handleSwap = () => {
    const target = {
      leftPrimaryName: props.rightPrimaryName,
      leftPrimaryNameFurigana: props.rightPrimaryNameFurigana,
      leftSecondaryName: props.rightSecondaryName,
      leftNumberPrimary: props.rightNumberPrimary,
      leftNumberSecondary: props.rightNumberSecondary,
      rightPrimaryName: props.leftPrimaryName,
      rightPrimaryNameFurigana: props.leftPrimaryNameFurigana,
      rightSecondaryName: props.leftSecondaryName,
      rightNumberPrimary: props.leftNumberPrimary,
      rightNumberSecondary: props.leftNumberSecondary,
    };

    Object.entries(target).forEach(([key, value]) => {
      props.onChange({
        target: { name: key, value: value || "" },
      } as ChangeEvent<HTMLInputElement | HTMLTextAreaElement>);
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
              {show("leftPrimaryName") && (
                <TextInput
                  name="leftPrimaryName"
                  label={t("input.direct.lstation")}
                  value={props.leftPrimaryName}
                  onChange={props.onChange}
                />
              )}
              {show("leftPrimaryNameFurigana") && (
                <TextInput
                  name="leftPrimaryNameFurigana"
                  label={t("input.direct.lread")}
                  value={props.leftPrimaryNameFurigana}
                  onChange={props.onChange}
                />
              )}
              {show("leftSecondaryName") && (
                <TextInput
                  name="leftSecondaryName"
                  label={t("input.direct.len")}
                  value={props.leftSecondaryName}
                  onChange={props.onChange}
                />
              )}
              {show("leftNumberPrimary") && (
                <TextInput
                  name="leftNumberPrimary"
                  label={t("input.direct.lnum")}
                  value={props.leftNumberPrimary}
                  onChange={props.onChange}
                />
              )}
              {show("leftNumberSecondary") && (
                <TextInput
                  name="leftNumberSecondary"
                  label={t("input.direct.lnum2")}
                  value={props.leftNumberSecondary}
                  onChange={props.onChange}
                />
              )}
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
                <TextInput
                  name="numberPrimary"
                  label={t("input.direct.num")}
                  value={props.numberPrimary}
                  onChange={props.onChange}
                />
              )}
              {show("numberSecondary") && (
                <TextInput
                  name="numberSecondary"
                  label={t("input.direct.num2")}
                  value={props.numberSecondary}
                  onChange={props.onChange}
                />
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
                swatches={["#36ab33", "#005bac", "#e60012", "#f97f00", "#000000", "#ffffff"]}
              />
              <ColorInput
                label={t("input.direct.line-color")}
                value={props.lineColor}
                onChange={(color) => handleColorChange("lineColor", color)}
                format="hex"
                swatches={["#89ff12", "#ffffff", "#000000", "#ffdd00", "#f97f00"]}
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
              {show("rightPrimaryName") && (
                <TextInput
                  name="rightPrimaryName"
                  label={t("input.direct.rstation")}
                  value={props.rightPrimaryName}
                  onChange={props.onChange}
                />
              )}
              {show("rightPrimaryNameFurigana") && (
                <TextInput
                  name="rightPrimaryNameFurigana"
                  label={t("input.direct.rread")}
                  value={props.rightPrimaryNameFurigana}
                  onChange={props.onChange}
                />
              )}
              {show("rightSecondaryName") && (
                <TextInput
                  name="rightSecondaryName"
                  label={t("input.direct.ren")}
                  value={props.rightSecondaryName}
                  onChange={props.onChange}
                />
              )}
              {show("rightNumberPrimary") && (
                <TextInput
                  name="rightNumberPrimary"
                  label={t("input.direct.rnum")}
                  value={props.rightNumberPrimary}
                  onChange={props.onChange}
                />
              )}
              {show("rightNumberSecondary") && (
                <TextInput
                  name="rightNumberSecondary"
                  label={t("input.direct.rnum2")}
                  value={props.rightNumberSecondary}
                  onChange={props.onChange}
                />
              )}
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
