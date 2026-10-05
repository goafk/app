// The message composer, laid out for phones: quick replies, a rounded input, and one row with
// + (attach) · a settings pill (mode / model / effort / Fast, in one sheet) · context ring · send.
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { ConfigOption } from "../lib/api";
import { ui, useTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";
import { ArrowUpIcon, BoltIcon, CheckIcon, ChevronDown, ChevronRight, ExpandIcon, FileIcon, FolderIcon, PencilIcon, PlusIcon, StopIcon, XIcon } from "./Icons";
import { QuickRepliesSheet } from "./QuickRepliesSheet";
import { chipLabel, useQuickReplies } from "../lib/quickReplies";
import { pickImages } from "../lib/images";
import type { Attachment } from "../lib/images";
import { Sheet } from "./Sheet";
import { formatTokens } from "./PlanBar";

type Choice = { value: string; name?: string; description?: string; group?: string };

export function flatOptions(o: ConfigOption): Choice[] {
  const out: Choice[] = [];
  for (const x of o.options ?? []) {
    if ("options" in x && Array.isArray(x.options)) for (const y of x.options) out.push({ ...y, group: x.name ?? x.group });
    else out.push(x as Choice);
  }
  return out;
}

const ON = new Set(["on", "true", "enabled", "yes"]);
const OFF = new Set(["off", "false", "disabled", "no"]);

function isOn(o: ConfigOption): boolean {
  return typeof o.currentValue === "boolean" ? o.currentValue : ON.has(String(o.currentValue).toLowerCase());
}

/** Context usage as a small ring. */
function Ring({ ratio, color, track }: { ratio: number; color: string; track: string }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Circle cx={11} cy={11} r={r} stroke={track} strokeWidth={2.5} fill="none" />
      <Circle cx={11} cy={11} r={r} stroke={color} strokeWidth={2.5} fill="none" strokeDasharray={`${c * ratio} ${c}`} strokeLinecap="round" transform="rotate(-90 11 11)" />
    </Svg>
  );
}

/** Two-valued on/off options (e.g. Fast mode) render as a switch like Zed. */
export function isToggle(o: ConfigOption): boolean {
  if (typeof o.currentValue === "boolean") return true;
  const vals = flatOptions(o).map((c) => String(c.value).toLowerCase());
  return vals.length === 2 && vals.some((v) => ON.has(v)) && vals.some((v) => OFF.has(v));
}

const ORDER: Record<string, number> = { mode: 0, model: 1, thought_level: 2 };

type Props = {
  agentName: string;
  options: ConfigOption[];
  running: boolean;
  disabled?: boolean;
  onSend: (text: string, mentions: string[], images?: Attachment[]) => Promise<void>;
  onCancel: () => void;
  onConfig: (id: string, value: string) => Promise<void>;
  /** The agent's slash commands, shown in a popup while typing "/…". */
  commands?: SlashCommand[];
  /** Context usage reported by the agent ({ used, size, cost }). */
  usage?: { used?: number; size?: number; cost?: { amount: number; currency: string } };
  /** Project file search for "@" mentions. */
  searchFiles?: (q: string) => Promise<FileHit[]>;
  /** The thread's project folder: quick replies can be set per project. */
  cwd?: string;
  /** "Approve everything in this thread", shown in the thread settings sheet when given. */
  autoApprove?: { on: boolean; toggle: () => void };
};

export type SlashCommand = { name: string; description?: string; input?: { hint?: string } | null };
export type FileHit = { path: string; dir: boolean };

/** Fuzzy subsequence score (name prefix > substring > scattered letters); -1 = no match. */
export function fuzzy(candidate: string, q: string): number {
  const c = candidate.toLowerCase();
  if (!q) return 0;
  if (c.startsWith(q)) return 1000 - c.length;
  if (c.includes(q)) return 500 - c.length;
  let at = 0;
  let score = 0;
  for (const ch of q) {
    const i = c.indexOf(ch, at);
    if (i < 0) return -1;
    score += i === at ? 12 : 4;
    at = i + 1;
  }
  return score;
}

