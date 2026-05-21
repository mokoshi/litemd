import { describe, expect, it } from "vitest";
import {
  applyEditorContent,
  applyExternalReload,
  applySavedContent,
  closeTabState,
  upsertTab,
} from "./tabState";
import type { EditorTab, FileContent, GitDiffContext } from "../types";

const gitContext: GitDiffContext = {
  is_git: false,
  repo_root: null,
  relative_path: null,
  head_content: null,
  is_new_file: false,
  error: null,
};

function tab(path: string, overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    id: `file:${path}`,
    path,
    title: path.split("/").pop() ?? path,
    content: "saved",
    savedContent: "saved",
    fileSignature: { modified_ms: 1, len: 5 },
    view: "split",
    gitContext,
    saveState: "saved",
    status: "Saved",
    ...overrides,
  };
}

describe("tab state", () => {
  it("keeps existing open tabs unless replacement is requested", () => {
    const original = tab("/tmp/a.md", { content: "draft" });
    const replacement = tab("/tmp/a.md", { content: "disk" });

    expect(upsertTab([original], replacement)).toEqual([original]);
    expect(upsertTab([original], replacement, { replaceExisting: true })).toEqual([
      replacement,
    ]);
  });

  it("keeps a tab dirty when content changes while save is in flight", () => {
    const tabs = [
      tab("/tmp/a.md", {
        content: "newer draft",
        savedContent: "old",
        saveState: "saving",
      }),
    ];

    const next = applySavedContent(
      tabs,
      "file:/tmp/a.md",
      "saved by request",
      { modified_ms: 2, len: 16 },
      gitContext,
    );

    expect(next[0]).toMatchObject({
      content: "newer draft",
      savedContent: "saved by request",
      saveState: "dirty",
      status: "Modified",
    });
  });

  it("does not overwrite local edits during external reload", () => {
    const tabs = [
      tab("/tmp/a.md", {
        content: "local draft",
        savedContent: "saved",
        saveState: "dirty",
      }),
    ];
    const file: FileContent = {
      path: "/tmp/a.md",
      contents: "external",
      signature: { modified_ms: 2, len: 8 },
    };

    const next = applyExternalReload(tabs, "file:/tmp/a.md", file, gitContext, {
      isSaveInFlight: false,
    });

    expect(next[0]).toMatchObject({
      content: "local draft",
      savedContent: "saved",
      saveState: "dirty",
      status: "External change detected; local edits pending",
    });
  });

  it("tracks dirty and saved editor content", () => {
    expect(applyEditorContent([tab("/tmp/a.md")], "file:/tmp/a.md", "draft")[0])
      .toMatchObject({
        content: "draft",
        saveState: "dirty",
        status: "Modified",
      });

    expect(applyEditorContent([tab("/tmp/a.md")], "file:/tmp/a.md", "saved")[0])
      .toMatchObject({
        content: "saved",
        saveState: "saved",
        status: "Saved",
      });
  });

  it("selects the previous tab after closing the active tab", () => {
    const tabs = [tab("/tmp/a.md"), tab("/tmp/b.md"), tab("/tmp/c.md")];

    expect(closeTabState(tabs, "file:/tmp/c.md", "file:/tmp/c.md")).toEqual({
      tabs: [tabs[0], tabs[1]],
      activeTabId: "file:/tmp/b.md",
    });
  });
});
