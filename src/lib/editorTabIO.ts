import type { EditorTab, StoredSession, WorkspaceView } from "../types";
import { readFile, getGitDiffContext, writeFile } from "./tauriCommands";
import { savedTabFromFile } from "./tabs";
import { normalizeWorkspaceView } from "./workspaceView";

export const markdownFileFilters = [
  { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
];

export async function loadSavedTab(path: string, status?: string) {
  const [file, gitContext] = await Promise.all([
    readFile(path),
    getGitDiffContext(path),
  ]);

  return savedTabFromFile(file, gitContext, status);
}

export async function createBlankSavedTab(path: string) {
  await writeFile(path, "");
  return loadSavedTab(path, "Created new file");
}

export async function loadTabsFromPaths(
  paths: string[],
  onError: (error: unknown) => void = console.error,
) {
  const tabs: EditorTab[] = [];

  for (const path of paths) {
    try {
      tabs.push(await loadSavedTab(path));
    } catch (error) {
      onError(error);
    }
  }

  return tabs;
}

export async function loadTabsFromSession(
  session: StoredSession,
  onError: (error: unknown) => void = console.error,
) {
  const restoredTabs: EditorTab[] = [];

  for (const item of session.tabs) {
    try {
      const tab = await loadSavedTab(item.path);
      const view: WorkspaceView = normalizeWorkspaceView(
        item.view,
        tab.gitContext,
      );

      restoredTabs.push({
        ...tab,
        view,
      });
    } catch (error) {
      onError(error);
    }
  }

  return restoredTabs;
}
