export type PreviewAnchor = {
  line: number;
  top: number;
};

export const SCROLL_SYNC_RELEASE_MS = 140;
export const SCROLL_END_EPSILON = 2;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function scrollRange(element: HTMLElement) {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

export function ratioScrollTop(source: HTMLElement, target: HTMLElement) {
  const sourceRange = scrollRange(source);
  const targetRange = scrollRange(target);
  if (sourceRange <= 0 || targetRange <= 0) {
    return null;
  }

  return (source.scrollTop / sourceRange) * targetRange;
}

export function isNearScrollEnd(element: HTMLElement) {
  return scrollRange(element) - element.scrollTop <= SCROLL_END_EPSILON;
}

export function collectPreviewAnchors(scroller: HTMLElement) {
  const scrollerTop = scroller.getBoundingClientRect().top;
  const anchors = Array.from(
    scroller.querySelectorAll<HTMLElement>("[data-source-line]"),
  )
    .map((element) => {
      const line = Number(element.dataset.sourceLine);
      if (!Number.isFinite(line) || line <= 0) {
        return null;
      }

      return {
        line,
        top:
          element.getBoundingClientRect().top -
          scrollerTop +
          scroller.scrollTop,
      };
    })
    .filter((anchor): anchor is PreviewAnchor => anchor !== null)
    .sort((a, b) => a.line - b.line || a.top - b.top);

  const deduped: PreviewAnchor[] = [];
  for (const anchor of anchors) {
    const last = deduped[deduped.length - 1];
    if (!last || last.line !== anchor.line) {
      deduped.push(anchor);
    }
  }

  return deduped;
}

export function interpolateTopForLine(anchors: PreviewAnchor[], line: number) {
  if (anchors.length === 0) {
    return null;
  }

  if (line <= anchors[0].line) {
    return anchors[0].top;
  }

  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const next = anchors[index];
    if (line > next.line) {
      continue;
    }

    const lineSpan = next.line - previous.line;
    const progress = lineSpan > 0 ? (line - previous.line) / lineSpan : 0;
    return previous.top + (next.top - previous.top) * progress;
  }

  return anchors[anchors.length - 1].top;
}

export function interpolateLineForTop(anchors: PreviewAnchor[], top: number) {
  if (anchors.length === 0) {
    return null;
  }

  if (top <= anchors[0].top) {
    return anchors[0].line;
  }

  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const next = anchors[index];
    if (top > next.top) {
      continue;
    }

    const topSpan = next.top - previous.top;
    const progress = topSpan > 0 ? (top - previous.top) / topSpan : 0;
    return previous.line + (next.line - previous.line) * progress;
  }

  return anchors[anchors.length - 1].line;
}
