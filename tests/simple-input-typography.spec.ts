import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { BASE_SIGN_STYLE_IDS } from "../src/customization/model";

const ja = YAML.parse(readFileSync("src/locales/ja.yml", "utf8"));
const advancedTitle = ja.settings.custom.advanced.title;

async function openAdvanced(page: Page, title = advancedTitle) {
  const button = page.getByRole("button", { name: title, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
}

test("edits, persists, exports, resets and imports simple-input typography", async ({ page }) => {
  await page.goto("/");
  const image = page.locator('img[src^="data:image/"]').first();
  await expect(image).toBeVisible();
  const originalImage = await image.getAttribute("src");
  await expect(page.getByRole("button", { name: advancedTitle, exact: true })).toHaveAttribute("aria-expanded", "false");
  await openAdvanced(page);
  await page.getByLabel(ja.settings.custom.font, { exact: true }).first().click();
  await page.getByRole("option", { name: "Noto Sans", exact: true }).click();
  const part = page.getByRole("group", { name: ja.settings.custom.parts["main-secondary"], exact: true });
  await part.getByLabel(ja.settings.custom.font, { exact: true }).click();
  await page.getByRole("option", { name: "Overused Grotesk", exact: true }).click();
  await part.getByLabel(ja.settings.custom.advanced["font-size"]).fill("27");
  await part.getByLabel(ja.settings.custom.advanced["letter-spacing"]).fill("2");
  await part.getByLabel(ja.settings.custom.advanced["y-offset"]).fill("-4");
  const expected = {
    fontFamily: "NotoSans",
    layout: { "main-secondary": { fontFamily: "OverusedGrotesk", fontSize: 27, letterSpacing: 2, yOffset: -4 } },
  };
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("sign-config-v1") ?? "{}").typography)).toEqual(expected);
  await expect.poll(() => image.getAttribute("src")).not.toBe(originalImage);
  const editedImage = await image.getAttribute("src");
  await part.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/simple-input-typography.png" });

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: ja.input.direct["export-download"], exact: true }).click();
  const exported = JSON.parse(readFileSync((await (await jsonDownload).path())!, "utf8"));
  expect(exported.typography).toEqual(expected);
  const imageDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: ja.input.save, exact: true }).click();
  const png = readFileSync((await (await imageDownload).path())!);
  expect(png.subarray(1, 4).toString()).toBe("PNG");

  await page.reload();
  await expect.poll(() => image.getAttribute("src")).toBe(editedImage);
  await openAdvanced(page);
  await expect(part.getByLabel(ja.settings.custom.advanced["y-offset"])).toHaveValue("-4");
  await page.getByRole("button", { name: ja.input.direct.reset, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: ja.common.confirm, exact: true }).click();
  await expect.poll(() => image.getAttribute("src")).toBe(originalImage);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("sign-config-v1") ?? "{}").typography)).toBeUndefined();

  await page.getByRole("button", { name: ja.input.direct.import, exact: true }).click();
  await page.getByLabel(ja.input.direct["import-paste-label"]).fill(JSON.stringify(exported));
  await page.getByRole("dialog").getByRole("button", { name: ja.input.direct["import-submit"], exact: true }).click();
  await expect.poll(() => image.getAttribute("src")).toBe(editedImage);
});

test("uses the same controls for all templates and custom-style creation", async ({ page }) => {
  await page.goto("/");
  await openAdvanced(page);
  const part = page.getByRole("group", { name: ja.settings.custom.parts["main-primary"], exact: true });
  await part.getByLabel(ja.settings.custom.font, { exact: true }).click();
  await page.getByRole("option", { name: "Overused Grotesk", exact: true }).click();
  await part.getByLabel(ja.settings.custom.advanced["font-size"]).fill("38");
  await part.getByLabel(ja.settings.custom.advanced["y-offset"]).fill("2");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("sign-config-v1") ?? "{}").typography?.layout?.["main-primary"]?.yOffset)).toBe(2);
  const style = page.getByRole("textbox", { name: ja.route.sign.style, exact: true });
  const image = page.locator('img[src^="data:image/"]').first();
  for (const [index, id] of BASE_SIGN_STYLE_IDS.entries()) {
    await style.click();
    await page.getByRole("option", { name: ja.route.sign[id], exact: true }).click();
    await expect(style).toHaveValue(ja.route.sign[id]);
    await expect(page.locator('img[aria-hidden="true"][src^="data:image/"]')).toHaveCount(0);
    await expect(image).toBeVisible();
    const previous = await image.getAttribute("src");
    await part.getByLabel(ja.settings.custom.advanced["y-offset"]).fill(String(index * 2 + 3));
    await expect.poll(async () => (await image.getAttribute("src")) !== previous, {
      message: `${id} renders the edited text offset`,
    }).toBe(true);
  }
  await page.getByRole("tab", { name: ja.tabs.settings, exact: true }).click();
  await page.getByRole("button", { name: ja.settings.custom.sign.create, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: advancedTitle, exact: true }).click();
  const customPart = dialog.getByRole("group", { name: ja.settings.custom.parts["main-primary"], exact: true });
  await customPart.getByLabel(ja.settings.custom.advanced["font-size"]).fill("35");
  await customPart.getByLabel(ja.settings.custom.advanced["y-offset"]).fill("-3");
  await expect(customPart.getByLabel(ja.settings.custom.advanced["y-offset"])).toHaveValue("-3");
  await expect(dialog.getByTestId("custom-style-preview").locator('img[src^="data:image/"]').first()).toBeVisible();
});

