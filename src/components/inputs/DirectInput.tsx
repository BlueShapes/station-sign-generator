import { ChangeEvent } from "react";
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
import { ColorPicker, ColorService } from "react-color-palette";
import type DirectInputStationProps from "../signs/DirectInputStationProps";
import styled from "styled-components";
import { v7 as uuidv7 } from "uuid";
import { useTranslations } from "@/i18n/useTranslation";

interface DirectInputStationPropsWithHandleChange extends DirectInputStationProps {
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

const DirectInput: React.FC<DirectInputStationPropsWithHandleChange> = (
  props,
) => {
  const t = useTranslations();

  const handleSwap = () => {
    const target = {
      leftStationName: props.rightStationName,
      leftStationNameFurigana: props.rightStationNameFurigana,
      leftStationNameEnglish: props.rightStationNameEnglish,
      leftStationNumberPrimary: props.rightStationNumberPrimary,
      leftStationNumberSecondary: props.rightStationNumberSecondary,
      rightStationName: props.leftStationName,
      rightStationNameFurigana: props.leftStationNameFurigana,
      rightStationNameEnglish: props.leftStationNameEnglish,
      rightStationNumberPrimary: props.leftStationNumberPrimary,
      rightStationNumberSecondary: props.leftStationNumberSecondary,
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

      <Grid gutter="md" justify="center">
        {/* Left station */}
        <Grid.Col span={{ base: 10, md: 3 }}>
          <Stack gap="md">
            <InputHead>
              <IconChevronsLeft size={20} />
              {t("input.direct.input-left")}
            </InputHead>
            <TextInput
              name="leftStationName"
              label={t("input.direct.lstation")}
              value={props.leftStationName}
              onChange={props.onChange}
            />
            <TextInput
              name="leftStationNameFurigana"
              label={t("input.direct.lread")}
              value={props.leftStationNameFurigana}
              onChange={props.onChange}
            />
            <TextInput
              name="leftStationNameEnglish"
              label={t("input.direct.len")}
              value={props.leftStationNameEnglish}
              onChange={props.onChange}
            />
            <TextInput
              name="leftStationNumberPrimary"
              label={t("input.direct.lnum")}
              value={props.leftStationNumberPrimary}
              onChange={props.onChange}
            />
            <TextInput
              name="leftStationNumberSecondary"
              label={t("input.direct.lnum2")}
              value={props.leftStationNumberSecondary}
              onChange={props.onChange}
            />
          </Stack>
        </Grid.Col>

        {/* Current station */}
        <Grid.Col span={{ base: 10, md: 3 }}>
          <Stack gap="md">
            <InputHead>
              <IconTrain size={20} />
              {t("input.direct.input-current")}
            </InputHead>
            <TextInput
              name="stationName"
              label={t("input.direct.station")}
              value={props.stationName}
              onChange={props.onChange}
            />
            <TextInput
              name="stationNameFurigana"
              label={t("input.direct.read")}
              value={props.stationNameFurigana}
              onChange={props.onChange}
            />
            <TextInput
              name="stationNameEnglish"
              label={t("input.direct.en")}
              value={props.stationNameEnglish}
              onChange={props.onChange}
            />
            <TextInput
              name="stationNameChinese"
              label={t("input.direct.ch")}
              value={props.stationNameChinese}
              onChange={props.onChange}
            />
            <TextInput
              name="stationNameKorean"
              label={t("input.direct.kp")}
              value={props.stationNameKorean}
              onChange={props.onChange}
            />
            <TextInput
              name="stationNumberPrimary"
              label={t("input.direct.num")}
              value={props.stationNumberPrimary}
              onChange={props.onChange}
            />
            <TextInput
              name="stationNumberSecondary"
              label={t("input.direct.num2")}
              value={props.stationNumberSecondary}
              onChange={props.onChange}
            />
            <TextInput
              name="stationThreeLetterCode"
              label={t("input.direct.trc")}
              value={props.stationThreeLetterCode}
              onChange={props.onChange}
            />
            <TextInput
              name="stationNote"
              label={t("input.direct.note")}
              value={props.stationNote}
              onChange={props.onChange}
            />
          </Stack>

          {/* Station area list */}
          <Box style={{ maxWidth: 220, marginTop: "16px" }}>
            <Text size="sm" fw={500} mb="xs">
              {t("input.direct.area")}
            </Text>
            <Stack gap="xs">
              {props.stationArea?.map((e) => (
                <Group key={e.id} gap="xs" align="center" wrap="nowrap">
                  <TextInput
                    style={{ minWidth: "68px", flex: 1 }}
                    placeholder={t("input.direct.area-name")}
                    value={e.name}
                    onChange={(i) => {
                      const nextStationArea = props.stationArea?.map((c) =>
                        e.id === c.id
                          ? {
                              id: c.id,
                              name: i.target.value,
                              isWhite: c.isWhite,
                            }
                          : c,
                      );
                      updateCurrentData("stationArea", nextStationArea);
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
                      const nextStationArea = props.stationArea?.map((c) =>
                        e.id === c.id
                          ? { id: c.id, name: c.name, isWhite: !c.isWhite }
                          : c,
                      );
                      updateCurrentData("stationArea", nextStationArea);
                    }}
                  />
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="delete"
                    onClick={() => {
                      updateCurrentData(
                        "stationArea",
                        props.stationArea?.filter((c) => c.id !== e.id),
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
                  "stationArea",
                  props.stationArea
                    ? [
                        ...props.stationArea,
                        { id: uuidv7(), name: "", isWhite: true },
                      ]
                    : undefined,
                );
              }}
            >
              {t("common.add")}
            </Button>
          </Box>
        </Grid.Col>

        {/* Right station */}
        <Grid.Col span={{ base: 10, md: 3 }}>
          <Stack gap="md">
            <InputHead>
              {t("input.direct.input-right")}
              <IconChevronsRight size={20} />
            </InputHead>
            <TextInput
              name="rightStationName"
              label={t("input.direct.rstation")}
              value={props.rightStationName}
              onChange={props.onChange}
            />
            <TextInput
              name="rightStationNameFurigana"
              label={t("input.direct.rread")}
              value={props.rightStationNameFurigana}
              onChange={props.onChange}
            />
            <TextInput
              name="rightStationNameEnglish"
              label={t("input.direct.ren")}
              value={props.rightStationNameEnglish}
              onChange={props.onChange}
            />
            <TextInput
              name="rightStationNumberPrimary"
              label={t("input.direct.rnum")}
              value={props.rightStationNumberPrimary}
              onChange={props.onChange}
            />
            <TextInput
              name="rightStationNumberSecondary"
              label={t("input.direct.rnum2")}
              value={props.rightStationNumberSecondary}
              onChange={props.onChange}
            />
          </Stack>
        </Grid.Col>
      </Grid>

      <ColorPicker
        color={ColorService.convert("hex", props.baseColor)}
        onChange={(color) => handleColorChange("baseColor", color.hex)}
        hideAlpha
      />
      <ColorPicker
        color={ColorService.convert("hex", props.lineColor)}
        onChange={(color) => handleColorChange("lineColor", color.hex)}
        hideAlpha
      />
      <Textarea autosize value={JSON.stringify(props, null, 2)} readOnly />
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
