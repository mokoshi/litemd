import CodeMirror from "@uiw/react-codemirror";
import { markdown as markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import type { RefObject } from "react";
import { DiffView } from "./DiffView";
import { MarkdownPreview } from "./MarkdownPreview";
import type { EditorTab, ViewLayout } from "../types";

type EditorWorkspaceProps = {
  activeTab: EditorTab;
  canShowDiff: boolean;
  diffBase: string;
  onCreateEditor: (view: EditorView) => void;
  onEditorChange: (value: string) => void;
  onSetLayout: (layout: ViewLayout) => void;
  onToggleDiff: () => void;
  onToggleDiffLayout: () => void;
  previewHtml: string;
  previewScrollerRef: RefObject<HTMLElement>;
};

const editorExtensions = [markdownLanguage(), EditorView.lineWrapping];

export function EditorWorkspace({
  activeTab,
  canShowDiff,
  diffBase,
  onCreateEditor,
  onEditorChange,
  onSetLayout,
  onToggleDiff,
  onToggleDiffLayout,
  previewHtml,
  previewScrollerRef,
}: EditorWorkspaceProps) {
  return (
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
            onChange={onEditorChange}
            onCreateEditor={onCreateEditor}
          />
        </section>
      ) : null}

      <section className="pane output-pane" aria-label="Markdown preview and git diff">
        <div className="view-switcher" aria-label="Output mode">
          <button
            type="button"
            className={activeTab.layout === "previewOnly" ? "active" : ""}
            onClick={() => onSetLayout("previewOnly")}
            title="Show output only"
          >
            Preview
          </button>
          <button
            type="button"
            className={activeTab.layout === "split" ? "active" : ""}
            onClick={() => onSetLayout("split")}
            title="Show editor and output"
          >
            Split
          </button>
          <button
            type="button"
            className={activeTab.mode === "diff" ? "active" : ""}
            disabled={!canShowDiff}
            onClick={onToggleDiff}
            title={canShowDiff ? "Show diff against HEAD" : "Open a file inside a git repository first"}
          >
            Show Diff
          </button>
          {activeTab.mode === "diff" ? (
            <button
              type="button"
              className={activeTab.diffLayout === "unified" ? "active" : ""}
              onClick={onToggleDiffLayout}
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
  );
}
