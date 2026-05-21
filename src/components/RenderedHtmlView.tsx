import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { hydratePreviewHtml } from "../lib/previewHydration";

type RenderedHtmlViewProps = {
  className?: string;
  html: string;
};

export const RenderedHtmlView = forwardRef<HTMLElement, RenderedHtmlViewProps>(
  function RenderedHtmlView({ className = "preview", html }, ref) {
    const containerRef = useRef<HTMLElement | null>(null);
    useImperativeHandle(ref, () => containerRef.current as HTMLElement, []);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      return hydratePreviewHtml(container, html);
    }, [html]);

    return <article ref={containerRef} className={className} />;
  },
);
