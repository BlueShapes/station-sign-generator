export interface TextInputKeyboardEvent {
  key: string;
  nativeEvent: {
    isComposing?: boolean;
    keyCode?: number;
  };
}

/**
 * Returns true only for an Enter key that is not being used to confirm IME
 * composition. keyCode 229 covers browsers that clear isComposing too early.
 */
export function shouldSubmitTextInput(event: TextInputKeyboardEvent): boolean {
  return (
    event.key === "Enter" &&
    !event.nativeEvent.isComposing &&
    event.nativeEvent.keyCode !== 229
  );
}
