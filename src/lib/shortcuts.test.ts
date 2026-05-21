import { describe, expect, it } from "vitest";
import {
  isRepeatableShortcutIntent,
  shortcutIntentForEvent,
  type ShortcutIntent,
} from "./shortcuts";

function event(
  key: string,
  overrides: Partial<KeyboardEvent> = {},
): Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"> {
  return {
    altKey: false,
    ctrlKey: false,
    key,
    metaKey: true,
    shiftKey: false,
    ...overrides,
  };
}

describe("shortcuts", () => {
  it("maps command shortcuts to editor intents", () => {
    expect(shortcutIntentForEvent(event("s"))).toEqual({ type: "save" });
    expect(shortcutIntentForEvent(event("w"))).toEqual({ type: "close" });
    expect(shortcutIntentForEvent(event("n"))).toEqual({ type: "create" });
    expect(shortcutIntentForEvent(event("o"))).toEqual({ type: "open" });
    expect(shortcutIntentForEvent(event("d", { shiftKey: true }))).toEqual({
      type: "toggle-diff",
    });
    expect(shortcutIntentForEvent(event("v", { shiftKey: true }))).toEqual({
      type: "toggle-preview",
    });
  });

  it("maps tab navigation shortcuts", () => {
    expect(shortcutIntentForEvent(event("Tab", { ctrlKey: true, metaKey: false })))
      .toEqual({ type: "switch-tab", offset: 1 });
    expect(
      shortcutIntentForEvent(
        event("Tab", { ctrlKey: true, metaKey: false, shiftKey: true }),
      ),
    ).toEqual({ type: "switch-tab", offset: -1 });
    expect(shortcutIntentForEvent(event("3"))).toEqual({
      type: "switch-tab-index",
      index: 2,
    });
    expect(shortcutIntentForEvent(event("[", { shiftKey: true }))).toEqual({
      type: "switch-tab",
      offset: -1,
    });
  });

  it("ignores modified or unknown key combinations", () => {
    expect(shortcutIntentForEvent(event("s", { altKey: true }))).toBeNull();
    expect(shortcutIntentForEvent(event("s", { shiftKey: true }))).toBeNull();
    expect(shortcutIntentForEvent(event("0"))).toBeNull();
  });

  it("only treats tab switching as repeatable", () => {
    const repeatable: ShortcutIntent = { type: "switch-tab", offset: 1 };
    const singleShot: ShortcutIntent = { type: "save" };

    expect(isRepeatableShortcutIntent(repeatable)).toBe(true);
    expect(isRepeatableShortcutIntent(singleShot)).toBe(false);
  });
});
