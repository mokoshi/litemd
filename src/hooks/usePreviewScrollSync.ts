import { useEffect, type RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import {
  clamp,
  collectPreviewAnchors,
  interpolateLineForTop,
  interpolateTopForLine,
  isNearScrollEnd,
  ratioScrollTop,
  scrollRange,
} from "../lib/scrollSync";
import { useScrollSyncLock } from "./useScrollSyncLock";
import type { WorkspaceView } from "../types";

type UsePreviewScrollSyncParams = {
  activeTabId: string | null;
  editorView: EditorView | null;
  view: WorkspaceView | null;
  previewHtml: string;
  previewScrollerRef: RefObject<HTMLElement>;
};

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

export function usePreviewScrollSync({
  activeTabId,
  editorView,
  view,
  previewHtml,
  previewScrollerRef,
}: UsePreviewScrollSyncParams) {
  const { releaseScrollSyncLock, runWithScrollSyncLock } = useScrollSyncLock();

  useEffect(() => {
    const previewScroller = previewScrollerRef.current;
    const currentEditorView = editorView;
    const editorScroller = currentEditorView?.scrollDOM ?? null;
    if (
      !currentEditorView ||
      !editorScroller ||
      !previewScroller ||
      view !== "split"
    ) {
      return;
    }

    function syncScroll(source: HTMLElement, target: HTMLElement, nextTop: number | null) {
      if (nextTop === null || scrollRange(target) <= 0) {
        return;
      }

      runWithScrollSyncLock(source, () => {
        target.scrollTop = clamp(nextTop, 0, scrollRange(target));
      });
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
      releaseScrollSyncLock();
    };
  }, [
    activeTabId,
    editorView,
    previewHtml,
    previewScrollerRef,
    releaseScrollSyncLock,
    runWithScrollSyncLock,
    view,
  ]);
}
