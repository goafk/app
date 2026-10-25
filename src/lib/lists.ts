// Markdown list continuation, like Zed's editor: Enter on "1. foo" starts "2. ", on "- foo" starts "- ",
// on "- [x] foo" starts "- [ ] ". Enter on an empty item ends the list instead. Numbered lists renumber as items come and go.

const ORDERED = /^(\s*)(\d+)([.)])(\s+)(.*)$/;
const BULLET = /^(\s*)([-*+])(\s+)(\[[ xX]\]\s+)?(.*)$/;

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

const indentOf = (line: string) => /^\s*/.exec(line)![0].length;

/**
 * Renumbers the numbered list around the line holding `caret` (or the line after it): its first item keeps
 * its number (or takes `start.n`, when the list now starts at the caret) and the rest count on from there. Only items with the same indent and delimiter count;
 * deeper-indented lines (nested lists, wrapped text) are skipped, and a blank line or anything else ends it.
 * Returns null when every number was already right.
 */
function renumber(text: string, caret: number, start?: { indent: string; delim: string; n: number }): { text: string; caret: number } | null {
  const lines = text.split("\n");
  let at = text.slice(0, caret).split("\n").length - 1;
  let m = ORDERED.exec(lines[at]);
  if (!m && at + 1 < lines.length) m = ORDERED.exec(lines[++at]);
  if (!m) return null;
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
  let shift = 0; // how much the text before the caret grew or shrank
  let offset = lines.slice(0, first).reduce((a, l) => a + l.length + 1, 0);
  for (let j = restart ? first : first + 1; j < lines.length; j++) {
    if (j > first) offset += lines[j - 1].length + 1;
    const x = item(lines[j]);
    if (x) {
      const line = `${indent}${++n}${delim}${x[4]}${x[5]}`;
      if (line !== lines[j]) {
        if (offset < caret) shift += line.length - lines[j].length;
        lines[j] = line;
        changed = true;
      }
    } else if (!nested(lines[j])) break;
  }
  return changed ? { text: lines.join("\n"), caret: caret + shift } : null;
}
