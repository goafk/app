// Theme palettes. Each variant is a small base palette; buildTheme() derives every
// surface/state colour from it, so all themes (and a live Zed theme) behave the same way.
// Popular palettes are the authors' published colours (all MIT licensed).

export type Syntax = {
  keyword: string; function: string; string: string; number: string; comment: string; type: string;
  operator: string; property: string; tag: string; attr: string; variable: string; inserted: string; deleted: string;
};

export type Palette = {
  dark: boolean;
  panel: string; // thread area
  sidebar: string;
  surface: string; // composer / sheets / raised
  text: string;
  muted: string;
  faint: string;
  border: string;
  accent: string;
  onAccent?: string;
  link?: string;
  warning: string;
  error: string;
  success: string;
  info: string;
  syntax: Syntax;
};

export type Variant = { name: string; palette: Palette };
export type ThemeFamily = { id: string; name: string; light?: Variant; dark?: Variant };

const syn = (keyword: string, fn: string, str: string, num: string, comment: string, type: string, op: string, prop: string, variable: string, add: string, del: string): Syntax => ({
  keyword, function: fn, string: str, number: num, comment, type, operator: op, property: prop, tag: prop, attr: num, variable, inserted: add, deleted: del,
});

// afk: the brand neutrals (#F7F7F5 → #111315), ink as the accent, the grey dot for comments.
const AFK_LIGHT: Palette = {
  dark: false, panel: "#F7F7F5", sidebar: "#EFEFEC", surface: "#FFFFFF",
  text: "#111315", muted: "#666C74", faint: "#8C929A", border: "#DDDEDA",
  accent: "#111315", onAccent: "#FFFFFF", link: "#2F5FA8",
  warning: "#A86A00", error: "#B3363B", success: "#3F7F3A", info: "#3A7480",
  syntax: syn("#7A4FC9", "#2F6FB3", "#3F7F3A", "#B5651D", "#8C929A", "#966700", "#3A7480", "#A1453E", "#2A2D31", "#3F7F3A", "#B3363B"),
};
const AFK_DARK: Palette = {
  dark: true, panel: "#111315", sidebar: "#15171A", surface: "#1A1C1F",
  text: "#F7F7F5", muted: "#A8ABB0", faint: "#666C74", border: "#2A2D31",
  accent: "#F7F7F5", onAccent: "#111315", link: "#8DB8EB",
  warning: "#E3B868", error: "#EE8A85", success: "#A8CC8C", info: "#8CC5CF",
  syntax: syn("#C3A6F0", "#8DB8EB", "#A8CC8C", "#E3A872", "#666C74", "#E8C987", "#8CC5CF", "#EE9A95", "#DDDFE2", "#A8CC8C", "#EE9A95"),
};

