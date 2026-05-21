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
