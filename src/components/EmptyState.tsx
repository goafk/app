// A quiet, centred empty state with the afk mark: nothing waiting, loading, no selection.
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ui, useTheme } from "../lib/theme";
import { AfkMark } from "./Icons";

export function EmptyState({ title, body, loading }: { title: string; body?: string; loading?: boolean }) {
  const t = useTheme();
  return (
    <View style={st.wrap}>
      <View style={{ opacity: 0.85 }}>
        <AfkMark size={40} bar={t.text} />
      </View>
      <Text style={[st.title, { color: t.text, fontSize: t.fs(16.5) }]}>{title}</Text>
      {body ? <Text style={[st.body, { color: t.muted, fontSize: t.fs(14), lineHeight: t.fs(20) }]}>{body}</Text> : null}
      {loading ? <ActivityIndicator size="small" color={t.faint} style={{ marginTop: 6 }} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32, paddingVertical: 64 },
  title: { fontFamily: ui, fontWeight: "600", textAlign: "center", marginTop: 6 },
  body: { fontFamily: ui, textAlign: "center", maxWidth: 300 },
});
