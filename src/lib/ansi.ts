// Terminal output with colour codes (ANSI SGR) → styled spans, so command output looks like it
// does in Zed's terminal cards. Other escape sequences are dropped.
import type { Theme } from "./theme";

export type AnsiSpan = { text: string; color?: string; bg?: string; bold?: boolean; dim?: boolean };

function named(i: number, t: Theme, bright: boolean): string {
  const s = t.syntax;
  const c = [bright ? t.faint : t.muted, t.error, t.success, t.warning, s.function, s.keyword, s.type, t.text][i];
  return c ?? t.text;
}

function xterm256(n: number, t: Theme): string {
  if (n < 8) return named(n, t, false);
  if (n < 16) return named(n - 8, t, true);
  if (n < 232) {
    const v = n - 16;
    const k = (x: number) => (x ? 55 + x * 40 : 0);
    return `rgb(${k(Math.floor(v / 36))},${k(Math.floor(v / 6) % 6)},${k(v % 6)})`;
  }
  const g = 8 + (n - 232) * 10;
  return `rgb(${g},${g},${g})`;
}

export function parseAnsi(input: string, t: Theme): AnsiSpan[] {
  const out: AnsiSpan[] = [];
  let cur: Omit<AnsiSpan, "text"> = {};
  // CSI sequences: ESC [ params letter. Only "m" (colours) is applied.
  const re = /\x1b\[([0-9;?]*)([A-Za-z])|\x1b\][^\x07]*(?:\x07|\x1b\\)|\r(?!\n)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (prev && prev.color === cur.color && prev.bg === cur.bg && prev.bold === cur.bold && prev.dim === cur.dim) prev.text += text;
    else out.push({ text, ...cur });
  };
  while ((m = re.exec(input))) {
    push(input.slice(last, m.index));
    last = re.lastIndex;
    if (m[2] !== "m") continue;
    const codes = (m[1] || "0").split(";").map((x) => Number(x) || 0);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) cur = {};
      else if (c === 1) cur = { ...cur, bold: true };
      else if (c === 2) cur = { ...cur, dim: true };
      else if (c === 22) cur = { ...cur, bold: false, dim: false };
      else if (c >= 30 && c <= 37) cur = { ...cur, color: named(c - 30, t, false) };
      else if (c >= 90 && c <= 97) cur = { ...cur, color: named(c - 90, t, true) };
      else if (c === 39) cur = { ...cur, color: undefined };
      else if (c >= 40 && c <= 47) cur = { ...cur, bg: named(c - 40, t, false) };
      else if (c >= 100 && c <= 107) cur = { ...cur, bg: named(c - 100, t, true) };
      else if (c === 49) cur = { ...cur, bg: undefined };
      else if ((c === 38 || c === 48) && codes[i + 1] === 5) {
        const col = xterm256(codes[i + 2] ?? 0, t);
        cur = c === 38 ? { ...cur, color: col } : { ...cur, bg: col };
        i += 2;
      } else if ((c === 38 || c === 48) && codes[i + 1] === 2) {
        const col = `rgb(${codes[i + 2] ?? 0},${codes[i + 3] ?? 0},${codes[i + 4] ?? 0})`;
        cur = c === 38 ? { ...cur, color: col } : { ...cur, bg: col };
        i += 4;
      }
    }
  }
  push(input.slice(last));
  return out;
}

export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "");
