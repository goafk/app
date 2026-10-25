// Android draws edge-to-edge (SDK 57+), so the window no longer shrinks for the keyboard and
// React Native's own keyboard events/KeyboardAvoidingView don't help there. On Android we follow
// the keyboard natively (react-native-keyboard-controller) and pad the bottom by its height, frame by
// frame, so the composer rides on top of the keyboard. iOS keeps KeyboardAvoidingView.
import React, { useEffect } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { KeyboardProvider, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** iOS only: height of anything above this view (header). */
  iosOffset?: number;
  /** Bottom padding the content already reserves (e.g. the gesture-bar inset); not added twice. */
  bottomInset?: number;
};

export function KeyboardRoot({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== "android") return <>{children}</>;
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

export function KeyboardSafe({ children, style, iosOffset = 0, bottomInset = 0 }: Props) {
  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView style={style} behavior="padding" keyboardVerticalOffset={iosOffset}>
        {children}
      </KeyboardAvoidingView>
    );
  }
  if (Platform.OS !== "android") return <View style={style}>{children}</View>;
  return (
    <AndroidKeyboardSafe style={style} bottomInset={bottomInset}>
      {children}
    </AndroidKeyboardSafe>
  );
}

function AndroidKeyboardSafe({ children, style, bottomInset = 0 }: Omit<Props, "iosOffset">) {
  const { height } = useReanimatedKeyboardAnimation(); // 0 → -keyboardHeight
  const pad = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, -height.value - bottomInset) }), [bottomInset]);
  return <Animated.View style={[style, pad]}>{children}</Animated.View>;
}

/**
 * Pads its bottom by the keyboard's height, for full-screen overlays (sheets in a Modal) where
 * KeyboardAvoidingView measures against the wrong frame. iOS follows the keyboard's own will-show/
 * will-hide timing; Android follows it natively, frame by frame (the controller sees Modal windows too).
 */
export function KeyboardLift({ children, style, bottomInset = 0 }: Omit<Props, "iosOffset">) {
  if (Platform.OS === "ios") return <IosKeyboardLift style={style} bottomInset={bottomInset}>{children}</IosKeyboardLift>;
  if (Platform.OS === "android") return <AndroidKeyboardSafe style={style} bottomInset={bottomInset}>{children}</AndroidKeyboardSafe>;
  return <View style={style}>{children}</View>;
}

function IosKeyboardLift({ children, style, bottomInset = 0 }: Omit<Props, "iosOffset">) {
  const kb = useSharedValue(0);
  useEffect(() => {
    const ease = { easing: Easing.bezier(0.17, 0.59, 0.4, 0.77) };
    const show = Keyboard.addListener("keyboardWillShow", (e) => {
      kb.value = withTiming(e.endCoordinates.height, { duration: e.duration || 250, ...ease });
    });
    const hide = Keyboard.addListener("keyboardWillHide", (e) => {
      kb.value = withTiming(0, { duration: e.duration || 250, ...ease });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [kb]);
  const pad = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, kb.value - bottomInset) }), [bottomInset]);
  return <Animated.View style={[style, pad]}>{children}</Animated.View>;
}
