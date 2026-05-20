import { lineDiff } from "./diff";
import { markdown } from "./markdown";

export function renderUnifiedDiffHtml(original: string, modified: string) {
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

export function markChangedBlocks(
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

