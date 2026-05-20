import type {
  EditorTab,
  FileContent,
  FileSignature,
  GitDiffContext,
  SaveState,
} from "../types";
import { fileName, saveStateLabel } from "./tabs";

export function upsertTab(
  tabs: EditorTab[],
  nextTab: EditorTab,
  options: { replaceExisting?: boolean } = {},
) {
  const existingIndex = tabs.findIndex((tab) => tab.id === nextTab.id);
  if (existingIndex === -1) {
    return [...tabs, nextTab];
  }

  if (!options.replaceExisting) {
    return tabs;
  }

  return tabs.map((tab) => (tab.id === nextTab.id ? nextTab : tab));
}

export function updateTab(
  tabs: EditorTab[],
  id: string,
  updater: (tab: EditorTab) => EditorTab,
) {
  return tabs.map((tab) => (tab.id === id ? updater(tab) : tab));
}

export function markTabSaving(tabs: EditorTab[], id: string) {
  return updateTab(tabs, id, (tab) => ({
    ...tab,
    saveState: "saving",
    status: "Saving",
  }));
}

export function markTabError(tabs: EditorTab[], id: string, error: unknown) {
  return updateTab(tabs, id, (tab) => ({
    ...tab,
    saveState: "error",
    status: error instanceof Error ? error.message : String(error),
  }));
}

export function applySavedContent(
  tabs: EditorTab[],
  id: string,
  savedContent: string,
  fileSignature: FileSignature,
  gitContext: GitDiffContext,
) {
  return updateTab(tabs, id, (tab) => {
    const saveState: SaveState =
      tab.content === savedContent ? "saved" : "dirty";

    return {
      ...tab,
      savedContent,
      fileSignature,
      gitContext,
      saveState,
      status:
        saveState === "saved"
          ? saveStateLabel({ ...tab, gitContext, saveState })
          : "Modified",
    };
  });
}

export function applyExternalReload(
  tabs: EditorTab[],
  id: string,
  file: FileContent,
  gitContext: GitDiffContext,
  options: { isSaveInFlight: boolean },
) {
  return updateTab(tabs, id, (tab) => {
    if (
      tab.content !== tab.savedContent ||
      tab.saveState === "saving" ||
      options.isSaveInFlight
    ) {
      return {
        ...tab,
        status: "External change detected; local edits pending",
      };
    }

    return {
      ...tab,
      path: file.path,
      title: fileName(file.path),
      content: file.contents,
      savedContent: file.contents,
      fileSignature: file.signature,
      gitContext,
      saveState: "saved",
      status: "Reloaded external changes",
    };
  });
}

export function applyEditorContent(
  tabs: EditorTab[],
  id: string,
  content: string,
) {
  return updateTab(tabs, id, (tab) => {
    const saveState: SaveState =
      content === tab.savedContent ? "saved" : "dirty";

    return {
      ...tab,
      content,
      saveState,
      status:
        saveState === "saved"
          ? saveStateLabel({ ...tab, content, saveState })
          : "Modified",
    };
  });
}

export function closeTabState(
  tabs: EditorTab[],
  activeTabId: string | null,
  id: string,
) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index === -1) {
    return { tabs, activeTabId };
  }

  const nextTabs = tabs.filter((tab) => tab.id !== id);
  if (activeTabId !== id) {
    return { tabs: nextTabs, activeTabId };
  }

  const nextActiveTab = nextTabs[Math.max(0, index - 1)] ?? nextTabs[0] ?? null;
  return {
    tabs: nextTabs,
    activeTabId: nextActiveTab?.id ?? null,
  };
}
