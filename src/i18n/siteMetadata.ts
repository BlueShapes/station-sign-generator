type Messages = Record<string, unknown>;

export interface LocalizedSiteMetadata {
  siteName: string;
  title: string;
  description: string;
  ogImagePath: string;
  ogImageAlt: string;
  pwaName: string;
  pwaShortName: string;
}

function getNestedString(messages: Messages, path: string): string | undefined {
  let current: unknown = messages;
  for (const key of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

export function getLocalizedSiteMetadata(
  messages: Messages,
): LocalizedSiteMetadata {
  const siteName = getNestedString(messages, "$site-name") ?? "Station Sign Generator";
  const title = getNestedString(messages, "meta.title") ?? siteName;

  return {
    siteName,
    title,
    description: getNestedString(messages, "meta.description") ?? "",
    ogImagePath: getNestedString(messages, "$og-image-path") ?? "/ogp.png",
    ogImageAlt: getNestedString(messages, "meta.og-image-alt") ?? title,
    pwaName: getNestedString(messages, "meta.pwa.name") ?? siteName,
    pwaShortName: getNestedString(messages, "meta.pwa.short-name") ?? siteName,
  };
}
