// The app's theme: a palette (afk's brand by default, a popular theme, or the user's live
// Zed theme) plus the appearance settings (mode, text size, code font, density, thinking).
// Everything visual reads it through useTheme(); styles(t) recompute when it changes.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Platform, useColorScheme } from "react-native";
import { alpha, bundledByZedName, family, mix, readableOn, variantFor, type Palette, type Syntax } from "./themes";

export type { Syntax } from "./themes";

export type Theme = {
  /** Display name of the active palette, e.g. "afk Dark" or "Catppuccin Latte". */
  name: string;
  dark: boolean;
  panel: string; // thread area
  sidebar: string;
  surface: string; // composer / raised areas
  selected: string;
  hover: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  /** Text and icons drawn on an accent background. */
  onAccent: string;
  link: string;
  codeBg: string;
  tableHead: string;
  toolBg: string;
  optionBg: string;
  scrim: string;
  diffAdd: string;
  diffDel: string;
  /** Stronger shades for the words that changed within a line. */
  diffAddStrong: string;
  diffDelStrong: string;
  warning: string;
  error: string;
  success: string;
  info: string;
  switchOff: string;
  syntax: Syntax;
  // Appearance settings, folded in so every styles(t) picks them up.
  /** Scales a font size / line height by the text-size setting. */
  fs: (n: number) => number;
  /** Scales vertical spacing by the density setting. */
  sp: (n: number) => number;
  mono: string;
  monoMedium: string;
  thinkingOpen: boolean;
};

export type Appearance = {
  /** A theme family id ("afk", "one", "catppuccin", …) or "zed" to follow the Mac's Zed theme. */
  theme: string;
  mode: "system" | "light" | "dark";
  textSize: "s" | "m" | "l" | "xl";
  codeFont: "fira" | "system";
  density: "comfortable" | "compact";
  thinking: "collapsed" | "expanded";
};

export const DEFAULT_APPEARANCE: Appearance = { theme: "afk", mode: "system", textSize: "m", codeFont: "fira", density: "comfortable", thinking: "collapsed" };
const TEXT_SCALE: Record<Appearance["textSize"], number> = { s: 0.92, m: 1, l: 1.1, xl: 1.22 };

// What the hub returns from GET /zed/theme.
export type ZedThemeColors = { name: string; appearance: "light" | "dark"; ui: Record<string, string>; syntax: Record<string, string> };
export type ZedThemeInfo = { mode: "system" | "light" | "dark"; light: { name: string; theme?: ZedThemeColors }; dark: { name: string; theme?: ZedThemeColors } };

const FIRA = Platform.select({ web: "FiraCode_400Regular, Menlo, monospace", default: "FiraCode_400Regular" });
const FIRA_MEDIUM = Platform.select({ web: "FiraCode_500Medium, Menlo, monospace", default: "FiraCode_500Medium" });
const SYSTEM_MONO = Platform.select({ ios: "Menlo", web: "ui-monospace, Menlo, monospace", default: "monospace" });