export const FAMILIES: ThemeFamily[] = [
  { id: "afk", name: "afk", light: { name: "afk Light", palette: AFK_LIGHT }, dark: { name: "afk Dark", palette: AFK_DARK } },
  {
    id: "one", name: "One",
    light: { name: "One Light", palette: {
      dark: false, panel: "#EBEBEC", sidebar: "#E5E5E6", surface: "#FAFAFA", text: "#383A42", muted: "#696C77", faint: "#A0A1A7", border: "#D3D3D5",
      accent: "#A626A4", link: "#4078F2", warning: "#C18401", error: "#E45649", success: "#50A14F", info: "#0184BC",
      syntax: syn("#A626A4", "#4078F2", "#50A14F", "#986801", "#A0A1A7", "#C18401", "#0184BC", "#E45649", "#383A42", "#50A14F", "#E45649"),
    } },
    dark: { name: "One Dark", palette: {
      dark: true, panel: "#282C34", sidebar: "#21252B", surface: "#2C313A", text: "#ABB2BF", muted: "#7F848E", faint: "#5C6370", border: "#181A1F",
      accent: "#C678DD", link: "#61AFEF", warning: "#E5C07B", error: "#E06C75", success: "#98C379", info: "#56B6C2",
      syntax: syn("#C678DD", "#61AFEF", "#98C379", "#D19A66", "#5C6370", "#E5C07B", "#56B6C2", "#E06C75", "#ABB2BF", "#98C379", "#E06C75"),
    } },
  },
  {
    id: "catppuccin", name: "Catppuccin",
    light: { name: "Catppuccin Latte", palette: {
      dark: false, panel: "#E6E9EF", sidebar: "#E1E4EB", surface: "#EFF1F5", text: "#4C4F69", muted: "#6C6F85", faint: "#9CA0B0", border: "#CCD0DA",
      accent: "#8839EF", link: "#8839EF", warning: "#DF8E1D", error: "#D20F39", success: "#40A02B", info: "#179299",
      syntax: syn("#8839EF", "#1E66F5", "#40A02B", "#FE640B", "#9CA0B0", "#DF8E1D", "#04A5E5", "#1E66F5", "#4C4F69", "#40A02B", "#D20F39"),
    } },
    dark: { name: "Catppuccin Mocha", palette: {
      dark: true, panel: "#181825", sidebar: "#11111B", surface: "#1E1E2E", text: "#CDD6F4", muted: "#A6ADC8", faint: "#6C7086", border: "#313244",
      accent: "#CBA6F7", link: "#89B4FA", warning: "#F9E2AF", error: "#F38BA8", success: "#A6E3A1", info: "#94E2D5",
      syntax: syn("#CBA6F7", "#89B4FA", "#A6E3A1", "#FAB387", "#6C7086", "#F9E2AF", "#89DCEB", "#89B4FA", "#CDD6F4", "#A6E3A1", "#F38BA8"),
    } },
  },
  {
    id: "ayu", name: "Ayu",
    light: { name: "Ayu Light", palette: {
      dark: false, panel: "#F8F9FA", sidebar: "#EEF0F2", surface: "#FCFCFC", text: "#5C6166", muted: "#8A9199", faint: "#ADAEB1", border: "#E7EAED",
      accent: "#FA8D3E", onAccent: "#FFFFFF", link: "#399EE6", warning: "#F2AE49", error: "#E65050", success: "#86B300", info: "#4CBF99",
      syntax: syn("#FA8D3E", "#F2AE49", "#86B300", "#A37ACC", "#ADAEB1", "#399EE6", "#ED9366", "#55B4D4", "#5C6166", "#86B300", "#E65050"),
    } },
    dark: { name: "Ayu Dark", palette: {
      dark: true, panel: "#0D1017", sidebar: "#0B0E14", surface: "#131721", text: "#BFBDB6", muted: "#8A8986", faint: "#565B66", border: "#1E222A",
      accent: "#E6B450", onAccent: "#0D1017", link: "#59C2FF", warning: "#FFB454", error: "#D95757", success: "#AAD94C", info: "#95E6CB",
      syntax: syn("#FF8F40", "#FFB454", "#AAD94C", "#D2A6FF", "#565B66", "#59C2FF", "#F29668", "#39BAE6", "#BFBDB6", "#AAD94C", "#D95757"),
    } },
  },
  {
    id: "gruvbox", name: "Gruvbox",
    light: { name: "Gruvbox Light", palette: {
      dark: false, panel: "#F2E5BC", sidebar: "#EBDBB2", surface: "#FBF1C7", text: "#3C3836", muted: "#665C54", faint: "#928374", border: "#D5C4A1",
      accent: "#AF3A03", onAccent: "#FBF1C7", link: "#076678", warning: "#B57614", error: "#9D0006", success: "#79740E", info: "#427B58",
      syntax: syn("#9D0006", "#79740E", "#79740E", "#8F3F71", "#928374", "#B57614", "#427B58", "#076678", "#3C3836", "#79740E", "#9D0006"),
    } },
    dark: { name: "Gruvbox Dark", palette: {
      dark: true, panel: "#282828", sidebar: "#1D2021", surface: "#32302F", text: "#EBDBB2", muted: "#BDAE93", faint: "#928374", border: "#3C3836",
      accent: "#FE8019", onAccent: "#282828", link: "#83A598", warning: "#FABD2F", error: "#FB4934", success: "#B8BB26", info: "#8EC07C",
      syntax: syn("#FB4934", "#B8BB26", "#B8BB26", "#D3869B", "#928374", "#FABD2F", "#8EC07C", "#83A598", "#EBDBB2", "#B8BB26", "#FB4934"),
    } },
  },
  {
    id: "tokyonight", name: "Tokyo Night",
    light: { name: "Tokyo Night Day", palette: {
      dark: false, panel: "#D0D5E3", sidebar: "#C4C8DA", surface: "#E1E2E7", text: "#3760BF", muted: "#6172B0", faint: "#848CB5", border: "#B4B5B9",
      accent: "#2E7DE9", onAccent: "#FFFFFF", link: "#2E7DE9", warning: "#8C6C3E", error: "#F52A65", success: "#587539", info: "#007197",
      syntax: syn("#9854F1", "#2E7DE9", "#587539", "#B15C00", "#848CB5", "#007197", "#006A83", "#007197", "#3760BF", "#587539", "#F52A65"),
    } },
    dark: { name: "Tokyo Night", palette: {
      dark: true, panel: "#1A1B26", sidebar: "#16161E", surface: "#1F2335", text: "#C0CAF5", muted: "#A9B1D6", faint: "#565F89", border: "#292E42",
      accent: "#7AA2F7", onAccent: "#1A1B26", link: "#7DCFFF", warning: "#E0AF68", error: "#F7768E", success: "#9ECE6A", info: "#73DACA",
      syntax: syn("#BB9AF7", "#7AA2F7", "#9ECE6A", "#FF9E64", "#565F89", "#2AC3DE", "#89DDFF", "#73DACA", "#C0CAF5", "#9ECE6A", "#F7768E"),
    } },
  },
  {
    id: "rosepine", name: "Rosé Pine",
    light: { name: "Rosé Pine Dawn", palette: {
      dark: false, panel: "#FFFAF3", sidebar: "#F2E9E1", surface: "#FAF4ED", text: "#575279", muted: "#797593", faint: "#9893A5", border: "#DFDAD9",
      accent: "#907AA9", onAccent: "#FFFFFF", link: "#286983", warning: "#EA9D34", error: "#B4637A", success: "#286983", info: "#56949F",
      syntax: syn("#286983", "#D7827E", "#EA9D34", "#D7827E", "#9893A5", "#56949F", "#286983", "#907AA9", "#575279", "#56949F", "#B4637A"),
    } },
    dark: { name: "Rosé Pine", palette: {
      dark: true, panel: "#1F1D2E", sidebar: "#191724", surface: "#26233A", text: "#E0DEF4", muted: "#908CAA", faint: "#6E6A86", border: "#26233A",
      accent: "#C4A7E7", onAccent: "#191724", link: "#9CCFD8", warning: "#F6C177", error: "#EB6F92", success: "#31748F", info: "#9CCFD8",
      syntax: syn("#31748F", "#EBBCBA", "#F6C177", "#EBBCBA", "#6E6A86", "#9CCFD8", "#31748F", "#C4A7E7", "#E0DEF4", "#9CCFD8", "#EB6F92"),
    } },
  },
  {
    id: "github", name: "GitHub",
    light: { name: "GitHub Light", palette: {
      dark: false, panel: "#F6F8FA", sidebar: "#EFF2F5", surface: "#FFFFFF", text: "#1F2328", muted: "#59636E", faint: "#818B98", border: "#D1D9E0",
      accent: "#0969DA", onAccent: "#FFFFFF", link: "#0969DA", warning: "#9A6700", error: "#D1242F", success: "#1A7F37", info: "#0550AE",
      syntax: syn("#CF222E", "#8250DF", "#0A3069", "#0550AE", "#59636E", "#953800", "#CF222E", "#0550AE", "#1F2328", "#116329", "#82071E"),
    } },
    dark: { name: "GitHub Dark", palette: {
      dark: true, panel: "#0D1117", sidebar: "#010409", surface: "#151B23", text: "#F0F6FC", muted: "#9198A1", faint: "#656C76", border: "#3D444D",
      accent: "#4493F8", onAccent: "#FFFFFF", link: "#4493F8", warning: "#D29922", error: "#F85149", success: "#3FB950", info: "#58A6FF",
      syntax: syn("#FF7B72", "#D2A8FF", "#A5D6FF", "#79C0FF", "#9198A1", "#FFA657", "#FF7B72", "#79C0FF", "#F0F6FC", "#AFF5B4", "#FFDCD7"),
    } },
  },
  {
    id: "solarized", name: "Solarized",
    light: { name: "Solarized Light", palette: {
      dark: false, panel: "#EEE8D5", sidebar: "#E6DFC8", surface: "#FDF6E3", text: "#586E75", muted: "#657B83", faint: "#93A1A1", border: "#DDD6C1",
      accent: "#268BD2", onAccent: "#FDF6E3", link: "#268BD2", warning: "#B58900", error: "#DC322F", success: "#859900", info: "#2AA198",
      syntax: syn("#859900", "#268BD2", "#2AA198", "#D33682", "#93A1A1", "#B58900", "#859900", "#268BD2", "#586E75", "#859900", "#DC322F"),
    } },
    dark: { name: "Solarized Dark", palette: {
      dark: true, panel: "#002B36", sidebar: "#00212B", surface: "#073642", text: "#93A1A1", muted: "#839496", faint: "#586E75", border: "#0A4351",
      accent: "#268BD2", onAccent: "#FDF6E3", link: "#268BD2", warning: "#B58900", error: "#DC322F", success: "#859900", info: "#2AA198",
      syntax: syn("#859900", "#268BD2", "#2AA198", "#D33682", "#586E75", "#B58900", "#859900", "#268BD2", "#93A1A1", "#859900", "#DC322F"),
    } },
  },
  {
    id: "nord", name: "Nord",
    dark: { name: "Nord", palette: {
      dark: true, panel: "#2E3440", sidebar: "#272C36", surface: "#3B4252", text: "#D8DEE9", muted: "#A3ACBC", faint: "#616E88", border: "#434C5E",
      accent: "#88C0D0", onAccent: "#2E3440", link: "#88C0D0", warning: "#EBCB8B", error: "#BF616A", success: "#A3BE8C", info: "#8FBCBB",
      syntax: syn("#81A1C1", "#88C0D0", "#A3BE8C", "#B48EAD", "#616E88", "#8FBCBB", "#81A1C1", "#D8DEE9", "#D8DEE9", "#A3BE8C", "#BF616A"),
    } },
  },
  {
    id: "dracula", name: "Dracula",
    dark: { name: "Dracula", palette: {
      dark: true, panel: "#282A36", sidebar: "#21222C", surface: "#343746", text: "#F8F8F2", muted: "#BDBFCB", faint: "#6272A4", border: "#44475A",
      accent: "#BD93F9", onAccent: "#282A36", link: "#8BE9FD", warning: "#F1FA8C", error: "#FF5555", success: "#50FA7B", info: "#8BE9FD",
      syntax: syn("#FF79C6", "#50FA7B", "#F1FA8C", "#BD93F9", "#6272A4", "#8BE9FD", "#FF79C6", "#66D9EF", "#F8F8F2", "#50FA7B", "#FF5555"),
    } },
  },
];

