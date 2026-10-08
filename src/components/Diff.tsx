// Diffs for ACP `diff` tool content (file edits), drawn like Zed's edit cards.
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { mono, ui, useTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";
import { colorFor, tokenize } from "../lib/highlight";
import { FileBadge, fileExt } from "./FileIcon";

type Line = { kind: " " | "+" | "-"; text: string };

/** LCS line diff; falls back to "all removed / all added" for very large inputs. */
export function diffLines(oldText: string, newText: string): Line[] {
  const a = oldText ? oldText.split("\n") : [];
  const b = newText ? newText.split("\n") : [];
  if (a.length * b.length > 400_000) return [...a.map((t) => ({ kind: "-" as const, text: t })), ...b.map((t) => ({ kind: "+" as const, text: t }))];
  const n = a.length;
  const m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Line[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) (out.push({ kind: " ", text: a[i] }), i++, j++);
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: "-", text: a[i++] });
    else out.push({ kind: "+", text: b[j++] });
  }
  while (i < n) out.push({ kind: "-", text: a[i++] });
  while (j < m) out.push({ kind: "+", text: b[j++] });
  return out;
}

/** Keeps changed lines plus `ctx` lines of context, collapsing the rest. */
function hunks(lines: Line[], ctx = 2): Array<Line | { gap: number }> {
  const keep = lines.map((l, i) => l.kind !== " " || lines.slice(Math.max(0, i - ctx), i + ctx + 1).some((x) => x.kind !== " "));
  const out: Array<Line | { gap: number }> = [];
  let gap = 0;
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (gap) out.push({ gap });
      gap = 0;
      out.push(l);
    } else gap++;
  });
  if (gap) out.push({ gap });
  return out;
}

/** Pairs each removed line with the added line that replaced it (runs of − then + in a hunk). */
function pairs(rows: Array<Line | { gap: number }>): Map<number, number> {
  const m = new Map<number, number>();
  for (let i = 0; i < rows.length; ) {
    const del: number[] = [];
    const add: number[] = [];
    while (i < rows.length && "kind" in rows[i] && (rows[i] as Line).kind === "-") del.push(i++);
    while (i < rows.length && "kind" in rows[i] && (rows[i] as Line).kind === "+") add.push(i++);
    for (let k = 0; k < Math.min(del.length, add.length); k++) (m.set(del[k], add[k]), m.set(add[k], del[k]));
    if (!del.length && !add.length) i++;
  }
  return m;
}

/** Character ranges of `a` that aren't in `b`, by word (what changed within a line). */
function changedRanges(a: string, b: string): Array<[number, number]> {
  const ta = a.match(/\w+|\s+|[^\w\s]/g) ?? [];
  const tb = b.match(/\w+|\s+|[^\w\s]/g) ?? [];
  if (ta.length * tb.length > 40_000) return [];
  const dp = Array.from({ length: ta.length + 1 }, () => new Uint16Array(tb.length + 1));
  for (let i = ta.length - 1; i >= 0; i--) for (let j = tb.length - 1; j >= 0; j--) dp[i][j] = ta[i] === tb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Array<[number, number]> = [];
  let i = 0, j = 0, pos = 0, changed = 0;
  while (i < ta.length) {
    if (j < tb.length && ta[i] === tb[j]) (pos += ta[i].length, i++, j++);
    else if (j < tb.length && dp[i][j + 1] >= dp[i + 1][j]) j++;
    else {
      const start = pos;
      pos += ta[i].length;
      changed += ta[i].length;
      i++;
      const prev = out[out.length - 1];
      if (prev && prev[1] === start) prev[1] = pos;
      else out.push([start, pos]);
    }
  }
  // Mostly rewritten: highlighting nearly every word says nothing, so leave the line plain.
  return changed > a.trim().length * 0.6 ? [] : out.filter(([s0, e]) => a.slice(s0, e).trim());
}

type Piece = { text: string; color?: string; strong: boolean };

/** Syntax colours for a line, split where the changed-word ranges start and end. */
function pieces(text: string, lang: string, ranges: Array<[number, number]>, t: Theme): Piece[] {
  const out: Piece[] = [];
  let pos = 0;
  const inRange = (i: number) => ranges.some(([a, b]) => i >= a && i < b);
  for (const sp of tokenize(text, lang)) {
    const color = colorFor(sp.types, t);
    let k = 0;
    while (k < sp.text.length) {
      const strong = inRange(pos + k);
      let e = k + 1;
      while (e < sp.text.length && inRange(pos + e) === strong) e++;
      out.push({ text: sp.text.slice(k, e), color, strong });
      k = e;
    }
    pos += sp.text.length;
  }
  return out;
}

