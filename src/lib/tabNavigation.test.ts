import { describe, expect, it } from "vitest";
import {
  activeTabIdAfterRestore,
  findTab,
  tabIdAtIndex,
  tabIdAtOffset,
} from "./tabNavigation";
import type { EditorTab } from "../types";

function tab(path: string): EditorTab {
  return {
    id: `file:${path}`,
    path,
    title: path,
    content: "",
    savedContent: "",
    fileSignature: { modified_ms: null, len: 0 },
    mode: "preview",
    layout: "split",
    diffLayout: "sideBySide",
    gitContext: null,
    saveState: "saved",
    status: "Saved",
  };
}

describe("tab navigation", () => {
  const tabs = [tab("/tmp/a.md"), tab("/tmp/b.md"), tab("/tmp/c.md")];

  it("finds active tabs safely", () => {
    expect(findTab(tabs, "file:/tmp/b.md")).toBe(tabs[1]);
    expect(findTab(tabs, "missing")).toBeNull();
    expect(findTab(tabs, null)).toBeNull();
  });

  it("restores the previous active path when available", () => {
    expect(activeTabIdAfterRestore(tabs, "/tmp/b.md")).toBe("file:/tmp/b.md");
    expect(activeTabIdAfterRestore(tabs, "/tmp/missing.md")).toBe("file:/tmp/a.md");
    expect(activeTabIdAfterRestore([], "/tmp/a.md")).toBeNull();
  });

  it("wraps offset navigation", () => {
    expect(tabIdAtOffset(tabs, "file:/tmp/a.md", -1)).toBe("file:/tmp/c.md");
    expect(tabIdAtOffset(tabs, "file:/tmp/c.md", 1)).toBe("file:/tmp/a.md");
    expect(tabIdAtOffset(tabs, "missing", 1)).toBe("file:/tmp/b.md");
    expect(tabIdAtOffset([], null, 1)).toBeNull();
  });

  it("reads numeric tab shortcuts", () => {
    expect(tabIdAtIndex(tabs, 1)).toBe("file:/tmp/b.md");
    expect(tabIdAtIndex(tabs, 9)).toBeNull();
  });
});

