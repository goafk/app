// Read offline: the last thread list and recently opened threads are saved on the phone, so
// they open without a connection (marked as a saved copy) and catch up once the Mac is back.
import { Platform } from "react-native";
import type { Project, ThreadDetail } from "./api";

const MAX_THREADS = 25;
const MAX_ENTRIES = 200;
const MAX_TEXT = 6000;

type FS = typeof import("expo-file-system");
let fsMod: FS | null = null;
function fs(): FS | null {
  if (Platform.OS === "web") return null;
  if (!fsMod) {
    try {
      fsMod = require("expo-file-system");
    } catch {
      return null;
    }
  }
  return fsMod;
}

const safe = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 80);

function dir(hostId: string) {
  const f = fs();
  if (!f) return null;
  const d = new f.Directory(f.Paths.cache, "offline", safe(hostId));
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

function writeJson(hostId: string, name: string, value: unknown): void {
  try {
    const d = dir(hostId);
    if (!d) return;
    const f = fs()!;
    const file = new f.File(d, name);
    file.write(JSON.stringify({ savedAt: Date.now(), value }));
  } catch {}
}

async function readJson<T>(hostId: string, name: string): Promise<{ savedAt: number; value: T } | null> {
  try {
    const d = dir(hostId);
    if (!d) return null;
    const file = new (fs()!).File(d, name);
    if (!file.exists) return null;
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

export function saveSidebar(hostId: string, projects: Project[]): void {
  writeJson(hostId, "sidebar.json", projects);
}

export function loadSidebar(hostId: string) {
  return readJson<Project[]>(hostId, "sidebar.json");
}

/** Keeps a trimmed copy of a thread: the latest entries, with very long text shortened. */
export function saveThread(hostId: string, t: ThreadDetail): void {
  const entries = (t.entries ?? []).slice(-MAX_ENTRIES).map((e: any) =>
    typeof e.text === "string" && e.text.length > MAX_TEXT ? { ...e, text: e.text.slice(0, MAX_TEXT) + "\n\n… (shortened in the saved copy)" } : e,
  );
  writeJson(hostId, `thread-${safe(t.id)}.json`, { ...t, entries });
  prune(hostId);
}

export function loadThread(hostId: string, id: string) {
  return readJson<ThreadDetail>(hostId, `thread-${safe(id)}.json`);
}

function prune(hostId: string): void {
  try {
    const d = dir(hostId);
    if (!d) return;
    const files = d
      .list()
      .filter((x: any) => x.name?.startsWith("thread-"))
      .map((x: any) => ({ x, t: x.modificationTime ?? 0 }))
      .sort((a: any, b: any) => b.t - a.t);
    for (const { x } of files.slice(MAX_THREADS)) x.delete();
  } catch {}
}

/** "10:42" today, otherwise "Mon 10:42". */
export function savedAtLabel(t: number): string {
  const d = new Date(t);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return new Date().toDateString() === d.toDateString() ? hm : `${d.toLocaleDateString(undefined, { weekday: "short" })} ${hm}`;
}
