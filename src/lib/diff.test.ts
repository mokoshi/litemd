import { describe, expect, it } from "vitest";
import { lineDiff, splitLines } from "./diff";

describe("diff utilities", () => {
  it("splits empty and multiline sources", () => {
    expect(splitLines("")).toEqual([]);
    expect(splitLines("a\nb")).toEqual(["a", "b"]);
  });

  it("groups equal and added lines into diff operations", () => {
    expect(lineDiff("a", "a\nb")).toEqual([
      { type: "equal", lines: ["a"] },
      { type: "add", lines: ["b"] },
    ]);
  });

  it("groups removed lines into diff operations", () => {
    expect(lineDiff("a\nb", "a")).toEqual([
      { type: "equal", lines: ["a"] },
      { type: "remove", lines: ["b"] },
    ]);
  });
});
