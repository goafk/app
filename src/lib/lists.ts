// Markdown list editing, like Zed's editor: Enter on "1. foo" starts "2. ", on "- foo" starts "- ",
// on "- [x] foo" starts "- [ ] ". Enter on an empty item ends the list instead. Numbered lists renumber
// as items come and go. Plus the composer toolbar's edits: indent, outdent, checklist, code.

const ORDERED = /^(\s*)(\d+)([.)])(\s+)(.*)$/;
const BULLET = /^(\s*)([-*+])(\s+)(\[[ xX]\]\s+)?(.*)$/;

/** Text plus the selection to show after an edit. */
export type Edit = { text: string; start: number; end: number };

/**
 * Given the text before and after one edit, returns the continued text and where the caret goes,
 * or null when the edit wasn't a single newline typed in a list item. `at` is where the caret was:
 * a newline typed next to another one can't be placed from the text alone.
 */
export function continueList(prev: string, next: string, at?: number): { text: string; caret: number } | null {
  if (next.length !== prev.length + 1) return null;
  let i = 0;
  if (at !== undefined && at <= prev.length && next === prev.slice(0, at) + "\n" + prev.slice(at)) i = at;
  else {
    // Without the caret, a newline beside another one is taken as the later spot (a fresh line), so no list starts.
    while (i < prev.length && prev[i] === next[i]) i++;
    if (next[i] !== "\n" || next.slice(i + 1) !== prev.slice(i)) return null;
  }

  const lineStart = prev.lastIndexOf("\n", i - 1) + 1;
  const line = prev.slice(lineStart, i);
  const rest = prev.slice(i, prev.indexOf("\n", i) < 0 ? prev.length : prev.indexOf("\n", i));

  let marker: string;
  let empty: boolean;
  const o = ORDERED.exec(line);
  const b = o ? null : BULLET.exec(line);
  if (o) {
    marker = `${o[1]}${Number(o[2]) + 1}${o[3]}${o[4]}`;
    empty = !o[5].trim();
  } else if (b) {
    marker = `${b[1]}${b[2]}${b[3]}${b[4] ? "[ ] " : ""}`;
    empty = !b[5].trim();
  } else return null;

  // Enter on an empty item: drop the marker and leave the list.
  if (empty && !rest.trim()) return { text: prev.slice(0, lineStart) + prev.slice(i), caret: lineStart };
  const caret = i + 1 + marker.length;
  const text = next.slice(0, i + 1) + marker + next.slice(i + 1);
  return o ? (renumber(text, caret) ?? { text, caret }) : { text, caret };
}

/**
 * After a deletion (an item removed, lines cut), renumbers the numbered list the edit touched so it
 * stays 1, 2, 3…; null when nothing needed renumbering. The caret sits where the deletion happened.
 */
export function renumberAfterDelete(prev: string, next: string): { text: string; caret: number } | null {
  if (next.length >= prev.length) return null;
  let k = 0;
  while (k < next.length && prev[k] === next[k]) k++;
  // Cut whole items off the top: the list keeps the number the first cut item had.
  const cut = k === 0 || next[k - 1] === "\n" ? ORDERED.exec(prev.slice(k, k + prev.length - next.length).split("\n")[0]) : null;
  return renumber(next, k, cut ? { indent: cut[1], delim: cut[3], n: Number(cut[2]) } : undefined);
}

/** Indents (dir 1) or outdents (dir -1) the selected lines; list items move a nesting level. */
export function indentLines(text: string, start: number, end: number, dir: 1 | -1): Edit {
  return editLines(text, start, end, (lines, first, last) => {
    for (let j = first; j <= last; j++) {
      const line = lines[j];
      const width = ORDERED.test(line) ? 3 : 2; // nested items sit under the parent's text
      if (dir === 1) lines[j] = line.trim() ? " ".repeat(width) + line : line;
      else lines[j] = line.slice(Math.min(width, indentOf(line)));
    }
    // The moved items take their place in their new list, and the lists they left close up.
    for (const j of [first, last + 1]) {
      const m = j < lines.length ? ORDERED.exec(lines[j]) : null;
      if (m) renumberLines(lines, j, { indent: m[1], delim: m[3], n: 1 });
    }
  });
}

/** Turns the selected lines into checklist items ("- [ ] "), or back into plain items if they all are. */
export function toggleChecklist(text: string, start: number, end: number): Edit {
  return editLines(text, start, end, (lines, first, last) => {
    const touched = lines.slice(first, last + 1);
    const allChecks = touched.filter((l) => l.trim()).every((l) => BULLET.exec(l)?.[4]);
    for (let j = first; j <= last; j++) {
      const line = lines[j];
      const b = BULLET.exec(line);
      const o = ORDERED.exec(line);
      if (allChecks) {
        if (b?.[4]) lines[j] = `${b[1]}${b[2]}${b[3]}${b[5]}`;
      } else if (b) {
        if (!b[4]) lines[j] = `${b[1]}${b[2]}${b[3]}[ ] ${b[5]}`;
      } else if (o) lines[j] = `${o[1]}- [ ] ${o[5]}`;
      else if (line.trim() || first === last) lines[j] = `${/^\s*/.exec(line)![0]}- [ ] ${line.trimStart()}`;
    }
  });
}

