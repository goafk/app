// Zed's Threads sidebar: search, project groups (collapsible), threads with agent icon + age.
// On phones it's the home screen: afk header, a labelled tab bar and a New thread button.
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PendingThread, Project, SearchHit, SidebarThread } from "../lib/api";
import { useStore } from "../lib/store";
import { ui, useTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";
import { BellIcon, ChevronDown, ChevronRight, FolderIcon, GitIcon, ClockIcon, GearIcon, PlusIcon, SearchIcon, SidebarIcon, WarningIcon } from "./Icons";
import { EmptyState } from "./EmptyState";
import { TabBar } from "./TabBar";
import { HubSwitcher } from "./HubSwitcher";
import { age } from "../lib/time";
import { savedAtLabel } from "../lib/offline";
import { applyOrder, isHidden, useHiddenProjects, useProjectOrder } from "../lib/projectOrder";
import { Sheet } from "./Sheet";
import { ThreadRow } from "./ThreadRow";

type Row =
  | { type: "project"; key: string; project: Project; open: boolean }
  | { type: "thread"; key: string; thread: SidebarThread; project: Project }
  | { type: "empty"; key: string }
  | { type: "more"; key: string; project: Project; remaining: number }
  | { type: "waiting"; key: string; project: Project; item: PendingThread };

/** Threads shown per open project before "Show more". */
const PAGE = 10;

type Props = {
  onOpen: (t: SidebarThread) => void;
  /** A message search result: open that thread with the find bar searching for the words. */
  onOpenHit?: (threadId: string, q: string) => void;
  onNewThread: (p: Project) => void;
  onSettings: () => void;
  onToggleSidebar?: () => void;
  onReviewChanges?: (p: Project) => void;
  initialMode?: "projects" | "history" | "inbox";
};

export function Sidebar({ onOpen, onOpenHit, onNewThread, onSettings, onToggleSidebar, onReviewChanges, initialMode }: Props) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();
  const { projects: zedProjects, expanded, toggle, selected, error, live, refresh, api, activeHost, conn, offlineSince } = useStore();
  // The user's own project order (per computer), and how many threads each open project shows.
  const { order, setOrder } = useProjectOrder(activeHost?.id ?? conn.url);
  const { hidden, hide, unhide } = useHiddenProjects(activeHost?.id ?? conn.url);
  const ordered = useMemo(() => applyOrder(zedProjects, order), [zedProjects, order]);
  const projects = useMemo(() => ordered.filter((p) => !isHidden(p, hidden)), [ordered, hidden]);
  const hiddenProjects = useMemo(() => ordered.filter((p) => isHidden(p, hidden)), [ordered, hidden]);
  const [shown, setShown] = useState<Record<string, number>>({});
  const [projectMenu, setProjectMenu] = useState<Project | null>(null);
  const [reordering, setReordering] = useState(false);
  const [cancelWaiting, setCancelWaiting] = useState<PendingThread | null>(null);
  const move = (path: string, to: number | "top") => {
    const list = projects.map((p) => p.path);
    const from = list.indexOf(path);
    if (from < 0) return;
    list.splice(from, 1);
    list.splice(to === "top" ? 0 : Math.max(0, Math.min(list.length, to)), 0, path);
    setOrder(list);
  };
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"projects" | "history" | "inbox">(initialMode ?? "projects");
  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);
  const history = mode === "history";
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState<SidebarThread | null>(null);
  const [renaming, setRenaming] = useState<SidebarThread | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [picking, setPicking] = useState(false);
  // Search inside messages (on the Mac), alongside the title matches.
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) return setHits(null);
    let alive = true;
    const tm = setTimeout(() => {
      api.search(needle).then((r) => alive && setHits(r.results), () => alive && setHits([]));
    }, 280);
    return () => {
      alive = false;
      clearTimeout(tm);
    };
  }, [q, api]);
  // Phones get the tab bar + New thread button; wide layouts keep Zed's compact footer.
  const phone = !onToggleSidebar;
  const newThread = () => (projects.length === 1 ? onNewThread(projects[0]) : setPicking(true));
  // Projects for the picker: most recently active first.
  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => Math.max(0, ...b.threads.map((x) => x.updatedAt)) - Math.max(0, ...a.threads.map((x) => x.updatedAt))),
    [projects],
  );

  const needsYou = (th: SidebarThread) => !th.archived && (th.status === "needs_permission" || !!th.unread);
  const inboxCount = useMemo(() => projects.reduce((n, p) => n + p.threads.filter(needsYou).length, 0), [projects]);
  const setMeta = async (th: SidebarThread, patch: { title?: string; archived?: boolean }) => {
    try {
      await api.setMeta(th.id, patch);
      await refresh();
    } catch {}
  };

  const rows = useMemo<Row[]>(() => {
    const needle = q.trim().toLowerCase();
    const out: Row[] = [];
    if (mode !== "projects") {
      const all = projects.flatMap((p) => p.threads.map((th) => ({ th, p })));
      all.sort((a, b) => Number(b.th.status === "needs_permission") - Number(a.th.status === "needs_permission") || b.th.updatedAt - a.th.updatedAt);
      for (const { th, p } of all) {
        if (needle && !th.title.toLowerCase().includes(needle)) continue;
        if (mode === "inbox" && !needsYou(th)) continue;
        // History shows archived threads too (so they can be found and unarchived).
        out.push({ type: "thread", key: `h:${th.id}`, thread: th, project: p });
      }
      return out;
    }
    for (const p of projects) {
      const visible = p.threads.filter((th) => !th.archived);
      const matches = needle ? visible.filter((th) => th.title.toLowerCase().includes(needle)) : visible;
      if (needle && !matches.length) continue;
      const open = needle ? true : !!expanded[p.path];
      out.push({ type: "project", key: `p:${p.path}`, project: p, open });
      if (!open) continue;
      for (const w of needle ? [] : p.pending ?? []) out.push({ type: "waiting", key: `w:${w.id}`, project: p, item: w });
      if (!matches.length) out.push({ type: "empty", key: `e:${p.path}` });
      // Long projects: the newest few, then "Show more" (searching shows every match).
      const limit = needle ? matches.length : shown[p.path] ?? PAGE;
      for (const th of matches.slice(0, limit)) out.push({ type: "thread", key: `t:${th.id}`, thread: th, project: p });
      if (matches.length > limit) out.push({ type: "more", key: `m:${p.path}`, project: p, remaining: matches.length - limit });
    }
    return out;
  }, [projects, expanded, q, mode, shown]);

  const now = Date.now();

  const renderRow = (item: Row, index: number) => {
    if (item.type === "project") {
      const afterThread = rows[index - 1]?.type === "thread";
      // Collapsed projects still say what's going on inside: needs you > working > unread.
      const live = item.project.threads.filter((x) => !x.archived);
      const collapsed = !q.trim() && !expanded[item.project.path];
      const waiting = collapsed && live.some((x) => x.status === "needs_permission");
      const working = collapsed && !waiting && live.some((x) => x.status === "running");
      const unread = collapsed && !waiting && !working && live.some((x) => x.unread);
      const nWaiting = live.filter((x) => x.status === "needs_permission").length;
      const nRunning = live.filter((x) => x.status === "running").length;
      const actions = (
        <>
          {onReviewChanges ? (
            <Pressable hitSlop={10} onPress={() => onReviewChanges(item.project)} style={s.projectPlus} accessibilityLabel={`Changes in ${item.project.name}`}>
              <GitIcon color={t.faint} size={16} />
            </Pressable>
          ) : null}
          <Pressable hitSlop={10} onPress={() => onNewThread(item.project)} style={s.projectPlus} accessibilityLabel={`New thread in ${item.project.name}`}>
            <PlusIcon color={t.faint} size={16} />
          </Pressable>
        </>
      );
      return (
        <Pressable
          onPress={() => toggle(item.project.path)}
          onLongPress={() => setProjectMenu(item.project)}
          delayLongPress={350}
          style={({ pressed }) => [phone ? s.projectCard : [s.project, afterThread && s.projectTop], pressed && { backgroundColor: t.hover }]}
        >
          <Text style={[s.projectName, phone && s.projectNameCard]} numberOfLines={1}>{item.project.name}</Text>
          {phone && collapsed ? (
            <>
              {nWaiting ? (
                <View style={[s.pill, { backgroundColor: t.warning + "1F" }]} accessibilityLabel={`${nWaiting} need you`}>
                  <WarningIcon color={t.warning} size={12} />
                  <Text style={[s.pillText, { color: t.warning }]}>{nWaiting && nRunning ? nWaiting : `${nWaiting} need${nWaiting === 1 ? "s" : ""} you`}</Text>
                </View>
              ) : null}
              {nRunning ? (
                <View style={[s.pill, { backgroundColor: t.optionBg }]} accessibilityLabel={`${nRunning} running`}>
                  <ActivityIndicator size="small" color={t.muted} style={{ transform: [{ scale: 0.55 }], marginVertical: -8, marginHorizontal: -4 }} />
                  <Text style={[s.pillText, { color: t.text }]}>{nWaiting && nRunning ? nRunning : `${nRunning} running`}</Text>
                </View>
              ) : null}
              {unread && !nWaiting && !nRunning ? <View style={[s.projectDot, { backgroundColor: t.accent }]} /> : null}
            </>
          ) : (
            <>
              {waiting ? <WarningIcon color={t.warning} size={15} /> : null}
              {working ? <ActivityIndicator size="small" color={t.muted} style={{ transform: [{ scale: 0.75 }] }} /> : null}
              {unread ? <View style={[s.projectDot, { backgroundColor: t.accent }]} /> : null}
            </>
          )}
          {phone ? (
            <>
              {collapsed ? <Text style={s.projectCount}>{live.length || ""}</Text> : actions}
              <View style={{ transform: [{ rotate: collapsed ? "-90deg" : "0deg" }], marginLeft: 2 }}>
                <ChevronDown color={t.faint} size={16} />
              </View>
            </>
          ) : (
            actions
          )}
        </Pressable>
      );
    }
    if (item.type === "waiting") {
      return (
        <Pressable onPress={() => setCancelWaiting(item.item)} style={({ pressed }) => [s.waiting, { backgroundColor: phone ? t.surface : t.sidebar }, pressed && { backgroundColor: t.hover }]} accessibilityRole="button">
          <ClockIcon color={t.faint} size={16} />
          <View style={{ flex: 1 }}>
            <Text style={s.waitingTitle} numberOfLines={2}>{item.item.prompt || "New thread"}</Text>
            <Text style={s.waitingMeta} numberOfLines={1}>{item.item.agentName} · starts when your Mac unlocks</Text>
          </View>
        </Pressable>
      );
    }
    if (item.type === "more") {
      const step = Math.min(20, item.remaining);
      return (
        <Pressable
          onPress={() => setShown((m) => ({ ...m, [item.project.path]: (m[item.project.path] ?? PAGE) + 20 }))}
          style={({ pressed }) => [s.more, { backgroundColor: phone ? t.surface : t.sidebar }, pressed && { backgroundColor: t.hover }]}
          accessibilityRole="button"
        >
          <Text style={s.moreText}>Show {step} more</Text>
          <Text style={s.moreCount}>{item.remaining} older</Text>
        </Pressable>
      );
    }
    if (item.type === "empty") {
      return (
        <View style={[s.empty, phone && { borderBottomWidth: 0, backgroundColor: t.surface }]}>
          <View style={s.emptyDot} />
          <Text style={s.emptyText}>No threads yet</Text>
        </View>
      );
    }
    const th = item.thread;
    return (
      <ThreadRow
        th={th}
        t={t}
        bg={phone ? t.surface : undefined}
        now={now}
        selected={selected === th.id}
        subtitle={mode !== "projects" ? item.project.name : undefined}
        preview={mode === "inbox"}
        onOpen={() => onOpen(th)}
        onMenu={() => setMenu(th)}
        onArchive={() => setMeta(th, { archived: !th.archived })}
      />
    );
  };

  return (
    <View style={[s.root, phone && s.rootPhone, { paddingTop: insets.top }]}>
      <HubSwitcher header={phone} />
      <View style={[s.searchBar, phone && s.searchPill]}>
        <SearchIcon color={t.faint} size={17} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search threads..."
          placeholderTextColor={t.faint}
          style={s.search}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>
      {error ? (
        <Pressable onPress={offlineSince ? refresh : onSettings} style={[s.error, phone && s.errorPhone]}>
          <WarningIcon color={t.warning} size={15} />
          <Text style={s.errorText} numberOfLines={2}>
            {offlineSince ? `Offline · showing the list saved at ${savedAtLabel(offlineSince)}. Tap to retry.` : `${error} — tap to set up the connection`}
          </Text>
        </Pressable>
      ) : null}
      <FlatList
        data={rows}
        extraData={rows}
        keyExtractor={(r) => r.key}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await refresh();
          setRefreshing(false);
        }}
        initialNumToRender={30}
        renderItem={({ item, index }) => {
          if (!phone) return renderRow(item, index);
          // Phones: every card is one view with an even border all round (Android blanks the
          // content of views that combine uneven borders, rounded corners and clipping).
          if (mode !== "projects") return <View style={[s.card, s.cardSmall]}>{renderRow(item, index)}</View>;
          if (item.type !== "project") return null; // drawn inside its project's card
          const inside: React.ReactNode[] = [];
          for (let i = index + 1; i < rows.length && rows[i].type !== "project"; i++) {
            inside.push(
              <View key={rows[i].key}>
                <View style={s.divider} />
                {renderRow(rows[i], i)}
              </View>,
            );
          }
          return (
            <View style={s.card}>
              {renderRow(item, index)}
              {inside}
            </View>
          );
        }}
        ListFooterComponent={
          hits && hits.length && mode !== "inbox" ? (
            <View style={{ paddingBottom: 8 }}>
              <Text style={s.hitsHead}>In messages</Text>
              {hits.map((h) => (
                <Pressable
                  key={`${h.threadId}:${h.seq}`}
                  onPress={() => (onOpenHit ? onOpenHit(h.threadId, q.trim()) : null)}
                  style={({ pressed }) => [phone ? [s.card, s.cardSmall] : s.hitWide, s.hit, pressed && { backgroundColor: t.hover }]}
                  accessibilityRole="button"
                >
                  <Text style={s.hitTitle} numberOfLines={1}>{h.title}</Text>
                  <Text style={s.hitSnippet} numberOfLines={3}>
                    {highlight(h.snippet, q.trim()).map((part, i) => (
                      <Text key={i} style={part.match ? s.hitMatch : undefined}>{part.text}</Text>
                    ))}
                  </Text>
                  <Text style={s.hitMeta} numberOfLines={1}>
                    {h.kind === "user" ? "You" : "Agent"} · {h.cwd.split("/").pop()} · {age(h.updatedAt, now)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          error || (hits && hits.length && mode !== "inbox") ? null : mode === "inbox" && !q.trim() ? (
            <EmptyState title="Nothing needs you right now" body="When an agent asks for permission, has a question or finishes, it shows up here." />
          ) : !projects.length ? (
            <EmptyState title="Loading your projects" loading />
          ) : (
            <EmptyState title="No matching threads" body={q.trim() ? `Nothing called "${q.trim()}".` : undefined} />
          )
        }
        contentContainerStyle={phone ? { paddingBottom: 24 } : undefined}
      />
      <Sheet visible={!!projectMenu} onClose={() => setProjectMenu(null)} title={projectMenu?.name}>
        {projectMenu
          ? [
              { label: "New thread", run: () => onNewThread(projectMenu) },
              ...(onReviewChanges ? [{ label: "Review changes", run: () => onReviewChanges(projectMenu) }] : []),
              ...(projects[0]?.path !== projectMenu.path ? [{ label: "Move to top", run: () => move(projectMenu.path, "top") }] : []),
              { label: "Reorder projects…", run: () => setTimeout(() => setReordering(true), 280) },
              { label: "Remove from afk", run: () => hide(projectMenu.path) },
            ].map((a) => (
              <Pressable key={a.label} onPress={() => { setProjectMenu(null); a.run(); }} style={({ pressed }) => [s.menuItem, pressed && { backgroundColor: t.hover }]}>
                <Text style={s.menuText}>{a.label}</Text>
              </Pressable>
            ))
          : null}
      </Sheet>
      <Sheet visible={!!cancelWaiting} onClose={() => setCancelWaiting(null)} title="Waiting for your Mac">
        <Text style={[s.menuMeta, { fontSize: t.fs(14), color: t.muted }]}>
          {cancelWaiting?.prompt ? `“${cancelWaiting.prompt}” ` : ""}starts in Zed as soon as your Mac is unlocked.
        </Text>
        <Pressable
          onPress={() => {
            const w = cancelWaiting;
            setCancelWaiting(null);
            if (w) api.cancelPending(w.id).then(refresh, () => {});
          }}
          style={({ pressed }) => [s.menuItem, pressed && { backgroundColor: t.hover }]}
        >
          <Text style={[s.menuText, { color: t.error }]}>Don't start it</Text>
        </Pressable>
      </Sheet>
      <Sheet visible={reordering} onClose={() => setReordering(false)} title="Reorder projects">
        <ScrollView style={{ maxHeight: 480 }}>
          {projects.map((p, i) => (
            <View key={p.path} style={s.orderRow}>
              <Text style={s.orderName} numberOfLines={1}>{p.name}</Text>
              <Pressable disabled={i === 0} onPress={() => move(p.path, i - 1)} hitSlop={6} style={[s.orderBtn, i === 0 && { opacity: 0.3 }]} accessibilityLabel={`Move ${p.name} up`}>
                <View style={{ transform: [{ rotate: "180deg" }] }}>
                  <ChevronDown color={t.text} size={18} />
                </View>
              </Pressable>
              <Pressable disabled={i === projects.length - 1} onPress={() => move(p.path, i + 1)} hitSlop={6} style={[s.orderBtn, i === projects.length - 1 && { opacity: 0.3 }]} accessibilityLabel={`Move ${p.name} down`}>
                <ChevronDown color={t.text} size={18} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
        {order ? (
          <Pressable onPress={() => setOrder(null)} style={({ pressed }) => [s.menuItem, pressed && { backgroundColor: t.hover }]}>
            <Text style={[s.menuText, { color: t.muted }]}>Reset to Zed's order</Text>
          </Pressable>
        ) : null}
        <Text style={s.menuMeta}>The order is kept on this phone, for this computer. New projects appear at the top.</Text>
        {hiddenProjects.length ? (
          <>
            <Text style={[s.menuMeta, { color: t.muted, fontWeight: "600", paddingTop: 12 }]}>Removed from afk</Text>
            {hiddenProjects.map((p) => (
              <View key={p.path} style={s.orderRow}>
                <Text style={[s.orderName, { color: t.muted }]} numberOfLines={1}>{p.name}</Text>
                <Pressable onPress={() => unhide(p.path)} hitSlop={6} style={[s.orderBtn, { width: undefined, paddingHorizontal: 14 }]} accessibilityLabel={`Show ${p.name} again`}>
                  <Text style={[s.menuText, { fontSize: t.fs(14) }]}>Show</Text>
                </Pressable>
              </View>
            ))}
            <Text style={s.menuMeta}>Removed projects come back by themselves when a thread there is active again. Zed isn't changed.</Text>
          </>
        ) : null}
      </Sheet>
      <Sheet visible={picking} onClose={() => setPicking(false)} title="New thread in…">
        {recentProjects.map((p) => (
          <Pressable
            key={p.path}
            onPress={() => {
              setPicking(false);
              onNewThread(p);
            }}
            style={({ pressed }) => [s.pickRow, pressed && { backgroundColor: t.hover }]}
          >
            <FolderIcon color={t.muted} size={18} />
            <Text style={s.menuText} numberOfLines={1}>{p.name}</Text>
            <View style={{ flex: 1 }} />
            <ChevronRight color={t.faint} size={16} />
          </Pressable>
        ))}
      </Sheet>
      {!phone && mode !== "projects" ? (
        <View style={s.modeBar}>
          <Text style={s.modeText}>{mode === "inbox" ? "Needs you" : "All threads"}</Text>
          <Pressable hitSlop={8} onPress={() => setMode("projects")}>
            <Text style={[s.modeText, { color: t.accent }]}>Projects</Text>
          </Pressable>
        </View>
      ) : null}
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.title}>
        {menu
          ? [
              { label: "Rename", run: () => { setNewTitle(menu.title); setRenaming(menu); } },
              { label: menu.archived ? "Unarchive" : "Archive", run: () => setMeta(menu, { archived: !menu.archived }) },
              ...(menu.unread ? [{ label: "Mark as read", run: () => api.seen(menu.id).then(refresh, () => {}) }] : []),
            ].map((a) => (
              <Pressable key={a.label} onPress={() => { setMenu(null); a.run(); }} style={({ pressed }) => [s.menuItem, pressed && { backgroundColor: t.hover }]}>
                <Text style={s.menuText}>{a.label}</Text>
              </Pressable>
            ))
          : null}
        <Text style={s.menuMeta}>Rename and archive apply in this app; Zed's own sidebar is unchanged.</Text>
      </Sheet>
      <Sheet visible={!!renaming} onClose={() => setRenaming(null)} title="Rename thread">
        <View style={{ paddingHorizontal: 18, gap: 12 }}>
          <TextInput value={newTitle} onChangeText={setNewTitle} autoFocus style={s.renameInput} placeholderTextColor={t.faint} placeholder={renaming?.zedTitle ?? renaming?.title} />
          <Pressable
            onPress={() => {
              if (renaming) setMeta(renaming, { title: newTitle });
              setRenaming(null);
            }}
            style={s.renameBtn}
          >
            <Text style={s.renameBtnText}>Save</Text>
          </Pressable>
          {renaming?.zedTitle ? (
            <Pressable onPress={() => { if (renaming) setMeta(renaming, { title: "" }); setRenaming(null); }}>
              <Text style={[s.menuMeta, { color: t.accent, paddingHorizontal: 0 }]}>Restore Zed's title “{renaming.zedTitle}”</Text>
            </Pressable>
          ) : null}
        </View>
      </Sheet>
      {phone ? (
        <TabBar
          active={mode}
          inboxCount={inboxCount}
          onTab={(k) => (k === "settings" ? onSettings() : setMode(k))}
          onNew={newThread}
          canNew={projects.length > 0}
        />
      ) : (
      <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={s.bottomLeft}>
          {/* Wide layouts only (phones use the tab bar): show / hide the thread list. */}
          <Pressable hitSlop={8} onPress={onToggleSidebar} accessibilityLabel="Toggle sidebar">
            <SidebarIcon color={t.muted} size={18} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => setMode((m) => (m === "history" ? "projects" : "history"))}>
            <ClockIcon color={history ? t.accent : t.muted} size={18} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => setMode((m) => (m === "inbox" ? "projects" : "inbox"))} style={s.bellWrap}>
            <BellIcon color={mode === "inbox" ? t.accent : t.muted} size={18} />
            {inboxCount ? (
              <View style={[s.badge, { backgroundColor: t.accent }]}>
                <Text style={s.badgeText}>{inboxCount > 99 ? "99+" : inboxCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <View style={s.bottomLeft}>
          <View style={[s.liveDot, { backgroundColor: live ? t.success : t.faint }]} />
          <Pressable hitSlop={8} onPress={onSettings}>
            <GearIcon color={t.muted} size={18} />
          </Pressable>
        </View>
      </View>
      )}
    </View>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.sidebar },
    rootPhone: { backgroundColor: t.panel },
    searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, height: 46, borderBottomWidth: 1, borderBottomColor: t.border },
    search: { flex: 1, fontSize: t.fs(16), color: t.text, fontFamily: ui, paddingVertical: t.sp(8), outlineStyle: "none" } as any,
    error: { flexDirection: "row", gap: 8, alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: t.border },
    errorText: { flex: 1, color: t.muted, fontSize: t.fs(13), fontFamily: ui },
    project: { flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 12, height: 50, borderBottomWidth: 1, borderBottomColor: t.border, backgroundColor: t.sidebar },
    projectTop: { borderTopWidth: 1, borderTopColor: t.border },
    projectName: { flex: 1, fontSize: t.fs(16), color: t.text, fontFamily: ui },
    projectDot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
    projectPlus: { padding: 4 },
    thread: { paddingLeft: 14, paddingRight: 14, paddingVertical: t.sp(9) },
    threadSel: { backgroundColor: t.selected },
    threadLine: { flexDirection: "row", alignItems: "center" },
    icon: { width: 26, height: 22, alignItems: "flex-start", justifyContent: "center" },
    title: { flex: 1, fontSize: t.fs(16), color: t.text, fontFamily: ui },
    age: { marginLeft: 26, marginTop: 2, fontSize: t.fs(14), color: t.muted, fontFamily: ui },
    empty: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingVertical: t.sp(12), borderBottomWidth: 1, borderBottomColor: t.border },
    emptyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.border },
    emptyText: { fontSize: t.fs(15), color: t.faint, fontFamily: ui },
    bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border },
    bottomLeft: { flexDirection: "row", alignItems: "center", gap: 18 },
    bellWrap: { position: "relative" },
    badge: { position: "absolute", top: -7, right: -10, minWidth: 17, height: 17, borderRadius: 12, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
    badgeText: { color: t.onAccent, fontSize: t.fs(10.5), fontWeight: "700", fontFamily: ui },
    modeBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: t.sp(8), borderTopWidth: 1, borderTopColor: t.border },
    modeText: { fontSize: t.fs(13), color: t.muted, fontFamily: ui },
    menuItem: { paddingHorizontal: 18, paddingVertical: t.sp(13) },
    menuText: { fontSize: t.fs(16), color: t.text, fontFamily: ui },
    menuMeta: { fontSize: t.fs(12.5), color: t.faint, fontFamily: ui, paddingHorizontal: 18, paddingVertical: t.sp(8) },
    renameInput: { borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 12, paddingVertical: t.sp(10), fontSize: t.fs(16), color: t.text, fontFamily: ui, outlineStyle: "none" } as any,
    renameBtn: { height: 42, borderRadius: 10, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", marginBottom: 6 },
    renameBtnText: { color: t.onAccent, fontSize: t.fs(15.5), fontFamily: ui, fontWeight: "600" },
    liveDot: { width: 7, height: 7, borderRadius: 6 },
    card: { marginHorizontal: 12, marginTop: 10, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 18, overflow: "hidden" },
    waiting: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 16, paddingVertical: t.sp(10) },
    waitingTitle: { fontSize: t.fs(15), color: t.muted, fontFamily: ui, fontStyle: "italic" },
    waitingMeta: { fontSize: t.fs(12.5), color: t.faint, fontFamily: ui, marginTop: 2 },
    more: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46, paddingLeft: 50, paddingRight: 16 },
    moreText: { flex: 1, fontSize: t.fs(14.5), color: t.text, fontFamily: ui, fontWeight: "500" },
    moreCount: { fontSize: t.fs(13), color: t.faint, fontFamily: ui },
    orderRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 52, paddingLeft: 18, paddingRight: 12 },
    orderName: { flex: 1, fontSize: t.fs(16), color: t.text, fontFamily: ui },
    orderBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.optionBg },
    hitsHead: { fontSize: t.fs(13), color: t.muted, fontFamily: ui, fontWeight: "500", marginTop: 18, marginBottom: 2, marginHorizontal: 16 },
    hit: { paddingHorizontal: 16, paddingVertical: t.sp(12), gap: 4 },
    hitWide: { borderBottomWidth: 1, borderBottomColor: t.border },
    hitTitle: { fontSize: t.fs(15), color: t.text, fontFamily: ui, fontWeight: "600" },
    hitSnippet: { fontSize: t.fs(14), color: t.muted, fontFamily: ui, lineHeight: t.fs(20) },
    hitMatch: { color: t.text, fontWeight: "600", backgroundColor: t.warning + "2E" },
    hitMeta: { fontSize: t.fs(12.5), color: t.faint, fontFamily: ui },
    errorPhone: { marginHorizontal: 12, marginTop: 8, borderBottomWidth: 0, borderRadius: 14, backgroundColor: t.warning + "1A" },
    pill: { flexDirection: "row", alignItems: "center", gap: 5, height: 24, paddingHorizontal: 9, borderRadius: 12 },
    pillText: { fontSize: t.fs(12.5), fontFamily: ui, fontWeight: "600" },
    cardSmall: { marginTop: 8, borderRadius: 14 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: 50 },
    projectCard: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 16, paddingRight: 14, minHeight: 54, backgroundColor: t.surface },
    projectNameCard: { fontWeight: "600", fontSize: t.fs(16) },
    projectCount: { fontSize: t.fs(13.5), color: t.faint, fontFamily: ui, minWidth: 14, textAlign: "right" },
    searchPill: { marginHorizontal: 12, marginBottom: 2, height: 42, borderRadius: 14, borderBottomWidth: 0, paddingHorizontal: 12, backgroundColor: t.dark ? t.optionBg : t.sidebar },
    pickRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 18 },
  });
}

/** Splits text around case-insensitive matches of q, for highlighting. */
function highlight(text: string, q: string): Array<{ text: string; match: boolean }> {
  if (!q) return [{ text, match: false }];
  const out: Array<{ text: string; match: boolean }> = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let at = 0;
  for (let i = lower.indexOf(needle); i >= 0; i = lower.indexOf(needle, at)) {
    if (i > at) out.push({ text: text.slice(at, i), match: false });
    out.push({ text: text.slice(i, i + needle.length), match: true });
    at = i + needle.length;
  }
  if (at < text.length) out.push({ text: text.slice(at), match: false });
  return out;
}
