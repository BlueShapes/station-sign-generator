import { expect, test } from "@playwright/test";

const TWO_CHOICE_SIGN_DATA = {
  primaryName: "香取",
  primaryNameFurigana: "かとり",
  secondaryName: "Katori",
  tertiaryName: "카토리",
  quaternaryName: "香取",
  numberPrimaryPrefix: "JO",
  numberPrimaryValue: "08",
  threeLetterCode: "KTR",
  left: [
    {
      id: "suigo",
      primaryName: "水郷",
      secondaryName: "Suigō",
      arrowColor: "#3a9200",
      numberPrimaryPrefix: "JO",
      numberPrimaryValue: "07",
    },
    {
      id: "junikyo",
      primaryName: "十二橋",
      secondaryName: "Jūnikyō",
      arrowColor: "#3a9200",
      numberPrimaryPrefix: "JO",
      numberPrimaryValue: "06",
    },
  ],
  right: [
    {
      id: "sawara",
      primaryName: "佐原",
      secondaryName: "Sawara",
      arrowColor: "#3a9200",
      numberPrimaryPrefix: "JO",
      numberPrimaryValue: "09",
    },
  ],
  baseColor: "#3a9200",
  centerSquareColors: ["#3a9200"],
  localLines: [{ id: "line", prefix: "JO", color: "#007ac0" }],
  ratio: 3.5,
  direction: "both",
};

async function setSignStyle(
  page: import("@playwright/test").Page,
  style: "jreast" | "jreastbranch",
) {
  await page.evaluate(
    ({ data, selectedStyle }) => {
      sessionStorage.setItem("sign-config-v1", JSON.stringify(data));
      sessionStorage.setItem("sign-style-v1", selectedStyle);
    },
    { data: TWO_CHOICE_SIGN_DATA, selectedStyle: style },
  );
  await page.reload();
}

test("two-choice branch signs keep the standard JR East image ratio", async ({
  page,
}) => {
  await page.goto("/");
  await setSignStyle(page, "jreastbranch");

  const branchPreview = page.locator('img[src^="data:image/png"]').first();
  await branchPreview.waitFor({ state: "visible" });
  const branchSize = await branchPreview.evaluate((element) => {
    const image = element as HTMLImageElement;
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  await setSignStyle(page, "jreast");
  const standardPreview = page.locator('img[src^="data:image/png"]').first();
  await standardPreview.waitFor({ state: "visible" });
  const standardSize = await standardPreview.evaluate((element) => {
    const image = element as HTMLImageElement;
    return { width: image.naturalWidth, height: image.naturalHeight };
  });

  expect(branchSize).toEqual(standardSize);
  expect(branchSize.width / branchSize.height).toBeCloseTo(3.5);
});
