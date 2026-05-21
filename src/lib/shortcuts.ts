export type ShortcutIntent =
  | { type: "close" }
  | { type: "create" }
  | { type: "open" }
  | { type: "save" }
  | { type: "switch-tab"; offset: number }
  | { type: "switch-tab-index"; index: number }
  | { type: "toggle-diff" }
  | { type: "toggle-preview" };

type KeyboardShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export function shortcutIntentForEvent(
  event: KeyboardShortcutEvent,
): ShortcutIntent | null {
  const key = event.key.toLowerCase();
  const hasPlainCommand = event.metaKey && !event.ctrlKey && !event.altKey;

  if (event.ctrlKey && !event.metaKey && !event.altKey && event.key === "Tab") {
    return { type: "switch-tab", offset: event.shiftKey ? -1 : 1 };
  }

  if (hasPlainCommand && /^[1-9]$/.test(event.key)) {
    return { type: "switch-tab-index", index: Number(event.key) - 1 };
  }

  if (hasPlainCommand && !event.shiftKey && key === "s") {
    return { type: "save" };
  }

  if (hasPlainCommand && !event.shiftKey && key === "w") {
    return { type: "close" };
  }

  if (hasPlainCommand && !event.shiftKey && key === "n") {
    return { type: "create" };
  }

  if (hasPlainCommand && !event.shiftKey && key === "o") {
    return { type: "open" };
  }

  if (hasPlainCommand && event.shiftKey && event.key === "[") {
    return { type: "switch-tab", offset: -1 };
  }

  if (hasPlainCommand && event.shiftKey && event.key === "]") {
    return { type: "switch-tab", offset: 1 };
  }

  if (hasPlainCommand && event.shiftKey && key === "d") {
    return { type: "toggle-diff" };
  }

  if (hasPlainCommand && event.shiftKey && key === "v") {
    return { type: "toggle-preview" };
  }

  return null;
}

export function isRepeatableShortcutIntent(intent: ShortcutIntent) {
  return intent.type === "switch-tab" || intent.type === "switch-tab-index";
}
