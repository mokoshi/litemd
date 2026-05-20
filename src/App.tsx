import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown as markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { open, save } from "@tauri-apps/plugin-dialog";
import { DiffView, type DiffLayout } from "./components/DiffView";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { markdown } from "./lib/markdown";

type FileContent = {
  path: string;
  contents: string;
  signature: FileSignature;
};

type FileSignature = {
  modified_ms: number | null;
  len: number;
};

type GitDiffContext = {
  is_git: boolean;
  repo_root: string | null;
  relative_path: string | null;
  head_content: string | null;
  is_new_file: boolean;
  error: string | null;
};

type CliInstallResult = {
  link_path: string;
  target_path: string;
};

type ViewMode = "preview" | "diff";
type ViewLayout = "split" | "previewOnly";
type SaveState = "saved" | "dirty" | "saving" | "error";
type UpdateState = "idle" | "checking" | "available" | "installing" | "error";

type EditorTab = {
  id: string;
  path: string;
  title: string;
  content: string;
  savedContent: string;
  fileSignature: FileSignature;
  mode: ViewMode;
  layout: ViewLayout;
  diffLayout: DiffLayout;
  gitContext: GitDiffContext | null;
  saveState: SaveState;
  status: string;
};

type StoredSessionTab = {
  path: string;
  mode: ViewMode;
  layout: ViewLayout;
  diffLayout: DiffLayout;
};

type StoredSession = {
  version: 1;
  tabs: StoredSessionTab[];
  activePath: string | null;
};

const editorExtensions = [markdownLanguage(), EditorView.lineWrapping];
const SESSION_STORAGE_KEY = "litemd.session.v1";

function tabId(path: string) {
  return `file:${path}`;
}

function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function saveStateLabel(tab: EditorTab) {
  if (tab.saveState === "saving") {
    return "Saving";
  }

  if (tab.saveState === "dirty") {
    return "Modified";
  }

  if (tab.saveState === "error") {
    return "Save failed";
  }

  if (tab.gitContext?.is_git) {
    return tab.gitContext.is_new_file ? "Saved, new file in git" : "Saved, git diff available";
  }

  return "Saved";
}

type PreviewAnchor = {
  line: number;
  top: number;
};

