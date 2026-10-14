import {
  CUSTOM_TEXT_PARTS,
  normalizeTextPartLayout,
  type BaseSignStyleId,
  type CustomSignDefinition,
  type CustomSignLayout,
  type TextPartLayout,
} from "./model";

export interface SimpleInputTypography {
  fontFamily?: string;
  layout?: CustomSignLayout;
}

const MAX_FONT_FAMILY_LENGTH = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFontFamily(value: unknown): string | undefined {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_FONT_FAMILY_LENGTH) || undefined
    : undefined;
}

/** JSON imports may contain malformed or future fields; keep only known values. */
export function normalizeSimpleInputTypography(value: unknown): SimpleInputTypography | undefined {
  if (!isRecord(value)) return undefined;
  const fontFamily = normalizeFontFamily(value.fontFamily);
  const layout: CustomSignLayout = {};
  if (isRecord(value.layout)) {
    for (const part of CUSTOM_TEXT_PARTS) {
      const raw = value.layout[part];
      if (!isRecord(raw)) continue;
      const normalized = normalizeTextPartLayout({
        fontFamily: normalizeFontFamily(raw.fontFamily),
        fontSize: typeof raw.fontSize === "number" ? raw.fontSize : undefined,
        letterSpacing: typeof raw.letterSpacing === "number" ? raw.letterSpacing : undefined,
        yOffset: typeof raw.yOffset === "number" ? raw.yOffset : undefined,
      });
      const fields = Object.fromEntries(
        Object.entries(normalized).filter(([, field]) => field !== undefined),
      ) as TextPartLayout;
      if (Object.keys(fields).length) layout[part] = fields;
    }
  }
  if (!fontFamily && Object.keys(layout).length === 0) return undefined;
  return {
    ...(fontFamily ? { fontFamily } : {}),
    ...(Object.keys(layout).length ? { layout } : {}),
  };
}

/** Compose local edits over the chosen style without editing a saved definition. */
export function resolveSimpleInputTextDefinition(
  templateId: BaseSignStyleId,
  definition: CustomSignDefinition | null,
  typography: SimpleInputTypography | undefined,
): CustomSignDefinition | null {
  const overrides = normalizeSimpleInputTypography(typography);
  if (!overrides) return definition;
  const layout: CustomSignLayout = { ...definition?.layout };
  for (const part of CUSTOM_TEXT_PARTS) {
    if (overrides.layout?.[part]) {
      layout[part] = { ...layout[part], ...overrides.layout[part] };
    }
  }
  return {
    ...(definition ?? {
      id: "simple-input-typography",
      name: "Simple input",
      kind: "sign" as const,
      templateId,
      createdAt: 0,
      updatedAt: 0,
    }),
    fontFamily: overrides.fontFamily ?? definition?.fontFamily,
    layout,
  };
}
