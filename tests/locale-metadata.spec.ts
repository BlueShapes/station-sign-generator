import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import {
  SUPPORTED_LOCALES,
  getLocaleDirection,
  getLocalePath,
  getOpenGraphLocale,
} from "../src/i18n/locales";

function messagesFor(locale: string) {
  return YAML.parse(readFileSync(`src/locales/${locale}.yml`, "utf8"));
}

test("keeps crawler metadata static without serializing all locales", async ({
  request,
}) => {
  const response = await request.get("/");
  const html = await response.text();

  expect(response.ok()).toBe(true);
  expect(html).not.toContain("allMessages");
  expect(html).toContain('property="og:locale" content="ja_JP"');
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
});

test("serves localized pages and manifests for all 22 languages and regions", async ({ request }) => {
  for (const { code } of SUPPORTED_LOCALES) {
    const messages = messagesFor(code);
    const response = await request.get(getLocalePath(code));
    expect(response.ok(), code).toBe(true);
    const html = await response.text();
    expect(html).toContain(`lang="${code}" dir="${getLocaleDirection(code)}"`);
    expect(html).toContain(`property="og:locale" content="${getOpenGraphLocale(code)}"`);
    for (const alternate of SUPPORTED_LOCALES) {
      expect(html).toContain(`hreflang="${alternate.code}"`);
    }
    const manifestResponse = await request.get(`/manifests/${code}.webmanifest`);
    expect(manifestResponse.ok(), code).toBe(true);
    expect(await manifestResponse.json()).toMatchObject({
      lang: code,
      dir: getLocaleDirection(code),
      name: messages.meta.pwa.name,
      short_name: messages.meta.pwa["short-name"],
      start_url: getLocalePath(code),
    });
  }
});

test("switches through every new language without losing station inputs", async ({ page }) => {
  const addedLocales = ["fr", "ar", "id", "ko", "vi", "tr", "it"];
  let messages = messagesFor("ja");
  await page.goto("/");
  await page.getByRole("textbox", { name: messages.input.direct.station, exact: true }).fill("Locale test station");
  // This marker disappears on a full page reload.
  await page.evaluate(() => { (window as unknown as Record<string, unknown>).localeTestMarker = true; });

  for (const code of addedLocales) {
    await page.getByLabel(messages.header.tooltip.lang, { exact: true }).click();
    const language = SUPPORTED_LOCALES.find((language) => language.code === code)!;
    await page.getByRole("menuitem", { name: language.nativeName, exact: true }).click();
    messages = messagesFor(code);
    await expect(page.locator("html")).toHaveAttribute("lang", code);
    await expect(page.locator("html")).toHaveAttribute("dir", getLocaleDirection(code));
    await expect(page).toHaveTitle(messages.meta.title);
    await expect(page).toHaveURL(new RegExp(`${getLocalePath(code)}$`));
    await expect(page.getByRole("tab", { name: messages.tabs.simple, exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: messages.input.direct.station, exact: true }))
      .toHaveValue("Locale test station");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", `/manifests/${code}.webmanifest`);
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).localeTestMarker)).toBe(true);
  }
});

test("renders Arabic controls in RTL while preserving physical sign positions", async ({ page }) => {
  const messages = messagesFor("ar");
  await page.goto("/ar/");
  const stationInput = page.getByRole("textbox", { name: messages.input.direct.station, exact: true });
  await expect(stationInput).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(stationInput).toHaveCSS("direction", "rtl");
  const leftInput = page.getByRole("textbox", { name: messages.input.direct.lstation, exact: true }).first();
  const rightInput = page.getByRole("textbox", { name: messages.input.direct.rstation, exact: true }).first();
  expect((await leftInput.boundingBox())!.x).toBeLessThan((await stationInput.boundingBox())!.x);
  expect((await rightInput.boundingBox())!.x).toBeGreaterThan((await stationInput.boundingBox())!.x);
  await expect(page.locator('input[value="left"]').first().locator("..")).toHaveCSS("direction", "ltr");
  await page.screenshot({ path: "test-results/localization-ar-desktop.png", fullPage: true });

  // Mantine keyboard navigation must use the same direction as the visible tabs.
  await page.getByRole("tab", { name: messages.tabs.simple, exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: messages.tabs["route-input"], exact: true }))
    .toHaveAttribute("aria-selected", "true");

  await page.getByLabel(messages.header.tooltip.lang, { exact: true }).click();
  await page.getByRole("menuitem", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  const english = messagesFor("en");
  await page.getByRole("tab", { name: english.tabs["route-input"], exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: english.tabs.simple, exact: true }))
    .toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("tab", { name: messages.tabs.settings, exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: messages.input.direct.station, exact: true })).toBeVisible();
  await page.getByLabel(messages.header.tooltip.lang, { exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "العربية", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/localization-ar-mobile.png", fullPage: true });
});

test("updates the tab title and PWA manifest without reloading", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    "content",
    "ja_JP",
  );
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute(
    "content",
    "image/png",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );

  await expect(page).toHaveTitle(/駅名標/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifests/ja.webmanifest",
  );

  await page.getByLabel("言語を変更").click();
  await page.getByRole("menuitem", { name: "हिन्दी" }).click();

  await expect(page).toHaveTitle(/रेलवे साइन जेनरेटर/);
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page).toHaveURL(/\/hi\/$/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifests/hi.webmanifest",
  );
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    "content",
    "hi_IN",
  );
  const hindiManifest = await page.evaluate(async () => {
    const manifestUrl = document
      .querySelector<HTMLLinkElement>('link[rel="manifest"]')
      ?.getAttribute("href");
    return fetch(manifestUrl ?? "").then((response) => response.json());
  });
  expect(hindiManifest.name).toContain("स्टेशन साइन");

  await page.getByLabel("स्थान बदलें").click();
  await page.getByRole("menuitem", { name: "日本語" }).click();

  await expect(page).toHaveTitle(/駅名標/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifests/ja.webmanifest",
  );
  const japaneseManifest = await page.evaluate(async () => {
    const manifestUrl = document
      .querySelector<HTMLLinkElement>('link[rel="manifest"]')
      ?.getAttribute("href");
    return fetch(manifestUrl ?? "").then((response) => response.json());
  });
  expect(japaneseManifest.name).toContain("駅名標");

  await page.goBack();
  await expect(page).toHaveTitle(/रेलवे साइन जेनरेटर/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifests/hi.webmanifest",
  );
});
