// zedthreads://demo opens the demo Mac.
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { useStartDemo } from "../lib/demo/useStartDemo";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";

export default function Demo() {
  const t = useTheme();
  const { ready } = useStore();
  const start = useStartDemo();
  const once = useRef(false);
  useEffect(() => {
    if (!ready || once.current) return;
    once.current = true;
    start();
  }, [ready, start]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.panel }}>
      <ActivityIndicator color={t.faint} />
    </View>
  );
}