const SCROLL_SYNC_RELEASE_MS = 140;
const SCROLL_END_EPSILON = 2;
const EXTERNAL_FILE_POLL_MS = 1200;
const markdownFileFilters = [
  { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function scrollRange(element: HTMLElement) {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function sameSignature(a: FileSignature, b: FileSignature) {
  return a.modified_ms === b.modified_ms && a.len === b.len;
}

function ratioScrollTop(source: HTMLElement, target: HTMLElement) {
  const sourceRange = scrollRange(source);
  const targetRange = scrollRange(target);
  if (sourceRange <= 0 || targetRange <= 0) {
    return null;
  }

  return (source.scrollTop / sourceRange) * targetRange;
}

function isNearScrollEnd(element: HTMLElement) {
  return scrollRange(element) - element.scrollTop <= SCROLL_END_EPSILON;
}

function collectPreviewAnchors(scroller: HTMLElement) {
  const scrollerTop = scroller.getBoundingClientRect().top;
  const anchors = Array.from(
    scroller.querySelectorAll<HTMLElement>("[data-source-line]"),
  )
    .map((element) => {
      const line = Number(element.dataset.sourceLine);
      if (!Number.isFinite(line) || line <= 0) {
        return null;
      }

      return {
        line,
        top:
          element.getBoundingClientRect().top -
          scrollerTop +
          scroller.scrollTop,
      };
    })
    .filter((anchor): anchor is PreviewAnchor => anchor !== null)
    .sort((a, b) => a.line - b.line || a.top - b.top);

  const deduped: PreviewAnchor[] = [];
  for (const anchor of anchors) {
    const last = deduped[deduped.length - 1];
    if (!last || last.line !== anchor.line) {
      deduped.push(anchor);
    }
  }

  return deduped;
}

function interpolateTopForLine(anchors: PreviewAnchor[], line: number) {
  if (anchors.length === 0) {
    return null;
  }

  if (line <= anchors[0].line) {
    return anchors[0].top;
  }

  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const next = anchors[index];
    if (line > next.line) {
      continue;
    }

    const lineSpan = next.line - previous.line;
    const progress = lineSpan > 0 ? (line - previous.line) / lineSpan : 0;
    return previous.top + (next.top - previous.top) * progress;
  }

  return anchors[anchors.length - 1].top;
}

function interpolateLineForTop(anchors: PreviewAnchor[], top: number) {
  if (anchors.length === 0) {
    return null;
  }

  if (top <= anchors[0].top) {
    return anchors[0].line;
  }

  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const next = anchors[index];
    if (top > next.top) {
      continue;
    }

    const topSpan = next.top - previous.top;
    const progress = topSpan > 0 ? (top - previous.top) / topSpan : 0;
    return previous.line + (next.line - previous.line) * progress;
  }

  return anchors[anchors.length - 1].line;
}

function editorTopLine(view: EditorView) {
  const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
  return view.state.doc.lineAt(block.from).number;
}

function editorScrollTopForLine(view: EditorView, lineNumber: number) {
  const line = view.state.doc.line(
    clamp(Math.round(lineNumber), 1, view.state.doc.lines),
  );
  return view.lineBlockAt(line.from).top;
}

function savedTabFromFile(
  file: FileContent,
  gitContext: GitDiffContext,
  status?: string,
): EditorTab {
  const tab: EditorTab = {
    id: tabId(file.path),
    path: file.path,
    title: fileName(file.path),
    content: file.contents,
    savedContent: file.contents,
    fileSignature: file.signature,
    mode: "preview",
    layout: "split",
    diffLayout: "sideBySide",
    gitContext,
    saveState: "saved",
    status: "",
  };

  return {
    ...tab,
    status: status ?? saveStateLabel(tab),
  };
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as {
      tabs?: unknown;
      activePath?: unknown;
    };

    if (!Array.isArray(value.tabs)) {
      return null;
    }

    const seen = new Set<string>();
    const tabs: StoredSessionTab[] = [];

    for (const item of value.tabs) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const candidate = item as {
        path?: unknown;
        mode?: unknown;
        layout?: unknown;
        diffLayout?: unknown;
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
        mode: candidate.mode === "diff" ? "diff" : "preview",
        layout: candidate.layout === "previewOnly" ? "previewOnly" : "split",
        diffLayout:
          candidate.diffLayout === "unified" ? "unified" : "sideBySide",
      });
    }

    const activePath =
      typeof value.activePath === "string" ? value.activePath : null;

    return {
      version: 1,
      tabs,
      activePath,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

function writeStoredSessionSnapshot(snapshot: string | null) {
  try {
    if (snapshot === null) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SESSION_STORAGE_KEY, snapshot);
  } catch (error) {
    console.error(error);
  }
}

