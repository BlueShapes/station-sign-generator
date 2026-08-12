import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import YAML from "yaml";

const workflow = YAML.parse(
  readFileSync(".github/workflows/bump-version.yml", "utf8"),
);

describe("bump version workflow", () => {
  test("runs for every main push so dev is always synchronized", () => {
    expect(workflow.on.push.branches).toEqual(["main"]);
    expect(workflow.on.push["paths-ignore"]).toBeUndefined();
  });

  test("skips the version bump for automation-only files", () => {
    const changesStep = workflow.jobs["bump-version"].steps.find(
      (step) => step.name === "Determine whether to bump version",
    );
    const incrementStep = workflow.jobs["bump-version"].steps.find(
      (step) => step.name === "Increment version",
    );

    expect(changesStep.run).toContain("*.md|.github/workflows/bump-version.yml");
    expect(changesStep.run).toContain("scripts/bump-version*.test.mjs");
    expect(incrementStep.if).toBe(
      "steps.changes.outputs.should-bump == 'true'",
    );
  });

  test("updates only the application version source", () => {
    const commitStep = workflow.jobs["bump-version"].steps.find(
      (step) => step.name === "Commit version",
    );

    expect(commitStep.run).toContain("git add src/config.ts");
    expect(commitStep.if).toBe(
      "steps.changes.outputs.should-bump == 'true'",
    );
  });

  test("fast-forwards dev after committing the main version", () => {
    const syncStep = workflow.jobs["bump-version"].steps.find(
      (step) => step.name === "Synchronize dev",
    );

    expect(syncStep.run).toContain("git fetch origin dev");
    expect(syncStep.run).toContain("git merge-base --is-ancestor origin/dev HEAD");
    expect(syncStep.run).toContain("git push origin HEAD:dev");
    expect(syncStep.if).toBeUndefined();
  });
});
