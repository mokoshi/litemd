import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { hydratePreviewHtml } from "../lib/previewHydration";

type MarkdownPreviewProps = {
  html: string;
};

export const MarkdownPreview = forwardRef<HTMLElement, MarkdownPreviewProps>(
  function MarkdownPreview({ html }, ref) {
    const containerRef = useRef<HTMLElement | null>(null);
    useImperativeHandle(ref, () => containerRef.current as HTMLElement, []);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      return hydratePreviewHtml(container, html);
    }, [html]);

    return <article ref={containerRef} className="preview" />;
  },
);
