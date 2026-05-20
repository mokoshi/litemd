import { useEffect, useMemo, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { EditorWorkspace } from "./components/EditorWorkspace";
import { EmptyState } from "./components/EmptyState";
import { TabStrip } from "./components/TabStrip";
import { useAppUpdate } from "./hooks/useAppUpdate";
import { useCliInstaller } from "./hooks/useCliInstaller";
import { useEditorTabs } from "./hooks/useEditorTabs";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { usePreviewScrollSync } from "./hooks/usePreviewScrollSync";
import { markdown } from "./lib/markdown";

export default function App() {
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const previewScrollerRef = useRef<HTMLElement | null>(null);
  const installCliCommand = useCliInstaller();
  const { checkForUpdates, updateState, updateStatus } = useAppUpdate();
  const {
    activeTab,
    activeTabId,
    canShowDiff,
    closeTab,
    createNewFile,
    diffBase,
    handleEditorChange,
    isOpening,
    isTabSaving,
    openFiles,
    saveTab,
    setActiveLayout,
    setActiveMode,
    setActiveTabId,
    switchActiveTab,
    switchToTabIndex,
    tabs,
    toggleDiff,
    toggleDiffLayout,
    togglePreviewLayout,
  } = useEditorTabs();

  const previewHtml = useMemo(
    () => markdown.render(activeTab?.content ?? ""),
    [activeTab?.content],
  );

  usePreviewScrollSync({
    activeTabId,
    editorView,
    layout: activeTab?.layout ?? null,
    mode: activeTab?.mode ?? null,
    previewHtml,
    previewScrollerRef,
  });

  useGlobalShortcuts({
    activeTab,
    canShowDiff,
    closeTab: (id) => void closeTab(id),
    createNewFile: () => void createNewFile(),
    openFiles: () => void openFiles(),
    saveTab: (tab) => void saveTab(tab),
    isTabSaving,
    setActiveMode,
    switchActiveTab,
    switchToTabIndex,
    togglePreviewLayout,
  });

  useEffect(() => {
    if (activeTab?.layout === "previewOnly") {
      setEditorView(null);
    }
  }, [activeTab?.id, activeTab?.layout]);

  return (
    <main className="app-shell">
      <TabStrip
        activeTabId={activeTabId}
        isOpening={isOpening}
        onCloseTab={(id) => void closeTab(id)}
        onOpenFiles={() => void openFiles()}
        onSelectTab={setActiveTabId}
        tabs={tabs}
      />

      {activeTab ? (
        <EditorWorkspace
          activeTab={activeTab}
          canShowDiff={canShowDiff}
          diffBase={diffBase}
          onCreateEditor={setEditorView}
          onEditorChange={handleEditorChange}
          onSetLayout={setActiveLayout}
          onToggleDiff={toggleDiff}
          onToggleDiffLayout={toggleDiffLayout}
          previewHtml={previewHtml}
          previewScrollerRef={previewScrollerRef}
        />
      ) : (
        <EmptyState
          isOpening={isOpening}
          onCheckForUpdates={() => void checkForUpdates()}
          onInstallCliCommand={() => void installCliCommand()}
          onOpenFiles={() => void openFiles()}
          updateState={updateState}
          updateStatus={updateStatus}
        />
      )}
    </main>
  );
}
