import { useCallback, useEffect, useMemo, useState } from "react";
import { useEditorTabEffects } from "./useTabLifecycleEffects";
import { useEditorFileCommands } from "./useEditorFileCommands";
import { useTabFileSync } from "./useTabFileSync";
import { loadTabsFromSession } from "../lib/editorTabIO";
import {
  createSessionSnapshot,
  readStoredSession,
} from "../lib/session";
import {
  applyEditorContent,
  closeCleanTabInState,
  closeTabInState,
  type EditorTabsState,
  replaceTabsState,
  setActiveTabState,
  updateTabInState,
} from "../lib/tabState";
import {
  activeTabIdAfterRestore,
  findTab,
  tabIdAtIndex,
  tabIdAtOffset,
} from "../lib/tabNavigation";
import {
  canUseWorkspaceView,
  nextDiffToggleView,
  nextPreviewToggleView,
  normalizeWorkspaceView,
} from "../lib/workspaceView";
import type {
  EditorTab,
  WorkspaceView,
} from "../types";

export function useEditorTabs() {
  const [tabState, setTabState] = useState<EditorTabsState>({
    tabs: [],
    activeTabId: null,
  });
  const [isSessionRestored, setIsSessionRestored] = useState(false);
  const {
    isTabSaving,
    reloadTabIfExternallyChanged,
    reloadingIds,
    saveTab,
    savingIds,
  } = useTabFileSync(setTabState);
  const {
    createNewFile,
    isOpening,
    openFiles,
    openFilesFromPaths,
  } = useEditorFileCommands(setTabState);
  const { activeTabId, tabs } = tabState;

  const activeTab = useMemo(
    () => findTab(tabs, activeTabId),
    [activeTabId, tabs],
  );
  const canShowDiff = Boolean(
    activeTab && canUseWorkspaceView("diff", activeTab.gitContext),
  );
  const diffBase = activeTab?.gitContext?.head_content ?? "";
  const sessionSnapshot = useMemo(
    () => createSessionSnapshot(tabs, activeTab?.path ?? null),
    [activeTab?.path, tabs],
  );

  const restoreSavedSession = useCallback(async () => {
    const session = readStoredSession();
    if (!session || session.tabs.length === 0) {
      return;
    }

    const restoredTabs = await loadTabsFromSession(session);
    if (restoredTabs.length === 0) {
      return;
    }

    setTabState(
      replaceTabsState(
        restoredTabs,
        activeTabIdAfterRestore(restoredTabs, session.activePath),
      ),
    );
  }, []);

  const closeTab = useCallback(
    async (id: string) => {
      const tab = tabs.find((item) => item.id === id);
      if (!tab) {
        setTabState((current) => closeTabInState(current, id));
        return;
      }

      if (tab.content === tab.savedContent) {
        setTabState((current) => closeTabInState(current, id));
        return;
      }

      const result = await saveTab(tab);
      if (result.ok) {
        setTabState((current) =>
          closeCleanTabInState(current, id, result.savedContent),
        );
      }
    },
    [saveTab, tabs],
  );

  const updateActiveTab = useCallback(
    (updater: (tab: EditorTab) => EditorTab) => {
      if (!activeTabId) {
        return;
      }

      setTabState((current) =>
        updateTabInState(current, activeTabId, updater),
      );
    },
    [activeTabId],
  );

  const setActiveTabId = useCallback((id: string | null) => {
    setTabState((current) => setActiveTabState(current, id));
  }, []);

  const setActiveView = useCallback(
    (view: WorkspaceView) => {
      updateActiveTab((tab) => ({
        ...tab,
        view: normalizeWorkspaceView(view, tab.gitContext),
      }));
    },
    [updateActiveTab],
  );

  const togglePreviewView = useCallback(() => {
    updateActiveTab((tab) => ({
      ...tab,
      view: nextPreviewToggleView(tab.view),
    }));
  }, [updateActiveTab]);

  const toggleDiff = useCallback(() => {
    if (!activeTab) {
      return;
    }

    const nextView = nextDiffToggleView(activeTab);
    if (nextView) {
      setActiveView(nextView);
    }
  }, [activeTab, setActiveView]);

  const switchActiveTab = useCallback(
    (offset: number) => {
      const nextTabId = tabIdAtOffset(tabs, activeTabId, offset);
      if (nextTabId) {
        setActiveTabId(nextTabId);
      }
    },
    [activeTabId, setActiveTabId, tabs],
  );

  const switchToTabIndex = useCallback(
    (index: number) => {
      const nextTabId = tabIdAtIndex(tabs, index);
      if (nextTabId) {
        setActiveTabId(nextTabId);
      }
    },
    [setActiveTabId, tabs],
  );

  const handleEditorChange = useCallback(
    (value: string) => {
      if (!activeTabId) {
        return;
      }

      setTabState((current) => ({
        ...current,
        tabs: applyEditorContent(current.tabs, activeTabId, value),
      }));
    },
    [activeTabId],
  );

  useEffect(() => {
    if (!activeTab) {
      return;
    }

    const normalizedView = normalizeWorkspaceView(
      activeTab.view,
      activeTab.gitContext,
    );

    if (normalizedView !== activeTab.view) {
      setActiveView(normalizedView);
    }
  }, [activeTab?.gitContext, activeTab?.id, activeTab?.view, setActiveView]);

  const markSessionRestored = useCallback(() => {
    setIsSessionRestored(true);
  }, []);

  useEditorTabEffects({
    isSessionRestored,
    onSessionRestored: markSessionRestored,
    openFilesFromPaths,
    reloadingIds,
    reloadTabIfExternallyChanged,
    restoreSavedSession,
    saveTab,
    savingIds,
    sessionSnapshot,
    tabs,
  });

  return {
    activeTab,
    activeTabId,
    canShowDiff,
    closeTab,
    createNewFile,
    diffBase,
    handleEditorChange,
    isOpening,
    openFiles,
    saveTab,
    isTabSaving,
    setActiveView,
    setActiveTabId,
    switchActiveTab,
    switchToTabIndex,
    tabs,
    toggleDiff,
    togglePreviewView,
  };
}