test("restores uploaded fonts and keeps memory-only choices across tabs", async ({ page }) => {
  const upload = async (name: string, family: string) => {
    await page.getByRole("button", { name: ja.settings.fonts.upload, exact: true }).click();
    await page.locator('input[type="file"][accept*=".ttf"]').setInputFiles(path.resolve("src/fonts/Hind-SemiBold.ttf"));
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(ja.settings.fonts["display-name"]).fill(name);
    await dialog.getByLabel(ja.settings.fonts["family-name"]).fill(family);
    await dialog.getByRole("button", { name: ja.settings.fonts["upload-submit"], exact: true }).click();
    await expect(dialog).toHaveCount(0);
  };
  const choose = async (name: string) => {
    await page.getByRole("tab", { name: ja.tabs.simple, exact: true }).click();
    await openAdvanced(page);
    await page.getByLabel(ja.settings.custom.font, { exact: true }).first().click();
    await page.getByRole("option", { name, exact: true }).click();
  };
  await page.goto("/");
  await page.getByRole("tab", { name: ja.tabs.settings, exact: true }).click();
  await upload("Persistent input font", "SimplePersistentFont");
  await choose("Persistent input font");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("sign-config-v1") ?? "{}").typography?.fontFamily)).toBe("SimplePersistentFont");
  const image = page.locator('img[src^="data:image/"]').first();
  await expect(image).toBeVisible();
  const beforeReload = await image.getAttribute("src");
  await page.reload();
  await expect.poll(() => image.getAttribute("src")).toBe(beforeReload);
  await openAdvanced(page);
  await expect(page.getByLabel(ja.settings.custom.font, { exact: true }).first()).toHaveValue("Persistent input font");
  expect(await page.evaluate(() => Array.from(document.fonts).some((face) => face.family === "SimplePersistentFont" && face.status === "loaded"))).toBe(true);

  await page.getByRole("tab", { name: ja.tabs.settings, exact: true }).click();
  await page.getByText(ja.settings.storage.memory, { exact: true }).click();
  await upload("Memory input font", "SimpleMemoryFont");
  await choose("Memory input font");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("sign-config-v1") ?? "{}").typography?.fontFamily)).toBe("SimpleMemoryFont");
  await page.getByRole("tab", { name: ja.tabs.settings, exact: true }).click();
  await page.getByRole("tab", { name: ja.tabs.simple, exact: true }).click();
  await openAdvanced(page);
  await expect(page.getByLabel(ja.settings.custom.font, { exact: true }).first()).toHaveValue("Memory input font");
});

test("fits the shared controls on a narrow Arabic screen", async ({ page }) => {
  const ar = YAML.parse(readFileSync("src/locales/ar.yml", "utf8"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/");
  await openAdvanced(page, ar.settings.custom.advanced.title);
  const part = page.getByRole("group", { name: ar.settings.custom.parts["main-primary"], exact: true });
  await part.getByLabel(ar.settings.custom.advanced["y-offset"]).fill("-2");
  await expect(part).toHaveCSS("direction", "rtl");
  const bounds = (await part.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await part.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/simple-input-typography-ar.png" });
});

test("keeps advanced layout spacing correct after viewport changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/theme-ready/);
  const control = page.getByRole("button", { name: advancedTitle, exact: true });
  const topGap = await control.evaluate((element) => {
    const container = element.closest(".mantine-Accordion-root")!.parentElement!;
    return container.getBoundingClientRect().top - container.previousElementSibling!.getBoundingClientRect().bottom;
  });
  expect.soft(topGap, "space above the advanced layout container").toBeGreaterThanOrEqual(24);
  await openAdvanced(page);
  const panel = page.getByRole("region", { name: advancedTitle, exact: true });
  const lastPart = panel.getByRole("group", { name: ja.settings.custom.parts["adjacent-secondary"], exact: true });
  const bottomGap = async () => {
    const panelBounds = (await panel.boundingBox())!;
    const partBounds = (await lastPart.boundingBox())!;
    return Math.round(panelBounds.y + panelBounds.height - partBounds.y - partBounds.height);
  };
  for (const width of [390, 1352, 768, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(bottomGap, { message: `panel follows its content at ${width}px` }).toBeGreaterThanOrEqual(0);
    await expect.poll(bottomGap, { message: `no excess space below the final part at ${width}px` }).toBeLessThanOrEqual(24);
  }
  await lastPart.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/simple-input-layout-resize-wide.png" });
  await control.click();
  await expect(panel).toBeHidden();
  await openAdvanced(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(bottomGap).toBeGreaterThanOrEqual(0);
  await expect.poll(bottomGap).toBeLessThanOrEqual(24);
  await lastPart.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/simple-input-layout-resize-narrow.png" });
});
