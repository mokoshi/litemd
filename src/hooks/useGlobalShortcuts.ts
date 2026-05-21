import { useEffect } from "react";
import {
  isRepeatableShortcutIntent,
  shortcutIntentForEvent,
} from "../lib/shortcuts";
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
      const intent = shortcutIntentForEvent(event);
      if (!intent) {
        return;
      }

      event.preventDefault();
      if (event.repeat && !isRepeatableShortcutIntent(intent)) {
        return;
      }

      switch (intent.type) {
        case "switch-tab":
          switchActiveTab(intent.offset);
          return;
        case "switch-tab-index":
          switchToTabIndex(intent.index);
          return;
        case "save":
          if (activeTab && !isTabSaving(activeTab.id)) {
            saveTab(activeTab);
          }
          return;
        case "close":
          if (activeTab) {
            closeTab(activeTab.id);
          }
          return;
        case "create":
          createNewFile();
          return;
        case "open":
          openFiles();
          return;
        case "toggle-diff":
          if (activeTab) {
            toggleDiff();
          }
          return;
        case "toggle-preview":
          if (activeTab) {
            togglePreviewView();
          }
          return;
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
