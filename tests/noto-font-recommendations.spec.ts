import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";

function messagesFor(locale: string) {
  return YAML.parse(readFileSync(`src/locales/${locale}.yml`, "utf8"));
}

const additionalFontRequest = /NotoSans(?:Arabic|Devanagari|HK)?-Variable(?:[.-]|\.ttf)/;

test("recommends the current language's font without downloading optional faces", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (additionalFontRequest.test(request.url())) requests.push(request.url());
  });
  let messages = messagesFor("en");
  await page.goto("/en/");
  await page.getByRole("tab", { name: messages.tabs.settings, exact: true }).click();

  const expectedFamilies: Record<string, string> = {
    ja: "Noto Sans JP", "zh-CN": "Noto Sans SC", "zh-TW": "Noto Sans TC",
    "zh-HK": "Noto Sans HK", ko: "Noto Sans KR", hi: "Noto Sans Devanagari",
    ar: "Noto Sans Arabic",
  };
  for (const language of SUPPORTED_LOCALES) {
    await page.getByLabel(messages.header.tooltip.lang, { exact: true }).click();
    await page.getByRole("menuitem", { name: language.nativeName, exact: true }).click();
    messages = messagesFor(language.code);
    const recommendation = page.getByRole("region", { name: messages.settings.fonts["recommended-title"], exact: true });
    await expect(recommendation).toBeVisible();
    await expect(recommendation.getByText(expectedFamilies[language.code] ?? "Noto Sans", { exact: true })).toBeVisible();
    await expect(recommendation).toContainText(language.nativeName);
  }
  expect(requests).toEqual([]);
});

test("loads only on request and retains its loaded status across settings visits", async ({ page }) => {
  const messages = messagesFor("en");
  let releaseFont!: () => void;
  const fontReleased = new Promise<void>((resolve) => { releaseFont = resolve; });
  await page.route(/NotoSans-Variable(?:[.-]|\.ttf)/, async (route) => {
    await fontReleased;
    await route.continue();
  });

  try {
    await page.goto("/en/");
    await page.getByRole("tab", { name: messages.tabs.settings, exact: true }).click();
    const recommendation = page.getByRole("region", { name: messages.settings.fonts["recommended-title"], exact: true });
    const loadButton = recommendation.getByRole("button", { name: messages.settings.fonts["recommended-load"], exact: true });
    await expect(recommendation.getByText(messages.settings.fonts.status.idle, { exact: true })).toBeVisible();
    const requested = page.waitForRequest(/NotoSans-Variable(?:[.-]|\.ttf)/);
    await loadButton.click();
    await requested;
    await expect(recommendation.getByText(messages.settings.fonts.status.loading, { exact: true })).toBeVisible();
    await expect(loadButton).toBeDisabled();
    releaseFont();
    await expect(recommendation.getByText(messages.settings.fonts.status.loaded, { exact: true })).toBeVisible();
    // FontFaceSet.check also sees the unused CSS face. Verify the downloaded
    // variable face itself rather than requiring every matching face to load.
    expect(await page.evaluate(() => Array.from(document.fonts).some((face) =>
      face.family.replace(/["']/g, "") === "NotoSans" &&
      face.weight === "100 900" && face.status === "loaded"
    ))).toBe(true);
    await page.screenshot({ path: "test-results/noto-font-recommendation.png" });

    await page.getByRole("tab", { name: messages.tabs.simple, exact: true }).click();
    await page.getByRole("tab", { name: messages.tabs.settings, exact: true }).click();
    await expect(recommendation.getByText(messages.settings.fonts.status.loaded, { exact: true })).toBeVisible();
    await expect(recommendation.getByRole("button", { name: messages.settings.fonts["recommended-load"], exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: messages.settings.custom.sign.create, exact: true }).click();
    await page.getByRole("dialog").getByLabel(messages.settings.custom.font, { exact: true }).first().click();
    await expect(page.getByRole("option", { name: "Noto Sans Arabic", exact: true })).toBeVisible();
  } finally {
    releaseFont();
  }
});

test("shows a retryable error in Arabic and fits a narrow RTL screen", async ({ page }) => {
  const messages = messagesFor("ar");
  let shouldFail = true;
  await page.route(/NotoSansArabic-Variable(?:[.-]|\.ttf)/, async (route) => {
    if (shouldFail) {
      shouldFail = false;
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/");
  await page.getByRole("tab", { name: messages.tabs.settings, exact: true }).click();
  const recommendation = page.getByRole("region", { name: messages.settings.fonts["recommended-title"], exact: true });
  await expect(recommendation).toBeVisible();
  await expect(recommendation).toHaveCSS("direction", "rtl");
  const bounds = (await recommendation.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  const loadButton = recommendation.getByRole("button", { name: messages.settings.fonts["recommended-load"], exact: true });
  await loadButton.click();
  await expect(recommendation.getByText(messages.settings.fonts["recommended-error"], { exact: true })).toBeVisible();
  await expect(loadButton).toBeEnabled();
  await loadButton.click();
  await expect(recommendation.getByText(messages.settings.fonts.status.loaded, { exact: true })).toBeVisible();
  await expect(recommendation.getByText(messages.settings.fonts["recommended-error"], { exact: true })).toHaveCount(0);
  await recommendation.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/noto-font-recommendation-ar.png" });
});
