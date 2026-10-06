// Shown while the demo Mac is active: what this is, and the way out.
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DEMO_HOST_ID, isDemo } from "../lib/demo/hub";
import { useStore } from "../lib/store";
import { ui, useTheme } from "../lib/theme";

export function DemoBanner({ phone }: { phone: boolean }) {
  const t = useTheme();
  const { conn, removeHost } = useStore();
  if (!isDemo(conn.url)) return null;
  return (
    <View style={[st.wrap, phone && st.phone, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={[st.text, { color: t.muted, fontSize: t.fs(13) }]}>
        <Text style={{ color: t.text, fontWeight: "600" }}>Demo.</Text> Sample projects, nothing runs. Tap around, send a message, approve a request.
      </Text>
      <View style={st.row}>
        <Pressable onPress={() => router.push("/scan")} hitSlop={6} style={st.btn} accessibilityRole="button">
          <Text style={[st.btnText, { color: t.accent, fontSize: t.fs(14) }]}>Connect my Mac</Text>
        </Pressable>
        <Pressable onPress={() => removeHost(DEMO_HOST_ID).then(() => router.replace("/scan"))} hitSlop={6} style={st.btn} accessibilityRole="button">
          <Text style={[st.btnText, { color: t.muted, fontSize: t.fs(14) }]}>Leave demo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2, gap: 2 },
  phone: { marginHorizontal: 16 },
  text: { fontFamily: ui, lineHeight: 19 },
  row: { flexDirection: "row", gap: 20 },
  btn: { minHeight: 40, justifyContent: "center" },
  btnText: { fontFamily: ui, fontWeight: "600" },
});
