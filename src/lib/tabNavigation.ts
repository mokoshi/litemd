import type { EditorTab } from "../types";

export function findTab(tabs: EditorTab[], id: string | null) {
  return tabs.find((tab) => tab.id === id) ?? null;
}

export function activeTabIdAfterRestore(
  tabs: EditorTab[],
  activePath: string | null,
) {
  return (
    tabs.find((tab) => tab.path === activePath)?.id ??
    tabs[0]?.id ??
    null
  );
}

export function tabIdAtOffset(
  tabs: EditorTab[],
  activeTabId: string | null,
  offset: number,
) {
  if (tabs.length === 0) {
    return null;
  }

  const currentIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTabId),
  );
  const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
  return tabs[nextIndex].id;
}

export function tabIdAtIndex(tabs: EditorTab[], index: number) {
  return tabs[index]?.id ?? null;
}

