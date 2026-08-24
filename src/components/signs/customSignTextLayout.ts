import type {
  CustomSignDefinition,
  CustomTextPart,
} from "@/customization/model";

export interface CustomTextDefaults {
  fontFamily?: string;
  fontSize?: number;
  letterSpacing?: number;
  y?: number;
}

export function resolveCustomTextConfig(
  defaults: CustomTextDefaults,
  definition: Pick<CustomSignDefinition, "fontFamily" | "layout"> | null,
  part: CustomTextPart,
): CustomTextDefaults {
  const layout = definition?.layout[part];
  return {
    fontFamily: layout?.fontFamily ?? definition?.fontFamily ?? defaults.fontFamily,
    fontSize: layout?.fontSize ?? defaults.fontSize,
    letterSpacing: layout?.letterSpacing ?? defaults.letterSpacing,
    y: (defaults.y ?? 0) + (layout?.yOffset ?? 0),
  };
}

export function shouldAutoFitCustomText(
  definition: Pick<CustomSignDefinition, "fontFamily" | "layout"> | null,
  part: CustomTextPart,
): boolean {
  if (!definition) return false;
  const layout = definition.layout[part];
  if (layout?.fontSize !== undefined) return false;
  return Boolean(
    definition.fontFamily ||
      layout?.fontFamily ||
      layout?.letterSpacing !== undefined,
  );
}

export function fitSingleLineFontSize({
  fontSize,
  naturalWidth,
  maxWidth,
}: {
  fontSize: number;
  naturalWidth: number;
  maxWidth: number;
}): number {
  if (
    !Number.isFinite(fontSize) ||
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(maxWidth) ||
    fontSize <= 0 ||
    naturalWidth <= 0 ||
    maxWidth <= 0 ||
    naturalWidth <= maxWidth
  ) {
    return fontSize;
  }
  return (fontSize * maxWidth) / naturalWidth;
}
