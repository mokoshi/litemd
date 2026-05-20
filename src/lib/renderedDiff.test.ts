import { describe, expect, it } from "vitest";
import { renderUnifiedDiffHtml } from "./renderedDiff";

describe("rendered diff", () => {
  it("renders unified additions and removals as labeled blocks", () => {
    const html = renderUnifiedDiffHtml("old", "new");

    expect(html).toContain("rendered-diff-removed");
    expect(html).toContain("rendered-diff-added");
    expect(html).toContain("Removed");
    expect(html).toContain("Added");
  });
});

