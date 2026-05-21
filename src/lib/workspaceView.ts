import type { EditorTab, GitDiffContext, WorkspaceView } from "../types";

export const DEFAULT_WORKSPACE_VIEW: WorkspaceView = "split";

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return value === "split" || value === "preview" || value === "diff";
}

export function canUseWorkspaceView(
  view: WorkspaceView,
  gitContext: GitDiffContext | null,
) {
  return view !== "diff" || Boolean(gitContext?.is_git);
}

export function normalizeWorkspaceView(
  view: WorkspaceView,
  gitContext: GitDiffContext | null,
) {
  return canUseWorkspaceView(view, gitContext) ? view : DEFAULT_WORKSPACE_VIEW;
}

export function workspaceViewFromStoredValue(candidate: {
  view?: unknown;
  mode?: unknown;
  layout?: unknown;
}): WorkspaceView {
  if (isWorkspaceView(candidate.view)) {
    return candidate.view;
  }

  if (candidate.mode === "diff") {
    return "diff";
  }

  return candidate.layout === "previewOnly" ? "preview" : DEFAULT_WORKSPACE_VIEW;
}

export function nextPreviewToggleView(currentView: WorkspaceView) {
  return currentView === "preview" ? DEFAULT_WORKSPACE_VIEW : "preview";
}

export function nextDiffToggleView(tab: EditorTab) {
  if (tab.view === "diff") {
    return DEFAULT_WORKSPACE_VIEW;
  }

  return canUseWorkspaceView("diff", tab.gitContext) ? "diff" : null;
}
