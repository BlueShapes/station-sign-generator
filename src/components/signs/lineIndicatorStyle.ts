import { getCustomLineIndicatorVisualStyle } from "@/customization/registry";
import type { CustomDefinition } from "@/customization/model";

export type LineIndicatorShape = "circle" | "rounded-square";

export interface LineIndicatorVisualStyle {
  shape: LineIndicatorShape;
  fontFamily: string;
  fontWeight: "bold" | "normal";
  strokeScale: number;
}

const DEFAULT_LINE_INDICATOR_STYLE = "jreast";

/**
 * Visual rules for each company station-number style.
 * Unknown future styles deliberately fall back to the neutral JR-style badge.
 */
const LINE_INDICATOR_VISUAL_STYLES: Record<
  string,
  LineIndicatorVisualStyle
> = {
  jreast: {
    shape: "rounded-square",
    fontFamily: '"HindSemiBold", Arial, sans-serif',
    fontWeight: "bold",
    strokeScale: 1,
  },
  tokyometro: {
    shape: "circle",
    fontFamily: '"JostTrispaceHybrid", Arial, sans-serif',
    fontWeight: "bold",
    strokeScale: 1.5,
  },
};

export function getLineIndicatorVisualStyle(
  style?: string,
  definitions?: readonly CustomDefinition[],
): LineIndicatorVisualStyle {
  const custom = getCustomLineIndicatorVisualStyle(style, definitions);
  if (custom) {
    const base = custom.shape === "circle"
      ? LINE_INDICATOR_VISUAL_STYLES.tokyometro
      : LINE_INDICATOR_VISUAL_STYLES.jreast;
    return {
      ...base,
      shape: custom.shape,
      fontFamily: custom.fontFamily ?? base.fontFamily,
    };
  }
  return (
    LINE_INDICATOR_VISUAL_STYLES[style ?? DEFAULT_LINE_INDICATOR_STYLE] ??
    LINE_INDICATOR_VISUAL_STYLES[DEFAULT_LINE_INDICATOR_STYLE]
  );
}

export function getLineIndicatorShape(style?: string): LineIndicatorShape {
  return getLineIndicatorVisualStyle(style).shape;
}

export function shouldShowLineIndicatorBadge(prefix?: string | null): boolean {
  return Boolean(prefix?.trim());
}
