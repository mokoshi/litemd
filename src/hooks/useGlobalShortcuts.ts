import { useEffect } from "react";
import type { EditorTab } from "../types";

type UseGlobalShortcutsParams = {
  activeTab: EditorTab | null;
  createNewFile: () => void;
  closeTab: (id: string) => void;
  openFiles: () => void;
  saveTab: (tab: EditorTab) => void;
  isTabSaving: (id: string) => boolean;
  switchActiveTab: (offset: number) => void;
  switchToTabIndex: (index: number) => void;
  toggleDiff: () => void;
  togglePreviewView: () => void;
};

export function useGlobalShortcuts({
  activeTab,
  closeTab,
  createNewFile,
  openFiles,
  isTabSaving,
  saveTab,
  switchActiveTab,
  switchToTabIndex,
  toggleDiff,
  togglePreviewView,
}: UseGlobalShortcutsParams) {
  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const hasPlainCommand = event.metaKey && !event.ctrlKey && !event.altKey;

      if (event.ctrlKey && !event.metaKey && !event.altKey && event.key === "Tab") {
        event.preventDefault();
        switchActiveTab(event.shiftKey ? -1 : 1);
        return;
      }

      if (hasPlainCommand && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        switchToTabIndex(Number(event.key) - 1);
        return;
      }

      if (hasPlainCommand && !event.shiftKey && key === "s") {
        event.preventDefault();
        if (!event.repeat && activeTab && !isTabSaving(activeTab.id)) {
          saveTab(activeTab);
        }
        return;
      }

      if (hasPlainCommand && !event.shiftKey && key === "w") {
        event.preventDefault();
        if (!event.repeat && activeTab) {
          closeTab(activeTab.id);
        }
        return;
      }

      if (hasPlainCommand && !event.shiftKey && key === "n") {
        event.preventDefault();
        if (!event.repeat) {
          createNewFile();
        }
        return;
      }

      if (hasPlainCommand && !event.shiftKey && key === "o") {
        event.preventDefault();
        if (!event.repeat) {
          openFiles();
        }
        return;
      }

      if (hasPlainCommand && event.shiftKey && event.key === "[") {
        event.preventDefault();
        switchActiveTab(-1);
        return;
      }

      if (hasPlainCommand && event.shiftKey && event.key === "]") {
        event.preventDefault();
        switchActiveTab(1);
        return;
      }

      if (hasPlainCommand && event.shiftKey && key === "d") {
        event.preventDefault();
        if (!event.repeat && activeTab) {
          toggleDiff();
        }
        return;
      }

      if (hasPlainCommand && event.shiftKey && key === "v") {
        event.preventDefault();
        if (!event.repeat && activeTab) {
          togglePreviewView();
        }
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [
    activeTab,
    closeTab,
    createNewFile,
    isTabSaving,
    openFiles,
    saveTab,
    switchActiveTab,
    switchToTabIndex,
    toggleDiff,
    togglePreviewView,
  ]);
}
