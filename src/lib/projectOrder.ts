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

// Projects removed from afk's list (per computer, on the phone): path → when. A project comes
// back by itself when a thread there is active after that (so new work is never hidden).
const hiddenKey = (hostId: string) => `afk.hiddenProjects.${hostId}`;

export function useHiddenProjects(hostId: string | undefined) {
  const [hidden, setHiddenState] = useState<Record<string, number>>({});
  useEffect(() => {
    setHiddenState({});
    if (!hostId) return;
    AsyncStorage.getItem(hiddenKey(hostId))
      .then((v) => setHiddenState(v ? JSON.parse(v) : {}))
      .catch(() => {});
  }, [hostId]);
  const save = useCallback(
    (next: Record<string, number>) => {
      setHiddenState(next);
      if (hostId) AsyncStorage.setItem(hiddenKey(hostId), JSON.stringify(next)).catch(() => {});
    },
    [hostId],
  );
  const hide = useCallback((path: string) => save({ ...hidden, [path]: Date.now() }), [hidden, save]);
  const unhide = useCallback(
    (path: string) => {
      const { [path]: _drop, ...rest } = hidden;
      save(rest);
    },
    [hidden, save],
  );
  return { hidden, hide, unhide };
}

/** Whether a project stays hidden: hidden, and nothing in it has been active since. */
export function isHidden(p: { path: string; threads: Array<{ updatedAt: number }>; pending?: unknown[] }, hidden: Record<string, number>): boolean {
  const at = hidden[p.path];
  if (!at) return false;
  if (p.pending?.length) return false;
  return !p.threads.some((t) => t.updatedAt > at);
}
