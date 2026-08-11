import { expect, test } from "@playwright/test";

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
