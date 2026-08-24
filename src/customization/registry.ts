import type {
  CustomDefinition,
  CustomRouteBadgeDefinition,
  CustomStationNumberBadgeDefinition,
} from "./model";

let registeredDefinitions: readonly CustomDefinition[] = [];

export function registerCustomDefinitions(
  definitions: readonly CustomDefinition[],
): void {
  registeredDefinitions = definitions;
}

function definitionsOrRegistered(
  definitions?: readonly CustomDefinition[],
): readonly CustomDefinition[] {
  return definitions ?? registeredDefinitions;
}

export function getCustomStationNumberBadgeVisualStyle(
  id: string | undefined,
  definitions?: readonly CustomDefinition[],
): { templateId: string; fontFamily?: string } | null {
  const definition = definitionsOrRegistered(definitions).find(
    (candidate): candidate is CustomStationNumberBadgeDefinition =>
      candidate.kind === "station-number-badge" && candidate.id === id,
  );
  return definition
    ? { templateId: definition.templateId, fontFamily: definition.fontFamily }
    : null;
}

export function getCustomLineIndicatorVisualStyle(
  id: string | undefined,
  definitions?: readonly CustomDefinition[],
): { shape: "circle" | "rounded-square"; fontFamily?: string } | null {
  const definition = definitionsOrRegistered(definitions).find(
    (candidate): candidate is CustomRouteBadgeDefinition =>
      candidate.kind === "route-badge" && candidate.id === id,
  );
  return definition
    ? { shape: definition.templateId, fontFamily: definition.fontFamily }
    : null;
}

