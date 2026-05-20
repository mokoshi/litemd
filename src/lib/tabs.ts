import type { EditorTab, FileContent, GitDiffContext } from "../types";

export function tabId(path: string) {
  return `file:${path}`;
}

export function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export function saveStateLabel(tab: EditorTab) {
  if (tab.saveState === "saving") {
    return "Saving";
  }

  if (tab.saveState === "dirty") {
    return "Modified";
  }

  if (tab.saveState === "error") {
    return "Save failed";
  }

  if (tab.gitContext?.is_git) {
    return tab.gitContext.is_new_file ? "Saved, new file in git" : "Saved, git diff available";
  }

  return "Saved";
}

export function savedTabFromFile(
  file: FileContent,
  gitContext: GitDiffContext,
  status?: string,
): EditorTab {
  const tab: EditorTab = {
    id: tabId(file.path),
    path: file.path,
    title: fileName(file.path),
    content: file.contents,
    savedContent: file.contents,
    fileSignature: file.signature,
    mode: "preview",
    layout: "split",
    diffLayout: "sideBySide",
    gitContext,
    saveState: "saved",
    status: "",
  };

  return {
    ...tab,
    status: status ?? saveStateLabel(tab),
  };
}
