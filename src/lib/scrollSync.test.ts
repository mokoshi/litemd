import { describe, expect, it } from "vitest";
import { interpolateLineForTop, interpolateTopForLine } from "./scrollSync";

const anchors = [
  { line: 1, top: 0 },
  { line: 11, top: 100 },
  { line: 21, top: 260 },
];

describe("scroll sync interpolation", () => {
  it("maps source lines to preview offsets", () => {
    expect(interpolateTopForLine([], 5)).toBeNull();
    expect(interpolateTopForLine(anchors, 1)).toBe(0);
    expect(interpolateTopForLine(anchors, 6)).toBe(50);
    expect(interpolateTopForLine(anchors, 16)).toBe(180);
    expect(interpolateTopForLine(anchors, 99)).toBe(260);
  });

  it("maps preview offsets back to source lines", () => {
    expect(interpolateLineForTop([], 50)).toBeNull();
    expect(interpolateLineForTop(anchors, 0)).toBe(1);
    expect(interpolateLineForTop(anchors, 50)).toBe(6);
    expect(interpolateLineForTop(anchors, 180)).toBe(16);
    expect(interpolateLineForTop(anchors, 999)).toBe(21);
  });
});
