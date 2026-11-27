import type { KeyboardEvent } from "react";

/**
 * Jewel chat composer keys (Jessica, 2026-11-26): pressing Enter in a
 * Jewel chat SENDS the message — it must act as Enter, not just move to a
 * new line. The send goes through the composer's own form submit, so it
 * lands on exactly the same path, with exactly the same guards, as
 * clicking the composer's send button. Shift+Enter keeps the newline so
 * multi-line messages stay possible. While an IME composition is in
 * progress, Enter confirms the composition instead of sending
 * (isComposing, or the legacy 229 keyCode some IMEs report).
 */
export function jewelComposerEnter(event: KeyboardEvent<HTMLTextAreaElement>): void {
  if (event.key !== "Enter" || event.shiftKey) return;
  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}
