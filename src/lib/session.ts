import type {
  EditorTab,
  StoredSession,
  StoredSessionTab,
} from "../types";
import { workspaceViewFromStoredValue } from "./workspaceView";

export const SESSION_STORAGE_KEY = "litemd.session.v1";

export function parseStoredSessionValue(value: unknown): StoredSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidateSession = value as {
    tabs?: unknown;
    activePath?: unknown;
  };

  if (!Array.isArray(candidateSession.tabs)) {
    return null;
  }

  const seen = new Set<string>();
  const tabs: StoredSessionTab[] = [];

  for (const item of candidateSession.tabs) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as {
      path?: unknown;
      view?: unknown;
      mode?: unknown;
      layout?: unknown;
    };
    if (typeof candidate.path !== "string" || candidate.path.trim() === "") {
      continue;
    }

    if (seen.has(candidate.path)) {
      continue;
    }

    seen.add(candidate.path);
    tabs.push({
      path: candidate.path,
      view: workspaceViewFromStoredValue(candidate),
    });
  }

  const activePath =
    typeof candidateSession.activePath === "string"
      ? candidateSession.activePath
      : null;

  return {
    version: 2,
    tabs,
    activePath,
  };
}

export function parseStoredSessionJson(raw: string | null): StoredSession | null {
  if (!raw) {
    return null;
  }

  try {
    return parseStoredSessionValue(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readStoredSession(storage: Storage = window.localStorage) {
  return parseStoredSessionJson(storage.getItem(SESSION_STORAGE_KEY));
}

export function createSessionSnapshot(
  tabs: EditorTab[],
  activePath: string | null,
) {
  if (tabs.length === 0) {
    return null;
  }

  const session: StoredSession = {
    version: 2,
    tabs: tabs.map((tab) => ({
      path: tab.path,
      view: tab.view,
    })),
    activePath,
  };

  return JSON.stringify(session);
}

export function writeStoredSessionSnapshot(
  snapshot: string | null,
  storage: Storage = window.localStorage,
) {
  try {
    if (snapshot === null) {
      storage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    storage.setItem(SESSION_STORAGE_KEY, snapshot);
  } catch (error) {
    console.error(error);
  }
}
