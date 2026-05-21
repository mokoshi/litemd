import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  createBlankSavedTab,
  loadTabsFromPaths,
  markdownFileFilters,
} from "../lib/editorTabIO";
import { type EditorTabsState, upsertTabsState } from "../lib/tabState";

type SetEditorTabsState = Dispatch<SetStateAction<EditorTabsState>>;

export function useEditorFileCommands(setTabState: SetEditorTabsState) {
  const [isOpening, setIsOpening] = useState(false);

  const openFilesFromPaths = useCallback(
    async (paths: string[]) => {
      const openedTabs = await loadTabsFromPaths(paths);
      if (openedTabs.length === 0) {
        return;
      }

      setTabState((current) =>
        upsertTabsState(current, openedTabs, {
          activeTabId: openedTabs[openedTabs.length - 1].id,
        }),
      );
    },
    [setTabState],
  );

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
  }, [isOpening, setTabState]);

  return {
    createNewFile,
    isOpening,
    openFiles,
    openFilesFromPaths,
  };
}
