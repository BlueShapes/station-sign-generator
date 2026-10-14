import { SUPPORTED_LOCALE_CODES } from "../i18n/locales";

export interface BuiltinFontDef {
  id: string;
  name: string;
  family: string;
  spec: string;
  sizeApprox: number;
  sourceUrl?: string;
  weight?: string;
  /** Optional language fonts are excluded from the required sign-font list. */
  optional?: boolean;
  /** Text used to request the face for its intended writing system. */
  sample?: string;
  license?: { name: string; url: string };
}

export const BUILTIN_FONTS: BuiltinFontDef[] = [
  {
    id: "noto-sans-jp", name: "Noto Sans JP", family: "NotoSansJP", spec: "900 1em NotoSansJP",
    sizeApprox: 9_600_000, sourceUrl: new URL("../fonts/NotoSansJP-VariableFont_wght.ttf", import.meta.url).href,
    weight: "100 900",
  },
  {
    id: "noto-sans-sc", name: "Noto Sans SC", family: "NotoSansSC",
    spec: "400 1em NotoSansSC", sizeApprox: 17_772_300,
    sourceUrl: new URL("../fonts/NotoSansSC-VariableFont_wght.ttf", import.meta.url).href,
    weight: "100 900",
    license: {
      name: "SIL Open Font License 1.1",
      url: new URL("../fonts/NotoSansSC-OFL.txt", import.meta.url).href,
    },
  },
  {
    id: "noto-sans-tc", name: "Noto Sans TC", family: "NotoSansTC", spec: "1em NotoSansTC",
    sizeApprox: 11_900_000, sourceUrl: new URL("../fonts/NotoSansTC-VariableFont_wght.ttf", import.meta.url).href,
    weight: "100 900",
  },
  {
    id: "noto-sans-kr", name: "Noto Sans KR", family: "NotoSansKR", spec: "1em NotoSansKR",
    sizeApprox: 10_400_000, sourceUrl: new URL("../fonts/NotoSansKR-VariableFont_wght.ttf", import.meta.url).href,
    weight: "100 900",
  },
  {
    id: "noto-sans", name: "Noto Sans", family: "NotoSans",
    spec: "400 1em NotoSans", sizeApprox: 2_049_096,
    sourceUrl: new URL("../fonts/NotoSans-Variable.ttf", import.meta.url).href,
    weight: "100 900",
    optional: true, sample: "Abc Жăộ İñ",
    license: {
      name: "SIL Open Font License 1.1",
      url: new URL("../fonts/NotoSans-OFL.txt", import.meta.url).href,
    },
  },
  {
    id: "noto-sans-arabic", name: "Noto Sans Arabic", family: "NotoSansArabic",
    spec: "400 1em NotoSansArabic", sizeApprox: 844_676,
    sourceUrl: new URL("../fonts/NotoSansArabic-Variable.ttf", import.meta.url).href,
    weight: "100 900",
    optional: true, sample: "العربية",
    license: {
      name: "SIL Open Font License 1.1",
      url: new URL("../fonts/NotoSansArabic-OFL.txt", import.meta.url).href,
    },
  },
  {
    id: "noto-sans-devanagari", name: "Noto Sans Devanagari", family: "NotoSansDevanagari",
    spec: "400 1em NotoSansDevanagari", sizeApprox: 641_944,
    sourceUrl: new URL("../fonts/NotoSansDevanagari-Variable.ttf", import.meta.url).href,
    weight: "100 900",
    optional: true, sample: "हिन्दी",
    license: {
      name: "SIL Open Font License 1.1",
      url: new URL("../fonts/NotoSansDevanagari-OFL.txt", import.meta.url).href,
    },
  },
  {
    id: "noto-sans-hk", name: "Noto Sans HK", family: "NotoSansHK",
    spec: "400 1em NotoSansHK", sizeApprox: 11_905_808,
    sourceUrl: new URL("../fonts/NotoSansHK-Variable.ttf", import.meta.url).href,
    weight: "100 900",
    optional: true, sample: "香港",
    license: {
      name: "SIL Open Font License 1.1",
      url: new URL("../fonts/NotoSansHK-OFL.txt", import.meta.url).href,
    },
  },
  {
    id: "zen-maru-gothic", name: "Zen Maru Gothic", family: "ZenMaruGothic",
    spec: "700 1em ZenMaruGothic", sizeApprox: 3_779_008,
    license: {
      name: "SIL Open Font License 1.1",
      url: new URL("../fonts/ZenMaruGothic-OFL.txt", import.meta.url).href,
    },
  },
  { id: "overused-grotesk", name: "Overused Grotesk", family: "OverusedGrotesk", spec: "1em OverusedGrotesk", sizeApprox: 217_000 },
  { id: "hind-semibold", name: "Hind SemiBold", family: "HindSemiBold", spec: "600 1em HindSemiBold", sizeApprox: 274_000 },
  { id: "jost-trispace-hybrid", name: "Jost Trispace Hybrid", family: "JostTrispaceHybrid", spec: "600 1em JostTrispaceHybrid", sizeApprox: 8_124 },
];

type SupportedLocale = (typeof SUPPORTED_LOCALE_CODES)[number];

const NOTO_FONT_IDS_BY_LOCALE = {
  ja: "noto-sans-jp",
  en: "noto-sans",
  "zh-CN": "noto-sans-sc",
  "zh-TW": "noto-sans-tc",
  "zh-HK": "noto-sans-hk",
  hi: "noto-sans-devanagari",
  es: "noto-sans",
  fr: "noto-sans",
  de: "noto-sans",
  "pt-BR": "noto-sans",
  "pt-PT": "noto-sans",
  ru: "noto-sans",
  ar: "noto-sans-arabic",
  id: "noto-sans",
  ko: "noto-sans-kr",
  vi: "noto-sans",
  tr: "noto-sans",
  it: "noto-sans",
  pl: "noto-sans",
  cs: "noto-sans",
  ms: "noto-sans",
  ro: "noto-sans",
} satisfies Record<SupportedLocale, string>;

export function getRecommendedNotoFont(locale: string): BuiltinFontDef | undefined {
  if (!Object.hasOwn(NOTO_FONT_IDS_BY_LOCALE, locale)) return undefined;
  const id = NOTO_FONT_IDS_BY_LOCALE[locale as SupportedLocale];
  return BUILTIN_FONTS.find((font) => font.id === id);
}

/** A missing CSS face resolves with an empty array; treat that as a failure. */
export async function loadBuiltinFont(
  font: BuiltinFontDef,
  fontSet: Pick<FontFaceSet, "load" | "add" | "delete"> = document.fonts,
): Promise<void> {
  if (font.sourceUrl) {
    const face = new FontFace(font.family, `url(${JSON.stringify(font.sourceUrl)})`, {
      weight: font.weight ?? "normal",
    });
    fontSet.add(face);
    try {
      await face.load();
      if (face.status !== "loaded") {
        throw new Error(`Font face is unavailable: ${font.family}`);
      }
      return;
    } catch (error) {
      fontSet.delete(face);
      throw error;
    }
  }

  const faces = await fontSet.load(font.spec, font.sample);
  if (faces.length === 0 || faces.some((face) => face.status !== "loaded")) {
    throw new Error(`Font face is unavailable: ${font.family}`);
  }
}
