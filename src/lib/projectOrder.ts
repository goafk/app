// The user's own project order, per computer, kept on the phone. Projects it doesn't know yet
// (new in Zed) come first, in Zed's order; the rest follow the saved order.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const key = (hostId: string) => `afk.projectOrder.${hostId}`;

export function applyOrder<T extends { path: string }>(projects: T[], order: string[] | null): T[] {
  if (!order?.length) return projects;
  const rank = new Map(order.map((p, i) => [p, i]));
  const fresh = projects.filter((p) => !rank.has(p.path));
  const known = projects.filter((p) => rank.has(p.path)).sort((a, b) => rank.get(a.path)! - rank.get(b.path)!);
  return [...fresh, ...known];
}

export function useProjectOrder(hostId: string | undefined) {
  const [order, setOrderState] = useState<string[] | null>(null);
  useEffect(() => {
    setOrderState(null);
    if (!hostId) return;
    AsyncStorage.getItem(key(hostId))
      .then((v) => setOrderState(v ? JSON.parse(v) : null))
      .catch(() => {});
  }, [hostId]);
  const setOrder = useCallback(
    (next: string[] | null) => {
      setOrderState(next);
      if (!hostId) return;
      (next ? AsyncStorage.setItem(key(hostId), JSON.stringify(next)) : AsyncStorage.removeItem(key(hostId))).catch(() => {});
    },
    [hostId],
  );
  return { order, setOrder };
}
