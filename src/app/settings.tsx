// Settings, as its own page: appearance, notifications (with permission + a test push),
// computers, security, connecting by address, and about.
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeApi } from "../lib/api";
import { askNotificationPermission, notificationPermission } from "../lib/push";
import { loadPushPrefs, useStore } from "../lib/store";
import type { PushPrefs } from "../lib/store";
import { ui, useAppearance, useTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";
import { useUpdates } from "../lib/updates";
import { AfkMark, BellIcon, CheckIcon, ChevronLeft, ChevronRight, LaptopIcon, PlusIcon } from "../components/Icons";
import { LOCK_AFTER_OPTIONS, useLock } from "../components/LockGate";

export default function SettingsScreen() {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();
  const { conn, setConn, push, setPushPrefs, retryPush, api, hosts, activeHost, switchHost, live } = useStore();
  const { appearance } = useAppearance();
  const lock = useLock();
  const updates = useUpdates();

  // Notifications: permission, per-kind prefs, and a test push through the Mac.
  const [perm, setPerm] = useState<{ granted: boolean; canAskAgain: boolean } | null | undefined>(undefined);
  const refreshPerm = useCallback(() => notificationPermission().then(setPerm, () => setPerm(null)), []);
  useEffect(() => {
    refreshPerm();
    // Coming back from system settings: pick up the change and register.
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") refreshPerm().then(() => retryPush());
    });
    return () => sub.remove();
  }, [refreshPerm, retryPush]);
  const allow = async () => {
    const before = perm;
    if (before && !before.canAskAgain) return Linking.openSettings();
    const p = await askNotificationPermission();
    setPerm(p);
    if (p?.granted) retryPush();
    else if (p && !p.canAskAgain) Linking.openSettings();
  };
  const [prefs, setPrefs] = useState<PushPrefs>({ finished: true, input: true });
  useEffect(() => {
    loadPushPrefs().then(setPrefs);
  }, []);
  const togglePref = (k: keyof PushPrefs) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    setPushPrefs(next);
  };
  const [test, setTest] = useState<{ state: "sending" | "sent" | "error"; msg?: string } | null>(null);
  const sendTest = async () => {
    if (push?.status !== "registered" || !push.detail) return;
    setTest({ state: "sending" });
    try {
      const r = await api.testPush(push.detail);
      setTest(r.ok ? { state: "sent", msg: "Sent. It should arrive in a few seconds." } : { state: "error", msg: r.error });
    } catch (e: any) {
      setTest({ state: "error", msg: /404|not found/i.test(e.message) ? "Update the hub on your computer to send test notifications." : e.message });
    }
  };

  // Connect by address (advanced).
  const [manual, setManual] = useState(!conn.url);
  const [url, setUrl] = useState(conn.url);
  const [token, setToken] = useState(conn.token);
  const [state, setState] = useState<string | null>(null);
  const save = async () => {
    const clean = url.trim().replace(/\/$/, "");
    const withScheme = /^https?:\/\//.test(clean) ? clean : clean ? `http://${clean}${/:\d+$/.test(clean) ? "" : ":47321"}` : "";
    setState("Checking…");
    try {
      await makeApi({ url: withScheme, token: token.trim() }).sidebar();
      await setConn({ url: withScheme, token: token.trim() });
      setState("Connected");
    } catch (e: any) {
      setState(e.message);
    }
  };

  const native = perm !== null;
  const notifOff = native && perm !== undefined && !perm.granted;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={s.back} accessibilityLabel="Back">
          <ChevronLeft color={t.muted} size={22} />
        </Pressable>
        <Text style={s.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {notifOff ? (
          <View style={s.banner}>
            <BellIcon color={t.text} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle}>Notifications are off</Text>
              <Text style={s.bannerBody}>Turn them on to hear when an agent needs you or finishes.</Text>
            </View>
            <Pressable onPress={allow} style={({ pressed }) => [s.bannerBtn, pressed && { opacity: 0.8 }]}>
              <Text style={s.bannerBtnText}>{perm?.canAskAgain ? "Allow" : "Open settings"}</Text>
            </Pressable>
          </View>
        ) : null}

        <Section s={s} title="Appearance">
          <Row s={s} t={t} label="Theme" value={appearance.theme === "zed" ? `Match Zed · ${t.name}` : t.name} onPress={() => router.push("/appearance")} />
        </Section>

        <Section s={s} title="Notifications">
          {!native ? <Text style={[s.note, { paddingTop: 14 }]}>Notifications work in the installed app.</Text> : null}
          {native ? (
            <>
              <View style={s.row}>
                <Text style={s.rowLabel}>Permission</Text>
                {perm === undefined ? (
                  <ActivityIndicator size="small" color={t.faint} />
                ) : perm?.granted ? (
                  <Text style={[s.rowValue, { color: t.success }]}>Allowed</Text>
                ) : (
                  <Pressable onPress={allow} hitSlop={8}>
                    <Text style={[s.rowValue, s.link]}>{perm?.canAskAgain ? "Allow" : "Open settings"}</Text>
                  </Pressable>
                )}
              </View>
              {(["input", "finished"] as const).map((k) => (
                <View key={k} style={s.row}>
                  <Text style={s.rowLabel}>{k === "input" ? "When a thread needs you" : "When a thread finishes"}</Text>
                  <Switch value={prefs[k]} onValueChange={() => togglePref(k)} trackColor={{ false: t.switchOff, true: t.accent }} thumbColor={prefs[k] ? t.onAccent : "#FFFFFF"} />
                </View>
              ))}
              <Pressable onPress={sendTest} disabled={push?.status !== "registered" || test?.state === "sending"} style={({ pressed }) => [s.row, pressed && { backgroundColor: t.hover }]}>
                <Text style={[s.rowLabel, push?.status !== "registered" && { color: t.faint }]}>Send a test notification</Text>
                {test?.state === "sending" ? <ActivityIndicator size="small" color={t.faint} /> : test?.state === "sent" ? <CheckIcon color={t.success} size={18} /> : <ChevronRight color={t.faint} size={16} />}
              </Pressable>
            </>
          ) : null}
          {test?.msg ? <Text style={[s.note, test.state === "error" && { color: t.error }]}>{test.msg}</Text> : null}
          {native && push && push.status !== "registered" && perm?.granted ? <Text style={[s.note, { color: t.warning }]}>{push.detail}</Text> : null}
        </Section>

        {hosts.length || Platform.OS !== "web" ? (
        <Section s={s} title="Computers">
          {hosts.map((h) => {
            const on = h.id === activeHost?.id;
            return (
              <Pressable key={h.id} onPress={() => !on && switchHost(h.id)} style={({ pressed }) => [s.row, pressed && { backgroundColor: t.hover }]}>
                <LaptopIcon color={t.muted} size={18} />
                <Text style={s.rowLabel} numberOfLines={1}>{h.name}</Text>
                {on ? <Text style={[s.rowValue, { color: live ? t.success : t.faint }]}>{live ? "Connected" : "Connecting…"}</Text> : <Text style={s.rowValue}>Switch</Text>}
              </Pressable>
            );
          })}
          {Platform.OS !== "web" ? (
            <Pressable onPress={() => router.push("/scan")} style={({ pressed }) => [s.row, pressed && { backgroundColor: t.hover }]}>
              <PlusIcon color={t.muted} size={18} />
              <Text style={s.rowLabel}>Add a computer</Text>
              <ChevronRight color={t.faint} size={16} />
            </Pressable>
          ) : null}
        </Section>
        ) : null}

        {lock.supported ? (
          <Section s={s} title="Security">
            <View style={s.row}>
              <Text style={s.rowLabel}>Unlock with fingerprint / Face ID</Text>
              <Switch value={lock.enabled} onValueChange={(v) => lock.setEnabled(v)} trackColor={{ false: t.switchOff, true: t.accent }} thumbColor={lock.enabled ? t.onAccent : "#FFFFFF"} />
            </View>
            {lock.enabled ? (
              <View style={s.block}>
                <Text style={s.blockLabel}>Ask again after the app hasn't been used for</Text>
                <View style={s.chips}>
                  {LOCK_AFTER_OPTIONS.map((o) => {
                    const on = lock.after === o.ms;
                    return (
                      <Pressable key={o.ms} onPress={() => lock.setAfter(o.ms)} style={[s.chip, { backgroundColor: on ? t.accent : "transparent", borderColor: on ? t.accent : t.borderStrong }]}>
                        <Text style={[s.chipText, { color: on ? t.onAccent : t.text }]}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section s={s} title="Connection" footer={manual ? 'Easiest: run "afk pair" on the computer and scan the code. Use this only to type an address and key by hand.' : undefined}>
          {!manual ? (
            <Row s={s} t={t} label="Connect by address" value="Advanced" onPress={() => setManual(true)} />
          ) : (
            <View style={[s.block, { gap: 10 }]}>
              <Text style={s.blockLabel}>Hub address</Text>
              <TextInput value={url} onChangeText={setUrl} placeholder="192.168.1.20:47321" placeholderTextColor={t.faint} autoCapitalize="none" autoCorrect={false} style={s.field} />
              <Text style={s.blockLabel}>Key</Text>
              <TextInput value={token} onChangeText={setToken} placeholder="from ~/.afk/config.json" placeholderTextColor={t.faint} autoCapitalize="none" autoCorrect={false} secureTextEntry style={s.field} />
              {state ? <Text style={[s.note, { paddingHorizontal: 0, color: state === "Connected" ? t.success : state === "Checking…" ? t.muted : t.error }]}>{state}</Text> : null}
              <Pressable onPress={save} style={({ pressed }) => [s.primary, pressed && { transform: [{ scale: 0.98 }] }]}>
                <Text style={s.primaryText}>Connect</Text>
              </Pressable>
            </View>
          )}
        </Section>

        <Section s={s} title="About">
          <View style={s.row}>
            <Text style={[s.rowLabel, { color: t.muted, fontSize: t.fs(14) }]} numberOfLines={2}>{updates.info}</Text>
            <Pressable onPress={updates.state === "ready" ? updates.restart : updates.check} hitSlop={8}>
              <Text style={[s.rowValue, s.link]}>
                {updates.state === "ready" ? "Restart to update" : updates.state === "checking" ? "Checking…" : updates.state === "downloading" ? "Downloading…" : updates.state === "latest" ? "Up to date ✓" : "Check for updates"}
              </Text>
            </Pressable>
          </View>
          {updates.error ? <Text style={[s.note, { color: t.error }]}>{updates.error}</Text> : null}
          <Row s={s} t={t} label="Help & docs" onPress={() => Linking.openURL("https://goafk.dev/docs/")} />
          <Row s={s} t={t} label="Privacy" onPress={() => Linking.openURL("https://goafk.dev/privacy/")} />
          <Row s={s} t={t} label="Website" value="goafk.dev" onPress={() => Linking.openURL("https://goafk.dev")} />
        </Section>

        <View style={s.footer}>
          <AfkMark size={26} bar={t.text} />
          <Text style={s.footerText}>Away from keyboard, not away from control.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

type St = ReturnType<typeof styles>;

function Section({ s, title, footer, children }: { s: St; title: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.card}>{children}</View>
      {footer ? <Text style={s.sectionFooter}>{footer}</Text> : null}
    </View>
  );
}

function Row({ s, t, label, value, onPress }: { s: St; t: Theme; label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: t.hover }]} accessibilityRole="button">
      <Text style={s.rowLabel}>{label}</Text>
      {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : null}
      <ChevronRight color={t.faint} size={16} />
    </Pressable>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.panel },
    header: { flexDirection: "row", alignItems: "center", gap: 6, height: 56, paddingHorizontal: 10 },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    title: { fontSize: t.fs(20), color: t.text, fontFamily: ui, fontWeight: "700", letterSpacing: -0.3 },
    banner: { flexDirection: "row", alignItems: "center", gap: 12, margin: 16, marginBottom: 4, padding: 14, borderRadius: 18, backgroundColor: t.optionBg },
    bannerTitle: { fontSize: t.fs(15.5), color: t.text, fontFamily: ui, fontWeight: "600" },
    bannerBody: { fontSize: t.fs(13), color: t.muted, fontFamily: ui, marginTop: 2, lineHeight: t.fs(18) },
    bannerBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" },
    bannerBtnText: { color: t.onAccent, fontSize: t.fs(14), fontFamily: ui, fontWeight: "600" },
    section: { marginTop: 20, paddingHorizontal: 16 },
    sectionTitle: { fontSize: t.fs(13), color: t.muted, fontFamily: ui, fontWeight: "500", marginBottom: 8, marginLeft: 4 },
    sectionFooter: { fontSize: t.fs(12.5), color: t.faint, fontFamily: ui, marginTop: 8, marginHorizontal: 4, lineHeight: t.fs(17) },
    card: { backgroundColor: t.surface, borderRadius: 18, borderWidth: 1, borderColor: t.border, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 16, paddingVertical: t.sp(8) },
    rowLabel: { flex: 1, fontSize: t.fs(16), color: t.text, fontFamily: ui },
    rowValue: { fontSize: t.fs(15), color: t.muted, fontFamily: ui, maxWidth: 200 },
    link: { color: t.text, fontWeight: "600" },
    note: { fontSize: t.fs(13), color: t.muted, fontFamily: ui, paddingHorizontal: 16, paddingBottom: 12, lineHeight: t.fs(18) },
    block: { paddingHorizontal: 16, paddingVertical: 12 },
    blockLabel: { fontSize: t.fs(13), color: t.muted, fontFamily: ui },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 10 },
    chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    chipText: { fontSize: t.fs(14.5), fontFamily: ui, fontWeight: "500" },
    field: { borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: t.fs(15), color: t.text, fontFamily: t.mono, outlineStyle: "none" } as any,
    primary: { height: 46, borderRadius: 14, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", marginTop: 4 },
    primaryText: { color: t.onAccent, fontSize: t.fs(16), fontFamily: ui, fontWeight: "600" },
    footer: { alignItems: "center", gap: 10, paddingTop: 36, paddingBottom: 12 },
    footerText: { fontSize: t.fs(13), color: t.faint, fontFamily: ui },
  });
}
