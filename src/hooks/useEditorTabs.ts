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
  closeCleanTabInState,
  closeTabInState,
  type EditorTabsState,
  markTabError,
  markTabSaving,
  replaceTabsState,
  setActiveTabState,
  updateTabInState,
  upsertTabsState,
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
  WorkspaceView,
} from "../types";

type SaveTabResult =
  | { ok: true; savedContent: string }
  | { ok: false };

export function useEditorTabs() {
  const [tabState, setTabState] = useState<EditorTabsState>({
    tabs: [],
    activeTabId: null,
  });
  const [isOpening, setIsOpening] = useState(false);
  const [isSessionRestored, setIsSessionRestored] = useState(false);
  const savingIds = useRef(new Set<string>());
  const savingTasks = useRef(new Map<string, Promise<SaveTabResult>>());
  const reloadingIds = useRef(new Set<string>());
  const { activeTabId, tabs } = tabState;

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
    const existingTask = savingTasks.current.get(tab.id);
    if (existingTask) {
      return existingTask;
    }

    const task = (async (): Promise<SaveTabResult> => {
      savingIds.current.add(tab.id);
      setTabState((current) => ({
        ...current,
        tabs: markTabSaving(current.tabs, tab.id),
      }));

      try {
        const signature = await writeFile(tab.path, tab.content);
        const gitContext = await getGitDiffContext(tab.path);

        setTabState((current) => ({
          ...current,
          tabs: applySavedContent(
            current.tabs,
            tab.id,
            tab.content,
            signature,
            gitContext,
          ),
        }));
        return { ok: true, savedContent: tab.content };
      } catch (error) {
        setTabState((current) => ({
          ...current,
          tabs: markTabError(current.tabs, tab.id, error),
        }));
        return { ok: false };
      } finally {
        savingIds.current.delete(tab.id);
        savingTasks.current.delete(tab.id);
      }
    })();

    savingTasks.current.set(tab.id, task);
    return task;
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

      setTabState((current) => ({
        ...current,
        tabs: applyExternalReload(current.tabs, tab.id, file, gitContext, {
          isSaveInFlight: savingIds.current.has(tab.id),
        }),
      }));
    } catch (error) {
      setTabState((current) => ({
        ...current,
        tabs: markTabError(current.tabs, tab.id, error),
      }));
    } finally {
      reloadingIds.current.delete(tab.id);
    }
  }, []);

  const openFilesFromPaths = useCallback(async (paths: string[]) => {
    const openedTabs = await loadTabsFromPaths(paths);
    if (openedTabs.length === 0) {
      return;
    }

    setTabState((current) =>
      upsertTabsState(current, openedTabs, {
        activeTabId: openedTabs[openedTabs.length - 1].id,
      }),
    );
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

    setTabState(
      replaceTabsState(
        restoredTabs,
        activeTabIdAfterRestore(restoredTabs, session.activePath),
      ),
    );
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

      setTabState((current) =>
        upsertTabsState(current, [tab], {
          activeTabId: tab.id,
          replaceExisting: true,
        }),
      );
    } catch (error) {
      console.error(error);
    } finally {
      setIsOpening(false);
    }
  }, [isOpening]);

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
      updateActiveTab((tab) => ({ ...tab, view }));
    },
    [updateActiveTab],
  );

  const togglePreviewView = useCallback(() => {
    updateActiveTab((tab) => ({
      ...tab,
      view: tab.view === "preview" ? "split" : "preview",
    }));
  }, [updateActiveTab]);

  const toggleDiff = useCallback(() => {
    if (!activeTab || (!canShowDiff && activeTab.view !== "diff")) {
      return;
    }

    setActiveView(activeTab.view === "diff" ? "split" : "diff");
  }, [activeTab, canShowDiff, setActiveView]);

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
    if (activeTab?.view === "diff" && !canShowDiff) {
      setActiveView("split");
    }
  }, [activeTab?.id, activeTab?.view, canShowDiff, setActiveView]);

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
    setActiveView,
    setActiveTabId,
    switchActiveTab,
    switchToTabIndex,
    tabs,
    toggleDiff,
    togglePreviewView,
  };
}
