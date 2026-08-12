import { expect, test } from "@playwright/test";
import { JR_EAST_BRANCH_LAYOUT } from "../src/components/signs/jrEastBranchLayout";

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

const THREE_CHOICE_SIGN_DATA = {
  ...TWO_CHOICE_SIGN_DATA,
  left: [
    {
      ...TWO_CHOICE_SIGN_DATA.left[0],
      arrowColor: "#3030ff",
    },
    {
      ...TWO_CHOICE_SIGN_DATA.left[1],
      arrowColor: "#f00000",
    },
    {
      ...TWO_CHOICE_SIGN_DATA.left[0],
      id: "third-branch",
      primaryName: "Third",
      secondaryName: "Third branch",
      numberPrimaryValue: "05",
      arrowColor: "#00adbd",
    },
  ],
};

const THREE_AND_TWO_CHOICE_SIGN_DATA = {
  ...THREE_CHOICE_SIGN_DATA,
  right: [
    {
      ...TWO_CHOICE_SIGN_DATA.right[0],
      arrowColor: "#3030ff",
    },
    {
      ...TWO_CHOICE_SIGN_DATA.right[0],
      id: "second-right-branch",
      primaryName: "Second",
      secondaryName: "Second branch",
      numberPrimaryValue: "10",
      arrowColor: "#ff7000",
    },
  ],
};

const THREE_NUMBER_BADGE_DATA = {
  ...TWO_CHOICE_SIGN_DATA,
  numberSecondaryPrefix: "JS",
  numberSecondaryValue: "08",
  numberTertiaryPrefix: "JT",
  numberTertiaryValue: "08",
  localLines: [
    ...TWO_CHOICE_SIGN_DATA.localLines,
    { id: "secondary-line", prefix: "JS", color: "#0066ff" },
    { id: "tertiary-line", prefix: "JT", color: "#ff00ff" },
  ],
};

async function setSignStyle(
  page: import("@playwright/test").Page,
  style: "jreast" | "jreastbranch",
  data = TWO_CHOICE_SIGN_DATA,
) {
  await page.evaluate(
    ({ data, selectedStyle }) => {
      sessionStorage.setItem("sign-config-v1", JSON.stringify(data));
      sessionStorage.setItem("sign-style-v1", selectedStyle);
    },
    { data, selectedStyle: style },
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

test("only the branch style renders a third current-station number badge", async ({
  page,
}) => {
  await page.goto("/");

  const countTertiaryBadgePixels = async () => {
    const preview = page.locator('img[src^="data:image/png"]').first();
    await preview.waitFor({ state: "visible" });
    return preview.evaluate((element) => {
      const image = element as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context is unavailable");
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      let matches = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (
          pixels[index] === 255 &&
          pixels[index + 1] === 0 &&
          pixels[index + 2] === 255
        ) {
          matches += 1;
        }
      }
      return matches;
    });
  };

  await setSignStyle(page, "jreastbranch", THREE_NUMBER_BADGE_DATA);
  await expect.poll(countTertiaryBadgePixels).toBeGreaterThan(0);

  await setSignStyle(page, "jreast", THREE_NUMBER_BADGE_DATA);
  await expect.poll(countTertiaryBadgePixels).toBe(0);
});

test("consecutive JR East badges share one three-letter-code frame", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  const longestBadgeHeaderRun = async () => {
    const preview = page.locator('img[src^="data:image/png"]').first();
    await preview.waitFor({ state: "visible" });
    return preview.evaluate((element) => {
      const image = element as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas context is unavailable");
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let longest = 0;

      // The current-station badge header occupies reference y=21..33. The
      // exported preview uses the standard 3x canvas scale.
      for (let y = 63; y <= 90; y += 1) {
        let current = 0;
        for (let x = 0; x < canvas.width; x += 1) {
          const index = (y * canvas.width + x) * 4;
          const isBlack =
            pixels[index] < 20 &&
            pixels[index + 1] < 20 &&
            pixels[index + 2] < 20;
          current = isBlack ? current + 1 : 0;
          longest = Math.max(longest, current);
        }
      }
      return longest;
    });
  };

  await setSignStyle(page, "jreast", TWO_CHOICE_SIGN_DATA);
  await expect.poll(longestBadgeHeaderRun).toBeGreaterThan(100);
  await expect.poll(longestBadgeHeaderRun).toBeLessThan(150);
  await page.locator('img[src^="data:image/png"]').first().screenshot({
    path: testInfo.outputPath("single-jr-east-badge.png"),
  });

  await setSignStyle(page, "jreast", THREE_NUMBER_BADGE_DATA);
  await expect.poll(longestBadgeHeaderRun).toBeGreaterThan(190);

  await setSignStyle(page, "jreastbranch", THREE_NUMBER_BADGE_DATA);
  await expect.poll(longestBadgeHeaderRun).toBeGreaterThan(290);
  await page.locator('img[src^="data:image/png"]').first().screenshot({
    path: testInfo.outputPath("three-connected-jr-east-badges.png"),
  });
});

