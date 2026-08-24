export const BASE_SIGN_STYLE_IDS = [
  "jreast",
  "jreastbranch",
  "jrcentral",
  "jrwest",
  "jrwestlarge",
  "metrolong",
  "metroforeign",
  "metromedium",
  "toeimedium",
  "toeilarge",
] as const;

export type BaseSignStyleId = (typeof BASE_SIGN_STYLE_IDS)[number];

export const STATION_NUMBER_BADGE_TEMPLATE_IDS = [
  "jreast",
  "jrcentral",
  "tokyometro",
] as const;

export type StationNumberBadgeTemplateId =
  (typeof STATION_NUMBER_BADGE_TEMPLATE_IDS)[number];

export const ROUTE_BADGE_TEMPLATE_IDS = ["rounded-square", "circle"] as const;
export type RouteBadgeTemplateId = (typeof ROUTE_BADGE_TEMPLATE_IDS)[number];

export const CUSTOM_TEXT_PARTS = [
  "main-primary",
  "main-furigana",
  "main-secondary",
  "main-tertiary",
  "main-quaternary",
  "main-note",
  "main-area",
  "adjacent-primary",
  "adjacent-furigana",
  "adjacent-secondary",
] as const;

export type CustomTextPart = (typeof CUSTOM_TEXT_PARTS)[number];

export interface TextPartLayout {
  fontFamily?: string;
  fontSize?: number;
  letterSpacing?: number;
  yOffset?: number;
}

export type CustomSignLayout = Partial<
  Record<CustomTextPart, TextPartLayout>
>;

export interface EmbeddedFont {
  name: string;
  family: string;
  mimeType: string;
  data: ArrayBuffer;
}

interface CustomDefinitionBase {
  id: string;
  name: string;
  fontFamily?: string;
  font?: EmbeddedFont;
  fonts?: EmbeddedFont[];
  createdAt: number;
  updatedAt: number;
}

export interface CustomSignDefinition extends CustomDefinitionBase {
  kind: "sign";
  templateId: BaseSignStyleId;
  layout: CustomSignLayout;
}

export interface CustomStationNumberBadgeDefinition
  extends CustomDefinitionBase {
  kind: "station-number-badge";
  templateId: StationNumberBadgeTemplateId;
}

export interface CustomRouteBadgeDefinition extends CustomDefinitionBase {
  kind: "route-badge";
  templateId: RouteBadgeTemplateId;
}

export type CustomDefinition =
  | CustomSignDefinition
  | CustomStationNumberBadgeDefinition
  | CustomRouteBadgeDefinition;

export type CustomDefinitionKind = CustomDefinition["kind"];

type CreateOptions = {
  fontFamily?: string;
  font?: EmbeddedFont;
  fonts?: EmbeddedFont[];
  layout?: CustomSignLayout;
};

type UpdateCustomSignDraft = {
  name: string;
  templateId: BaseSignStyleId;
  fontFamily?: string;
  font?: EmbeddedFont;
  fonts?: EmbeddedFont[];
  layout: CustomSignLayout;
};

function copyEmbeddedFont(font: EmbeddedFont | undefined): EmbeddedFont | undefined {
  return font
    ? {
        ...font,
        data: font.data.slice(0),
      }
    : undefined;
}

function copyEmbeddedFonts(fonts: EmbeddedFont[] | undefined): EmbeddedFont[] | undefined {
  return fonts?.map((font) => copyEmbeddedFont(font)!);
}

function createId(kind: CustomDefinitionKind): string {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `custom-${kind}-${suffix}`;
}

export function normalizeTextPartLayout(
  value: TextPartLayout,
): TextPartLayout {
  const finite = (candidate: number | undefined) =>
    typeof candidate === "number" && Number.isFinite(candidate)
      ? candidate
      : undefined;
  const fontSize = finite(value.fontSize);

  return {
    fontFamily: value.fontFamily?.trim() || undefined,
    fontSize: fontSize !== undefined && fontSize > 0 ? fontSize : undefined,
    letterSpacing: finite(value.letterSpacing),
    yOffset: finite(value.yOffset),
  };
}

export function normalizeSignLayout(layout: CustomSignLayout): CustomSignLayout {
  return Object.fromEntries(
    Object.entries(layout).map(([part, value]) => [
      part,
      normalizeTextPartLayout(value ?? {}),
    ]),
  ) as CustomSignLayout;
}

export function createCustomDefinition(
  kind: "sign",
  name: string,
  templateId: BaseSignStyleId,
  options?: CreateOptions,
): CustomSignDefinition;
export function createCustomDefinition(
  kind: "station-number-badge",
  name: string,
  templateId: StationNumberBadgeTemplateId,
  options?: CreateOptions,
): CustomStationNumberBadgeDefinition;
export function createCustomDefinition(
  kind: "route-badge",
  name: string,
  templateId: RouteBadgeTemplateId,
  options?: CreateOptions,
): CustomRouteBadgeDefinition;
export function createCustomDefinition(
  kind: CustomDefinitionKind,
  name: string,
  templateId: string,
  options: CreateOptions = {},
): CustomDefinition {
  const now = Date.now();
  const base = {
    id: createId(kind),
    name: name.trim(),
    fontFamily: options.fontFamily ?? options.font?.family,
    font: options.font,
    fonts: options.fonts,
    createdAt: now,
    updatedAt: now,
  };

  if (kind === "sign") {
    return {
      ...base,
      kind,
      templateId: templateId as BaseSignStyleId,
      layout: normalizeSignLayout(options.layout ?? {}),
    };
  }
  if (kind === "station-number-badge") {
    return {
      ...base,
      kind,
      templateId: templateId as StationNumberBadgeTemplateId,
    };
  }
  return {
    ...base,
    kind,
    templateId: templateId as RouteBadgeTemplateId,
  };
}

export function duplicateCustomSignDefinition(
  source: CustomSignDefinition,
  name: string,
): CustomSignDefinition {
  return createCustomDefinition("sign", name, source.templateId, {
    fontFamily: source.fontFamily,
    font: copyEmbeddedFont(source.font),
    fonts: copyEmbeddedFonts(source.fonts),
    layout: structuredClone(source.layout),
  });
}

export function updateCustomSignDefinition(
  source: CustomSignDefinition,
  draft: UpdateCustomSignDraft,
): CustomSignDefinition {
  return {
    ...source,
    name: draft.name.trim(),
    templateId: draft.templateId,
    fontFamily: draft.fontFamily,
    font: copyEmbeddedFont(draft.font),
    fonts: copyEmbeddedFonts(draft.fonts),
    layout: normalizeSignLayout(structuredClone(draft.layout)),
    updatedAt: Date.now(),
  };
}

export function resolveCustomSelection<T extends CustomDefinition>(
  selectionId: string,
  definitions: readonly T[],
): { templateId: string; definition: T | null } {
  const definition = definitions.find(({ id }) => id === selectionId) ?? null;
  return {
    templateId: definition?.templateId ?? selectionId,
    definition,
  };
}

export function getCustomDefinitionFontSpecs(
  definition: CustomDefinition | null | undefined,
): string[] {
  if (!definition) return [];
  const families = new Set<string>();
  if (definition.fontFamily) families.add(definition.fontFamily);
  if (definition.kind === "sign") {
    Object.values(definition.layout).forEach((part) => {
      if (part?.fontFamily) families.add(part.fontFamily);
    });
  }
  return [...families].map((family) => `400 1em ${family}`);
}
