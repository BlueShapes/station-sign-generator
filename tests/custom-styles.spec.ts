import { expect, test } from "@playwright/test";
import path from "node:path";

const SIGN_TEMPLATE_LABELS = [
  "JR東日本風",
  "JR東日本風（分岐対応）",
  "JR東海風",
  "JR西日本風",
  "JR西日本風（大）",
  "東京メトロ風（小・日）",
  "東京メトロ風（小・外）",
  "東京メトロ風（中）",
  "都営地下鉄風（中）",
  "都営地下鉄風（大）",
] as const;

function customFontFixture(): { path: string; name: string } {
  const fixturePath =
    process.env.CUSTOM_STYLE_FONT_FIXTURE ??
    path.resolve("src/fonts/Hind-SemiBold.ttf");
  return {
    path: fixturePath,
    name: path.basename(fixturePath, path.extname(fixturePath)),
  };
}

test("creates persistent custom styles and embeds an uploaded font", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(180_000);
  const fontFixture = customFontFixture();
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.stack ?? error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.goto("/ja/");
  await page.getByRole("tab", { name: "設定" }).click({ timeout: 120_000 });

  await page.getByRole("button", { name: "フォントをアップロード" }).click();
  await page
    .locator('input[type="file"][accept*=".ttf"]')
    .setInputFiles(fontFixture.path);
  await page.getByRole("button", { name: "アップロード", exact: true }).click();
  await expect(
    page.getByText(fontFixture.name, { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "カスタムスタイルを作成" }).click();
  const creator = page.getByRole("dialog");
  const preview = creator.getByTestId("custom-style-preview");
  await expect(preview).toHaveAttribute(
    "aria-label",
    "プレビュー: 高輪ゲートウェイ",
  );
  const signPreview = preview.locator('img[src^="data:image"]').first();
  await expect(signPreview).toBeVisible({ timeout: 50_000 });
  const initialPreviewSource = await signPreview.getAttribute("src");
  await page.getByLabel("名前").fill("E2E カスタム駅名標");
  await page
    .getByRole("textbox", { name: "元にするテンプレート" })
    .click();
  await page.getByRole("option", { name: "JR東海風", exact: true }).click();
  await page.getByLabel("フォント", { exact: true }).first().click();
  await page.getByRole("option", { name: fontFixture.name }).click();
  await expect
    .poll(() => signPreview.getAttribute("src"), { timeout: 50_000 })
    .not.toBe(initialPreviewSource);
  if (process.env.CUSTOM_STYLE_PREVIEW_SCREENSHOT) {
    await preview.screenshot({
      path: process.env.CUSTOM_STYLE_PREVIEW_SCREENSHOT,
    });
  }
  await page.getByText("上級レイアウト設定").click();
  await page.getByLabel("フォントサイズ").first().fill("36");
  await page.getByLabel("字間").first().fill("2");
  await page.getByLabel("Y座標オフセット").first().fill("-1");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  await expect(page.getByText("E2E カスタム駅名標")).toBeVisible();
  await expect(page.getByText("フォントバイナリを内包")).toBeVisible();

  await page
    .getByRole("button", { name: "複製: E2E カスタム駅名標" })
    .click();
  await expect(page.getByText("E2E カスタム駅名標 のコピー")).toBeVisible();

  await page
    .getByRole("button", { name: "編集: E2E カスタム駅名標", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "カスタムスタイルを編集",
  );
  await expect(page.getByLabel("名前")).toHaveValue("E2E カスタム駅名標");
  await page.getByLabel("名前").fill("E2E 編集済み駅名標");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("E2E 編集済み駅名標")).toBeVisible();

  await page
    .getByRole("button", { name: "カスタム駅番号バッジを作成" })
    .click();
  await expect(
    page.getByRole("dialog").getByTestId("custom-style-preview").locator("canvas").first(),
  ).toBeVisible({ timeout: 50_000 });
  await page.getByLabel("名前").fill("E2E 駅番号");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("E2E 駅番号")).toBeVisible();

  await page
    .getByRole("button", { name: "カスタム路線バッジを作成" })
    .click();
  await expect(
    page.getByRole("dialog").getByTestId("custom-style-preview").locator("canvas").first(),
  ).toBeVisible({ timeout: 50_000 });
  await page.getByLabel("名前").fill("E2E 路線");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("E2E 路線")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "設定" }).click();
  await expect(page.getByText("E2E 編集済み駅名標")).toBeVisible();
  await expect(page.getByText("E2E カスタム駅名標 のコピー")).toBeVisible();

  await page.getByRole("tab", { name: "シンプル入力" }).click();
  const styleSelect = page.getByRole("textbox", { name: "スタイル", exact: true });
  await styleSelect.click();
  await page
    .getByRole("option", { name: "カスタム: E2E 編集済み駅名標" })
    .click();
  await expect(styleSelect).toHaveValue("カスタム: E2E 編集済み駅名標");
  expect(
    browserErrors.filter((message) => message.includes("Maximum update depth")),
  ).toEqual([]);
});