test("three-choice branch signs add vertical room without changing width", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await setSignStyle(page, "jreastbranch");

  const preview = page.locator('img[src^="data:image/png"]').first();
  await preview.waitFor({ state: "visible" });
  const twoChoiceSize = await preview.evaluate((element) => {
    const image = element as HTMLImageElement;
    return { width: image.naturalWidth, height: image.naturalHeight };
  });

  const threeChoicePage = await context.newPage();
  await threeChoicePage.goto("/");
  await setSignStyle(
    threeChoicePage,
    "jreastbranch",
    THREE_CHOICE_SIGN_DATA,
  );
  const threeChoicePreview = threeChoicePage
    .locator('img[src^="data:image/png"]')
    .first();
  await threeChoicePreview.waitFor({ state: "visible" });
  const expectedThreeChoiceHeight =
    twoChoiceSize.height + JR_EAST_BRANCH_LAYOUT.threeBranchHeightIncrease * 3;
  await expect.poll(() =>
    threeChoicePreview.evaluate(
      (element) => (element as HTMLImageElement).naturalHeight,
    )
  ).toBe(expectedThreeChoiceHeight);
  const threeChoiceSize = await threeChoicePreview.evaluate((element) => {
    const image = element as HTMLImageElement;
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(threeChoiceSize.width).toBe(twoChoiceSize.width);
  expect(threeChoiceSize.height).toBe(expectedThreeChoiceHeight);
});

test("a three-branch side makes the opposite center line thin", async ({
  page,
}) => {
  await page.goto("/");

  const cases = [
    {
      data: THREE_CHOICE_SIGN_DATA,
      expectedRightPriorityColor: [58, 146, 0],
      expectedUpperRightRootColor: [255, 255, 255],
    },
    {
      data: THREE_AND_TWO_CHOICE_SIGN_DATA,
      expectedRightPriorityColor: [48, 48, 255],
      // A two-branch diagonal uses the thicker three-branch geometry when the
      // opposite side has three branches, so its upper root reaches this pixel.
      expectedUpperRightRootColor: [48, 48, 255],
    },
  ];

  for (const {
    data,
    expectedRightPriorityColor,
    expectedUpperRightRootColor,
  } of cases) {
    await setSignStyle(page, "jreastbranch", data);
    const preview = page.locator('img[src^="data:image/png"]').first();
    await preview.waitFor({ state: "visible" });

    const pixels = await preview.evaluate((element) => {
      const image = element as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context is unavailable");
      context.drawImage(image, 0, 0);

      const scale = image.naturalWidth / (140 * 3.5);
      const readPixel = (x: number, y: number) =>
        Array.from(
          context.getImageData(
            Math.round(x * scale),
            Math.round(y * scale),
            1,
            1,
          ).data,
        );

      return {
        outsideThinLine: readPixel(275, 77),
        upperRightRoot: readPixel(354, 76),
        leftPriorityTrunk: readPixel(200, 88),
        leftPriorityRoot: readPixel(136, 88),
        rightPriorityTrunk: readPixel(275, 88),
        rightPriorityRoot: readPixel(354, 88),
      };
    });

    expect(pixels.outsideThinLine.slice(0, 3)).toEqual([255, 255, 255]);
    expect(pixels.upperRightRoot.slice(0, 3)).toEqual(
      expectedUpperRightRootColor,
    );
    expect(pixels.leftPriorityTrunk.slice(0, 3)).toEqual([240, 0, 0]);
    expect(pixels.leftPriorityRoot.slice(0, 3)).toEqual([240, 0, 0]);
    expect(pixels.rightPriorityTrunk.slice(0, 3)).toEqual(
      expectedRightPriorityColor,
    );
    expect(pixels.rightPriorityRoot.slice(0, 3)).toEqual(
      expectedRightPriorityColor,
    );
  }
});
