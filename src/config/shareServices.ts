export type ShareService =
  | "copy"
  | "twitter"
  | "x"
  | "misskey"
  | "mastodon"
  | "reddit"
  | "line"
  | "facebook"
  | "whatsapp"
  | "telegram"
  | "vk";

export const SHARE_SERVICES_BY_LOCALE: Record<string, readonly ShareService[]> = {
  ja: ["copy", "twitter", "x", "misskey", "mastodon", "reddit", "line"],
  en: ["copy", "whatsapp", "facebook", "x", "reddit", "mastodon"],
  hi: ["copy", "whatsapp", "facebook", "telegram", "x", "reddit"],
  "zh-HK": ["copy", "whatsapp", "facebook", "telegram", "x", "reddit"],
  "zh-TW": ["copy", "line", "facebook", "x", "reddit"],
  "zh-CN": ["copy"],
  ru: ["copy", "vk", "telegram"],
  "pt-BR": ["copy", "whatsapp", "facebook", "telegram", "x", "reddit"],
  "pt-PT": ["copy", "whatsapp", "facebook", "x"],
  es: ["copy", "whatsapp", "facebook", "telegram", "x"],
  de: ["copy", "whatsapp", "facebook", "x", "mastodon", "reddit"],
  cs: ["copy", "facebook", "whatsapp", "telegram", "reddit"],
  pl: ["copy", "facebook", "whatsapp", "telegram", "x"],
  ms: ["copy", "whatsapp", "facebook", "telegram", "x"],
  ro: ["copy", "facebook", "whatsapp", "telegram"],
};

export function getShareServices(locale: string): readonly ShareService[] {
  return SHARE_SERVICES_BY_LOCALE[locale] ?? ["copy"];
}