test("renders every station-sign template with a width-changing custom font", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(180_000);
  const fontFixture = customFontFixture();
  await page.goto("/ja/");
  await page.getByRole("tab", { name: "設定" }).click({ timeout: 120_000 });
  await page.getByRole("button", { name: "フォントをアップロード" }).click();
  await page
    .locator('input[type="file"][accept*=".ttf"]')
    .setInputFiles(fontFixture.path);
  await page.getByRole("button", { name: "アップロード", exact: true }).click();
  await page.getByRole("button", { name: "カスタムスタイルを作成" }).click();

  const dialog = page.getByRole("dialog");
  const preview = dialog.getByTestId("custom-style-preview");
  const previewImage = preview.locator('img[src^="data:image"]').first();
  await dialog.getByLabel("フォント", { exact: true }).first().click();
  await page.getByRole("option", { name: fontFixture.name }).click();

  const templateSelect = dialog.getByRole("textbox", {
    name: "元にするテンプレート",
  });
  for (const [index, label] of SIGN_TEMPLATE_LABELS.entries()) {
    await templateSelect.click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(templateSelect).toHaveValue(label);
    await expect(previewImage).toBeVisible({ timeout: 50_000 });
    if (process.env.CUSTOM_STYLE_PREVIEW_SCREENSHOT_DIR) {
      await preview.screenshot({
        path: path.join(
          process.env.CUSTOM_STYLE_PREVIEW_SCREENSHOT_DIR,
          `custom-font-template-${index + 1}.png`,
        ),
      });
    }
  }
});

test("applies a custom station-number badge in simple input", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(120_000);
  await page.goto("/ja/");
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ssg-customization-store", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("definitions")) {
          request.result.createObjectStore("definitions", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("definitions", "readwrite");
      transaction.objectStore("definitions").put({
        id: "e2e-simple-station-badge",
        kind: "station-number-badge",
        name: "E2E シンプル駅番号",
        templateId: "jreast",
        fontFamily: "NotoSansJP",
        layout: {},
        createdAt: 1,
        updatedAt: 1,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();

  const previewImage = page.locator('img[src^="data:image/"]').first();
  await expect(previewImage).toBeVisible({ timeout: 50_000 });
  const initialPreview = await previewImage.getAttribute("src");
  expect(initialPreview).not.toBeNull();

  const badgeStyle = page
    .getByRole("textbox", { name: "駅番号スタイル" })
    .first();
  await badgeStyle.click();
  await page
    .getByRole("option", { name: "カスタム: E2E シンプル駅番号" })
    .click();
  await expect(badgeStyle).toHaveValue("カスタム: E2E シンプル駅番号");
  await expect
    .poll(() => previewImage.getAttribute("src"), { timeout: 50_000 })
    .not.toBe(initialPreview);
});