export default function App() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isSessionRestored, setIsSessionRestored] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateStatus, setUpdateStatus] = useState("Check for Updates");
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const savingIds = useRef(new Set<string>());
  const reloadingIds = useRef(new Set<string>());
  const previewScrollerRef = useRef<HTMLElement | null>(null);
  const scrollSyncSource = useRef<HTMLElement | null>(null);
  const scrollSyncReleaseTimer = useRef<number | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const canShowDiff = Boolean(activeTab?.gitContext?.is_git);

  const previewHtml = useMemo(
    () => markdown.render(activeTab?.content ?? ""),
    [activeTab?.content],
  );
  const diffBase = activeTab?.gitContext?.head_content ?? "";
  const sessionSnapshot = useMemo(() => {
    if (tabs.length === 0) {
      return null;
    }

    const session: StoredSession = {
      version: 1,
      tabs: tabs.map((tab) => ({
        path: tab.path,
        mode: tab.mode,
        layout: tab.layout,
        diffLayout: tab.diffLayout,
      })),
      activePath: activeTab?.path ?? null,
    };

    return JSON.stringify(session);
  }, [activeTab?.path, tabs]);

  useEffect(() => {
    if (activeTab?.mode === "diff" && !canShowDiff) {
      setActiveMode("preview");
    }
  }, [activeTab?.id, activeTab?.mode, canShowDiff]);

  useEffect(() => {
    if (activeTab?.layout === "previewOnly") {
      setEditorView(null);
    }
  }, [activeTab?.id, activeTab?.layout]);

  useEffect(() => {
    const previewScroller = previewScrollerRef.current;
    const currentEditorView = editorView;
    const editorScroller = currentEditorView?.scrollDOM ?? null;
    if (
      !currentEditorView ||
      !editorScroller ||
      !previewScroller ||
      activeTab?.mode !== "preview" ||
      activeTab?.layout !== "split"
    ) {
      return;
    }

    function syncScroll(source: HTMLElement, target: HTMLElement, nextTop: number | null) {
      if (scrollSyncSource.current && scrollSyncSource.current !== source) {
        return;
      }

      if (nextTop === null || scrollRange(target) <= 0) {
        return;
      }

      scrollSyncSource.current = source;
      target.scrollTop = clamp(nextTop, 0, scrollRange(target));

      if (scrollSyncReleaseTimer.current) {
        window.clearTimeout(scrollSyncReleaseTimer.current);
      }

      scrollSyncReleaseTimer.current = window.setTimeout(() => {
        scrollSyncSource.current = null;
        scrollSyncReleaseTimer.current = null;
      }, SCROLL_SYNC_RELEASE_MS);
    }

    const handleEditorScroll = () => {
      const anchors = collectPreviewAnchors(previewScroller);
      const line = editorTopLine(currentEditorView);
      const targetTop =
        isNearScrollEnd(editorScroller)
          ? scrollRange(previewScroller)
          : interpolateTopForLine(anchors, line) ??
            ratioScrollTop(editorScroller, previewScroller);

      syncScroll(editorScroller, previewScroller, targetTop);
    };

    const handlePreviewScroll = () => {
      const anchors = collectPreviewAnchors(previewScroller);
      const line = interpolateLineForTop(anchors, previewScroller.scrollTop);
      const targetTop =
        isNearScrollEnd(previewScroller)
          ? scrollRange(editorScroller)
          : line === null
          ? ratioScrollTop(previewScroller, editorScroller)
          : editorScrollTopForLine(currentEditorView, line);

      syncScroll(previewScroller, editorScroller, targetTop);
    };

    editorScroller.addEventListener("scroll", handleEditorScroll, { passive: true });
    previewScroller.addEventListener("scroll", handlePreviewScroll, { passive: true });

    return () => {
      editorScroller.removeEventListener("scroll", handleEditorScroll);
      previewScroller.removeEventListener("scroll", handlePreviewScroll);
      if (scrollSyncReleaseTimer.current) {
        window.clearTimeout(scrollSyncReleaseTimer.current);
        scrollSyncReleaseTimer.current = null;
      }
      scrollSyncSource.current = null;
    };
  }, [activeTab?.id, activeTab?.layout, activeTab?.mode, editorView, previewHtml]);

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
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [tabs]);

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
  }, [tabs]);

  useEffect(() => {
    if (!isSessionRestored) {
      return;
    }

    writeStoredSessionSnapshot(sessionSnapshot);
  }, [isSessionRestored, sessionSnapshot]);

  useEffect(() => {
    let disposed = false;

    async function loadInitialFiles() {
      try {
        const paths = await invoke<string[]>("initial_cli_files");
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
          setIsSessionRestored(true);
        }
      }
    }

    void loadInitialFiles();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkForUpdates({ silent: true });
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, []);

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
  }, []);

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
        if (!event.repeat && activeTab && !savingIds.current.has(activeTab.id)) {
          void saveTab(activeTab);
        }
        return;
      }

      if (hasPlainCommand && !event.shiftKey && key === "w") {
        event.preventDefault();
        if (!event.repeat && activeTab) {
          void closeTab(activeTab.id);
        }
        return;
      }

      if (hasPlainCommand && !event.shiftKey && key === "n") {
        event.preventDefault();
        if (!event.repeat) {
          void createNewFile();
        }
        return;
      }

      if (hasPlainCommand && !event.shiftKey && key === "o") {
        event.preventDefault();
        if (!event.repeat) {
          void openFiles();
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
          if (activeTab.mode === "diff") {
            setActiveMode("preview");
          } else if (canShowDiff) {
            setActiveMode("diff");
          }
        }
        return;
      }

      if (hasPlainCommand && event.shiftKey && key === "v") {
        event.preventDefault();
        if (!event.repeat && activeTab) {
          togglePreviewLayout();
        }
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [activeTab, activeTabId, canShowDiff, isOpening, tabs]);

  async function getGitContext(path: string) {
    return invoke<GitDiffContext>("get_git_diff_context", { path });
  }

  async function openFiles() {
    if (isOpening) {
      return;
    }

    setIsOpening(true);

    try {
      const selected = await open({
        multiple: true,
        filters: markdownFileFilters,
      });

      const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
      for (const path of paths) {
        await openFile(path);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsOpening(false);
    }
  }

  async function openFilesFromPaths(paths: string[]) {
    for (const path of paths) {
      await openFile(path);
    }
  }

  async function restoreSavedSession() {
    const session = readStoredSession();
    if (!session || session.tabs.length === 0) {
      return;
    }

    const restoredTabs: EditorTab[] = [];
    for (const item of session.tabs) {
      try {
        const [file, gitContext] = await Promise.all([
          invoke<FileContent>("read_file", { path: item.path }),
          getGitContext(item.path),
        ]);
        const tab = savedTabFromFile(file, gitContext);

        const mode: ViewMode =
          item.mode === "diff" && gitContext.is_git ? "diff" : "preview";

        restoredTabs.push({
          ...tab,
          mode,
          layout: item.layout === "previewOnly" ? "previewOnly" : "split",
          diffLayout: item.diffLayout,
        });
      } catch (error) {
        console.error(error);
      }
    }

    if (restoredTabs.length === 0) {
      return;
    }

    setTabs(restoredTabs);

    const activeTab =
      restoredTabs.find((tab) => tab.path === session.activePath) ??
      restoredTabs[0];
    setActiveTabId(activeTab.id);
  }

  async function createNewFile() {
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

      await invoke<FileSignature>("write_file", { path, contents: "" });
      const [file, gitContext] = await Promise.all([
        invoke<FileContent>("read_file", { path }),
        getGitContext(path),
      ]);
      const tab = savedTabFromFile(file, gitContext, "Created new file");

      setTabs((current) => {
        const exists = current.some((item) => item.id === tab.id);
        return exists
          ? current.map((item) => (item.id === tab.id ? tab : item))
          : [...current, tab];
      });
      setActiveTabId(tab.id);
    } catch (error) {
      console.error(error);
    } finally {
      setIsOpening(false);
    }
  }

  async function openFile(path: string) {
    try {
      const [file, gitContext] = await Promise.all([
        invoke<FileContent>("read_file", { path }),
        getGitContext(path),
      ]);

      const tab = savedTabFromFile(file, gitContext);

      setTabs((current) => {
        const exists = current.some((item) => item.id === tab.id);
        return exists ? current : [...current, tab];
      });
      setActiveTabId(tab.id);
    } catch (error) {
      console.error(error);
    }
  }

  async function installCliCommand() {
    try {
      const result = await invoke<CliInstallResult>("install_cli_command");
      window.alert(`Installed litemd command:\n${result.link_path} -> ${result.target_path}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  }

  async function checkForUpdates(options: { silent?: boolean } = {}) {
    if (updateState === "checking" || updateState === "installing") {
      return;
    }

    setUpdateState("checking");
    setUpdateStatus("Checking...");

    try {
      const update = await check();
      if (!update?.available) {
        setUpdateState("idle");
        setUpdateStatus("Up to date");
        if (!options.silent) {
          window.alert("litemd is up to date.");
        }
        return;
      }

      setUpdateState("available");
      setUpdateStatus(`Update ${update.version} available`);
      const shouldInstall = window.confirm(
        `litemd ${update.version} is available.\nInstall it now and restart?`,
      );

      if (shouldInstall) {
        await installUpdate(update);
      }
    } catch (error) {
      setUpdateState("error");
      setUpdateStatus("Update check failed");
      if (!options.silent) {
        window.alert(error instanceof Error ? error.message : String(error));
      }
    }
  }

  async function installUpdate(update: Update) {
    setUpdateState("installing");
    setUpdateStatus("Downloading update...");

    await update.downloadAndInstall((event: DownloadEvent) => {
      if (event.event === "Started") {
        setUpdateStatus("Downloading update...");
      }

      if (event.event === "Progress") {
        setUpdateStatus("Downloading update...");
      }

      if (event.event === "Finished") {
        setUpdateStatus("Installing update...");
      }
    });

    setUpdateStatus("Restarting...");
    await relaunch();
  }

  async function saveTab(tab: EditorTab) {
    savingIds.current.add(tab.id);
    setTabs((current) =>
      current.map((item) =>
        item.id === tab.id ? { ...item, saveState: "saving", status: "Saving" } : item,
      ),
    );

    try {
      const signature = await invoke<FileSignature>("write_file", { path: tab.path, contents: tab.content });
      const gitContext = await getGitContext(tab.path);

      setTabs((current) =>
        current.map((item) => {
          if (item.id !== tab.id) {
            return item;
          }

          const saveState: SaveState =
            item.content === tab.content ? "saved" : "dirty";

          return {
            ...item,
            savedContent: tab.content,
            fileSignature: signature,
            gitContext,
            saveState,
            status: saveState === "saved" ? saveStateLabel({ ...item, gitContext, saveState }) : "Modified",
          };
        }),
      );
    } catch (error) {
      setTabs((current) =>
        current.map((item) =>
          item.id === tab.id
            ? {
                ...item,
                saveState: "error",
                status: error instanceof Error ? error.message : String(error),
              }
            : item,
        ),
      );
    } finally {
      savingIds.current.delete(tab.id);
    }
  }

  async function reloadTabIfExternallyChanged(tab: EditorTab) {
    reloadingIds.current.add(tab.id);

    try {
      const signature = await invoke<FileSignature>("file_signature", { path: tab.path });
      if (sameSignature(signature, tab.fileSignature)) {
        return;
      }

      const [file, gitContext] = await Promise.all([
        invoke<FileContent>("read_file", { path: tab.path }),
        getGitContext(tab.path),
      ]);

      setTabs((current) =>
        current.map((item) => {
          if (item.id !== tab.id) {
            return item;
          }

          if (
            item.content !== item.savedContent ||
            item.saveState === "saving" ||
            savingIds.current.has(item.id)
          ) {
            return {
              ...item,
              status: "External change detected; local edits pending",
            };
          }

          return {
            ...item,
            path: file.path,
            title: fileName(file.path),
            content: file.contents,
            savedContent: file.contents,
            fileSignature: file.signature,
            gitContext,
            saveState: "saved",
            status: "Reloaded external changes",
          };
        }),
      );
    } catch (error) {
      setTabs((current) =>
        current.map((item) =>
          item.id === tab.id
            ? {
                ...item,
                saveState: "error",
                status: error instanceof Error ? error.message : String(error),
              }
            : item,
        ),
      );
    } finally {
      reloadingIds.current.delete(tab.id);
    }
  }

  async function closeTab(id: string) {
    const tab = tabs.find((item) => item.id === id);
    if (tab && tab.content !== tab.savedContent) {
      await saveTab(tab);
    }

    setTabs((current) => {
      const index = current.findIndex((item) => item.id === id);
      const next = current.filter((item) => item.id !== id);

      if (activeTabId === id) {
        const nextActive = next[Math.max(0, index - 1)] ?? next[0] ?? null;
        setActiveTabId(nextActive?.id ?? null);
      }

      return next;
    });
  }

  function updateActiveTab(updater: (tab: EditorTab) => EditorTab) {
    if (!activeTabId) {
      return;
    }

    setTabs((current) =>
      current.map((tab) => (tab.id === activeTabId ? updater(tab) : tab)),
    );
  }

  function setActiveMode(mode: ViewMode) {
    updateActiveTab((tab) => ({ ...tab, mode }));
  }

  function setActiveLayout(layout: ViewLayout) {
    updateActiveTab((tab) => ({ ...tab, layout }));
  }

  function togglePreviewLayout() {
    updateActiveTab((tab) => ({
      ...tab,
      layout: tab.layout === "previewOnly" ? "split" : "previewOnly",
    }));
  }

  function toggleDiffLayout() {
    updateActiveTab((tab) => ({
      ...tab,
      diffLayout: tab.diffLayout === "unified" ? "sideBySide" : "unified",
    }));
  }

  function toggleDiff() {
    if (!canShowDiff) {
      return;
    }

    setActiveMode(activeTab?.mode === "diff" ? "preview" : "diff");
  }

  function switchActiveTab(offset: number) {
    if (tabs.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      0,
      tabs.findIndex((tab) => tab.id === activeTabId),
    );
    const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
    setActiveTabId(tabs[nextIndex].id);
  }

  function switchToTabIndex(index: number) {
    const tab = tabs[index];
    if (tab) {
      setActiveTabId(tab.id);
    }
  }

  function handleEditorChange(value: string) {
    updateActiveTab((tab) => {
      const saveState: SaveState = value === tab.savedContent ? "saved" : "dirty";

      return {
        ...tab,
        content: value,
        saveState,
        status: saveState === "saved" ? saveStateLabel({ ...tab, content: value, saveState }) : "Modified",
      };
    });
  }

  return (
    <main className="app-shell">
      <nav className="tab-strip" aria-label="Open files">
        <div className="tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={tab.id === activeTabId ? "tab active" : "tab"}
              title={`${tab.path}\n${tab.status}`}
            >
              <button
                type="button"
                className="tab-select"
                onClick={() => setActiveTabId(tab.id)}
              >
                <span className={`save-dot ${tab.saveState}`} aria-label={saveStateLabel(tab)} />
                <span className="tab-title">{tab.title}</span>
              </button>
              <button
                type="button"
                className="tab-close"
                aria-label={`Close ${tab.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void closeTab(tab.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="new-tab-button"
          onClick={() => void openFiles()}
          disabled={isOpening}
          title="Open Markdown files"
        >
          +
        </button>
      </nav>

      {activeTab ? (
        <section
          className={
            activeTab.layout === "previewOnly"
              ? "workspace preview-only"
              : "workspace"
          }
        >
          {activeTab.layout === "split" ? (
            <section className="pane editor-pane" aria-label="Markdown editor">
              <CodeMirror
                key={activeTab.id}
                value={activeTab.content}
                height="100%"
                theme="dark"
                basicSetup={{
                  foldGutter: true,
                  dropCursor: true,
                  allowMultipleSelections: true,
                  indentOnInput: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: true,
                  rectangularSelection: true,
                  highlightSelectionMatches: true,
                  searchKeymap: true,
                }}
                extensions={editorExtensions}
                onChange={handleEditorChange}
                onCreateEditor={(view) => setEditorView(view)}
              />
            </section>
          ) : null}

          <section className="pane output-pane" aria-label="Markdown preview and git diff">
            <div className="view-switcher" aria-label="Output mode">
              <button
                type="button"
                className={activeTab.layout === "previewOnly" ? "active" : ""}
                onClick={() => setActiveLayout("previewOnly")}
                title="Show output only"
              >
                Preview
              </button>
              <button
                type="button"
                className={activeTab.layout === "split" ? "active" : ""}
                onClick={() => setActiveLayout("split")}
                title="Show editor and output"
              >
                Split
              </button>
              <button
                type="button"
                className={activeTab.mode === "diff" ? "active" : ""}
                disabled={!canShowDiff}
                onClick={() => toggleDiff()}
                title={canShowDiff ? "Show diff against HEAD" : "Open a file inside a git repository first"}
              >
                Show Diff
              </button>
              {activeTab.mode === "diff" ? (
                <button
                  type="button"
                  className={activeTab.diffLayout === "unified" ? "active" : ""}
                  onClick={() => toggleDiffLayout()}
                  title="Toggle unified diff"
                >
                  Unified
                </button>
              ) : null}
            </div>

            {activeTab.mode === "preview" ? (
              <MarkdownPreview ref={previewScrollerRef} html={previewHtml} />
            ) : (
              <DiffView
                original={diffBase}
                modified={activeTab.content}
                layout={activeTab.diffLayout}
              />
            )}
          </section>
        </section>
      ) : (
        <section className="empty-state">
          <div className="empty-actions">
            <button type="button" onClick={() => void openFiles()} disabled={isOpening}>
              Open Markdown Files
            </button>
            <button type="button" onClick={() => void installCliCommand()}>
              Install CLI Command
            </button>
            <button
              type="button"
              onClick={() => void checkForUpdates()}
              disabled={updateState === "checking" || updateState === "installing"}
            >
              {updateStatus}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
