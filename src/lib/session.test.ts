import { describe, expect, it } from "vitest";
import { createSessionSnapshot, parseStoredSessionJson, parseStoredSessionValue } from "./session";
import type { EditorTab } from "../types";

function editorTab(path: string): EditorTab {
  return {
    id: `file:${path}`,
    path,
    title: path,
    content: "",
    savedContent: "",
    fileSignature: { modified_ms: null, len: 0 },
    mode: "preview",
    layout: "split",
    diffLayout: "sideBySide",
    gitContext: null,
    saveState: "saved",
    status: "Saved",
  };
}

describe("session storage", () => {
  it("normalizes stored tabs and removes duplicate paths", () => {
    const session = parseStoredSessionValue({
      tabs: [
        {
          path: "/tmp/a.md",
          mode: "diff",
          layout: "previewOnly",
          diffLayout: "unified",
        },
        {
          path: "/tmp/a.md",
          mode: "preview",
        },
        {
          path: "/tmp/b.md",
          mode: "invalid",
          layout: "invalid",
          diffLayout: "invalid",
        },
        {
          path: "",
        },
      ],
      activePath: "/tmp/a.md",
    });

    expect(session).toEqual({
      version: 1,
      tabs: [
        {
          path: "/tmp/a.md",
          mode: "diff",
          layout: "previewOnly",
          diffLayout: "unified",
        },
        {
          path: "/tmp/b.md",
          mode: "preview",
          layout: "split",
          diffLayout: "sideBySide",
        },
      ],
      activePath: "/tmp/a.md",
    });
  });

  it("ignores invalid JSON or missing tab arrays", () => {
    expect(parseStoredSessionJson("{")).toBeNull();
    expect(parseStoredSessionValue({ tabs: "not tabs" })).toBeNull();
    expect(parseStoredSessionValue(null)).toBeNull();
  });

  it("serializes open tabs without editor contents", () => {
    const snapshot = createSessionSnapshot(
      [
        {
          ...editorTab("/tmp/a.md"),
          content: "draft content",
          mode: "diff",
          diffLayout: "unified",
        },
      ],
      "/tmp/a.md",
    );

    expect(JSON.parse(snapshot ?? "")).toEqual({
      version: 1,
      tabs: [
        {
          path: "/tmp/a.md",
          mode: "diff",
          layout: "split",
          diffLayout: "unified",
        },
      ],
      activePath: "/tmp/a.md",
    });
  });

  it("uses null snapshot for an empty tab set", () => {
    expect(createSessionSnapshot([], null)).toBeNull();
  });
});
