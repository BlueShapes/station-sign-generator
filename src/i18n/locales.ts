export const DEFAULT_LOCALE = "ja";

export const SUPPORTED_LOCALES = [
  { code: "ja", nativeName: "日本語", flag: "JP" },
  { code: "en", nativeName: "English", flag: "GB" },
  { code: "hi", nativeName: "हिन्दी", flag: "IN" },
  { code: "zh-HK", nativeName: "繁體中文（香港）", flag: "HK" },
  { code: "zh-TW", nativeName: "繁體中文（台灣）", flag: "TW" },
  { code: "zh-CN", nativeName: "简体中文（中国）", flag: "CN" },
  { code: "ru", nativeName: "Русский", flag: "RU" },
  { code: "pt-BR", nativeName: "Português (Brasil)", flag: "BR" },
  { code: "pt-PT", nativeName: "Português (Portugal)", flag: "PT" },
  { code: "es", nativeName: "Español", flag: "ES" },
  { code: "de", nativeName: "Deutsch", flag: "DE" },
  { code: "cs", nativeName: "Čeština", flag: "CZ" },
  { code: "pl", nativeName: "Polski", flag: "PL" },
  { code: "ms", nativeName: "Bahasa Melayu", flag: "MY" },
  { code: "ro", nativeName: "Română", flag: "RO" },
] as const;

export const SUPPORTED_LOCALE_CODES = SUPPORTED_LOCALES.map(
  ({ code }) => code,
);

export function getLocalePath(locale: string): string {
  return locale === DEFAULT_LOCALE ? "/" : `/${locale}/`;
}

export function getManifestPath(locale: string): string {
  return `/manifests/${locale}.webmanifest`;
}

export function getOpenGraphLocale(locale: string): string {
  const language = SUPPORTED_LOCALES.find(({ code }) => code === locale);
  if (!language) return "ja_JP";

  const [languageCode] = language.code.split("-");
  return `${languageCode}_${language.flag}`;
}

export function getLocaleFromPathname(pathname: string): string {
  const locale = pathname.split("/").filter(Boolean)[0];
  return SUPPORTED_LOCALE_CODES.includes(
    locale as (typeof SUPPORTED_LOCALE_CODES)[number],
  )
    ? locale
    : DEFAULT_LOCALE;
}
