import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type MarkdownPreviewProps = {
  html: string;
};

type WebKitGestureEvent = Event & {
  scale?: number;
};

let renderSequence = 0;
let mermaidInitialized = false;
const mermaidZoomByKey = new Map<string, number>();
const MERMAID_ZOOM_MIN = 50;
const MERMAID_ZOOM_MAX = 240;
const MERMAID_ZOOM_STEP = 10;
const MERMAID_ZOOM_DEFAULT = 100;
const MERMAID_WHEEL_ZOOM_SPEED = 0.08;

async function loadMermaid() {
  const mermaid = (await import("mermaid")).default;

  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "dark",
    });
    mermaidInitialized = true;
  }

  return mermaid;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function mermaidZoomKey(source: string, sourceLine: string | null) {
  return `${sourceLine ?? "inline"}:${source.length}:${hashString(source)}`;
}

function svgBaseWidth(svg: SVGSVGElement) {
  const viewBox = svg
    .getAttribute("viewBox")
    ?.trim()
    .split(/\s+/)
    .map(Number);
  if (viewBox?.length === 4 && Number.isFinite(viewBox[2]) && viewBox[2] > 0) {
    return viewBox[2];
  }

  const width = Number.parseFloat(svg.getAttribute("width") ?? "");
  if (Number.isFinite(width) && width > 0) {
    return width;
  }

  const measuredWidth = svg.getBoundingClientRect().width;
  return measuredWidth > 0 ? measuredWidth : 640;
}

function addMermaidZoomControls(chart: HTMLElement, source: string) {
  const svg = chart.querySelector<SVGSVGElement>("svg");
  if (!svg) {
    return;
  }

  const chartSvg = svg;
  const zoomKey = mermaidZoomKey(source, chart.dataset.sourceLine ?? null);
  const baseWidth = svgBaseWidth(chartSvg);
  const controls = document.createElement("div");
  const viewport = document.createElement("div");
  const zoomOutButton = document.createElement("button");
  const zoomInButton = document.createElement("button");
  const resetButton = document.createElement("button");
  const range = document.createElement("input");
  const value = document.createElement("span");

  controls.className = "mermaid-controls";
  viewport.className = "mermaid-chart-viewport";
  range.className = "mermaid-zoom-range";
  value.className = "mermaid-zoom-value";

  zoomOutButton.type = "button";
  zoomOutButton.textContent = "-";
  zoomOutButton.setAttribute("aria-label", "Zoom Mermaid chart out");

  zoomInButton.type = "button";
  zoomInButton.textContent = "+";
  zoomInButton.setAttribute("aria-label", "Zoom Mermaid chart in");

  resetButton.type = "button";
  resetButton.textContent = "100%";
  resetButton.setAttribute("aria-label", "Reset Mermaid chart zoom");

  range.type = "range";
  range.min = String(MERMAID_ZOOM_MIN);
  range.max = String(MERMAID_ZOOM_MAX);
  range.step = "1";
  range.setAttribute("aria-label", "Mermaid chart zoom");

  Array.from(chart.childNodes).forEach((node) => viewport.appendChild(node));
  chart.append(controls, viewport);

  function currentZoom() {
    const zoom = Number(range.value);
    return Number.isFinite(zoom) ? zoom : MERMAID_ZOOM_DEFAULT;
  }

  function setZoom(nextZoom: number) {
    const zoom = Math.round(
      Math.min(Math.max(nextZoom, MERMAID_ZOOM_MIN), MERMAID_ZOOM_MAX),
    );
    mermaidZoomByKey.set(zoomKey, zoom);
    chart.dataset.zoom = String(zoom);
    chartSvg.style.width = `${Math.round((baseWidth * zoom) / 100)}px`;
    chartSvg.style.height = "auto";
    chartSvg.style.maxWidth = "none";
    range.value = String(zoom);
    value.textContent = `${zoom}%`;
    zoomOutButton.disabled = zoom <= MERMAID_ZOOM_MIN;
    zoomInButton.disabled = zoom >= MERMAID_ZOOM_MAX;
    resetButton.disabled = zoom === MERMAID_ZOOM_DEFAULT;
  }

  function handlePinchWheel(event: WheelEvent) {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    setZoom(currentZoom() - event.deltaY * MERMAID_WHEEL_ZOOM_SPEED);
  }

  let gestureStartZoom = MERMAID_ZOOM_DEFAULT;

  function handleGestureStart(event: Event) {
    event.preventDefault();
    gestureStartZoom = currentZoom();
  }

  function handleGestureChange(event: Event) {
    const scale = (event as WebKitGestureEvent).scale;
    if (!Number.isFinite(scale) || !scale || scale <= 0) {
      return;
    }

    event.preventDefault();
    setZoom(gestureStartZoom * scale);
  }

  function handleGestureEnd(event: Event) {
    event.preventDefault();
    gestureStartZoom = currentZoom();
  }

  chart.addEventListener("wheel", handlePinchWheel, { passive: false });
  chart.addEventListener("gesturestart", handleGestureStart);
  chart.addEventListener("gesturechange", handleGestureChange);
  chart.addEventListener("gestureend", handleGestureEnd);

  zoomOutButton.addEventListener("click", () => {
    setZoom(Number(range.value) - MERMAID_ZOOM_STEP);
  });
  zoomInButton.addEventListener("click", () => {
    setZoom(Number(range.value) + MERMAID_ZOOM_STEP);
  });
  resetButton.addEventListener("click", () => {
    setZoom(MERMAID_ZOOM_DEFAULT);
  });
  range.addEventListener("input", () => {
    setZoom(Number(range.value));
  });

  controls.append(zoomOutButton, range, value, zoomInButton, resetButton);
  setZoom(mermaidZoomByKey.get(zoomKey) ?? MERMAID_ZOOM_DEFAULT);
}

export function hydratePreviewHtml(
  container: HTMLElement,
  html: string,
  afterRender?: () => void,
) {
  let cancelled = false;
  container.innerHTML = html;
  afterRender?.();

  const codeBlocks = Array.from(
    container.querySelectorAll<HTMLElement>(
      "pre > code.language-mermaid, pre > code.lang-mermaid",
    ),
  );

  async function renderCharts() {
    if (codeBlocks.length === 0) {
      return;
    }

    const mermaid = await loadMermaid();

    for (const codeBlock of codeBlocks) {
      const source = codeBlock.textContent ?? "";
      const pre = codeBlock.parentElement;
      const chart = document.createElement("div");
      const sourceLine =
        codeBlock.dataset.sourceLine ?? pre?.dataset.sourceLine ?? null;
      const sourceLineEnd =
        codeBlock.dataset.sourceLineEnd ?? pre?.dataset.sourceLineEnd ?? null;

      chart.className = "mermaid-chart";
      if (sourceLine) {
        chart.dataset.sourceLine = sourceLine;
      }
      if (sourceLineEnd) {
        chart.dataset.sourceLineEnd = sourceLineEnd;
      }

      pre?.replaceWith(chart);

      try {
        const renderId = `mermaid-chart-${Date.now()}-${renderSequence++}`;
        const { svg, bindFunctions } = await mermaid.render(renderId, source);

        if (cancelled) {
          return;
        }

        chart.innerHTML = svg;
        bindFunctions?.(chart);
        addMermaidZoomControls(chart, source);
      } catch (error) {
        chart.className = "mermaid-chart mermaid-error";
        chart.textContent = error instanceof Error ? error.message : String(error);
      }
    }

    if (!cancelled) {
      afterRender?.();
    }
  }

  void renderCharts();

  return () => {
    cancelled = true;
  };
}

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