const LANG: Record<string, string> = { tsx: "tsx", ts: "typescript", mts: "typescript", cts: "typescript", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript", php: "php", py: "python", rb: "ruby", rs: "rust", go: "go", swift: "swift", kt: "kotlin", java: "java", json: "json", yml: "yaml", yaml: "yaml", toml: "toml", sql: "sql", sh: "bash", zsh: "bash", bash: "bash", html: "markup", vue: "markup", svg: "markup", xml: "markup", dockerfile: "docker" };

/**
 * A file edit the way Zed's edit cards show it: unchanged lines as plain code, added lines on
 * green, removed on red, the words that changed within a line highlighted more strongly, all
 * syntax-coloured. `header`: show the file name and +/− counts (off inside an Edit card).
 */
export function DiffView({ path, oldText, newText, header = true }: { path?: string; oldText?: string | null; newText?: string; header?: boolean }) {
  const t = useTheme();
  const st = sheet(t);
  const [all, setAll] = useState(false);
  const lang = LANG[fileExt(path)] ?? "";
  const rows = useMemo(() => hunks(diffLines(oldText ?? "", newText ?? "")), [oldText, newText]);
  const partner = useMemo(() => pairs(rows), [rows]);
  const added = rows.filter((r) => "kind" in r && r.kind === "+").length;
  const removed = rows.filter((r) => "kind" in r && r.kind === "-").length;
  const shown = all ? rows : rows.slice(0, 40);
  const bg = { "+": t.diffAdd, "-": t.diffDel, " ": "transparent" };
  return (
    <View style={[st.box, { borderColor: t.border }, !header && st.bare]}>
      {header ? (
        <View style={[st.head, { borderBottomColor: t.border }]}>
          <FileBadge path={path} />
          <Text style={[st.path, { color: t.text }]} numberOfLines={1}>{path?.split("/").slice(-3).join("/") ?? "file"}</Text>
          <Text style={[st.stat, { color: t.success }]}>+{added}</Text>
          <Text style={[st.stat, { color: t.error }]}>−{removed}</Text>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: "100%" }}>
          {shown.map((r, i) => {
            if ("gap" in r) return <Text key={i} style={[st.gap, { color: t.faint }]}>⋯ {r.gap} unchanged line{r.gap === 1 ? "" : "s"}</Text>;
            const other = partner.get(i);
            const ranges = other !== undefined && r.kind !== " " ? changedRanges(r.text, (rows[other] as Line).text) : [];
            const strongBg = r.kind === "+" ? t.diffAddStrong : t.diffDelStrong;
            return (
              <Text key={i} style={[st.line, { backgroundColor: bg[r.kind], color: t.text }]}>
                {r.text
                  ? pieces(r.text, lang, ranges, t).map((p, k) => (
                      <Text key={k} style={{ color: p.color, backgroundColor: p.strong ? strongBg : undefined }}>{p.text}</Text>
                    ))
                  : " "}
              </Text>
            );
          })}
        </View>
      </ScrollView>
      {rows.length > 40 && !all ? (
        <Pressable onPress={() => setAll(true)} style={st.more}>
          <Text style={{ color: t.accent, fontFamily: ui, fontSize: 13 }}>Show all {rows.length} lines</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function make(t: Theme) {
  return StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 8, overflow: "hidden", marginTop: 6 },
  bare: { borderWidth: 0, borderRadius: 0, marginTop: 0 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1 },
  path: { flex: 1, fontFamily: t.mono, fontSize: t.fs(12.5) },
  stat: { fontFamily: t.mono, fontSize: t.fs(12) },
  line: { fontFamily: t.mono, fontSize: t.fs(12.5), lineHeight: t.fs(21), paddingHorizontal: 12 },
  gap: { fontFamily: ui, fontSize: t.fs(12), paddingHorizontal: 10, paddingVertical: 3 },
  more: { padding: 8, alignItems: "center" },
  });
}
const sheets = new WeakMap<Theme, ReturnType<typeof make>>();
/** Styles for a theme, built once per theme (rows render many times). */
function sheet(t: Theme) {
  let s = sheets.get(t);
  if (!s) sheets.set(t, (s = make(t)));
  return s;
}

