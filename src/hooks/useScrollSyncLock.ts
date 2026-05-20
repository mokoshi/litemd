import { useCallback, useEffect, useRef } from "react";
import { SCROLL_SYNC_RELEASE_MS } from "../lib/scrollSync";

export function useScrollSyncLock(releaseMs = SCROLL_SYNC_RELEASE_MS) {
  const scrollSyncSource = useRef<HTMLElement | null>(null);
  const scrollSyncReleaseTimer = useRef<number | null>(null);

  const releaseScrollSyncLock = useCallback(() => {
    if (scrollSyncReleaseTimer.current) {
      window.clearTimeout(scrollSyncReleaseTimer.current);
      scrollSyncReleaseTimer.current = null;
    }

    scrollSyncSource.current = null;
  }, []);

  const runWithScrollSyncLock = useCallback(
    (source: HTMLElement, sync: () => void) => {
      if (scrollSyncSource.current && scrollSyncSource.current !== source) {
        return false;
      }

      scrollSyncSource.current = source;
      sync();

      if (scrollSyncReleaseTimer.current) {
        window.clearTimeout(scrollSyncReleaseTimer.current);
      }

      scrollSyncReleaseTimer.current = window.setTimeout(() => {
        scrollSyncSource.current = null;
        scrollSyncReleaseTimer.current = null;
      }, releaseMs);

      return true;
    },
    [releaseMs],
  );

  useEffect(() => releaseScrollSyncLock, [releaseScrollSyncLock]);

  return {
    releaseScrollSyncLock,
    runWithScrollSyncLock,
  };
}
