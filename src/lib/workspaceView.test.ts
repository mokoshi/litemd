import { describe, expect, it } from "vitest";
import {
  canUseWorkspaceView,
  nextDiffToggleView,
  nextPreviewToggleView,
  normalizeWorkspaceView,
  workspaceViewFromStoredValue,
} from "./workspaceView";
import type { EditorTab, GitDiffContext } from "../types";

const nonGitContext: GitDiffContext = {
  is_git: false,
  repo_root: null,
  relative_path: null,
  head_content: null,
  is_new_file: false,
  error: null,
};

const gitContext: GitDiffContext = {
  ...nonGitContext,
  is_git: true,
  repo_root: "/repo",
  relative_path: "README.md",
  head_content: "",
};

function tab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    id: "file:/repo/README.md",
    path: "/repo/README.md",
    title: "README.md",
    content: "",
    savedContent: "",
    fileSignature: { modified_ms: null, len: 0 },
    view: "split",
    gitContext,
    saveState: "saved",
    status: "Saved",
    ...overrides,
  };
}

describe("workspace views", () => {
  it("only allows diff when git context is available", () => {
    expect(canUseWorkspaceView("preview", null)).toBe(true);
    expect(canUseWorkspaceView("diff", null)).toBe(false);
    expect(canUseWorkspaceView("diff", nonGitContext)).toBe(false);
    expect(canUseWorkspaceView("diff", gitContext)).toBe(true);
  });

  it("normalizes unavailable diff views to split", () => {
    expect(normalizeWorkspaceView("diff", nonGitContext)).toBe("split");
    expect(normalizeWorkspaceView("diff", gitContext)).toBe("diff");
  });

  it("reads current and legacy stored view values", () => {
    expect(workspaceViewFromStoredValue({ view: "preview" })).toBe("preview");
    expect(workspaceViewFromStoredValue({ mode: "diff" })).toBe("diff");
    expect(workspaceViewFromStoredValue({ layout: "previewOnly" })).toBe(
      "preview",
    );
    expect(workspaceViewFromStoredValue({ view: "unknown" })).toBe("split");
  });

  it("keeps view toggles independent from React state", () => {
    expect(nextPreviewToggleView("split")).toBe("preview");
    expect(nextPreviewToggleView("preview")).toBe("split");
    expect(nextDiffToggleView(tab({ view: "split" }))).toBe("diff");
    expect(nextDiffToggleView(tab({ view: "diff" }))).toBe("split");
    expect(nextDiffToggleView(tab({ gitContext: nonGitContext }))).toBeNull();
  });
});
