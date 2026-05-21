import { useEffect, type MutableRefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import { writeStoredSessionSnapshot } from "../lib/session";
import { initialCliFiles } from "../lib/tauriCommands";
import type { EditorTab } from "../types";

const EXTERNAL_FILE_POLL_MS = 1200;
const AUTOSAVE_DELAY_MS = 600;

type TabOperation = (tab: EditorTab) => void | Promise<unknown>;
type OpenFilesFromPaths = (paths: string[]) => void | Promise<void>;
type RestoreSavedSession = () => void | Promise<void>;

export function useTabAutosave(
  tabs: EditorTab[],
  saveTab: TabOperation,
  savingIds: MutableRefObject<Set<string>>,
) {
  useEffect(() => {
    const dirtyTabs = tabs.filter(
      (tab) =>
        tab.content !== tab.savedContent &&
        tab.saveState !== "saving" &&
        !savingIds.current.has(tab.id),
    );

    if (dirtyTabs.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dirtyTabs.forEach((tab) => {
        void saveTab(tab);
      });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [saveTab, savingIds, tabs]);
}

export function useExternalFileReload(
  tabs: EditorTab[],
  reloadTabIfExternallyChanged: TabOperation,
  savingIds: MutableRefObject<Set<string>>,
  reloadingIds: MutableRefObject<Set<string>>,
) {
  useEffect(() => {
    if (tabs.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      tabs.forEach((tab) => {
        if (
          tab.saveState === "dirty" ||
          tab.saveState === "saving" ||
          savingIds.current.has(tab.id) ||
          reloadingIds.current.has(tab.id)
        ) {
          return;
        }

        void reloadTabIfExternallyChanged(tab);
      });
    }, EXTERNAL_FILE_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [reloadingIds, reloadTabIfExternallyChanged, savingIds, tabs]);
}

export function useSessionSnapshotWriter(
  isSessionRestored: boolean,
  sessionSnapshot: string | null,
) {
  useEffect(() => {
    if (!isSessionRestored) {
      return;
    }

    writeStoredSessionSnapshot(sessionSnapshot);
  }, [isSessionRestored, sessionSnapshot]);
}

export function useInitialFiles(
  openFilesFromPaths: OpenFilesFromPaths,
  restoreSavedSession: RestoreSavedSession,
  onSessionRestored: () => void,
) {
  useEffect(() => {
    let disposed = false;

    async function loadInitialFiles() {
      try {
        const paths = await initialCliFiles();
        if (disposed) {
          return;
        }

        await restoreSavedSession();
        if (disposed) {
          return;
        }

        await openFilesFromPaths(paths);
      } catch (error) {
        console.error(error);
      } finally {
        if (!disposed) {
          onSessionRestored();
        }
      }
    }

    void loadInitialFiles();

    return () => {
      disposed = true;
    };
  }, [onSessionRestored, openFilesFromPaths, restoreSavedSession]);
}

export function useCliFileListener(openFilesFromPaths: OpenFilesFromPaths) {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listen<string[]>("open-cli-files", (event) => {
      void openFilesFromPaths(event.payload);
    })
      .then((unsubscribe) => {
        if (disposed) {
          unsubscribe();
        } else {
          unlisten = unsubscribe;
        }
      })
      .catch((error) => console.error(error));

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [openFilesFromPaths]);
}
