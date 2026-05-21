import CodeMirror from "@uiw/react-codemirror";
import { markdown as markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import type { RefObject } from "react";
import { DiffView } from "./DiffView";
import { MarkdownPreview } from "./MarkdownPreview";
import type { EditorTab, WorkspaceView } from "../types";

type EditorWorkspaceProps = {
  activeTab: EditorTab;
  canShowDiff: boolean;
  diffBase: string;
  onCreateEditor: (view: EditorView) => void;
  onEditorChange: (value: string) => void;
  onSetView: (view: WorkspaceView) => void;
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
  onSetView,
  previewHtml,
  previewScrollerRef,
}: EditorWorkspaceProps) {
  return (
    <section
      className={
        activeTab.view === "split"
          ? "workspace"
          : "workspace output-only"
      }
    >
      {activeTab.view === "split" ? (
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
            className={activeTab.view === "split" ? "active" : ""}
            onClick={() => onSetView("split")}
            title="Show editor and preview"
          >
            Split
          </button>
          <button
            type="button"
            className={activeTab.view === "preview" ? "active" : ""}
            onClick={() => onSetView("preview")}
            title="Show preview only"
          >
            Preview
          </button>
          <button
            type="button"
            className={activeTab.view === "diff" ? "active" : ""}
            disabled={!canShowDiff}
            onClick={() => onSetView("diff")}
            title={canShowDiff ? "Show diff against HEAD" : "Open a file inside a git repository first"}
          >
            Diff
          </button>
        </div>

        {activeTab.view === "diff" ? (
          <DiffView
            original={diffBase}
            modified={activeTab.content}
          />
        ) : (
          <MarkdownPreview ref={previewScrollerRef} html={previewHtml} />
        )}
      </section>
    </section>
  );
}
