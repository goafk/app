// The phone's bottom bar: four labelled tabs around a raised, round New thread button.
// The bar's top edge rises into a smooth bump that cradles the button.
import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ui, useTheme } from "../lib/theme";
import { BellIcon, ClockIcon, FolderIcon, GearIcon, PlusIcon } from "./Icons";

export type TabKey = "projects" | "inbox" | "history" | "settings";

const BUMP = 20; // how far the bump rises above the bar
const BAR = 60; // bar height below the flat top edge
const BTN = 64; // the round + button

/** Top edge: flat, then a smooth rise to the bump's crest at the centre, and back down. */
function shape(w: number, h: number): { fill: string; edge: string } {
  const c = w / 2;
  const half = 74; // half-width of the bump at its base
  const top = `M0 ${BUMP} L${c - half} ${BUMP} C${c - half * 0.55} ${BUMP} ${c - half * 0.62} 0 ${c} 0 C${c + half * 0.62} 0 ${c + half * 0.55} ${BUMP} ${c + half} ${BUMP} L${w} ${BUMP}`;
  return { edge: top, fill: `${top} L${w} ${h} L0 ${h} Z` };
}

export function TabBar({ active, inboxCount, onTab, onNew, canNew }: { active: TabKey; inboxCount: number; onTab: (k: TabKey) => void; onNew: () => void; canNew: boolean }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);
  const h = BUMP + BAR + bottom;
  const { fill, edge } = shape(width, h);

  const tab = (key: TabKey, label: string, Icon: typeof FolderIcon) => {
    const on = key === active;
    return (
      <Pressable
        key={key}
        onPress={() => onTab(key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={key === "inbox" && inboxCount ? `${label}, ${inboxCount}` : label}
        style={({ pressed }) => [st.tab, pressed && { opacity: 0.6 }]}
      >
        <View>
          <Icon color={on ? t.text : t.faint} size={22} strokeWidth={on ? 2 : 1.7} />
          {key === "inbox" && inboxCount ? (
            <View style={[st.badge, { backgroundColor: t.accent, borderColor: t.surface }]}>
              <Text style={[st.badgeText, { color: t.onAccent }]}>{inboxCount > 99 ? "99+" : inboxCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[st.label, { color: on ? t.text : t.faint, fontSize: t.fs(11.5) }, on && { fontWeight: "600" }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={[st.indicator, { backgroundColor: on ? t.text : "transparent" }]} />
      </Pressable>
    );
  };

  return (
    <View style={{ height: h }} accessibilityRole="tablist">
      <Svg width={width} height={h} style={StyleSheet.absoluteFill}>
        <Path d={fill} fill={t.surface} />
        <Path d={edge} fill="none" stroke={t.border} strokeWidth={1} />
      </Svg>
      <View style={[st.row, { paddingBottom: bottom }]}>
        {tab("projects", "Projects", FolderIcon)}
        {tab("inbox", "Needs you", BellIcon)}
        <View style={st.center}>
          <Pressable
            onPress={onNew}
            disabled={!canNew}
            accessibilityRole="button"
            accessibilityLabel="New thread"
            style={({ pressed }) => [
              st.plus,
              { backgroundColor: t.accent, borderColor: t.surface, shadowOpacity: t.dark ? 0.55 : 0.22, opacity: canNew ? 1 : 0.5 },
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
          >
            <PlusIcon color={t.onAccent} size={26} strokeWidth={2.2} />
          </Pressable>
        </View>
        {tab("history", "Recent", ClockIcon)}
        {tab("settings", "Settings", GearIcon)}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  row: { position: "absolute", left: 0, right: 0, top: BUMP, bottom: 0, flexDirection: "row", paddingHorizontal: 4 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 52 },
  label: { fontFamily: ui, fontWeight: "500" },
  indicator: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  center: { width: 84, alignItems: "center" },
  plus: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    marginTop: -BUMP - 12,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  badge: { position: "absolute", top: -5, left: 14, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, paddingHorizontal: 3, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 10.5, fontWeight: "700", fontFamily: ui },
});
