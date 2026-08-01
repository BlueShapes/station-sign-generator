import { test, expect } from "@playwright/test";

test("footer presents project links and the current Misskey profile", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector('[role="tab"]', { timeout: 30000 });

  const footer = page.getByRole("contentinfo");
  await expect(footer).toBeVisible();
  await expect(
    footer.getByRole("heading", { name: "リンク" }),
  ).toBeVisible();
  await expect(
    footer.getByRole("heading", { name: "開発リソース" }),
  ).toBeVisible();

  const misskeyProfile = footer.getByRole("link", { name: /Misskey/i });
  await expect(misskeyProfile).toHaveAttribute(
    "href",
    "https://crafters.aosankaku.net/@aosankaku",
  );

  for (const link of await footer.getByRole("link").all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
});
