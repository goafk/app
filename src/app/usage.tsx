// Usage at a glance: cost today and over the last 7 days, and which threads cost the most,
// with how full each one's context window is. Costs come from what the agents report.
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UsageSummary } from "../lib/api";
import { useStore } from "../lib/store";
import { ui, useTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";
import { ChevronLeft } from "../components/Icons";
import { formatTokens } from "../components/PlanBar";
import { money } from "../lib/money";

export default function UsageScreen() {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();
  const { api, select } = useStore();
  const [data, setData] = useState<UsageSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await api.usage();
      if (!r || !Array.isArray(r.days) || !Array.isArray(r.threads)) throw new Error("Couldn't read usage from your computer.");
      setData(r);
      setErr(null);
    } catch (e: any) {
      setErr(/404|not found/i.test(e.message) ? "Update the hub on your computer to see usage (run the install command again)." : e.message);
    }
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);

  const max = Math.max(0.01, ...(data?.days ?? []).map((d) => d.cost));
  const week = (data?.days ?? []).reduce((a, d) => a + d.cost, 0);
  const cur = data?.currency ?? "USD";

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} style={s.back} accessibilityLabel="Back">
          <ChevronLeft color={t.muted} size={22} />
        </Pressable>
        <Text style={s.title}>Usage</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {err ? <Text style={s.err}>{err}</Text> : null}
        {!data && !err ? <ActivityIndicator color={t.faint} style={{ marginTop: 40 }} /> : null}
        {data ? (
          <>
            <View style={s.totals}>
              <View style={s.total}>
                <Text style={s.totalLabel}>Today</Text>
                <Text style={s.totalValue}>{money(data.today, cur)}</Text>
              </View>
              <View style={[s.total, s.totalRight]}>
                <Text style={s.totalLabel}>Last 7 days</Text>
                <Text style={s.totalValue}>{money(week, cur)}</Text>
              </View>
            </View>
            <View style={s.card}>
              <View style={s.chart} accessibilityLabel={`Cost per day: ${data.days.map((d) => `${dayName(d.day)} ${money(d.cost, cur)}`).join(", ")}`}>
                {data.days.map((d, i) => (
                  <View key={d.day} style={s.barCol}>
                    <Text style={s.barValue} numberOfLines={1}>{d.cost ? money(d.cost, cur) : ""}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.bar, { height: `${Math.max(d.cost ? 4 : 0, (d.cost / max) * 100)}%`, backgroundColor: i === data.days.length - 1 ? t.text : t.faint }]} />
                    </View>
                    <Text style={[s.barDay, i === data.days.length - 1 && { color: t.text, fontWeight: "600" }]}>{i === data.days.length - 1 ? "Today" : dayName(d.day)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={s.section}>Threads</Text>
            <View style={s.card}>
              {data.threads.length ? (
                data.threads.map((th, i) => {
                  const ratio = th.used && th.size ? Math.min(1, th.used / th.size) : null;
                  return (
                    <Pressable
                      key={th.id}
                      onPress={() => {
                        select(th.id);
                        router.push(`/thread/${encodeURIComponent(th.id)}`);
                      }}
                      style={({ pressed }) => [s.row, i > 0 && s.rowBorder, pressed && { backgroundColor: t.hover }]}
                    >
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={s.rowTitle} numberOfLines={1}>{th.title}</Text>
                        <Text style={s.rowMeta} numberOfLines={1}>
                          {th.cwd.split("/").pop()}
                          {ratio !== null ? ` · context ${Math.round(ratio * 100)}% (${formatTokens(th.used!)} of ${formatTokens(th.size!)})` : ""}
                        </Text>
                        {ratio !== null ? (
                          <View style={s.meter}>
                            <View style={{ width: `${ratio * 100}%`, height: "100%", backgroundColor: ratio > 0.8 ? t.warning : t.text }} />
                          </View>
                        ) : null}
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <Text style={s.rowCost}>{money(th.cost, cur)}</Text>
                        {th.week ? <Text style={s.rowWeek}>{money(th.week, cur)} this week</Text> : null}
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={s.empty}>No usage reported yet. Costs appear once an agent reports them.</Text>
              )}
            </View>
            <Text style={s.note}>
              Totals per thread are what each agent reports for the whole thread. Daily totals count from when this hub started tracking them.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function dayName(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
}

function styles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.panel },
    header: { flexDirection: "row", alignItems: "center", gap: 6, height: 56, paddingHorizontal: 10 },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    title: { fontSize: t.fs(20), color: t.text, fontFamily: ui, fontWeight: "700", letterSpacing: -0.3 },
    err: { margin: 16, fontSize: t.fs(14), color: t.error, fontFamily: ui },
    totals: { flexDirection: "row", marginHorizontal: 16, marginTop: 8, gap: 12 },
    total: { flex: 1, padding: 16, borderRadius: 18, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
    totalRight: {},
    totalLabel: { fontSize: t.fs(13), color: t.muted, fontFamily: ui },
    totalValue: { fontSize: t.fs(26), color: t.text, fontFamily: ui, fontWeight: "700", letterSpacing: -0.5, marginTop: 4, fontVariant: ["tabular-nums"] },
    card: { marginHorizontal: 16, marginTop: 12, borderRadius: 18, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, overflow: "hidden" },
    chart: { flexDirection: "row", height: 170, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 10, gap: 6 },
    barCol: { flex: 1, alignItems: "center", gap: 6 },
    barValue: { fontSize: 10.5, color: t.muted, fontFamily: ui, fontVariant: ["tabular-nums"] },
    barTrack: { flex: 1, width: "70%", justifyContent: "flex-end", borderRadius: 6, backgroundColor: t.optionBg, overflow: "hidden" },
    bar: { width: "100%", borderRadius: 6 },
    barDay: { fontSize: t.fs(11.5), color: t.faint, fontFamily: ui },
    section: { fontSize: t.fs(13), color: t.muted, fontFamily: ui, fontWeight: "500", marginTop: 22, marginHorizontal: 20 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: t.sp(12) },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    rowTitle: { fontSize: t.fs(15.5), color: t.text, fontFamily: ui, fontWeight: "500" },
    rowMeta: { fontSize: t.fs(12.5), color: t.faint, fontFamily: ui },
    meter: { height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: t.border, marginTop: 2 },
    rowCost: { fontSize: t.fs(15.5), color: t.text, fontFamily: ui, fontWeight: "600", fontVariant: ["tabular-nums"] },
    rowWeek: { fontSize: t.fs(12), color: t.faint, fontFamily: ui },
    empty: { padding: 16, fontSize: t.fs(14), color: t.muted, fontFamily: ui },
    note: { fontSize: t.fs(12.5), color: t.faint, fontFamily: ui, marginHorizontal: 20, marginTop: 12, lineHeight: t.fs(17) },
  });
}