/** Commands matching a "/query" being typed (name first, then description), or [] when not typing one. */
export function matchCommands(text: string, commands: SlashCommand[]): SlashCommand[] {
  const m = /^\/(\S*)$/.exec(text);
  if (!m) return [];
  const q = m[1].toLowerCase();
  return commands
    .map((c) => {
      const byName = fuzzy(c.name, q);
      const byDesc = q.length > 2 && (c.description ?? "").toLowerCase().includes(q) ? 100 : -1;
      return { c, s: Math.max(byName, byDesc) };
    })
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 40)
    .map((x) => x.c);
}

/** The "@query" being typed at the end of the message, or null. */
export function mentionQuery(text: string): string | null {
  const m = /(^|\s)@([^\s@]*)$/.exec(text);
  return m ? m[2] : null;
}


type MenuItem = { kind: "cmd"; cmd: SlashCommand } | { kind: "file"; file: FileHit };

export function Composer({ agentName, options, running, disabled, onSend, onCancel, onConfig, commands = [], searchFiles, usage, autoApprove, cwd }: Props) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const [text, setText] = useState("");
  const [big, setBig] = useState(false);
  const [sending, setSending] = useState(false);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickEdit, setQuickEdit] = useState(false);
  const quick = useQuickReplies(cwd);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<ConfigOption | null>(null);
  const [busyOpt, setBusyOpt] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [mentions, setMentions] = useState<string[]>([]);
  const [files, setFiles] = useState<FileHit[]>([]);
  const [images, setImages] = useState<Attachment[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const attach = async (source: "library" | "camera") => {
    setAttachOpen(false);
    try {
      const picked = await pickImages(source);
      setImages((cur) => [...cur, ...picked].slice(0, 6));
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const inputRef = useRef<TextInput>(null);

  const atQ = mentionQuery(text);
  useEffect(() => {
    if (atQ === null || !searchFiles) return setFiles([]);
    let live = true;
    const tm = setTimeout(() => {
      searchFiles(atQ).then((r) => live && setFiles(r), () => live && setFiles([]));
    }, 120);
    return () => {
      live = false;
      clearTimeout(tm);
    };
  }, [atQ, searchFiles]);

  const items: MenuItem[] = useMemo(() => {
    const cmds = matchCommands(text, commands);
    if (cmds.length) return cmds.map((cmd) => ({ kind: "cmd" as const, cmd }));
    return atQ !== null ? files.map((file) => ({ kind: "file" as const, file })) : [];
  }, [text, commands, atQ, files]);

  const pick = (it: MenuItem) => {
    if (it.kind === "cmd") setText(`/${it.cmd.name} `);
    else {
      setText((x) => x.replace(/@([^\s@]*)$/, `@${it.file.path} `));
      setMentions((m) => (m.includes(it.file.path) ? m : [...m, it.file.path]));
    }
    setSel(0);
    inputRef.current?.focus();
  };

  // "+" adds context like Zed's: a photo, a screenshot, or an @-mentioned file.
  const addContext = () => setAttachOpen(true);
  const startMention = () => {
    setText((x) => (x && !/\s$/.test(x) ? `${x} @` : `${x}@`));
    inputRef.current?.focus();
  };

  const selects = options.filter((o) => !isToggle(o)).sort((a, b) => (ORDER[a.category ?? ""] ?? 9) - (ORDER[b.category ?? ""] ?? 9));
  const toggles = options.filter(isToggle);

  const send = async () => {
    const msg = text.trim() || (images.length ? "What do you see in this image?" : "");
    if (!msg || sending) return;
    setSending(true);
    setErr(null);
    try {
      await onSend(msg, mentions.filter((m) => msg.includes(`@${m}`)), images);
      setText("");
      setMentions([]);
      setImages([]);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  const setOpt = async (o: ConfigOption, value: string) => {
    setOpen(null);
    setBusyOpt(o.id);
    setErr(null);
    try {
      await onConfig(o.id, value);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusyOpt(null);
    }
  };

  const label = (o: ConfigOption) => {
    const c = flatOptions(o).find((x) => String(x.value) === String(o.currentValue));
    return c?.name ?? String(o.currentValue);
  };

  const canSend = (!!text.trim() || images.length > 0) && !disabled && !sending;
  const byCat = (c: string) => selects.find((o) => o.category === c || o.id === c);
  const pillParts = [byCat("model"), byCat("mode")].filter(Boolean).map((o) => label(o!));
  const pill = pillParts.length ? pillParts : selects.slice(0, 2).map(label);
  const fastOn = toggles.some((o) => /fast/i.test(`${o.id} ${o.name ?? ""}`) && isOn(o));
  const ratio = usage?.used && usage?.size ? Math.min(1, usage.used / usage.size) : null;
  // A picker for one option opens after the settings sheet has closed (no sheet-on-sheet).
  const openPicker = (o: ConfigOption) => {
    setSettingsOpen(false);
    setTimeout(() => setOpen(o), 280);
  };

  return (
    <View style={s.root}>
      {!text && (!running || quickBusy) && !disabled ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quick} keyboardShouldPersistTaps="always">
          {quick.list.map((q, qi) => (
            <Pressable
              key={`${qi}:${q}`}
              disabled={sending}
              onLongPress={() => {
                setText(q);
                inputRef.current?.focus();
              }}
              delayLongPress={350}
              onPress={() => {
                setSending(true);
                setQuickBusy(q);
                setErr(null);
                onSend(q, [])
                  .catch((e) => setErr(e.message))
                  .finally(() => {
                    setSending(false);
                    setQuickBusy(null);
                  });
              }}
              style={({ pressed }) => [
                s.quickChip,
                pressed && { backgroundColor: t.hover, transform: [{ scale: 0.96 }] },
                quickBusy === q && { borderColor: t.accent },
                quickBusy !== null && quickBusy !== q && { opacity: 0.45 },
              ]}
            >
              {quickBusy === q ? <ActivityIndicator size="small" color={t.accent} style={{ transform: [{ scale: 0.7 }], marginVertical: -4 }} /> : null}
              <Text style={[s.quickText, quickBusy === q && { color: t.accent }]}>{chipLabel(q)}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setQuickEdit(true)} style={({ pressed }) => [s.quickChip, s.quickEdit, pressed && { backgroundColor: t.hover }]} accessibilityLabel="Edit quick replies">
            <PencilIcon color={t.muted} size={14} />
            <Text style={[s.quickText, { color: t.muted }]}>Edit</Text>
          </Pressable>
        </ScrollView>
      ) : null}
      <View style={s.card}>
      {items.length ? (
        <View style={s.cmdMenu}>
          <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 280 }}>
            {items.map((it, i) => (
              <Pressable
                key={it.kind === "cmd" ? `c:${it.cmd.name}` : `f:${it.file.path}`}
                onPress={() => pick(it)}
                style={({ pressed }) => [s.cmdRow, (i === sel || pressed) && { backgroundColor: t.selected }]}
              >
                {it.kind === "cmd" ? (
                  <>
                    <Text style={s.cmdName}>/{it.cmd.name}</Text>
                    {it.cmd.description ? <Text style={s.cmdDesc} numberOfLines={2}>{it.cmd.description}</Text> : null}
                  </>
                ) : (
                  <View style={s.fileRow}>
                    {it.file.dir ? <FolderIcon color={t.muted} size={15} /> : <FileIcon color={t.muted} size={15} />}
                    <Text style={s.fileName} numberOfLines={1}>{it.file.path.replace(/\/$/, "").split("/").pop()}</Text>
                    <Text style={s.fileDir} numberOfLines={1}>{it.file.path.replace(/\/$/, "").split("/").slice(0, -1).join("/")}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbs}>
          {images.map((im, i) => (
            <View key={im.uri + i} style={s.thumbWrap}>
              <Image source={{ uri: im.uri }} style={s.thumb} />
              <Pressable hitSlop={8} onPress={() => setImages((cur) => cur.filter((_, j) => j !== i))} style={s.thumbX}>
                <XIcon color="#fff" size={11} strokeWidth={2.6} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={s.inputRow}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setSel(0);
          }}
          placeholder={`Message ${agentName}…`}
          placeholderTextColor={t.faint}
          style={[s.input, big && { minHeight: 220 }]}
          multiline
          editable={!disabled}
          textAlignVertical="top"
          onKeyPress={(e: any) => {
            const key = e.nativeEvent.key;
            // Web keyboard: arrows/Tab/Enter drive the command menu; Enter sends, Shift+Enter is a newline.
            if (items.length && (key === "ArrowDown" || key === "ArrowUp")) {
              e.preventDefault?.();
              setSel((x) => (x + (key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
              return;
            }
            if (items.length && (key === "Tab" || (key === "Enter" && !e.nativeEvent.shiftKey))) {
              e.preventDefault?.();
              pick(items[Math.min(sel, items.length - 1)]);
              return;
            }
            if (items.length && key === "Escape") {
              setText(text + " ");
              return;
            }
            if (key === "Enter" && !e.nativeEvent.shiftKey && typeof document !== "undefined") {
              e.preventDefault?.();
              send();
            }
          }}
        />
        <View style={s.inputSide}>
          <Pressable hitSlop={8} onPress={() => setBig((b) => !b)} style={s.expand} accessibilityLabel="Expand editor">
            <ExpandIcon color={t.faint} size={16} />
          </Pressable>
        </View>
      </View>
      {err ? <Text style={s.err} numberOfLines={3}>{err}</Text> : null}
      <View style={s.toolbar}>
        <Pressable onPress={addContext} disabled={disabled} style={({ pressed }) => [s.round, { backgroundColor: t.optionBg }, pressed && s.pressed]} accessibilityLabel="Add photo or file">
          <PlusIcon color={t.muted} size={20} strokeWidth={1.9} />
        </Pressable>
        {selects.length || toggles.length ? (
          <Pressable
            onPress={() => setSettingsOpen(true)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Thread settings: ${pill.join(", ")}${fastOn ? ", fast" : ""}`}
            style={({ pressed }) => [s.pill, { backgroundColor: t.optionBg }, pressed && s.pressed]}
          >
            {busyOpt ? <ActivityIndicator size="small" color={t.faint} style={{ transform: [{ scale: 0.6 }], marginHorizontal: -4 }} /> : null}
            {fastOn ? <BoltIcon color={t.text} size={14} /> : null}
            <Text style={s.pillText} numberOfLines={1}>
              {pill[0]}
              {pill[1] ? <Text style={{ color: t.muted }}>{` · ${pill[1]}`}</Text> : null}
            </Text>
            <ChevronDown color={t.muted} size={13} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        {ratio !== null ? (
          <Pressable onPress={() => setSettingsOpen(true)} hitSlop={8} accessibilityLabel={`Context ${Math.round(ratio * 100)}% used`} style={s.ringBtn}>
            <Ring ratio={ratio} color={ratio > 0.8 ? t.warning : t.text} track={t.border} />
          </Pressable>
        ) : null}
        {running && !canSend ? (
          <Pressable onPress={onCancel} style={({ pressed }) => [s.round, { backgroundColor: t.optionBg }, pressed && s.pressed]} accessibilityLabel="Stop">
            <StopIcon color={t.error} size={17} />
          </Pressable>
        ) : (
          <Pressable onPress={send} disabled={!canSend} style={({ pressed }) => [s.round, { backgroundColor: canSend ? t.accent : t.optionBg }, pressed && s.pressed]} accessibilityLabel="Send">
            {sending ? <ActivityIndicator size="small" color={t.faint} /> : <ArrowUpIcon color={canSend ? t.onAccent : t.faint} size={19} strokeWidth={2.2} />}
          </Pressable>
        )}
      </View>
      </View>

      <QuickRepliesSheet visible={quickEdit} onClose={() => setQuickEdit(false)} cwd={cwd} />
      <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} title="This thread">
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ paddingBottom: 6 }}>
          {selects.map((o) => {
            const choices = flatOptions(o);
            const segmented = choices.length > 1 && choices.length <= 4 && !choices.some((c) => c.group) && choices.every((c) => (c.name ?? String(c.value)).length <= 12);
            if (segmented)
              return (
                <View key={o.id} style={s.setBlock}>
                  <Text style={s.setLabel}>{o.name ?? o.id}</Text>
                  <View style={[s.seg, { backgroundColor: t.optionBg }]}>
                    {choices.map((c) => {
                      const on = String(c.value) === String(o.currentValue);
                      return (
                        <Pressable
                          key={String(c.value)}
                          onPress={() => !on && setOpt(o, String(c.value))}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          style={[s.segItem, on && { backgroundColor: t.surface, borderColor: t.border }]}
                        >
                          <Text style={[s.segText, { color: on ? t.text : t.muted }, on && { fontWeight: "600" }]} numberOfLines={1}>{c.name ?? String(c.value)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            return (
              <Pressable key={o.id} onPress={() => openPicker(o)} style={({ pressed }) => [s.setRow, pressed && { backgroundColor: t.hover }]}>
                <Text style={s.setRowText}>{o.name ?? o.id}</Text>
                <Text style={s.setValue} numberOfLines={1}>{label(o)}</Text>
                <ChevronRight color={t.faint} size={16} />
              </Pressable>
            );
          })}
          {toggles.map((o) => {
            const on = isOn(o);
            const target = flatOptions(o).find((c) => (on ? OFF : ON).has(String(c.value).toLowerCase()));
            return (
              <View key={o.id} style={s.setRow}>
                <Text style={s.setRowText}>{o.name ?? o.id}</Text>
                <Switch
                  value={on}
                  disabled={busyOpt === o.id}
                  onValueChange={() => setOpt(o, target ? String(target.value) : String(!on))}
                  trackColor={{ false: t.switchOff, true: t.accent }}
                  thumbColor={on ? t.onAccent : "#FFFFFF"}
                />
              </View>
            );
          })}
          {autoApprove ? (
            <View style={s.setRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.setRowText}>Approve everything</Text>
                <Text style={s.setHint}>Run tools in this thread without asking.</Text>
              </View>
              <Switch value={autoApprove.on} onValueChange={autoApprove.toggle} trackColor={{ false: t.switchOff, true: t.warning }} thumbColor="#FFFFFF" />
            </View>
          ) : null}
          {usage?.used && usage?.size ? (
            <View style={s.setBlock}>
              <Text style={s.setLabel}>
                Context · {Math.round((usage.used / usage.size) * 100)}% used ({formatTokens(usage.used)} of {formatTokens(usage.size)})
                {usage.cost ? ` · $${usage.cost.amount.toFixed(2)}` : ""}
              </Text>
              <View style={[s.meter, { backgroundColor: t.border }]}>
                <View style={{ width: `${Math.min(100, (usage.used / usage.size) * 100)}%`, height: "100%", backgroundColor: usage.used / usage.size > 0.8 ? t.warning : t.text }} />
              </View>
              <Pressable onPress={() => { setSettingsOpen(false); setTimeout(() => router.push("/usage"), 250); }} hitSlop={6} style={{ marginTop: 12, alignSelf: "flex-start" }}>
                <Text style={[s.setLabel, { color: t.text, fontWeight: "600", marginBottom: 0 }]}>Usage across all threads ›</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </Sheet>
      <Sheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Add context">
        {[
          { label: "Photo or screenshot", run: () => attach("library") },
          ...(Platform.OS !== "web" ? [{ label: "Take a photo", run: () => attach("camera") }] : []),
          { label: "Mention a file  @", run: () => { setAttachOpen(false); startMention(); } },
        ].map((a) => (
          <Pressable key={a.label} onPress={a.run} style={({ pressed }) => [s.opt, pressed && { backgroundColor: t.hover }]}>
            <Text style={s.optName}>{a.label}</Text>
          </Pressable>
        ))}
      </Sheet>
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.name ?? open?.id}>
        <ScrollView style={{ maxHeight: 460 }}>
          {open
            ? flatOptions(open).map((c, i, all) => {
                const cur = String(c.value) === String(open.currentValue);
                const showGroup = c.group && c.group !== all[i - 1]?.group;
                return (
                  <View key={`${c.group}:${c.value}`}>
                    {showGroup ? <Text style={s.group}>{c.group}</Text> : null}
                    <Pressable onPress={() => setOpt(open, String(c.value))} style={({ pressed }) => [s.opt, pressed && { backgroundColor: t.hover }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.optName, cur && { color: t.accent }]}>{c.name ?? String(c.value)}</Text>
                        {c.description ? <Text style={s.optDesc} numberOfLines={2}>{c.description}</Text> : null}
                      </View>
                      {cur ? <CheckIcon color={t.accent} size={16} /> : null}
                    </Pressable>
                  </View>
                );
              })
            : null}
        </ScrollView>
      </Sheet>
    </View>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    root: { backgroundColor: t.panel, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8 },
    card: { borderWidth: 1, borderColor: t.border, borderRadius: 20, backgroundColor: t.surface, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
    round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    pressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
    pill: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, borderRadius: 18, paddingHorizontal: 12, flexShrink: 1, minWidth: 0 },
    pillText: { fontSize: t.fs(14), color: t.text, fontFamily: ui, fontWeight: "500", flexShrink: 1 },
    ringBtn: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
    setBlock: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12 },
    setLabel: { fontSize: t.fs(13), color: t.muted, fontFamily: ui, marginBottom: 8 },
    seg: { flexDirection: "row", borderRadius: 12, padding: 3 },
    segItem: { flex: 1, minHeight: 40, borderRadius: 9, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    segText: { fontSize: t.fs(14), fontFamily: ui },
    setRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 18 },
    setRowText: { flex: 1, fontSize: t.fs(16), color: t.text, fontFamily: ui },
    setValue: { fontSize: t.fs(15), color: t.muted, fontFamily: ui, maxWidth: 180 },
    setHint: { fontSize: t.fs(12.5), color: t.faint, fontFamily: ui, marginTop: 2 },
    meter: { height: 6, borderRadius: 3, overflow: "hidden" },
    cmdMenu: { borderWidth: 1, borderColor: t.border, borderRadius: 10, backgroundColor: t.panel, marginBottom: 10, overflow: "hidden" },
    cmdRow: { paddingHorizontal: 12, paddingVertical: 8 },
    cmdName: { fontFamily: t.mono, fontSize: t.fs(14), color: t.text },
    thumbs: { gap: 8, paddingBottom: 10 },
    thumbWrap: { position: "relative" },
    thumb: { width: 64, height: 64, borderRadius: 8, borderWidth: 1, borderColor: t.border },
    thumbX: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
    quick: { gap: 8, paddingBottom: 8, paddingHorizontal: 2 },
    quickChip: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36, borderWidth: 1, borderColor: t.border, borderRadius: 18, paddingHorizontal: 14, backgroundColor: t.surface },
    quickEdit: { borderStyle: "dashed" },
    quickText: { fontSize: t.fs(13.5), color: t.text, fontFamily: ui },
    usage: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 4 },
    toolbar: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    toolBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    toggleChip: { borderWidth: 1, borderColor: t.borderStrong, borderRadius: 18, width: 36, justifyContent: "center", marginLeft: 4 },
    inputSide: { alignItems: "flex-end", gap: 8 },
    usageTrack: { width: 36, height: 4, borderRadius: 2, overflow: "hidden" },
    usageText: { fontSize: t.fs(12), color: t.faint, fontFamily: ui },
    fileRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    fileName: { fontFamily: ui, fontSize: t.fs(14.5), color: t.text, flexShrink: 0, maxWidth: "60%" },
    fileDir: { flex: 1, fontFamily: ui, fontSize: t.fs(13), color: t.faint },
    cmdDesc: { fontFamily: ui, fontSize: t.fs(13), color: t.muted, marginTop: 2 },
    inputRow: { flexDirection: "row", alignItems: "flex-start" },
    input: { flex: 1, minHeight: 44, maxHeight: 260, fontFamily: ui, fontSize: t.fs(16), lineHeight: t.fs(22), color: t.text, padding: 0, paddingHorizontal: 4, outlineStyle: "none" } as any,
    expand: { paddingLeft: 10, paddingTop: 4 },
    err: { color: t.error, fontSize: t.fs(13), fontFamily: ui, marginTop: 6 },
    iconRow: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 10, marginBottom: 6, paddingLeft: 2 },
    controls: { flexDirection: "row", alignItems: "center" },
    chips: { gap: 4, alignItems: "center" },
    chip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, minHeight: 36, borderRadius: 8 },
    chipText: { fontSize: t.fs(14.5), color: t.text, fontFamily: ui, maxWidth: 200 },
    bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    toggles: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1 },
    toggle: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 8 },
    toggleLabel: { fontSize: t.fs(15.5), color: t.text, fontFamily: ui },
    send: { width: 42, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.hover },
    group: { fontSize: t.fs(12), color: t.faint, fontFamily: ui, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
    opt: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 11 },
    optName: { fontSize: t.fs(16), color: t.text, fontFamily: ui },
    optDesc: { fontSize: t.fs(13), color: t.muted, fontFamily: ui, marginTop: 2 },
  });
}

