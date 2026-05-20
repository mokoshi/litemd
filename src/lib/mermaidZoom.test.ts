import { describe, expect, it } from "vitest";
import { hashString } from "./mermaidZoom";

describe("mermaid zoom helpers", () => {
  it("creates stable compact hashes for zoom persistence keys", () => {
    expect(hashString("graph TD\nA-->B")).toBe(hashString("graph TD\nA-->B"));
    expect(hashString("graph TD\nA-->B")).not.toBe(hashString("graph TD\nA-->C"));
  });
});

