// Bottom sheet (phone) / centered popover (wide) used for dropdowns and dialogs.
// Phones: drag the top of the sheet (grabber and title) down to dismiss it; a short drag springs back.
// The drag area is the top only, so scrolling inside a sheet never closes it by accident.
import React, { useEffect } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ui, useTheme } from "../lib/theme";

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  const y = useSharedValue(0);

  useEffect(() => {
    if (visible) y.value = 0;
  }, [visible, y]);

  const drag = Gesture.Pan()
    .enabled(!wide)
    .activeOffsetY(6)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      // Down follows the finger; up resists a little.
      y.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15;
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) {
        y.value = withTiming(height, { duration: 180 }, () => runOnJS(onClose)());
      } else {
        y.value = withSpring(0, { damping: 22, stiffness: 260 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  // The backdrop fades as the sheet is dragged down.
  const dimStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.max(0, y.value) / 400) }));

  return (
    <Modal visible={visible} transparent animationType={wide ? "fade" : "slide"} onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }, dimStyle]} pointerEvents="none" />
          <Pressable style={[st.backdrop, wide && st.center]} onPress={onClose} accessibilityLabel="Close">
            <Animated.View style={[st.wrap, wide ? st.wrapWide : null, !wide && cardStyle]}>
              <Pressable
                onPress={() => {}}
                style={[
                  st.card,
                  { backgroundColor: t.surface, borderColor: t.border, paddingBottom: wide ? 12 : Math.max(insets.bottom, 12) },
                  wide ? st.cardWide : st.cardSheet,
                ]}
              >
                <GestureDetector gesture={drag}>
                  <View style={!wide ? st.handleArea : undefined} accessibilityHint={!wide ? "Drag down to close" : undefined}>
                    {!wide ? <View style={[st.grabber, { backgroundColor: t.borderStrong }]} /> : null}
                    {title ? <Text style={[st.title, { color: t.muted }]}>{title}</Text> : null}
                  </View>
                </GestureDetector>
                {children}
              </Pressable>
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  center: { justifyContent: "center", alignItems: "center" },
  wrap: { maxHeight: "80%", width: "100%" },
  wrapWide: { width: undefined },
  card: { borderWidth: StyleSheet.hairlineWidth, flexShrink: 1 },
  cardSheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8 },
  cardWide: { width: 420, borderRadius: 12, paddingTop: 12 },
  // A generous grab zone at the top of the sheet.
  handleArea: { minHeight: 28, paddingTop: 2 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  title: { fontSize: 13, fontFamily: ui, paddingHorizontal: 18, paddingVertical: 8, textTransform: "uppercase", letterSpacing: 0.6 },
});
