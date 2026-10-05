// New-thread picker and hub connection settings.
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { Agent, SidebarThread } from "../lib/api";
import { makeApi } from "../lib/api";
import { loadPushPrefs, useStore } from "../lib/store";
import type { PushPrefs } from "../lib/store";
import { ui, useAppearance, useTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";
import { AgentIcon, CheckIcon, ChevronRight } from "./Icons";
import { AppearanceSettings } from "./AppearanceSettings";
import { LOCK_AFTER_OPTIONS, useLock } from "./LockGate";
import { useUpdates } from "../lib/updates";
import { Sheet } from "./Sheet";

const kindOf = (id: string) => (id.includes("claude") ? "claude" : id.includes("codex") ? "codex" : "other");

export function NewThreadSheet({ cwd, onClose, onCreated }: { cwd: string | null; onClose: () => void; onCreated: (t: SidebarThread) => void }) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const { api } = useStore();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!cwd) return;
    setErr(null);
    setPrompt("");
    api.agents().then(
      (a) => {
        setAgents(a);
        setAgentId((cur) => cur ?? a.find((x) => x.agentId.includes("claude"))?.agentId ?? a[0]?.agentId ?? null);
      },
      (e) => setErr(e.message),
    );
  }, [cwd, api]);

  const start = async () => {
    if (!cwd || !agentId) return;
    setBusy(true);
    setErr(null);
    try {
      const th = await api.newThread(cwd, agentId, prompt.trim() || undefined);
      onCreated(th);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={!!cwd} onClose={onClose} title={`New thread · ${cwd?.split("/").pop() ?? ""}`}>
      {agents === null && !err ? <ActivityIndicator style={{ margin: 20 }} color={t.faint} /> : null}
      {(agents ?? []).map((a) => (
        <Pressable key={a.agentId} onPress={() => setAgentId(a.agentId)} style={({ pressed }) => [s.row, pressed && { backgroundColor: t.hover }]}>
          <AgentIcon kind={kindOf(a.agentId)} color={t.muted} size={18} />
          <Text style={[s.rowText, agentId === a.agentId && { color: t.accent }]}>{a.zedName}</Text>
          {agentId === a.agentId ? <CheckIcon color={t.accent} size={16} /> : null}
        </Pressable>
      ))}
      <View style={s.box}>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="First message (optional)"
          placeholderTextColor={t.faint}
          multiline
          style={s.input}
        />
      </View>
      {err ? <Text style={s.err}>{err}</Text> : null}
      <Text style={s.hint}>Zed opens the project and starts the thread on your Mac.</Text>
      <Pressable onPress={start} disabled={busy || !agentId} style={[s.primary, (busy || !agentId) && { opacity: 0.5 }]}>
        {busy ? <ActivityIndicator color={t.onAccent} size="small" /> : <Text style={s.primaryText}>Start thread</Text>}
      </Pressable>
    </Sheet>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    navRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingHorizontal: 18, marginBottom: 4 },
    navValue: { color: t.faint, fontSize: t.fs(14), fontFamily: ui, maxWidth: 190 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
    linkBtn: { minHeight: 44, justifyContent: "center", paddingLeft: 12 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },
    chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    chipText: { fontSize: t.fs(14.5), fontFamily: ui, fontWeight: "500" },
    rowText: { flex: 1, fontSize: t.fs(16), color: t.text, fontFamily: ui },
    box: { marginHorizontal: 18, marginTop: 8, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, padding: 12 },
    input: { minHeight: 70, fontFamily: t.mono, fontSize: t.fs(14.5), color: t.text, outlineStyle: "none" } as any,
    err: { color: t.error, fontSize: t.fs(13.5), fontFamily: ui, paddingHorizontal: 18, paddingTop: 8 },
    hint: { color: t.faint, fontSize: t.fs(13), fontFamily: ui, paddingHorizontal: 18, paddingTop: 8 },
    hint2: { color: t.faint, fontSize: t.fs(13), lineHeight: t.fs(18), fontFamily: ui },
    primary: { margin: 18, marginTop: 14, height: 44, borderRadius: 10, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" },
    primaryText: { color: t.onAccent, fontSize: t.fs(16), fontFamily: ui, fontWeight: "600" },
    prefRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 8 },
    label: { color: t.muted, fontSize: t.fs(13), fontFamily: ui },
    field: { borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: t.fs(15), color: t.text, fontFamily: t.mono, outlineStyle: "none" } as any,
  });
}
