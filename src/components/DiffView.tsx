import { useMemo } from "react";
import { renderUnifiedDiffHtml } from "../lib/renderedDiff";
import { RenderedHtmlView } from "./RenderedHtmlView";

type DiffViewProps = {
  original: string;
  modified: string;
};

export function DiffView({ original, modified }: DiffViewProps) {
  const unifiedHtml = useMemo(
    () => renderUnifiedDiffHtml(original, modified),
    [original, modified],
  );

  return (
    <div className="diff-view rendered-diff-view">
      <RenderedHtmlView
        className="preview rendered-diff-preview"
        html={unifiedHtml}
      />
    </div>
  );
}
