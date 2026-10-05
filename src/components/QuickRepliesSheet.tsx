// Edit quick replies: add, remove, reorder; for this project or for all projects.
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ui, useTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";
import { useQuickReplies } from "../lib/quickReplies";
import type { Scope } from "../lib/quickReplies";
import { ChevronDown, XIcon } from "./Icons";
import { Sheet } from "./Sheet";

export function QuickRepliesSheet({ visible, onClose, cwd }: { visible: boolean; onClose: () => void; cwd?: string }) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const q = useQuickReplies(cwd);
  const [scope, setScope] = useState<Scope>(q.scope);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    if (visible) setScope(q.scope);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = q.listFor(scope);
  const project = cwd?.replace(/\/$/, "").split("/").pop();

  const set = (next: string[]) => q.setList(next, scope);
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    set(next);
  };
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    set([...items, text]);
    setDraft("");
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Quick replies">
      {cwd ? (
        <View style={s.seg}>
          {(["project", "all"] as const).map((sc) => (
            <Pressable key={sc} onPress={() => setScope(sc)} style={[s.segItem, scope === sc && s.segOn]} accessibilityRole="radio" accessibilityState={{ selected: scope === sc }}>
              <Text style={[s.segText, scope === sc && { color: t.text, fontWeight: "600" }]} numberOfLines={1}>
                {sc === "project" ? `Only ${project}` : "All projects"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
        {items.map((text, i) => (
          <View key={`${i}:${text}`} style={s.row}>
            <Text style={s.text} numberOfLines={3}>{text}</Text>
            <Pressable disabled={i === 0} onPress={() => move(i, -1)} hitSlop={6} style={[s.btn, i === 0 && { opacity: 0.3 }]} accessibilityLabel="Move up">
              <View style={{ transform: [{ rotate: "180deg" }] }}>
                <ChevronDown color={t.text} size={16} />
              </View>
            </Pressable>
            <Pressable onPress={() => set(items.filter((_, j) => j !== i))} hitSlop={6} style={s.btn} accessibilityLabel={`Remove ${text}`}>
              <XIcon color={t.muted} size={14} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View style={s.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a reply or a saved prompt…"
          placeholderTextColor={t.faint}
          style={s.input}
          multiline
          onSubmitEditing={add}
          blurOnSubmit
        />
        <Pressable onPress={add} disabled={!draft.trim()} style={[s.addBtn, !draft.trim() && { opacity: 0.4 }]}>
          <Text style={s.addText}>Add</Text>
        </Pressable>
      </View>
      <Text style={s.hint}>
        Tap a reply to send it. Long-press to put it in the message box first, to edit it.
        {scope === "project" ? " Only this project uses this list." : ""}
      </Text>
      {(scope === "project" && q.hasOwn) || scope === "all" ? (
        <Pressable onPress={() => q.reset(scope)} style={({ pressed }) => [s.reset, pressed && { backgroundColor: t.hover }]}>
          <Text style={s.resetText}>{scope === "project" ? "Use the shared list for this project" : "Reset to the defaults"}</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    seg: { flexDirection: "row", marginHorizontal: 18, marginBottom: 8, borderRadius: 12, padding: 3, backgroundColor: t.optionBg },
    segItem: { flex: 1, minHeight: 38, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, borderWidth: 1, borderColor: "transparent" },
    segOn: { backgroundColor: t.surface, borderColor: t.border },
    segText: { fontSize: t.fs(14), color: t.muted, fontFamily: ui },
    row: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 50, paddingLeft: 18, paddingRight: 12 },
    text: { flex: 1, fontSize: t.fs(15.5), color: t.text, fontFamily: ui },
    btn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.optionBg },
    addRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginHorizontal: 18, marginTop: 10 },
    input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: t.fs(15), color: t.text, fontFamily: ui, outlineStyle: "none" } as any,
    addBtn: { height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" },
    addText: { color: t.onAccent, fontSize: t.fs(15), fontFamily: ui, fontWeight: "600" },
    hint: { fontSize: t.fs(12.5), color: t.faint, fontFamily: ui, marginHorizontal: 18, marginTop: 10, lineHeight: t.fs(17) },
    reset: { paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
    resetText: { fontSize: t.fs(15), color: t.muted, fontFamily: ui },
  });
}
