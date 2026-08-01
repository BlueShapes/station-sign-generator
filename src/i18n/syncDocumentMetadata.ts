import { getLocalePath, getManifestPath } from "./locales";
import { getLocalizedSiteMetadata } from "./siteMetadata";

type Messages = Record<string, unknown>;

function setMetaContent(selector: string, content: string): void {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", content);
}

function setLinkHref(selector: string, href: string): void {
  document.querySelector<HTMLLinkElement>(selector)?.setAttribute("href", href);
}

export function syncDocumentMetadata(locale: string, messages: Messages): void {
  const metadata = getLocalizedSiteMetadata(messages);
  const canonicalUrl = new URL(getLocalePath(locale), window.location.origin).href;
  const ogImageUrl = new URL(metadata.ogImagePath, window.location.origin).href;

  document.documentElement.lang = locale;
  document.title = metadata.title;

  setMetaContent('meta[name="description"]', metadata.description);
  setMetaContent('meta[property="og:title"]', metadata.title);
  setMetaContent('meta[property="og:description"]', metadata.description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[property="og:image"]', ogImageUrl);
  setMetaContent('meta[property="og:image:alt"]', metadata.ogImageAlt);
  setMetaContent('meta[property="og:locale"]', locale);
  setMetaContent('meta[property="og:site_name"]', metadata.siteName);

  setLinkHref('link[rel="canonical"]', canonicalUrl);
  setLinkHref('link[rel="manifest"]', getManifestPath(locale));

  const structuredData = document.querySelector<HTMLScriptElement>(
    "#site-structured-data",
  );
  if (structuredData) {
    structuredData.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${canonicalUrl}#web-application`,
      name: metadata.siteName,
      description: metadata.description,
      url: canonicalUrl,
      applicationCategory: "DesignApplication",
      operatingSystem: "Any",
      inLanguage: locale,
      isAccessibleForFree: true,
    });
  }
}
