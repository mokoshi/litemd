import {
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { sameSignature } from "../lib/fileSignature";
import {
  applyExternalReload,
  applySavedContent,
  type EditorTabsState,
  markTabError,
  markTabSaving,
} from "../lib/tabState";
import {
  fileSignature,
  getGitDiffContext,
  readFile,
  writeFile,
} from "../lib/tauriCommands";
import type { EditorTab } from "../types";

type SaveTabResult =
  | { ok: true; savedContent: string }
  | { ok: false };

type SetEditorTabsState = Dispatch<SetStateAction<EditorTabsState>>;

export function useTabFileSync(setTabState: SetEditorTabsState) {
  const savingIds = useRef(new Set<string>());
  const savingTasks = useRef(new Map<string, Promise<SaveTabResult>>());
  const reloadingIds = useRef(new Set<string>());

  const saveTab = useCallback(
    async (tab: EditorTab) => {
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
    },
    [setTabState],
  );

  const reloadTabIfExternallyChanged = useCallback(
    async (tab: EditorTab) => {
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
    },
    [setTabState],
  );

  const isTabSaving = useCallback(
    (id: string) => savingIds.current.has(id),
    [],
  );

  return {
    isTabSaving,
    reloadTabIfExternallyChanged,
    reloadingIds,
    saveTab,
    savingIds,
  };
}