export const family = (id: string): ThemeFamily => FAMILIES.find((f) => f.id === id) ?? FAMILIES[0];

/** The variant of a family for a mode, falling back to the one it has. */
export function variantFor(f: ThemeFamily, dark: boolean): Variant {
  return (dark ? f.dark ?? f.light : f.light ?? f.dark)!;
}

/** Zed's built-in theme names → the bundled copy (built-ins aren't files we can read). */
export function bundledByZedName(name: string): Variant | undefined {
  for (const f of FAMILIES) for (const v of [f.light, f.dark]) if (v && v.name.toLowerCase() === name.toLowerCase()) return v;
  const n = name.toLowerCase();
  const fam = n.startsWith("one ") ? "one" : n.startsWith("ayu") ? "ayu" : n.startsWith("gruvbox") ? "gruvbox" : n.startsWith("catppuccin") ? "catppuccin" : n.startsWith("tokyo") ? "tokyonight" : n.startsWith("ros") ? "rosepine" : n.startsWith("github") ? "github" : n.startsWith("solarized") ? "solarized" : null;
  if (!fam) return undefined;
  const f = family(fam);
  return variantFor(f, !/light|latte|day|dawn/.test(n));
}

// ---- colour helpers ----

const hex6 = (c: string) => {
  let h = c.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((x) => x + x).join("");
  return h.slice(0, 6);
};
const rgb = (c: string) => {
  const h = hex6(c);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const toHex = (n: number[]) => "#" + n.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("").toUpperCase();

/** Mix b into a by w (0 → a, 1 → b). Ignores alpha. */
export function mix(a: string, b: string, w: number): string {
  const x = rgb(a), y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * w));
}
/** Colour with alpha, as #RRGGBBAA. */
export function alpha(c: string, a: number): string {
  return "#" + hex6(c).toUpperCase() + Math.round(a * 255).toString(16).padStart(2, "0").toUpperCase();
}
export function luminance(c: string): number {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Readable text colour on a background. */
export const readableOn = (bg: string) => (luminance(bg) > 0.45 ? "#111315" : "#FFFFFF");
