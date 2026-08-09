import type { Company } from "@/db/types";

export const DEFAULT_COMPANY_LANGUAGES = ["ja", "en", "ko", "zh-CN"] as const;

export const RAILWAY_LANGUAGE_OPTIONS = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-HK", label: "繁體中文（香港）" },
  { value: "zh-TW", label: "繁體中文（台灣）" },
  { value: "hi", label: "हिन्दी" },
  { value: "ru", label: "Русский" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "pt-PT", label: "Português (Portugal)" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "cs", label: "Čeština" },
  { value: "pl", label: "Polski" },
  { value: "ms", label: "Bahasa Melayu" },
  { value: "ro", label: "Română" },
] as const;

export type CompanyLanguageSlot =
  | "primary_language"
  | "secondary_language"
  | "tertiary_language"
  | "quaternary_language";

export const COMPANY_LANGUAGE_SLOTS: CompanyLanguageSlot[] = [
  "primary_language",
  "secondary_language",
  "tertiary_language",
  "quaternary_language",
];

export function getCompanyLanguages(company?: Company | null): string[] {
  if (!company) return [...DEFAULT_COMPANY_LANGUAGES];
  return COMPANY_LANGUAGE_SLOTS.map(
    (slot, index) => company[slot] || DEFAULT_COMPANY_LANGUAGES[index],
  );
}

export function getRailwayLanguageLabel(code: string): string {
  return (
    RAILWAY_LANGUAGE_OPTIONS.find((option) => option.value === code)?.label ??
    code
  );
}

export function getRailwayLanguageOptions(currentCode?: string) {
  if (
    !currentCode ||
    RAILWAY_LANGUAGE_OPTIONS.some((option) => option.value === currentCode)
  ) {
    return [...RAILWAY_LANGUAGE_OPTIONS];
  }
  return [{ value: currentCode, label: currentCode }, ...RAILWAY_LANGUAGE_OPTIONS];
}
