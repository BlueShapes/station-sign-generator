import { parse } from "yaml";

const rawFiles = import.meta.glob("../locales/*.yml", {
  as: "raw",
  eager: true,
});

const locales: Record<string, Record<string, unknown>> = Object.fromEntries(
  Object.entries(rawFiles).map(([path, raw]) => {
    const locale = path.replace("../locales/", "").replace(".yml", "");
    return [locale, parse(raw)];
  }),
);

export function loadTranslations(locale: string): Record<string, unknown> {
  return locales[locale] ?? locales["ja"];
}
