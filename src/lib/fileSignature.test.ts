import { describe, expect, it } from "vitest";
import { sameSignature } from "./fileSignature";

describe("file signatures", () => {
  it("matches only identical modified time and length", () => {
    expect(
      sameSignature(
        { modified_ms: 100, len: 10 },
        { modified_ms: 100, len: 10 },
      ),
    ).toBe(true);
    expect(
      sameSignature(
        { modified_ms: 100, len: 10 },
        { modified_ms: 101, len: 10 },
      ),
    ).toBe(false);
    expect(
      sameSignature(
        { modified_ms: null, len: 10 },
        { modified_ms: null, len: 11 },
      ),
    ).toBe(false);
  });
});
