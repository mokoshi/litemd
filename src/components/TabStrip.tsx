import { saveStateLabel } from "../lib/tabs";
import type { EditorTab } from "../types";

type TabStripProps = {
  activeTabId: string | null;
  isOpening: boolean;
  onCloseTab: (id: string) => void;
  onOpenFiles: () => void;
  onSelectTab: (id: string) => void;
  tabs: EditorTab[];
};

export function TabStrip({
  activeTabId,
  isOpening,
  onCloseTab,
  onOpenFiles,
  onSelectTab,
  tabs,
}: TabStripProps) {
  return (
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
              onClick={() => onSelectTab(tab.id)}
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
                onCloseTab(tab.id);
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
        onClick={onOpenFiles}
        disabled={isOpening}
        title="Open Markdown files"
      >
        +
      </button>
    </nav>
  );
}
