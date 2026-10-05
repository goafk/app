// Home: Zed's sidebar. On wide screens (tablet, web) the thread opens beside it like in Zed.
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import { NewThreadSheet } from "../components/Dialogs";
import { Sidebar } from "../components/Sidebar";
import { EmptyState } from "../components/EmptyState";
import { ThreadView } from "../components/ThreadView";
import { useStore } from "../lib/store";
import { ui, useTheme } from "../lib/theme";

export default function Home() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const { selected, select, ready, conn, projects, hosts } = useStore();
  const params = useLocalSearchParams<{ mode?: string; new?: string; settings?: string }>();
  const [newIn, setNewIn] = useState<string | null>(null);
  // Widget deep links: open the new-thread sheet for a project.
  useEffect(() => {
    if (params.new) setNewIn(String(params.new));
  }, [params.new]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!ready) return;
    // First run on the phone: pair with a Mac. (The web build talks to the hub on this computer.)
    if (!hosts.length && Platform.OS !== "web" && !params.settings) {
      router.replace("/scan");
      return;
    }
    // "Enter address manually" from the pairing screen, or nothing to talk to yet.
    if (params.settings || !conn.url) router.push("/settings");
  }, [ready, conn.url, hosts.length, params.settings]);

  // Wide layout starts on the most recent thread, like Zed reopening the active one.
  useEffect(() => {
    if (wide && !selected && projects.length) {
      const first = projects.find((p) => p.threads.length)?.threads[0];
      if (first) select(first.id);
    }
  }, [wide, selected, projects, select]);

  const [findIn, setFindIn] = useState<{ id: string; q: string } | null>(null);
  const open = (id: string, find?: string) => {
    select(id);
    setFindIn(find ? { id, q: find } : null);
    if (!wide) router.push(`/thread/${encodeURIComponent(id)}${find ? `?find=${encodeURIComponent(find)}` : ""}`);
  };

  const sidebar = (
    <Sidebar
      initialMode={params.mode === "inbox" ? "inbox" : undefined}
      onOpen={(th) => open(th.id)}
      onOpenHit={(id, q) => open(id, q)}
      onNewThread={(p) => setNewIn(p.path)}
      onReviewChanges={(p) => router.push(`/changes?cwd=${encodeURIComponent(p.path)}`)}
      onSettings={() => router.push("/settings")}
      onToggleSidebar={wide ? () => setSidebarOpen((o) => !o) : undefined}
    />
  );

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.panel }}>
      {!wide || sidebarOpen ? <View style={wide ? { width: 300, borderRightWidth: 1, borderRightColor: t.border } : { flex: 1 }}>{sidebar}</View> : null}
      {wide ? (
        <View style={{ flex: 1 }}>
          {selected ? (
            <ThreadView id={selected} find={findIn?.id === selected ? findIn.q : undefined} onNewThread={(cwd) => setNewIn(cwd)} onToggleWide={() => setSidebarOpen((o) => !o)} onReviewChanges={(cwd) => router.push(`/changes?cwd=${encodeURIComponent(cwd)}`)} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <EmptyState title="Pick a thread" body="Choose a thread on the left, or start a new one from a project." />
            </View>
          )}
        </View>
      ) : null}
      <NewThreadSheet
        cwd={newIn}
        onClose={() => setNewIn(null)}
        onCreated={(th) => {
          setNewIn(null);
          open(th.id);
        }}
      />
    </View>
  );
}
