import { FiraCode_400Regular, FiraCode_500Medium, useFonts } from "@expo-google-fonts/fira-code";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardRoot } from "../lib/keyboard";
import { StoreProvider } from "../lib/store";
import { ThemeProvider, useTheme, useZedThemeSync } from "../lib/theme";
import { useStore } from "../lib/store";
import { setupNotificationHandling } from "../lib/push";
import { LockGate } from "../components/LockGate";
import { UpdatesProvider } from "../lib/updates";
import React, { useEffect } from "react";
import { shareModule } from "../lib/share";

/** Wraps the app in the share-intent provider where the native module exists (installed app). */
function ShareProvider({ children }: { children: React.ReactNode }) {
  const mod = shareModule();
  if (!mod) return <>{children}</>;
  const P = mod.ShareIntentProvider;
  return <P options={{ resetOnBackground: true }}>{children}</P>;
}

/** Keeps "Match Zed" in step with the active Mac's Zed theme. */
function ZedThemeSync() {
  const { api, activeHost, conn } = useStore();
  useZedThemeSync(conn.url ? api.zedTheme : null, activeHost?.id ?? conn.url);
  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

function App() {
  const [loaded] = useFonts({ FiraCode_400Regular, FiraCode_500Medium });
  const t = useTheme();
  useEffect(() => setupNotificationHandling(), []);
  if (!loaded) return null;
  return (
    <ShareProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardRoot>
    <SafeAreaProvider>
      <StoreProvider>
        <ZedThemeSync />
        <StatusBar style={t.dark ? "light" : "dark"} />
        <LockGate>
          <UpdatesProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.panel } }} />
          </UpdatesProvider>
        </LockGate>
      </StoreProvider>
    </SafeAreaProvider>
      </KeyboardRoot>
    </GestureHandlerRootView>
    </ShareProvider>
  );
}
