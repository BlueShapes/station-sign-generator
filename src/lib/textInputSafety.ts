import type DirectInputStationProps from "@/components/signs/DirectInputStationProps";

export const TEXT_INPUT_MAX_LENGTH = 100;
export const DIRECT_INPUT_JSON_MAX_LENGTH = 100_000;

const TEXT_INPUT_TYPES = new Set([
  "email",
  "password",
  "search",
  "tel",
  "text",
  "url",
]);

export function truncateTextInput(value: string): string {
  return value.slice(0, TEXT_INPUT_MAX_LENGTH);
}

function isTextInput(element: Element): element is HTMLInputElement {
  return (
    element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type)
  );
}

function findTextDropTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;

  const editable = target.closest("input, textarea, [contenteditable='true']");
  if (!editable) return null;
  if (editable instanceof HTMLInputElement && !isTextInput(editable)) return null;

  return editable;
}

/**
 * Install browser-level guards for every text control, including controls
 * rendered through a portal. The input listener is a second line of defence
 * for programmatic input that bypasses the native maxlength constraint.
 */
export function installTextInputSafety(): () => void {
  const handleInput = (event: Event) => {
    const target = event.target;
    if (!target || !(target instanceof Element) || !isTextInput(target)) return;

    const safeValue = truncateTextInput(target.value);
    if (safeValue === target.value) return;

    const selectionStart = target.selectionStart;
    const selectionEnd = target.selectionEnd;
    target.value = safeValue;
    if (selectionStart !== null && selectionEnd !== null) {
      target.setSelectionRange(
        Math.min(selectionStart, safeValue.length),
        Math.min(selectionEnd, safeValue.length),
      );
    }
  };

  const handleDragOver = (event: DragEvent) => {
    if (!findTextDropTarget(event.target)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
  };

  const handleDrop = (event: DragEvent) => {
    if (!findTextDropTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  document.addEventListener("input", handleInput, true);
  document.addEventListener("dragover", handleDragOver, true);
  document.addEventListener("drop", handleDrop, true);

  return () => {
    document.removeEventListener("input", handleInput, true);
    document.removeEventListener("dragover", handleDragOver, true);
    document.removeEventListener("drop", handleDrop, true);
  };
}

export function sanitizeDirectInputData(
  data: DirectInputStationProps,
): DirectInputStationProps {
  const optional = (value: string | undefined) =>
    value === undefined ? undefined : truncateTextInput(value);

  const adjacent = (station: DirectInputStationProps["left"][number]) => ({
    ...station,
    id: truncateTextInput(station.id),
    primaryName: truncateTextInput(station.primaryName),
    primaryNameFurigana: optional(station.primaryNameFurigana),
    secondaryName: truncateTextInput(station.secondaryName),
    arrowColor: optional(station.arrowColor),
    numberPrimaryPrefix: optional(station.numberPrimaryPrefix),
    numberPrimaryValue: optional(station.numberPrimaryValue),
    numberSecondaryPrefix: optional(station.numberSecondaryPrefix),
    numberSecondaryValue: optional(station.numberSecondaryValue),
    numberTertiaryPrefix: optional(station.numberTertiaryPrefix),
    numberTertiaryValue: optional(station.numberTertiaryValue),
  });

  return {
    ...data,
    primaryName: truncateTextInput(data.primaryName),
    primaryNameFurigana: truncateTextInput(data.primaryNameFurigana),
    secondaryName: truncateTextInput(data.secondaryName),
    tertiaryName: optional(data.tertiaryName),
    quaternaryName: optional(data.quaternaryName),
    note: optional(data.note),
    numberPrimaryPrefix: optional(data.numberPrimaryPrefix),
    numberPrimaryValue: optional(data.numberPrimaryValue),
    numberSecondaryPrefix: optional(data.numberSecondaryPrefix),
    numberSecondaryValue: optional(data.numberSecondaryValue),
    numberTertiaryPrefix: optional(data.numberTertiaryPrefix),
    numberTertiaryValue: optional(data.numberTertiaryValue),
    threeLetterCode: optional(data.threeLetterCode),
    stationNumberStyle: optional(data.stationNumberStyle),
    baseColor: truncateTextInput(data.baseColor),
    centerSquareColors: data.centerSquareColors?.map(truncateTextInput),
    left: data.left.map(adjacent),
    right: data.right.map(adjacent),
    stationAreas: data.stationAreas?.map((area) => ({
      ...area,
      id: truncateTextInput(area.id),
      name: truncateTextInput(area.name),
    })),
    localLines: data.localLines?.map((line) => ({
      ...line,
      id: truncateTextInput(line.id),
      prefix: truncateTextInput(line.prefix),
      color: truncateTextInput(line.color),
    })),
  };
}
