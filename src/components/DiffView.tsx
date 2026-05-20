import { useEffect, useMemo, useRef } from "react";
import { changedLines } from "../lib/diff";
import { markdown } from "../lib/markdown";
import { renderUnifiedDiffHtml, markChangedBlocks } from "../lib/renderedDiff";
import { scrollRange } from "../lib/scrollSync";
import { hydratePreviewHtml } from "../lib/previewHydration";
import { useScrollSyncLock } from "../hooks/useScrollSyncLock";
import type { DiffLayout } from "../types";

type DiffViewProps = {
  original: string;
  modified: string;
  layout: DiffLayout;
};

export function DiffView({ original, modified, layout }: DiffViewProps) {
  const originalRef = useRef<HTMLElement | null>(null);
  const modifiedRef = useRef<HTMLElement | null>(null);
  const unifiedRef = useRef<HTMLElement | null>(null);
  const { releaseScrollSyncLock, runWithScrollSyncLock } =
    useScrollSyncLock(120);
  const originalHtml = useMemo(() => markdown.render(original), [original]);
  const modifiedHtml = useMemo(() => markdown.render(modified), [modified]);
  const changed = useMemo(
    () => changedLines(original, modified),
    [original, modified],
  );
  const unifiedHtml = useMemo(
    () => renderUnifiedDiffHtml(original, modified),
    [original, modified],
  );

  useEffect(() => {
    if (layout !== "sideBySide") {
      return;
    }

    const originalContainer = originalRef.current;
    const modifiedContainer = modifiedRef.current;
    if (!originalContainer || !modifiedContainer) {
      return;
    }

    const cleanupOriginal = hydratePreviewHtml(
      originalContainer,
      originalHtml,
      () => markChangedBlocks(originalContainer, changed.original, "original"),
    );
    const cleanupModified = hydratePreviewHtml(
      modifiedContainer,
      modifiedHtml,
      () => markChangedBlocks(modifiedContainer, changed.modified, "modified"),
    );

    return () => {
      cleanupOriginal();
      cleanupModified();
    };
  }, [changed, layout, modifiedHtml, originalHtml]);

  useEffect(() => {
    if (layout !== "unified") {
      return;
    }

    const unifiedContainer = unifiedRef.current;
    if (!unifiedContainer) {
      return;
    }

    return hydratePreviewHtml(unifiedContainer, unifiedHtml);
  }, [layout, unifiedHtml]);

  useEffect(() => {
    if (layout !== "sideBySide") {
      return;
    }

    const originalContainer = originalRef.current;
    const modifiedContainer = modifiedRef.current;
    if (!originalContainer || !modifiedContainer) {
      return;
    }

    function syncScroll(source: HTMLElement, target: HTMLElement) {
      const sourceRange = scrollRange(source);
      const targetRange = scrollRange(target);
      if (sourceRange <= 0 || targetRange <= 0) {
        return;
      }

      runWithScrollSyncLock(source, () => {
        target.scrollTop = (source.scrollTop / sourceRange) * targetRange;
      });
    }

    const handleOriginalScroll = () => {
      syncScroll(originalContainer, modifiedContainer);
    };
    const handleModifiedScroll = () => {
      syncScroll(modifiedContainer, originalContainer);
    };

    originalContainer.addEventListener("scroll", handleOriginalScroll, {
      passive: true,
    });
    modifiedContainer.addEventListener("scroll", handleModifiedScroll, {
      passive: true,
    });

    return () => {
      originalContainer.removeEventListener("scroll", handleOriginalScroll);
      modifiedContainer.removeEventListener("scroll", handleModifiedScroll);
      releaseScrollSyncLock();
    };
  }, [layout, releaseScrollSyncLock, runWithScrollSyncLock]);

  if (layout === "unified") {
    return (
      <div className="diff-view rendered-diff-view rendered-diff-unified-view">
        <article
          ref={unifiedRef}
          className="preview rendered-diff-unified-preview"
        />
      </div>
    );
  }

  return (
    <div className="diff-view rendered-diff-view">
      <section className="rendered-diff-pane">
        <div className="rendered-diff-header">HEAD</div>
        <article
          ref={originalRef}
          className="preview rendered-diff-preview"
        />
      </section>
      <section className="rendered-diff-pane">
        <div className="rendered-diff-header">Current</div>
        <article
          ref={modifiedRef}
          className="preview rendered-diff-preview"
        />
      </section>
    </div>
  );
}
