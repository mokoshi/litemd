import { useEffect, useMemo, useRef } from "react";
import { markdown } from "../lib/markdown";
import { hydratePreviewHtml } from "./MarkdownPreview";

type DiffViewProps = {
  original: string;
  modified: string;
  layout: DiffLayout;
};

export type DiffLayout = "sideBySide" | "unified";

type ChangedLines = {
  original: Set<number>;
  modified: Set<number>;
};

type DiffOp = {
  type: "equal" | "remove" | "add";
  lines: string[];
};

function splitLines(source: string) {
  return source.length === 0 ? [] : source.split(/\r?\n/);
}

function scrollRange(element: HTMLElement) {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function changedLines(original: string, modified: string): ChangedLines {
  const originalLines = splitLines(original);
  const modifiedLines = splitLines(modified);
  const lcs = Array.from(
    { length: originalLines.length + 1 },
    () => new Uint32Array(modifiedLines.length + 1),
  );

  for (let i = originalLines.length - 1; i >= 0; i -= 1) {
    for (let j = modifiedLines.length - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        originalLines[i] === modifiedLines[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const changedOriginal = new Set<number>();
  const changedModified = new Set<number>();
  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < modifiedLines.length) {
    if (
      i < originalLines.length &&
      j < modifiedLines.length &&
      originalLines[i] === modifiedLines[j]
    ) {
      i += 1;
      j += 1;
      continue;
    }

    if (
      j < modifiedLines.length &&
      (i === originalLines.length || lcs[i][j + 1] >= lcs[i + 1][j])
    ) {
      changedModified.add(j + 1);
      j += 1;
      continue;
    }

    if (i < originalLines.length) {
      changedOriginal.add(i + 1);
      i += 1;
    }
  }

  return {
    original: changedOriginal,
    modified: changedModified,
  };
}

function pushDiffOp(ops: DiffOp[], type: DiffOp["type"], line: string) {
  const last = ops[ops.length - 1];
  if (last?.type === type) {
    last.lines.push(line);
    return;
  }

  ops.push({
    type,
    lines: [line],
  });
}

function lineDiff(original: string, modified: string) {
  const originalLines = splitLines(original);
  const modifiedLines = splitLines(modified);
  const lcs = Array.from(
    { length: originalLines.length + 1 },
    () => new Uint32Array(modifiedLines.length + 1),
  );

  for (let i = originalLines.length - 1; i >= 0; i -= 1) {
    for (let j = modifiedLines.length - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        originalLines[i] === modifiedLines[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < modifiedLines.length) {
    if (
      i < originalLines.length &&
      j < modifiedLines.length &&
      originalLines[i] === modifiedLines[j]
    ) {
      pushDiffOp(ops, "equal", modifiedLines[j]);
      i += 1;
      j += 1;
      continue;
    }

    if (
      j < modifiedLines.length &&
      (i === originalLines.length || lcs[i][j + 1] >= lcs[i + 1][j])
    ) {
      pushDiffOp(ops, "add", modifiedLines[j]);
      j += 1;
      continue;
    }

    if (i < originalLines.length) {
      pushDiffOp(ops, "remove", originalLines[i]);
      i += 1;
    }
  }

  return ops;
}

function renderUnifiedDiffHtml(original: string, modified: string) {
  return lineDiff(original, modified)
    .map((op) => {
      const html = markdown.render(op.lines.join("\n"));
      if (op.type === "equal") {
        return `<section class="rendered-diff-unified-block">${html}</section>`;
      }

      const className =
        op.type === "add" ? "rendered-diff-added" : "rendered-diff-removed";
      const label = op.type === "add" ? "Added" : "Removed";

      return [
        `<section class="rendered-diff-unified-block rendered-diff-unified-change ${className}">`,
        `<div class="rendered-diff-unified-label">${label}</div>`,
        html,
        "</section>",
      ].join("");
    })
    .join("");
}

function lineRangeIntersects(
  changed: Set<number>,
  start: number,
  end: number,
) {
  for (let line = start; line <= end; line += 1) {
    if (changed.has(line)) {
      return true;
    }
  }

  return false;
}

function markChangedBlocks(
  container: HTMLElement,
  changed: Set<number>,
  side: "original" | "modified",
) {
  const changedClass =
    side === "original" ? "rendered-diff-removed" : "rendered-diff-added";

  container
    .querySelectorAll<HTMLElement>(".rendered-diff-changed")
    .forEach((element) => {
      element.classList.remove(
        "rendered-diff-changed",
        "rendered-diff-removed",
        "rendered-diff-added",
      );
    });

  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>("[data-source-line]"),
  ).filter((element) => {
    const start = Number(element.dataset.sourceLine);
    const end = Number(element.dataset.sourceLineEnd ?? start);

    return (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      lineRangeIntersects(changed, start, end)
    );
  });

  candidates
    .filter(
      (element) =>
        !candidates.some(
          (candidate) => candidate !== element && element.contains(candidate),
        ),
    )
    .forEach((element) => {
      element.classList.add("rendered-diff-changed", changedClass);
    });
}

export function DiffView({ original, modified, layout }: DiffViewProps) {
  const originalRef = useRef<HTMLElement | null>(null);
  const modifiedRef = useRef<HTMLElement | null>(null);
  const unifiedRef = useRef<HTMLElement | null>(null);
  const scrollSyncSource = useRef<HTMLElement | null>(null);
  const scrollSyncReleaseTimer = useRef<number | null>(null);
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
      if (scrollSyncSource.current && scrollSyncSource.current !== source) {
        return;
      }

      const sourceRange = scrollRange(source);
      const targetRange = scrollRange(target);
      if (sourceRange <= 0 || targetRange <= 0) {
        return;
      }

      scrollSyncSource.current = source;
      target.scrollTop = (source.scrollTop / sourceRange) * targetRange;

      if (scrollSyncReleaseTimer.current) {
        window.clearTimeout(scrollSyncReleaseTimer.current);
      }

      scrollSyncReleaseTimer.current = window.setTimeout(() => {
        scrollSyncSource.current = null;
        scrollSyncReleaseTimer.current = null;
      }, 120);
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
      if (scrollSyncReleaseTimer.current) {
        window.clearTimeout(scrollSyncReleaseTimer.current);
        scrollSyncReleaseTimer.current = null;
      }
      scrollSyncSource.current = null;
    };
  }, [layout]);

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
