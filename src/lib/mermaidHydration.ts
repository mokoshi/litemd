import { addMermaidZoomControls } from "./mermaidZoom";

let renderSequence = 0;
let mermaidInitialized = false;

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

export function hydrateMermaidCharts(
  container: HTMLElement,
  afterRender?: () => void,
) {
  let cancelled = false;
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
