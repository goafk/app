// Settings → Appearance, as a page.
import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppearanceSettings } from "../components/AppearanceSettings";
import { ChevronLeft } from "../components/Icons";
import { ui, useTheme } from "../lib/theme";

export default function AppearanceScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.panel, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 56, paddingHorizontal: 10 }}>
        <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Back">
          <ChevronLeft color={t.muted} size={22} />
        </Pressable>
        <Text style={{ fontSize: t.fs(20), color: t.text, fontFamily: ui, fontWeight: "700", letterSpacing: -0.3 }}>Appearance</Text>
      </View>
      <AppearanceSettings page />
    </View>
  );
}