/** Default code font, for the few static styles outside a theme. Prefer t.mono. */
export const mono = FIRA;
export const monoMedium = FIRA_MEDIUM;
export const ui = Platform.select({ ios: "System", web: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", default: undefined });

/** Maps a Zed theme's colours onto an app palette (missing keys fall back to afk's). */
export function paletteFromZed(z: ZedThemeColors): Palette {
  const dark = z.appearance === "dark";
  const base = variantFor(family("afk"), dark).palette;
  const u = z.ui;
  const s = z.syntax;
  const panel = u["panel.background"] ?? u["editor.background"] ?? base.panel;
  const text = u.text ?? base.text;
  const muted = u["text.muted"] ?? mix(text, panel, 0.3);
  const accent = u["text.accent"] ?? u["player.cursor"] ?? base.accent;
  const success = u.success ?? u.created ?? base.success;
  const error = u.error ?? u.deleted ?? base.error;
  return {
    dark,
    panel,
    sidebar: mix(panel, u.background ?? panel, 0.35),
    surface: u["editor.background"] ?? panel,
    text,
    muted,
    faint: u["text.placeholder"] ?? mix(muted, panel, 0.35),
    border: (u.border ?? base.border).slice(0, 7),
    accent,
    link: u["link_text.hover"] ?? accent,
    warning: u.warning ?? base.warning,
    error,
    success,
    info: u.info ?? base.info,
    syntax: {
      keyword: s.keyword ?? base.syntax.keyword,
      function: s.function ?? base.syntax.function,
      string: s.string ?? base.syntax.string,
      number: s.number ?? s.constant ?? base.syntax.number,
      comment: s.comment ?? muted,
      type: s.type ?? base.syntax.type,
      operator: s.operator ?? s.punctuation ?? base.syntax.operator,
      property: s.property ?? base.syntax.property,
      tag: s.tag ?? s.property ?? base.syntax.tag,
      attr: s.attribute ?? s.number ?? base.syntax.attr,
      variable: s.variable ?? text,
      inserted: u.created ?? success,
      deleted: u.deleted ?? error,
    },
  };
}

export function buildTheme(name: string, p: Palette, a: Appearance): Theme {
  const scale = TEXT_SCALE[a.textSize] ?? 1;
  const compact = a.density === "compact";
  const code = a.codeFont === "system";
  return {
    name,
    dark: p.dark,
    panel: p.panel,
    sidebar: p.sidebar,
    surface: p.surface,
    selected: mix(p.sidebar, p.text, p.dark ? 0.1 : 0.08),
    hover: mix(p.sidebar, p.text, p.dark ? 0.06 : 0.05),
    border: p.border,
    borderStrong: mix(p.border, p.text, 0.16),
    text: p.text,
    muted: p.muted,
    faint: p.faint,
    accent: p.accent,
    onAccent: p.onAccent ?? readableOn(p.accent),
    link: p.link ?? p.accent,
    codeBg: p.dark ? p.sidebar : mix(p.panel, p.text, 0.05),
    tableHead: mix(p.panel, p.text, p.dark ? 0.05 : 0.06),
    toolBg: p.dark ? p.sidebar : mix(p.panel, p.surface, 0.5),
    optionBg: mix(p.surface, p.text, p.dark ? 0.06 : 0.04),
    scrim: p.dark ? "rgba(0,0,0,0.5)" : alpha(p.text, 0.22),
    diffAdd: alpha(p.syntax.inserted, p.dark ? 0.14 : 0.12),
    diffDel: alpha(p.syntax.deleted, p.dark ? 0.14 : 0.1),
    diffAddStrong: alpha(p.syntax.inserted, p.dark ? 0.34 : 0.3),
    diffDelStrong: alpha(p.syntax.deleted, p.dark ? 0.34 : 0.26),
    warning: p.warning,
    error: p.error,
    success: p.success,
    info: p.info,
    switchOff: p.faint,
    syntax: p.syntax,
    fs: scale === 1 ? (n) => n : (n) => Math.round(n * scale * 2) / 2,
    sp: compact ? (n) => Math.round(n * 0.7) : (n) => n,
    mono: code ? SYSTEM_MONO! : FIRA!,
    monoMedium: code ? SYSTEM_MONO! : FIRA_MEDIUM!,
    thinkingOpen: a.thinking === "expanded",
  };
}

/** Resolves which palette to show for the settings, system mode and (optional) Zed theme. */
export function resolvePalette(a: Appearance, systemDark: boolean, zed: ZedThemeInfo | null): { name: string; palette: Palette } {
  if (a.theme === "zed" && zed) {
    const dark = a.mode === "system" ? (zed.mode === "system" ? systemDark : zed.mode === "dark") : a.mode === "dark";
    const ref = dark ? zed.dark : zed.light;
    if (ref.theme) return { name: ref.theme.name, palette: paletteFromZed(ref.theme) };
    const bundled = bundledByZedName(ref.name);
    if (bundled) return bundled;
  }
  const dark = a.mode === "system" ? systemDark : a.mode === "dark";
  const fam = family(a.theme === "zed" ? "afk" : a.theme);
  return variantFor(fam, dark);
}

// ---- provider ----

const PREFS_KEY = "afk.appearance";
const ZED_KEY = "afk.zedTheme";

type Ctx = {
  theme: Theme;
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;
  zed: ZedThemeInfo | null;
  setZed: (z: ZedThemeInfo | null) => void;
  /** Why the Zed theme couldn't be fetched: the hub predates it, or the Mac is unreachable. */
  zedError: "outdated" | "offline" | null;
  setZedError: (e: "outdated" | "offline" | null) => void;
};

const fallback = buildTheme("afk", variantFor(family("afk"), false).palette, DEFAULT_APPEARANCE);
const ThemeCtx = createContext<Ctx>({ theme: fallback, appearance: DEFAULT_APPEARANCE, setAppearance: () => {}, zed: null, setZed: () => {}, zedError: null, setZedError: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemDark = useColorScheme() === "dark";
  const [appearance, setA] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [zed, setZedState] = useState<ZedThemeInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [zedError, setZedError] = useState<Ctx["zedError"]>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(PREFS_KEY), AsyncStorage.getItem(ZED_KEY)])
      .then(([p, z]) => {
        if (p) setA({ ...DEFAULT_APPEARANCE, ...JSON.parse(p) });
        if (z) setZedState(JSON.parse(z));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setAppearance = useCallback((patch: Partial<Appearance>) => {
    setA((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const setZed = useCallback((z: ZedThemeInfo | null) => {
    setZedState((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(z)) return prev;
      AsyncStorage.setItem(ZED_KEY, JSON.stringify(z)).catch(() => {});
      return z;
    });
  }, []);

  const theme = useMemo(() => {
    const { name, palette } = resolvePalette(appearance, systemDark, zed);
    return buildTheme(name, palette, appearance);
  }, [appearance, systemDark, zed]);
  const value = useMemo(() => ({ theme, appearance, setAppearance, zed, setZed, zedError, setZedError }), [theme, appearance, setAppearance, zed, setZed, zedError]);
  if (!loaded) return null; // a few ms: avoids flashing the default theme
  return React.createElement(ThemeCtx.Provider, { value }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeCtx).theme;
}

export function useAppearance() {
  const { appearance, setAppearance, zed, zedError } = useContext(ThemeCtx);
  return { appearance, setAppearance, zed, zedError };
}

/**
 * While "Match Zed" is on, keeps the Mac's Zed theme fresh: on start, when the app
 * comes back to the foreground, and every 30s while it's open.
 */
export function useZedThemeSync(fetchTheme: (() => Promise<ZedThemeInfo>) | null, hostId: string | undefined) {
  const { appearance, setZed, setZedError: setError } = useContext(ThemeCtx);
  const on = appearance.theme === "zed" && !!fetchTheme;
  useEffect(() => {
    if (!on) return;
    let alive = true;
    const pull = () =>
      fetchTheme!()
        .then((z) => {
          if (!alive) return;
          setZed(z);
          setError(null);
        })
        .catch((e: any) => alive && setError(/404|not found/i.test(String(e?.message)) ? "outdated" : "offline"));
    pull();
    const timer = setInterval(() => AppState.currentState === "active" && pull(), 30_000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && pull());
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [on, hostId]); // eslint-disable-line react-hooks/exhaustive-deps
}
