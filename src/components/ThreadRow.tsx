// One sidebar thread row: agent icon / spinner / warning, title, age, unread dot.
// Swipe left to archive (or unarchive); long-press for rename / archive / mark read.
import React, { useRef } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SidebarThread } from "../lib/api";
import { age } from "../lib/time";
import { ui } from "../lib/theme";
import { readableOn } from "../lib/themes";
import type { Theme } from "../lib/theme";
import { AgentIcon, WarningIcon } from "./Icons";

type Props = {
  th: SidebarThread;
  t: Theme;
  selected: boolean;
  subtitle?: string;
  preview?: boolean;
  now: number;
  onOpen: () => void;
  onMenu: () => void;
  onArchive: () => void;
};

export function ThreadRow({ th, t, selected, subtitle, preview, now, onOpen, onMenu, onArchive }: Props) {
  const ref = useRef<SwipeableMethods>(null);
  const st = sheet(t);
  const waiting = th.status === "needs_permission";
  const row = (
    <Pressable
      onPress={onOpen}
      onLongPress={onMenu}
      delayLongPress={350}
      style={({ pressed }) => [st.thread, { backgroundColor: t.sidebar }, selected && { backgroundColor: t.selected }, pressed && !selected && { backgroundColor: t.hover }]}
      {...(Platform.OS === "web" ? ({ onContextMenu: (e: any) => (e.preventDefault(), onMenu()) } as any) : {})}
    >
      <View style={st.line}>
        <View style={st.icon}>
          {th.status === "running" ? (
            <ActivityIndicator size="small" color={t.muted} style={{ transform: [{ scale: 0.75 }] }} />
          ) : waiting ? (
            <WarningIcon color={t.warning} size={17} />
          ) : (
            <AgentIcon kind={th.kind} color={t.muted} size={18} />
          )}
        </View>
        <Text style={[st.title, { color: t.text }, th.unread && { fontWeight: "600" }]} numberOfLines={1}>{th.title}</Text>
        {th.unread ? <View style={[st.dot, { backgroundColor: t.accent }]} /> : null}
      </View>
      {preview && th.preview ? <Text style={[st.preview, { color: t.muted }]} numberOfLines={2}>{th.preview.replace(/\s+/g, " ").trim()}</Text> : null}
      <Text style={[st.age, { color: waiting ? t.warning : t.muted }]}>
        {waiting ? "Waiting for input · " : th.status === "running" ? "Generating · " : ""}
        {th.archived ? "Archived · " : ""}
        {subtitle ? `${subtitle} · ` : ""}
        {age(th.updatedAt, now)}
      </Text>
    </Pressable>
  );
  if (Platform.OS === "web") return row;
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={60}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            ref.current?.close();
            onArchive();
          }}
          style={[st.action, { backgroundColor: th.archived ? t.success : t.borderStrong }]}
        >
          <Text style={[st.actionText, { color: readableOn(th.archived ? t.success : t.borderStrong) }]}>{th.archived ? "Unarchive" : "Archive"}</Text>
        </Pressable>
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

function make(t: Theme) {
  return StyleSheet.create({
  thread: { paddingLeft: 14, paddingRight: 14, paddingVertical: t.sp(9) },
  line: { flexDirection: "row", alignItems: "center" },
  icon: { width: 26, height: 22, alignItems: "flex-start", justifyContent: "center" },
  title: { flex: 1, fontSize: t.fs(16), fontFamily: ui },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  preview: { marginLeft: 26, marginTop: 3, fontSize: t.fs(14), lineHeight: t.fs(19), fontFamily: ui },
  age: { marginLeft: 26, marginTop: 2, fontSize: t.fs(14), fontFamily: ui },
  action: { width: 104, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: t.fs(15), fontFamily: ui, fontWeight: "600" },
  });
}
const sheets = new WeakMap<Theme, ReturnType<typeof make>>();
/** Styles for a theme, built once per theme (rows render many times). */
function sheet(t: Theme) {
  let s = sheets.get(t);
  if (!s) sheets.set(t, (s = make(t)));
  return s;
}

