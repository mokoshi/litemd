import { useEffect, useRef } from "react";
import { markdown } from "@codemirror/lang-markdown";
import { MergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";

type DiffViewProps = {
  original: string;
  modified: string;
};

const readOnlyExtensions = [
  basicSetup,
  markdown(),
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
  EditorView.lineWrapping,
];

export function DiffView({ original, modified }: DiffViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    containerRef.current.innerHTML = "";

    const view = new MergeView({
      a: {
        doc: original,
        extensions: readOnlyExtensions,
      },
      b: {
        doc: modified,
        extensions: readOnlyExtensions,
      },
      parent: containerRef.current,
    });

    return () => {
      view.destroy();
    };
  }, [original, modified]);

  return <div ref={containerRef} className="diff-view" />;
}
