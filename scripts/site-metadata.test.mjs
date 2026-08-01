import { describe, expect, test } from "bun:test";
import {
  getLocaleFromPathname,
  getManifestPath,
} from "../src/i18n/locales";
import { getLocalizedSiteMetadata } from "../src/i18n/siteMetadata";

describe("localized site metadata", () => {
  test("reads title and PWA names from the selected messages", () => {
    const metadata = getLocalizedSiteMetadata({
      "$site-name": "Localized site",
      "$og-image-path": "/localized-og.png",
      meta: {
        title: "Localized title",
        description: "Localized description",
        "og-image-alt": "Localized image",
        pwa: { name: "Localized PWA", "short-name": "Local PWA" },
      },
    });

    expect(metadata).toEqual({
      siteName: "Localized site",
      title: "Localized title",
      description: "Localized description",
      ogImagePath: "/localized-og.png",
      ogImageAlt: "Localized image",
      pwaName: "Localized PWA",
      pwaShortName: "Local PWA",
    });
  });

  test("uses a locale-specific manifest path", () => {
    expect(getManifestPath("ja")).toBe("/manifests/ja.webmanifest");
    expect(getManifestPath("hi")).toBe("/manifests/hi.webmanifest");
  });

  test("resolves the locale from SPA history paths", () => {
    expect(getLocaleFromPathname("/hi/")).toBe("hi");
    expect(getLocaleFromPathname("/zh-HK/")).toBe("zh-HK");
    expect(getLocaleFromPathname("/")).toBe("ja");
    expect(getLocaleFromPathname("/unsupported/")).toBe("ja");
  });
});
