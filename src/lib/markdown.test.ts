import { describe, expect, it } from "vitest";
import { markdown } from "./markdown";

describe("markdown renderer", () => {
  it("adds source line metadata to block tokens", () => {
    const html = markdown.render("# Title\n\nBody");

    expect(html).toContain('data-source-line="1"');
    expect(html).toContain('data-source-line-end="1"');
    expect(html).toContain('data-source-line="3"');
    expect(html).toContain('data-source-line-end="3"');
  });
});
