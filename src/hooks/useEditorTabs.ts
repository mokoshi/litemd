import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  useCliFileListener,
  useExternalFileReload,
  useInitialFiles,
  useSessionSnapshotWriter,
  useTabAutosave,
} from "./useTabLifecycleEffects";
import {
  createBlankSavedTab,
  loadTabsFromPaths,
  loadTabsFromSession,
  markdownFileFilters,
} from "../lib/editorTabIO";
import { sameSignature } from "../lib/fileSignature";
import {
  createSessionSnapshot,
  readStoredSession,
} from "../lib/session";
import {
  applyEditorContent,
  applyExternalReload,
  applySavedContent,
  closeTabState,
  markTabError,
  markTabSaving,
  updateTab,
  upsertTab,
} from "../lib/tabState";
import {
  fileSignature,
  getGitDiffContext,
  readFile,
  writeFile,
} from "../lib/tauriCommands";
import {
  activeTabIdAfterRestore,
  findTab,
  tabIdAtIndex,
  tabIdAtOffset,
} from "../lib/tabNavigation";
import type {
  EditorTab,
  ViewLayout,
  ViewMode,
} from "../types";

export function useEditorTabs() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isSessionRestored, setIsSessionRestored] = useState(false);
  const savingIds = useRef(new Set<string>());
  const reloadingIds = useRef(new Set<string>());

  const activeTab = useMemo(
    () => findTab(tabs, activeTabId),
    [activeTabId, tabs],
  );
  const canShowDiff = Boolean(activeTab?.gitContext?.is_git);
  const diffBase = activeTab?.gitContext?.head_content ?? "";
  const sessionSnapshot = useMemo(
    () => createSessionSnapshot(tabs, activeTab?.path ?? null),
    [activeTab?.path, tabs],
  );

  const saveTab = useCallback(async (tab: EditorTab) => {
    savingIds.current.add(tab.id);
    setTabs((current) => markTabSaving(current, tab.id));

    try {
      const signature = await writeFile(tab.path, tab.content);
      const gitContext = await getGitDiffContext(tab.path);

      setTabs((current) =>
        applySavedContent(current, tab.id, tab.content, signature, gitContext),
      );
    } catch (error) {
      setTabs((current) => markTabError(current, tab.id, error));
    } finally {
      savingIds.current.delete(tab.id);
    }
  }, []);

  const reloadTabIfExternallyChanged = useCallback(async (tab: EditorTab) => {
    reloadingIds.current.add(tab.id);

    try {
      const signature = await fileSignature(tab.path);
      if (sameSignature(signature, tab.fileSignature)) {
        return;
      }

      const [file, gitContext] = await Promise.all([
        readFile(tab.path),
        getGitDiffContext(tab.path),
      ]);

      setTabs((current) =>
        applyExternalReload(current, tab.id, file, gitContext, {
          isSaveInFlight: savingIds.current.has(tab.id),
        }),
      );
    } catch (error) {
      setTabs((current) => markTabError(current, tab.id, error));
    } finally {
      reloadingIds.current.delete(tab.id);
    }
  }, []);

  const openFilesFromPaths = useCallback(async (paths: string[]) => {
    const openedTabs = await loadTabsFromPaths(paths);
    if (openedTabs.length === 0) {
      return;
    }

    setTabs((current) =>
      openedTabs.reduce(
        (nextTabs, tab) => upsertTab(nextTabs, tab),
        current,
      ),
    );
    setActiveTabId(openedTabs[openedTabs.length - 1].id);
  }, []);

  const openFiles = useCallback(async () => {
    if (isOpening) {
      return;
    }

    setIsOpening(true);

    try {
      const selected = await open({
        multiple: true,
        filters: markdownFileFilters,
      });

      const paths = Array.isArray(selected)
        ? selected
        : selected
          ? [selected]
          : [];
      await openFilesFromPaths(paths);
    } catch (error) {
      console.error(error);
    } finally {
      setIsOpening(false);
    }
  }, [isOpening, openFilesFromPaths]);

  const restoreSavedSession = useCallback(async () => {
    const session = readStoredSession();
    if (!session || session.tabs.length === 0) {
      return;
    }

    const restoredTabs = await loadTabsFromSession(session);
    if (restoredTabs.length === 0) {
      return;
    }

    setTabs(restoredTabs);
    setActiveTabId(activeTabIdAfterRestore(restoredTabs, session.activePath));
  }, []);

  const createNewFile = useCallback(async () => {
    if (isOpening) {
      return;
    }

    setIsOpening(true);

    try {
      const path = await save({
        defaultPath: "untitled.md",
        filters: markdownFileFilters,
      });

      if (!path) {
        return;
      }

      const tab = await createBlankSavedTab(path);

      setTabs((current) => upsertTab(current, tab, { replaceExisting: true }));
      setActiveTabId(tab.id);
    } catch (error) {
      console.error(error);
    } finally {
      setIsOpening(false);
    }
  }, [isOpening]);

  const closeTab = useCallback(
    async (id: string) => {
      const tab = tabs.find((item) => item.id === id);
      if (tab && tab.content !== tab.savedContent) {
        await saveTab(tab);
      }

      setTabs((current) => {
        const result = closeTabState(current, activeTabId, id);
        if (result.activeTabId !== activeTabId) {
          setActiveTabId(result.activeTabId);
        }
        return result.tabs;
      });
    },
    [activeTabId, saveTab, tabs],
  );

  const updateActiveTab = useCallback(
    (updater: (tab: EditorTab) => EditorTab) => {
      if (!activeTabId) {
        return;
      }

      setTabs((current) =>
        updateTab(current, activeTabId, updater),
      );
    },
    [activeTabId],
  );

  const setActiveMode = useCallback(
    (mode: ViewMode) => {
      updateActiveTab((tab) => ({ ...tab, mode }));
    },
    [updateActiveTab],
  );

  const setActiveLayout = useCallback(
    (layout: ViewLayout) => {
      updateActiveTab((tab) => ({ ...tab, layout }));
    },
    [updateActiveTab],
  );

  const togglePreviewLayout = useCallback(() => {
    updateActiveTab((tab) => ({
      ...tab,
      layout: tab.layout === "previewOnly" ? "split" : "previewOnly",
    }));
  }, [updateActiveTab]);

  const toggleDiffLayout = useCallback(() => {
    updateActiveTab((tab) => ({
      ...tab,
      diffLayout: tab.diffLayout === "unified" ? "sideBySide" : "unified",
    }));
  }, [updateActiveTab]);

  const toggleDiff = useCallback(() => {
    if (!canShowDiff) {
      return;
    }

    setActiveMode(activeTab?.mode === "diff" ? "preview" : "diff");
  }, [activeTab?.mode, canShowDiff, setActiveMode]);

  const switchActiveTab = useCallback(
    (offset: number) => {
      const nextTabId = tabIdAtOffset(tabs, activeTabId, offset);
      if (nextTabId) {
        setActiveTabId(nextTabId);
      }
    },
    [activeTabId, tabs],
  );

  const switchToTabIndex = useCallback(
    (index: number) => {
      const nextTabId = tabIdAtIndex(tabs, index);
      if (nextTabId) {
        setActiveTabId(nextTabId);
      }
    },
    [tabs],
  );

  const handleEditorChange = useCallback(
    (value: string) => {
      if (!activeTabId) {
        return;
      }

      setTabs((current) => applyEditorContent(current, activeTabId, value));
    },
    [activeTabId],
  );

  useEffect(() => {
    if (activeTab?.mode === "diff" && !canShowDiff) {
      setActiveMode("preview");
    }
  }, [activeTab?.id, activeTab?.mode, canShowDiff, setActiveMode]);

  const markSessionRestored = useCallback(() => {
    setIsSessionRestored(true);
  }, []);

  const isTabSaving = useCallback(
    (id: string) => savingIds.current.has(id),
    [],
  );

  useTabAutosave(tabs, saveTab, savingIds);
  useExternalFileReload(
    tabs,
    reloadTabIfExternallyChanged,
    savingIds,
    reloadingIds,
  );
  useSessionSnapshotWriter(isSessionRestored, sessionSnapshot);
  useInitialFiles(openFilesFromPaths, restoreSavedSession, markSessionRestored);
  useCliFileListener(openFilesFromPaths);

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
    setActiveLayout,
    setActiveMode,
    setActiveTabId,
    switchActiveTab,
    switchToTabIndex,
    tabs,
    toggleDiff,
    toggleDiffLayout,
    togglePreviewLayout,
  };
}
