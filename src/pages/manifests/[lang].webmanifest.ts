import type { APIRoute } from "astro";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALE_CODES,
  getLocalePath,
} from "../../i18n/locales";
import { getLocalizedSiteMetadata } from "../../i18n/siteMetadata";
import { loadTranslations } from "../../i18n/translations";

export function getStaticPaths() {
  return SUPPORTED_LOCALE_CODES.map((locale) => ({
    params: { lang: locale },
  }));
}

export const GET: APIRoute = ({ params }) => {
  const locale = params.lang ?? DEFAULT_LOCALE;
  const metadata = getLocalizedSiteMetadata(loadTranslations(locale));
  const manifest = {
    id: "/",
    name: metadata.pwaName,
    short_name: metadata.pwaShortName,
    description: metadata.description,
    lang: locale,
    start_url: getLocalePath(locale),
    scope: "/",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    theme_color: "#ffffff",
    background_color: "#ffffff",
    display: "standalone",
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
};
