import { describe, expect, test } from "bun:test";
import { shouldSubmitTextInput } from "../src/components/tabs/imeSubmit.ts";

function keyboardEvent({
  key = "Enter",
  isComposing = false,
  keyCode = 13,
} = {}) {
  return {
    key,
    nativeEvent: { isComposing, keyCode },
  };
}

describe("shouldSubmitTextInput", () => {
  test("submits a regular Enter key", () => {
    expect(shouldSubmitTextInput(keyboardEvent())).toBe(true);
  });

  test("does not submit Enter while IME composition is active", () => {
    expect(
      shouldSubmitTextInput(keyboardEvent({ isComposing: true })),
    ).toBe(false);
  });

  test("treats legacy keyCode 229 as IME composition", () => {
    expect(shouldSubmitTextInput(keyboardEvent({ keyCode: 229 }))).toBe(false);
  });

  test("does not submit non-Enter keys", () => {
    expect(shouldSubmitTextInput(keyboardEvent({ key: "Space" }))).toBe(false);
  });
});
