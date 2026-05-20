export type ChangedLines = {
  original: Set<number>;
  modified: Set<number>;
};

export type DiffOp = {
  type: "equal" | "remove" | "add";
  lines: string[];
};

export function splitLines(source: string) {
  return source.length === 0 ? [] : source.split(/\r?\n/);
}

function lcsMatrix(originalLines: string[], modifiedLines: string[]) {
  const lcs = Array.from(
    { length: originalLines.length + 1 },
    () => new Uint32Array(modifiedLines.length + 1),
  );

  for (let i = originalLines.length - 1; i >= 0; i -= 1) {
    for (let j = modifiedLines.length - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        originalLines[i] === modifiedLines[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  return lcs;
}

export function changedLines(original: string, modified: string): ChangedLines {
  const originalLines = splitLines(original);
  const modifiedLines = splitLines(modified);
  const lcs = lcsMatrix(originalLines, modifiedLines);
  const changedOriginal = new Set<number>();
  const changedModified = new Set<number>();
  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < modifiedLines.length) {
    if (
      i < originalLines.length &&
      j < modifiedLines.length &&
      originalLines[i] === modifiedLines[j]
    ) {
      i += 1;
      j += 1;
      continue;
    }

    if (
      j < modifiedLines.length &&
      (i === originalLines.length || lcs[i][j + 1] >= lcs[i + 1][j])
    ) {
      changedModified.add(j + 1);
      j += 1;
      continue;
    }

    if (i < originalLines.length) {
      changedOriginal.add(i + 1);
      i += 1;
    }
  }

  return {
    original: changedOriginal,
    modified: changedModified,
  };
}

function pushDiffOp(ops: DiffOp[], type: DiffOp["type"], line: string) {
  const last = ops[ops.length - 1];
  if (last?.type === type) {
    last.lines.push(line);
    return;
  }

  ops.push({
    type,
    lines: [line],
  });
}

export function lineDiff(original: string, modified: string) {
  const originalLines = splitLines(original);
  const modifiedLines = splitLines(modified);
  const lcs = lcsMatrix(originalLines, modifiedLines);
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < modifiedLines.length) {
    if (
      i < originalLines.length &&
      j < modifiedLines.length &&
      originalLines[i] === modifiedLines[j]
    ) {
      pushDiffOp(ops, "equal", modifiedLines[j]);
      i += 1;
      j += 1;
      continue;
    }

    if (
      j < modifiedLines.length &&
      (i === originalLines.length || lcs[i][j + 1] >= lcs[i + 1][j])
    ) {
      pushDiffOp(ops, "add", modifiedLines[j]);
      j += 1;
      continue;
    }

    if (i < originalLines.length) {
      pushDiffOp(ops, "remove", originalLines[i]);
      i += 1;
    }
  }

  return ops;
}
