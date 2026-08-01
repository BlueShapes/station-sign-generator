import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import YAML from "yaml";

const workflow = YAML.parse(
  readFileSync(".github/workflows/bump-version.yml", "utf8"),
);

describe("bump version workflow", () => {
  test("runs for main pushes while ignoring automation-only files", () => {
    expect(workflow.on.push.branches).toEqual(["main"]);
    expect(workflow.on.push["paths-ignore"]).toEqual([
      "*.md",
      ".github/workflows/bump-version.yml",
      "scripts/bump-version*.test.mjs",
    ]);
  });

  test("updates only the application version source", () => {
    const commitStep = workflow.jobs["bump-version"].steps.find(
      (step) => step.name === "Commit version",
    );

    expect(commitStep.run).toContain("git add src/config.ts");
  });

  test("fast-forwards dev after committing the main version", () => {
    const syncStep = workflow.jobs["bump-version"].steps.find(
      (step) => step.name === "Synchronize dev",
    );

    expect(syncStep.run).toContain("git fetch origin dev");
    expect(syncStep.run).toContain("git merge-base --is-ancestor origin/dev HEAD");
    expect(syncStep.run).toContain("git push origin HEAD:dev");
  });
});
