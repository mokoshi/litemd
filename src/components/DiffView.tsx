import { useEffect, useMemo, useRef } from "react";
import { renderUnifiedDiffHtml } from "../lib/renderedDiff";
import { hydratePreviewHtml } from "../lib/previewHydration";

type DiffViewProps = {
  original: string;
  modified: string;
};

export function DiffView({ original, modified }: DiffViewProps) {
  const unifiedRef = useRef<HTMLElement | null>(null);
  const unifiedHtml = useMemo(
    () => renderUnifiedDiffHtml(original, modified),
    [original, modified],
  );

  useEffect(() => {
    const unifiedContainer = unifiedRef.current;
    if (!unifiedContainer) {
      return;
    }

    return hydratePreviewHtml(unifiedContainer, unifiedHtml);
  }, [unifiedHtml]);

  return (
    <div className="diff-view rendered-diff-view">
      <article
        ref={unifiedRef}
        className="preview rendered-diff-preview"
      />
    </div>
  );
}
