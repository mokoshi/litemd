type WebKitGestureEvent = Event & {
  scale?: number;
};

const mermaidZoomByKey = new Map<string, number>();
const MERMAID_ZOOM_MIN = 50;
const MERMAID_ZOOM_MAX = 240;
const MERMAID_ZOOM_STEP = 10;
const MERMAID_ZOOM_DEFAULT = 100;
const MERMAID_WHEEL_ZOOM_SPEED = 0.08;

export function hashString(value: string) {
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

export function addMermaidZoomControls(chart: HTMLElement, source: string) {
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

