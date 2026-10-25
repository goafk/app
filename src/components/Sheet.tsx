// Bottom sheet (phone) / centered popover (wide) used for dropdowns and dialogs.
// Phones: drag the top of the sheet (grabber and title) down to dismiss it; a short drag springs back.
// The drag area is the top only, so scrolling inside a sheet never closes it by accident.
// The backdrop fades in place while only the card slides up; closing plays the same in reverse.
import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardLift } from "../lib/keyboard";
import { ui, useTheme } from "../lib/theme";
import { haptic } from "../lib/haptics";

// iOS's sheet curve: quick out of the gate, long gentle settle.
const SHEET_EASE = Easing.bezier(0.32, 0.72, 0, 1);

// One sheet handing off to another (menu → Rename) shares one backdrop: the closing sheet drops its
// dim at once and the opening one starts fully dimmed, instead of two backdrops stacking darker.
const closing = new Set<() => void>();
let lastClosedAt = 0;

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  const y = useSharedValue(0); // drag offset
  const open = useSharedValue(0); // 0 hidden → 1 shown
  const dim = useSharedValue(0);
  const cardH = useSharedValue(height);

  // Stay mounted through the exit animation, showing what was there (callers often clear it on close).
  const [mounted, setMounted] = useState(visible);
  const wasShown = useRef(false);
  const last = useRef({ title, children });
  if (visible) last.current = { title, children };

  useEffect(() => {
    if (visible) {
      wasShown.current = true;
      setMounted(true);
      y.value = 0;
      open.value = withTiming(1, { duration: wide ? 180 : 340, easing: SHEET_EASE });
      // After this commit's effects, so a sheet closing in the same render has registered.
      queueMicrotask(() => {
        if (Date.now() - lastClosedAt < 100 && closing.size) {
          for (const drop of closing) drop();
          dim.value = 1;
        } else dim.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
      });
      return;
    }
    if (!wasShown.current) return;
    wasShown.current = false;
    const drop = () => (dim.value = 0);
    closing.add(drop);
    lastClosedAt = Date.now();
    dim.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) });
    open.value = withTiming(0, { duration: wide ? 140 : 220, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(setMounted)(false);
    });
    return () => {
      closing.delete(drop);
    };
  }, [visible, wide, y, open, dim]);

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
        runOnJS(haptic.tap)();
        runOnJS(onClose)(); // the exit carries on from here
      }
      else y.value = withSpring(0, { damping: 22, stiffness: 260 });
    });

  const cardStyle = useAnimatedStyle(() =>
    wide
      ? { opacity: open.value, transform: [{ scale: 0.97 + 0.03 * open.value }] }
      : { transform: [{ translateY: y.value + (1 - open.value) * (cardH.value + 24) }] },
  );
  // The backdrop fades with the sheet, and as it's dragged down.
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value * (1 - Math.min(1, Math.max(0, y.value) / 400)) }));

  const shown = visible ? { title, children } : last.current;
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* The card already pads for the home indicator; the keyboard covers that, so don't count it twice. */}
        <KeyboardLift style={{ flex: 1 }} bottomInset={wide ? 0 : Math.max(insets.bottom, 12) - 12}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }, dimStyle]} pointerEvents="none" />
          <Pressable style={[st.backdrop, wide && st.center]} onPress={onClose} accessibilityLabel="Close" disabled={!visible}>
            <Animated.View
              style={[st.wrap, wide ? st.wrapWide : null, cardStyle]}
              onLayout={(e) => (cardH.value = e.nativeEvent.layout.height)}
              pointerEvents={visible ? "auto" : "none"}
            >
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
                    {shown.title ? <Text style={[st.title, { color: t.muted }]}>{shown.title}</Text> : null}
                  </View>
                </GestureDetector>
                {shown.children}
              </Pressable>
            </Animated.View>
          </Pressable>
        </KeyboardLift>
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
