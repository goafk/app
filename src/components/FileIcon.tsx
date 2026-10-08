// A small language badge for a file, like Zed's file-type icons ("php", "TS", "py", …).
import React from "react";
import { Text } from "react-native";
import { mono } from "../lib/theme";

const BADGES: Record<string, [string, string]> = {
  ts: ["TS", "#3178C6"], tsx: ["TSX", "#3178C6"], mts: ["TS", "#3178C6"], cts: ["TS", "#3178C6"],
  js: ["JS", "#D4B830"], jsx: ["JSX", "#D4B830"], mjs: ["JS", "#D4B830"], cjs: ["JS", "#D4B830"],
  php: ["php", "#7A86B8"], py: ["py", "#3B78A8"], rb: ["rb", "#CC342D"], rs: ["rs", "#DEA584"], go: ["go", "#00ADD8"],
  swift: ["swift", "#F05138"], kt: ["kt", "#A97BFF"], java: ["java", "#B07219"], c: ["C", "#6E8BB5"], h: ["H", "#6E8BB5"],
  cpp: ["C++", "#F34B7D"], cs: ["C#", "#68217A"], json: ["{}", "#C9A227"], yml: ["yml", "#CB171E"], yaml: ["yml", "#CB171E"],
  toml: ["toml", "#9C4221"], md: ["M↓", "#6E7681"], mdx: ["M↓", "#6E7681"], css: ["css", "#663399"], scss: ["scss", "#C6538C"],
  html: ["<>", "#E34C26"], vue: ["vue", "#41B883"], svelte: ["sv", "#FF3E00"], sql: ["sql", "#E38C00"], sh: ["$", "#89E051"],
  zsh: ["$", "#89E051"], bash: ["$", "#89E051"], lock: ["lock", "#6E7681"], env: ["env", "#ECD53F"], dockerfile: ["dkr", "#2496ED"],
};

export function fileExt(path?: string): string {
  const name = (path ?? "").split("/").pop()?.toLowerCase() ?? "";
  if (name === "dockerfile") return "dockerfile";
  if (name.startsWith(".env")) return "env";
  return name.includes(".") ? name.split(".").pop()! : "";
}

export function FileBadge({ path, size = 11 }: { path?: string; size?: number }) {
  const b = BADGES[fileExt(path)];
  if (!b) return null;
  return (
    <Text style={{ fontFamily: mono, fontSize: size, fontWeight: "700", fontStyle: b[0] === "php" ? "italic" : "normal", color: b[1], minWidth: size * 1.6 }} numberOfLines={1}>
      {b[0]}
    </Text>
  );
}
