// Add a Mac: scan the QR that `afk setup` / `afk pair` prints. Doubles as the first-run
// screen, with the one-line install for the Mac.
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_HOST_ID } from "../lib/demo/hub";
import { useStartDemo } from "../lib/demo/useStartDemo";
import { parsePairLink } from "../lib/hosts";
import { useStore } from "../lib/store";
import { mono, ui, useTheme } from "../lib/theme";
import { AfkMark, ChevronLeft } from "../components/Icons";

// The one-line install (install.sh, served from goafk.dev).
const INSTALL_COMMAND: string | null = "curl -fsSL https://goafk.dev/install.sh | sh";

export default function Scan() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { hosts } = useStore();
  const inDemo = hosts.some((h) => h.id === DEMO_HOST_ID);
  // A pretend Mac with sample projects, for trying afk before installing anything.
  const demo = useStartDemo();
  const [perm, requestPerm] = useCameraPermissions();
  const [msg, setMsg] = useState<string | null>(null);
  const handled = useRef(false);
  const first = !hosts.length;

  const use = (data: string) => {
    if (handled.current) return;
    const link = parsePairLink(data);
    if (!data.startsWith("zedthreads://pair") || !link) {
      setMsg("That's not an afk pairing code.");
      return;
    }
    handled.current = true;
    const q = [`h=${encodeURIComponent(link.hubId)}`, `n=${encodeURIComponent(link.name)}`, `c=${encodeURIComponent(link.code)}`, ...link.urls.map((u) => `u=${encodeURIComponent(u)}`)].join("&");
    router.replace(`/pair?${q}` as any);
  };

  const paste = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) use(text);
    else setMsg("Clipboard is empty — copy the pairing link printed on your Mac.");
  };

  return (
    <View style={[st.root, { backgroundColor: t.panel, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={st.head}>
        {!first ? (
          <Pressable onPress={() => router.back()} hitSlop={10} style={st.back} accessibilityLabel="Back">
            <ChevronLeft color={t.muted} size={22} />
          </Pressable>
        ) : null}
        {first ? <AfkMark size={26} bar={t.text} /> : null}
        <Text style={[st.title, { color: t.text }]}>{first ? "Connect your Mac" : "Add a Mac"}</Text>
      </View>

      <View style={st.steps}>
        <Text style={[st.step, { color: t.muted }]}>1. On the Mac, in Terminal:</Text>
        <Pressable
          onPress={() => Clipboard.setStringAsync(INSTALL_COMMAND ?? "afk setup").then(() => setMsg("Copied — send it to your Mac"))}
          style={[st.cmd, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <Text style={[st.cmdText, { color: t.text }]} selectable>
            {INSTALL_COMMAND ?? "afk setup"}
          </Text>
        </Pressable>
        <Text style={[st.hint, { color: t.faint }]}>Already set up? Run afk pair for a new code.</Text>
        <Text style={[st.step, { color: t.muted, marginTop: 10 }]}>2. Scan the QR code it shows:</Text>
      </View>

      <View style={[st.camera, { backgroundColor: t.surface, borderColor: t.border }]}>
        {Platform.OS === "web" ? (
          <Text style={[st.hint, { color: t.faint }]}>Scanning works in the phone app. Paste the link instead.</Text>
        ) : !perm ? null : perm.granted ? (
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => use(data)} />
        ) : (
          <Pressable onPress={requestPerm} style={[st.btn, { backgroundColor: t.accent }]}>
            <Text style={[st.btnText, { color: t.onAccent }]}>Allow camera to scan</Text>
          </Pressable>
        )}
      </View>

      {msg ? <Text style={[st.hint, { color: t.warning, textAlign: "center" }]}>{msg}</Text> : null}
      <View style={st.row}>
        <Pressable onPress={paste} style={[st.link]} hitSlop={6}>
          <Text style={[st.linkText, { color: t.accent }]}>Paste pairing link</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/?settings=1" as any)} style={st.link} hitSlop={6}>
          <Text style={[st.linkText, { color: t.muted }]}>Enter address manually</Text>
        </Pressable>
      </View>
      {first || inDemo ? (
        <Pressable onPress={demo} style={[st.demo, { borderColor: t.border }]} accessibilityRole="button">
          <Text style={[st.linkText, { color: t.text }]}>No Mac handy? Try the demo</Text>
          <Text style={[st.hint, { color: t.faint }]}>Sample projects, nothing to install</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, gap: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  back: { width: 36, height: 44, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", fontFamily: ui },
  steps: { gap: 8 },
  step: { fontSize: 15, fontFamily: ui },
  cmd: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  cmdText: { fontFamily: mono, fontSize: 13.5 },
  hint: { fontSize: 13.5, fontFamily: ui },
  camera: { flex: 1, minHeight: 240, borderRadius: 18, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  btn: { minHeight: 44, paddingHorizontal: 20, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontFamily: ui, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  link: { minHeight: 44, justifyContent: "center" },
  linkText: { fontSize: 15, fontFamily: ui, fontWeight: "500" },
  demo: { minHeight: 56, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 8 },
});
