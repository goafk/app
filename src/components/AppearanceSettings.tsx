// Settings → Appearance: theme (afk, Match Zed, popular themes), mode, text size,
// code font, density and thinking. Changes apply live and are remembered on the phone.
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, useColorScheme, View } from "react-native";
import { paletteFromZed, ui, useAppearance, useTheme } from "../lib/theme";
import type { Appearance, Theme } from "../lib/theme";
import { bundledByZedName, FAMILIES, variantFor } from "../lib/themes";
import type { Palette } from "../lib/themes";
import { CheckIcon, ChevronLeft } from "./Icons";

type Option<T> = { value: T; label: string };
const MODES: Option<Appearance["mode"]>[] = [{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }];
const SIZES: Option<Appearance["textSize"]>[] = [{ value: "s", label: "Small" }, { value: "m", label: "Default" }, { value: "l", label: "Large" }, { value: "xl", label: "Larger" }];
const FONTS: Option<Appearance["codeFont"]>[] = [{ value: "fira", label: "Fira Code" }, { value: "system", label: "System mono" }];
const DENSITY: Option<Appearance["density"]>[] = [{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }];

const INSTALL = "curl -fsSL https://goafk.dev/install.sh | sh";

export function AppearanceSettings({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const { appearance: a, setAppearance, zed, zedError } = useAppearance();
  const systemDark = useColorScheme() === "dark";
  const dark = a.mode === "system" ? systemDark : a.mode === "dark";

  // What "Match Zed" would show right now, for its swatch.
  const zedRef = zed ? (dark ? zed.dark : zed.light) : null;
  const zedPalette: Palette | null = zedRef?.theme ? paletteFromZed(zedRef.theme) : zedRef ? bundledByZedName(zedRef.name)?.palette ?? null : null;
  const zedStatus =
    a.theme !== "zed"
      ? "Uses the theme you picked in Zed, light and dark. Changes in Zed show up here within seconds."
      : zedError === "outdated"
        ? `Your Mac's hub is too old to share its theme. Update it by running this on the Mac:\n${INSTALL}`
        : zedError === "offline" && zedRef
          ? `Can't reach your Mac right now, so this is the last theme it shared (${zedRef.name}).`
          : zedError === "offline"
            ? "Can't reach your Mac right now. Showing afk until it's back."
            : zedRef
              ? `Following ${zedRef.name} from Zed${zedRef.theme || bundledByZedName(zedRef.name) ? "" : " (not available on the phone yet, showing afk)"}.`
              : "Asking your Mac which theme Zed uses…";

  return (
    <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ paddingBottom: 12 }}>
      <Pressable onPress={onBack} hitSlop={8} style={s.back}>
        <ChevronLeft color={t.muted} size={18} />
        <Text style={s.backText}>Settings</Text>
      </Pressable>

      <Text style={s.section}>Theme</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.swatches}>
        <Swatch t={t} s={s} label="Match Zed" sub={zedRef?.name ?? "Your Zed theme"} palette={zedPalette} on={a.theme === "zed"} onPress={() => setAppearance({ theme: "zed" })} zedMark />
        {FAMILIES.map((f) => {
          const v = variantFor(f, dark);
          return <Swatch key={f.id} t={t} s={s} label={f.name} sub={f.id === "afk" ? "Default" : !f.light || !f.dark ? (v.palette.dark ? "Dark only" : "Light only") : v.name.replace(f.name, "").trim() || (v.palette.dark ? "Dark" : "Light")} palette={v.palette} on={a.theme === f.id} onPress={() => setAppearance({ theme: f.id })} />;
        })}
      </ScrollView>
      <Text style={[s.hint, a.theme === "zed" && zedError === "outdated" && { color: t.warning }]} selectable>
        {a.theme === "zed" ? zedStatus : "Tip: pick Match Zed to use the same theme as your editor."}
      </Text>

      <Text style={s.section}>Mode</Text>
      <Segmented t={t} s={s} options={MODES} value={a.mode} onChange={(mode) => setAppearance({ mode })} />

      <Text style={s.section}>Text size</Text>
      <Segmented t={t} s={s} options={SIZES} value={a.textSize} onChange={(textSize) => setAppearance({ textSize })} />

      <Text style={s.section}>Code font</Text>
      <Segmented t={t} s={s} options={FONTS} value={a.codeFont} onChange={(codeFont) => setAppearance({ codeFont })} />
      <Text style={[s.sample, { fontFamily: t.mono }]}>{"const agent = await zed.thread(); // 0O 1lI"}</Text>

      <Text style={s.section}>Density</Text>
      <Segmented t={t} s={s} options={DENSITY} value={a.density} onChange={(density) => setAppearance({ density })} />

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowText}>Show thinking expanded</Text>
          <Text style={[s.hint, { paddingHorizontal: 0, paddingTop: 2 }]}>Otherwise the agent's thinking starts collapsed.</Text>
        </View>
        <Switch
          value={a.thinking === "expanded"}
          onValueChange={(v) => setAppearance({ thinking: v ? "expanded" : "collapsed" })}
          trackColor={{ false: t.switchOff, true: t.accent }}
          thumbColor={a.thinking === "expanded" ? t.onAccent : "#FFFFFF"}
        />
      </View>
    </ScrollView>
  );
}