/** Inline code around a selection on one line, a fenced block around several, or an empty pair at the caret. */
export function toggleCode(text: string, start: number, end: number): Edit {
  const sel = text.slice(start, end);
  if (!sel.includes("\n")) {
    // Already wrapped: unwrap.
    if (sel && text[start - 1] === "`" && text[end] === "`") return { text: text.slice(0, start - 1) + sel + text.slice(end + 1), start: start - 1, end: end - 1 };
    return { text: `${text.slice(0, start)}\`${sel}\`${text.slice(end)}`, start: start + 1, end: end + 1 };
  }
  const before = start > 0 && text[start - 1] !== "\n" ? "\n" : "";
  const after = end < text.length && text[end] !== "\n" ? "\n" : "";
  const open = `${before}\`\`\`\n`;
  return { text: `${text.slice(0, start)}${open}${sel}\n\`\`\`${after}${text.slice(end)}`, start: start + open.length, end: start + open.length + sel.length };
}

const indentOf = (line: string) => /^\s*/.exec(line)![0].length;

/**
 * Runs a line-wise edit over the lines the selection touches, keeping the selection on the same
 * text (each end moves with its own line's growth or shrinkage).
 */
function editLines(text: string, start: number, end: number, fn: (lines: string[], first: number, last: number) => void): Edit {
  const lines = text.split("\n");
  const pos = (at: number) => {
    const before = text.slice(0, at).split("\n");
    return { line: before.length - 1, col: before[before.length - 1].length };
  };
  const a = pos(start);
  const b = pos(end);
  // A selection ending at the very start of a line doesn't take that line along.
  const last = b.line > a.line && b.col === 0 ? b.line - 1 : b.line;
  const old = [...lines];
  fn(lines, a.line, last);
  const back = (p: { line: number; col: number }) => {
    const grown = lines[p.line].length - old[p.line].length;
    const col = Math.max(0, Math.min(lines[p.line].length, p.col + grown));
    return lines.slice(0, p.line).reduce((n, l) => n + l.length + 1, 0) + col;
  };
  return { text: lines.join("\n"), start: back(a), end: back(b) };
}

/**
 * Renumbers the numbered list around the line holding `caret` (or the line after it): its first item keeps
 * its number (or takes `start.n`, when the list now starts at the caret) and the rest count on from there.
 * Returns null when every number was already right.
 */
function renumber(text: string, caret: number, start?: { indent: string; delim: string; n: number }): { text: string; caret: number } | null {
  const lines = text.split("\n");
  let at = text.slice(0, caret).split("\n").length - 1;
  if (!ORDERED.test(lines[at]) && at + 1 < lines.length && ORDERED.test(lines[at + 1])) at++;
  const old = [...lines];
  if (!renumberLines(lines, at, start)) return null;
  // Lines wholly before the caret that changed length move it.
  let shift = 0;
  let offset = 0;
  for (let j = 0; j < lines.length && offset + old[j].length < caret; j++) {
    shift += lines[j].length - old[j].length;
    offset += old[j].length + 1;
  }
  return { text: lines.join("\n"), caret: caret + shift };
}

/**
 * Renumbers, in place, the numbered list holding line `at`. Only items with the same indent and
 * delimiter count; deeper-indented lines (nested lists, wrapped text) are skipped, and a blank line
 * or anything else ends it. Returns whether any line changed.
 */
function renumberLines(lines: string[], at: number, start?: { indent: string; delim: string; n: number }): boolean {
  const m = ORDERED.exec(lines[at] ?? "");
  if (!m) return false;
  const indent = m[1];
  const delim = m[3];
  const item = (l: string) => {
    const x = ORDERED.exec(l);
    return x && x[1] === indent && x[3] === delim ? x : null;
  };
  const nested = (l: string) => !!l.trim() && indentOf(l) > indent.length;

  let first = at;
  for (let j = at - 1; j >= 0; j--) {
    if (item(lines[j])) first = j;
    else if (!nested(lines[j])) break;
  }

  const restart = first === at && start?.indent === indent && start.delim === delim;
  let n = restart ? start.n - 1 : Number(item(lines[first])![2]);
  let changed = false;
  for (let j = restart ? first : first + 1; j < lines.length; j++) {
    const x = item(lines[j]);
    if (x) {
      const line = `${indent}${++n}${delim}${x[4]}${x[5]}`;
      if (line !== lines[j]) {
        lines[j] = line;
        changed = true;
      }
    } else if (!nested(lines[j])) break;
  }
  return changed;
}
