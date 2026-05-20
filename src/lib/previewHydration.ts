import { hydrateMermaidCharts } from "./mermaidHydration";

export function hydratePreviewHtml(
  container: HTMLElement,
  html: string,
  afterRender?: () => void,
) {
  container.innerHTML = html;
  afterRender?.();

  return hydrateMermaidCharts(container, afterRender);
}
