import type { FileSignature } from "../types";

export function sameSignature(a: FileSignature, b: FileSignature) {
  return a.modified_ms === b.modified_ms && a.len === b.len;
}
