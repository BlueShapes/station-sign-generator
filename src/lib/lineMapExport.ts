import type Konva from "konva";
import notoSansJpUrl from "@/fonts/NotoSansJP-VariableFont_wght.ttf?url";
import notoSansJpRegularUrl from "@/fonts/NotoSansJP-Regular.ttf?url";
import notoSansJpBoldUrl from "@/fonts/NotoSansJP-Bold.ttf?url";
import hindSemiBoldUrl from "@/fonts/Hind-SemiBold.ttf?url";
import hindBoldUrl from "@/fonts/Hind-Bold.ttf?url";
import jostTrispaceUrl from "@/fonts/JostTrispaceHybrid-600.ttf?url";
import publicSansUrl from "@/fonts/PublicSans-VariableFont_wght.ttf?url";
import { createKonvaStageSvg } from "@/lib/konvaSvgExport";
import { exportStageToStreamingPng } from "@/lib/streamingPngExport";

export type LineMapExportFormat = "png" | "svg" | "pdf";

const FONT_DEFINITIONS = [
  {
    family: "NotoSansJP",
    url: notoSansJpUrl,
    filename: "NotoSansJP.ttf",
    weights: [400, 700],
  },
  {
    family: "HindSemiBold",
    url: hindSemiBoldUrl,
    filename: "HindSemiBold.ttf",
    weights: [400, 700],
  },
  {
    family: "JostTrispaceHybrid",
    url: jostTrispaceUrl,
    filename: "JostTrispaceHybrid.ttf",
    weights: [400, 600, 700],
  },
  {
    family: "PublicSans",
    url: publicSansUrl,
    filename: "PublicSans.ttf",
    weights: [400, 700],
  },
] as const;

// jsPDF does not instantiate variable-font axes. Use static Noto Sans JP
// instances for PDF so regular and bold text retain the canvas typography.
const PDF_FONT_DEFINITIONS = [
  {
    family: "NotoSansJP",
    url: notoSansJpRegularUrl,
    filename: "NotoSansJP-Regular.ttf",
    weight: 400,
  },
  {
    family: "NotoSansJP",
    url: notoSansJpBoldUrl,
    filename: "NotoSansJP-Bold.ttf",
    weight: 700,
  },
  {
    family: "HindSemiBold",
    url: hindSemiBoldUrl,
    filename: "HindSemiBold.ttf",
    weight: 400,
  },
  {
    family: "HindSemiBold",
    url: hindBoldUrl,
    filename: "HindBold.ttf",
    weight: 700,
  },
  {
    family: "JostTrispaceHybrid",
    url: jostTrispaceUrl,
    filename: "JostTrispaceHybrid.ttf",
    weight: 400,
  },
  {
    family: "JostTrispaceHybrid",
    url: jostTrispaceUrl,
    filename: "JostTrispaceHybrid.ttf",
    weight: 600,
  },
  {
    family: "JostTrispaceHybrid",
    url: jostTrispaceUrl,
    filename: "JostTrispaceHybrid.ttf",
    weight: 700,
  },
  {
    family: "PublicSans",
    url: publicSansUrl,
    filename: "PublicSans.ttf",
    weight: 400,
  },
  {
    family: "PublicSans",
    url: publicSansUrl,
    filename: "PublicSans.ttf",
    weight: 700,
  },
] as const;

const fontBase64Cache = new Map<string, Promise<string>>();

// svg2pdf/jsPDF positions the Latin badge faces slightly below the browser
// canvas baseline. Keep this PDF-only so ordinary SVG output remains identical
// to the on-screen route map.
const PDF_BADGE_BASELINE_ADJUSTMENTS = {
  HindSemiBold: -1,
  JostTrispaceHybrid: -1,
  PublicSans: -1,
} as const;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(""));
}

function loadFontBase64(url: string): Promise<string> {
  const cached = fontBase64Cache.get(url);
  if (cached) return cached;
  const request = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`Font download failed: ${response.status}`);
    return arrayBufferToBase64(await response.arrayBuffer());
  });
  fontBase64Cache.set(url, request);
  return request;
}

async function loadFonts() {
  return Promise.all(
    FONT_DEFINITIONS.map(async (definition) => ({
      ...definition,
      base64: await loadFontBase64(definition.url),
    })),
  );
}

async function loadPdfFonts() {
  return Promise.all(
    PDF_FONT_DEFINITIONS.map(async (definition) => ({
      ...definition,
      base64: await loadFontBase64(definition.url),
    })),
  );
}

async function createPortableSvg(stage: Konva.Stage): Promise<string> {
  const fonts = await loadFonts();
  const css = fonts
    .flatMap(({ family, base64, weights }) =>
      weights.map(
        (weight) =>
          `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${base64}) format('truetype');font-style:normal;font-weight:${weight};}`,
      ),
    )
    .join("");
  return createKonvaStageSvg(stage, css);
}

async function createPdf(stage: Konva.Stage): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }, fonts] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
    loadPdfFonts(),
  ]);
  const width = Math.ceil(stage.width());
  const height = Math.ceil(stage.height());
  const pdf = new jsPDF({
    orientation: width > height ? "landscape" : "portrait",
    unit: "pt",
    format: [width, height],
    compress: true,
    putOnlyUsedFonts: true,
  });
  for (const { family, filename, base64, weight } of fonts) {
    pdf.addFileToVFS(filename, base64);
    // svg2pdf resolves numeric SVG weights to jsPDF's generated style keys.
    // Passing "bold" together with 700 creates an unusable "boldbold" key.
    pdf.addFont(filename, family, "normal", weight, "Identity-H");
  }

  const parsed = new DOMParser().parseFromString(
    createKonvaStageSvg(stage, "", PDF_BADGE_BASELINE_ADJUSTMENTS),
    "image/svg+xml",
  );
  if (parsed.querySelector("parsererror")) {
    throw new Error("The generated line-map SVG is invalid.");
  }
  await svg2pdf(parsed.documentElement, pdf, { width, height });
  return pdf.output("blob");
}

export async function createLineMapExportBlob({
  stage,
  format,
  pixelRatio,
}: {
  stage: Konva.Stage;
  format: LineMapExportFormat;
  pixelRatio: number;
}): Promise<Blob> {
  if (format === "png") return exportStageToStreamingPng(stage, pixelRatio);
  if (format === "pdf") return createPdf(stage);
  return new Blob([await createPortableSvg(stage)], {
    type: "image/svg+xml;charset=utf-8",
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