function Swatch({ t, s, label, sub, palette, on, onPress, zedMark }: { t: Theme; s: St; label: string; sub: string; palette: Palette | null; on: boolean; onPress: () => void; zedMark?: boolean }) {
  const p = palette;
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${label} theme`} style={({ pressed }) => [s.swatch, pressed && { transform: [{ scale: 0.96 }] }]}>
      <View style={[s.preview, { borderColor: on ? t.accent : t.border, borderWidth: on ? 2 : 1 }]}>
        {p ? (
          <View style={[s.previewInner, { backgroundColor: p.panel }]}>
            <View style={[s.previewSide, { backgroundColor: p.sidebar, borderRightColor: p.border }]}>
              <View style={[s.bar, { width: 22, backgroundColor: p.muted, opacity: 0.6 }]} />
              <View style={[s.bar, { width: 16, backgroundColor: p.faint, opacity: 0.6 }]} />
              <View style={[s.bar, { width: 20, backgroundColor: p.faint, opacity: 0.6 }]} />
            </View>
            <View style={s.previewMain}>
              <View style={[s.bar, { width: 46, backgroundColor: p.text }]} />
              <View style={[s.bar, { width: 34, backgroundColor: p.syntax.keyword }]} />
              <View style={[s.bar, { width: 40, backgroundColor: p.syntax.string }]} />
              <View style={[s.pill, { backgroundColor: p.accent }]} />
            </View>
          </View>
        ) : (
          <View style={[s.previewInner, s.previewEmpty, { backgroundColor: t.optionBg }]}>
            <Text style={[s.zedZ, { color: t.muted }]}>Z</Text>
          </View>
        )}
        {zedMark && p ? (
          <View style={[s.zedBadge, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[s.zedBadgeText, { color: t.text }]}>Z</Text>
          </View>
        ) : null}
        {on ? (
          <View style={[s.check, { backgroundColor: t.accent }]}>
            <CheckIcon color={t.onAccent} size={11} strokeWidth={2.8} />
          </View>
        ) : null}
      </View>
      <Text style={[s.swatchLabel, on && { fontWeight: "600" }]} numberOfLines={1}>{label}</Text>
      <Text style={s.swatchSub} numberOfLines={1}>{sub}</Text>
    </Pressable>
  );
}

function Segmented<T extends string>({ t, s, options, value, onChange }: { t: Theme; s: St; options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={[s.seg, { backgroundColor: t.optionBg }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[s.segItem, on && [s.segOn, { backgroundColor: t.surface, borderColor: t.border }]]}>
            <Text style={[s.segText, { color: on ? t.text : t.muted }, on && { fontWeight: "600" }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type St = ReturnType<typeof styles>;
function styles(t: Theme) {
  return StyleSheet.create({
    back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", minHeight: 40, paddingHorizontal: 14 },
    backText: { color: t.muted, fontSize: t.fs(15), fontFamily: ui },
    section: { color: t.muted, fontSize: t.fs(13), fontFamily: ui, paddingHorizontal: 18, marginTop: 16, marginBottom: 8 },
    hint: { color: t.faint, fontSize: t.fs(13), lineHeight: t.fs(18), fontFamily: ui, paddingHorizontal: 18, paddingTop: 8 },
    swatches: { paddingHorizontal: 18, gap: 12 },
    swatch: { width: 104 },
    preview: { height: 70, borderRadius: 12, overflow: "hidden" },
    previewInner: { flex: 1, flexDirection: "row" },
    previewEmpty: { alignItems: "center", justifyContent: "center" },
    previewSide: { width: 34, paddingTop: 10, paddingLeft: 6, gap: 6, borderRightWidth: StyleSheet.hairlineWidth },
    previewMain: { flex: 1, paddingTop: 10, paddingLeft: 8, gap: 6 },
    bar: { height: 4, borderRadius: 2 },
    pill: { position: "absolute", right: 8, bottom: 8, width: 18, height: 10, borderRadius: 5 },
    check: { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    zedBadge: { position: "absolute", left: 6, bottom: 6, width: 18, height: 18, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    zedBadgeText: { fontSize: 10.5, fontWeight: "700", fontFamily: ui },
    zedZ: { fontSize: 22, fontWeight: "700", fontFamily: ui },
    swatchLabel: { color: t.text, fontSize: t.fs(13.5), fontFamily: ui, marginTop: 6 },
    swatchSub: { color: t.faint, fontSize: t.fs(12), fontFamily: ui, marginTop: 1 },
    seg: { flexDirection: "row", marginHorizontal: 18, borderRadius: 12, padding: 3 },
    segItem: { flex: 1, minHeight: 38, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent", paddingHorizontal: 4 },
    segOn: {},
    segText: { fontSize: t.fs(14), fontFamily: ui },
    sample: { color: t.muted, fontSize: t.fs(13), paddingHorizontal: 18, paddingTop: 10 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, marginTop: 18 },
    rowText: { color: t.text, fontSize: t.fs(16), fontFamily: ui },
  });
}
