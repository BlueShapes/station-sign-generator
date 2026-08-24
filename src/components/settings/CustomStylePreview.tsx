import { useMemo, useRef } from "react";
import type Konva from "konva";
import { Box, Paper, Text } from "@mantine/core";
import { Layer, Stage } from "react-konva";
import JrEastSign from "@/components/signs/JrEastSign";
import JrEastBranchSign from "@/components/signs/JrEastBranchSign";
import JrCentralSign from "@/components/signs/JrCentralSign";
import JrWestSign from "@/components/signs/JrWestSign";
import JrWestSignLarge from "@/components/signs/JrWestSignLarge";
import MetroLongSign, {
  MetroLongForeignSign,
} from "@/components/signs/MetroLongSign";
import {
  MetroMediumSign,
  ToeiLargeSign,
  ToeiMediumSign,
} from "@/components/signs/SubwaySign";
import StationNumberBadge from "@/components/signs/StationNumberBadge";
import { LineIndicatorBadge } from "@/components/signs/LineMapRenderer";
import { SignTextCustomizationProvider } from "@/components/signs/CustomSignText";
import CanvasFontLoading from "@/components/CanvasFontLoading";
import {
  BASE_SIGN_STYLE_IDS,
  ROUTE_BADGE_TEMPLATE_IDS,
  STATION_NUMBER_BADGE_TEMPLATE_IDS,
  createCustomDefinition,
  getCustomDefinitionFontSpecs,
  type BaseSignStyleId,
  type CustomDefinition,
  type CustomDefinitionKind,
  type CustomSignDefinition,
  type CustomSignLayout,
  type RouteBadgeTemplateId,
  type StationNumberBadgeTemplateId,
} from "@/customization/model";
import { DEFAULT_DATA } from "@/db/seed";
import {
  getLineMapFontSpecs,
  getStationNumberFontSpecs,
  getStationSignFontSpecs,
} from "@/lib/fonts";
import { useCanvasFonts } from "@/lib/useCanvasFonts";
import { useTranslations } from "@/i18n/useTranslation";

const SIGN_COMPONENTS: Record<BaseSignStyleId, typeof JrEastSign> = {
  jreast: JrEastSign,
  jreastbranch: JrEastBranchSign,
  jrcentral: JrCentralSign,
  jrwest: JrWestSign,
  jrwestlarge: JrWestSignLarge,
  metrolong: MetroLongSign,
  metroforeign: MetroLongForeignSign,
  metromedium: MetroMediumSign,
  toeimedium: ToeiMediumSign,
  toeilarge: ToeiLargeSign,
};

function includesString(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

function createPreviewDefinition({
  kind,
  templateId,
  fontFamily,
  layout,
}: CustomStylePreviewProps): CustomDefinition {
  if (kind === "sign") {
    const resolvedTemplate = includesString(BASE_SIGN_STYLE_IDS, templateId)
      ? (templateId as BaseSignStyleId)
      : "jreast";
    return createCustomDefinition("sign", "Preview", resolvedTemplate, {
      fontFamily,
      layout,
    });
  }
  if (kind === "station-number-badge") {
    const resolvedTemplate = includesString(
      STATION_NUMBER_BADGE_TEMPLATE_IDS,
      templateId,
    )
      ? (templateId as StationNumberBadgeTemplateId)
      : "jreast";
    return createCustomDefinition(
      "station-number-badge",
      "Preview",
      resolvedTemplate,
      { fontFamily },
    );
  }
  const resolvedTemplate = includesString(ROUTE_BADGE_TEMPLATE_IDS, templateId)
    ? (templateId as RouteBadgeTemplateId)
    : "rounded-square";
  return createCustomDefinition("route-badge", "Preview", resolvedTemplate, {
    fontFamily,
  });
}

type CustomStylePreviewProps = {
  kind: CustomDefinitionKind;
  templateId: string;
  fontFamily?: string;
  layout: CustomSignLayout;
};

export default function CustomStylePreview(props: CustomStylePreviewProps) {
  const t = useTranslations();
  const definition = useMemo(
    () => createPreviewDefinition(props),
    [props.kind, props.templateId, props.fontFamily, props.layout],
  );
  const baseFontSpecs =
    definition.kind === "sign"
      ? getStationSignFontSpecs(definition.templateId)
      : definition.kind === "station-number-badge"
        ? getStationNumberFontSpecs(definition.templateId)
        : getLineMapFontSpecs();
  const fontSpecs = [
    ...baseFontSpecs,
    ...getCustomDefinitionFontSpecs(definition),
  ];
  const fonts = useCanvasFonts(fontSpecs);
  const previewColor =
    DEFAULT_DATA.centerSquareColors?.[0] ?? DEFAULT_DATA.baseColor;

  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      data-testid="custom-style-preview"
      aria-label={`${t("common.preview")}: ${DEFAULT_DATA.primaryName}`}
    >
      <Text size="sm" fw={600} mb="xs">
        {t("common.preview")}
      </Text>
      {fonts.ready ? (
        definition.kind === "sign" ? (
          <SignPreview definition={definition} />
        ) : (
          <Box style={{ display: "flex", justifyContent: "center" }}>
            <Stage width={120} height={100}>
              <Layer>
                {definition.kind === "station-number-badge" ? (
                  <StationNumberBadge
                    x={35}
                    y={20}
                    size={50}
                    color={previewColor}
                    prefix={DEFAULT_DATA.numberPrimaryPrefix}
                    value={DEFAULT_DATA.numberPrimaryValue}
                    threeLetterCode={DEFAULT_DATA.threeLetterCode}
                    style={definition.id}
                    customDefinitions={[definition]}
                  />
                ) : (
                  <LineIndicatorBadge
                    x={35}
                    y={20}
                    size={50}
                    strokeWidth={3}
                    color={previewColor}
                    prefix={DEFAULT_DATA.numberPrimaryPrefix ?? ""}
                    style={definition.id}
                    customDefinitions={[definition]}
                  />
                )}
              </Layer>
            </Stage>
          </Box>
        )
      ) : (
        <CanvasFontLoading show={fonts.showLoader} minHeight={100} />
      )}
    </Paper>
  );
}

function SignPreview({ definition }: { definition: CustomSignDefinition }) {
  const stageRef = useRef<Konva.Stage>(null);
  const SignComponent = SIGN_COMPONENTS[definition.templateId];
  return (
    <Box style={{ overflow: "hidden" }}>
      <SignTextCustomizationProvider definition={definition}>
        <SignComponent {...DEFAULT_DATA} ref={stageRef} />
      </SignTextCustomizationProvider>
    </Box>
  );
}
