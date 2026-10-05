// Quick replies (and saved prompts): one-tap messages above the composer. Kept on the phone,
// either for one project or for all projects; projects without their own list use the shared one.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export const DEFAULT_QUICK_REPLIES = ["Continue", "Yes, do it", "Run the tests", "Commit it", "Explain what you changed"];
const KEY = "afk.quickReplies";

type Saved = { all?: string[]; projects?: Record<string, string[]> };
let cache: Saved | null = null;
const listeners = new Set<(s: Saved) => void>();

async function load(): Promise<Saved> {
  if (cache) return cache;
  try {
    cache = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}");
  } catch {
    cache = {};
  }
  return cache!;
}

async function save(next: Saved): Promise<void> {
  cache = next;
  listeners.forEach((fn) => fn(next));
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export type Scope = "project" | "all";

export function useQuickReplies(cwd?: string) {
  const [saved, setSaved] = useState<Saved>(cache ?? {});
  useEffect(() => {
    load().then(setSaved);
    listeners.add(setSaved);
    return () => {
      listeners.delete(setSaved);
    };
  }, []);
  const own = cwd ? saved.projects?.[cwd] : undefined;
  const list = own ?? saved.all ?? DEFAULT_QUICK_REPLIES;
  const scope: Scope = own ? "project" : "all";
  const listFor = (sc: Scope) => (sc === "project" && cwd ? saved.projects?.[cwd] ?? saved.all ?? DEFAULT_QUICK_REPLIES : saved.all ?? DEFAULT_QUICK_REPLIES);
  const setList = useCallback(
    (items: string[], sc: Scope) => {
      const s = cache ?? {};
      if (sc === "project" && cwd) save({ ...s, projects: { ...(s.projects ?? {}), [cwd]: items } });
      else save({ ...s, all: items });
    },
    [cwd],
  );
  /** Project: back to the shared list. All projects: back to the built-in defaults. */
  const reset = useCallback(
    (sc: Scope) => {
      const s = cache ?? {};
      if (sc === "project" && cwd) {
        const { [cwd]: _drop, ...rest } = s.projects ?? {};
        save({ ...s, projects: rest });
      } else save({ ...s, all: undefined });
    },
    [cwd],
  );
  return { list, scope, listFor, setList, reset, hasOwn: !!own };
}

/** A chip's label: the first line, shortened. */
export const chipLabel = (text: string) => {
  const line = text.split("\n")[0].trim();
  return line.length > 28 ? line.slice(0, 26) + "…" : line;
};
