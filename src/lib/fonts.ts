export const CANVAS_FONT_SPECS = [
  "900 1em NotoSansJP",
  "1em NotoSansTC",
  "1em NotoSansKR",
  "1em OverusedGrotesk",
  "600 1em HindSemiBold",
  "600 1em JostTrispaceHybrid",
] as const;

async function waitForNextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function waitForCanvasFonts(
  specs: readonly string[] = CANVAS_FONT_SPECS,
): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;

  await Promise.all(specs.map((spec) => document.fonts.load(spec)));
  await document.fonts.ready;

  // Give canvas/Konva one paint cycle after FontFaceSet settles.
  await waitForNextFrame();
  await waitForNextFrame();
}
