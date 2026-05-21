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
    view: "split",
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
          view: "diff",
        },
        {
          path: "/tmp/a.md",
          view: "preview",
        },
        {
          path: "/tmp/b.md",
          view: "invalid",
        },
        {
          path: "",
        },
      ],
      activePath: "/tmp/a.md",
    });

    expect(session).toEqual({
      version: 2,
      tabs: [
        {
          path: "/tmp/a.md",
          view: "diff",
        },
        {
          path: "/tmp/b.md",
          view: "split",
        },
      ],
      activePath: "/tmp/a.md",
    });
  });

  it("reads view state from legacy mode and layout fields", () => {
    const session = parseStoredSessionValue({
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
          layout: "previewOnly",
        },
      ],
      activePath: "/tmp/b.md",
    });

    expect(session).toEqual({
      version: 2,
      tabs: [
        {
          path: "/tmp/a.md",
          view: "diff",
        },
        {
          path: "/tmp/b.md",
          view: "preview",
        },
      ],
      activePath: "/tmp/b.md",
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
          view: "diff",
        },
      ],
      "/tmp/a.md",
    );

    expect(JSON.parse(snapshot ?? "")).toEqual({
      version: 2,
      tabs: [
        {
          path: "/tmp/a.md",
          view: "diff",
        },
      ],
      activePath: "/tmp/a.md",
    });
  });

  it("uses null snapshot for an empty tab set", () => {
    expect(createSessionSnapshot([], null)).toBeNull();
  });
});
