// Demo mode: a pretend Mac that lives inside the app. It answers the same HTTP API and event
// stream as the real hub (see api.ts / sse.ts), from sample data, and plays out small scripts so
// the app can be tried end to end without installing anything (and by store reviewers).
import * as Notifications from "expo-notifications";
import type { Entry, Project, SearchHit, SidebarThread, ThreadDetail, UsageSummary } from "../api";
import type { HubEvent, Subscription } from "../sse";
import { claudeOpts, codexOpts, commands, diff, files, git, seed } from "./fixtures";

export const DEMO_URL = "demo://mac";
export const DEMO_HOST_ID = "demo";
export const isDemo = (url?: string | null) => !!url && url.startsWith("demo://");

type World = ReturnType<typeof seed>;
let world: World | null = null;
const w = () => (world ??= seed(Date.now()));

const listeners = new Set<(e: HubEvent) => void>();
const emit = (type: string, threadId: string, data: any = null) => {
  for (const l of listeners) l({ type, threadId, data });
};

const rows = () => w().projects.flatMap((p) => p.threads);
const row = (id: string) => rows().find((t) => t.id === id);

function detail(t: SidebarThread): ThreadDetail {
  const d = (w().details[t.id] ??= { entries: [{ seq: 1, kind: "user", text: t.title }, { seq: 2, kind: "agent", text: "Done." }] });
  return {
    ...t,
    configOptions: t.kind === "codex" ? codexOpts() : claudeOpts(),
    availableCommands: commands,
    pendingPermissions: [],
    pendingElicitations: [],
    queued: [],
    ...d,
  };
}

/** Changes a thread's row and tells the app, the way the hub does. */
function update(id: string, patch: Partial<SidebarThread>) {
  const t = row(id);
  if (!t) return;
  Object.assign(t, patch, { updatedAt: Date.now() });
  const d = detail(t);
  emit("thread.updated", id, {
    status: t.status,
    online: t.online,
    unread: t.unread,
    title: t.title,
    configOptions: d.configOptions,
    pendingPermissions: d.pendingPermissions,
    pendingElicitations: d.pendingElicitations,
    queued: d.queued,
  });
}

function upsert(id: string, entry: Entry) {
  detail(row(id)!); // makes sure the thread has a details record
  const list = w().details[id].entries;
  const i = list.findIndex((e) => e.seq === entry.seq);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  emit("entry.upserted", id, entry);
}

const nextSeq = (id: string) => Math.max(0, ...w().details[id]?.entries.map((e) => e.seq) ?? [0]) + 1;

/** Puts the thread in Android's live progress (status-bar chip), exactly as a real hub's push would. */
function live(id: string, state: "working" | "waiting" | "done", step?: string, done?: number, total?: number) {
  const t = row(id);
  if (!t) return;
  // Required lazily: notifyActions -> api -> demo/hub would otherwise be a cycle at startup.
  const { showProgress } = require("../notifyActions") as typeof import("../notifyActions");
  showProgress({
    kind: "progress",
    hubId: DEMO_HOST_ID,
    hubName: "Demo Mac",
    threadId: id,
    title: t.title,
    project: t.cwd.split("/").pop() ?? "",
    running: state !== "done",
    step: state === "waiting" ? "Waiting for you" : step,
    done,
    total,
  }).catch(() => {});
}

/** Takes the demo's live progress off the status bar (when leaving the demo). */
export function stopDemoLive() {
  const { afkLive } = require("../../../modules/afk-live") as typeof import("../../../modules/afk-live");
  for (const t of world ? rows() : []) afkLive()?.dismiss(`progress:${DEMO_HOST_ID}:${t.id}`);
}

/** Runs steps one after another, each `ms` after the previous. */
function script(steps: Array<[number, () => void]>) {
  let at = 0;
  for (const [ms, fn] of steps) {
    at += ms;
    setTimeout(fn, at);
  }
}

const FILE_FOR: Record<string, string> = { "aurora-ui": "src/theme/ThemeProvider.tsx", "pocket-ledger": "src/billing/adapter.ts", "trailhead-api": "src/middleware/rateLimit.ts", noted: "src/sync/merge.ts" };
const fileFor = (t: SidebarThread) => FILE_FOR[t.cwd.split("/").pop() ?? ""] ?? "src/index.ts";

function replyText(text: string) {
  const s = text.toLowerCase();
  if (/\btest/.test(s)) return "Ran the suite: **48 passed**, nothing flaky across 5 runs.\n\n*(This is the demo. With afk installed, your message goes to the real agent on your Mac, in Zed.)*";
  if (/commit|push/.test(s)) return "Committed as `feat: dark mode` and pushed to `feat/dark-mode`.\n\n*(Demo: nothing was really pushed.)*";
  if (/contrast/.test(s)) return "Added a **High contrast** option next to System / Light / Dark, with its own palette and a 7:1 minimum contrast ratio.";
  return `On it. I looked at the code and made the change you asked for:\n\n> ${text.slice(0, 160)}\n\n*(This is the demo, so nothing really ran. With afk installed, this goes to the real agent on your Mac, in Zed, and you'd see its actual work here as it happens.)*`;
}

/** The agent picks up a message: thinks, runs a tool, answers. */
function respond(id: string, text: string, echo = true) {
  const t = row(id);
  if (!t) return;
  const seq = nextSeq(id);
  if (echo) upsert(id, { seq, kind: "user", text });
  update(id, { status: "running", preview: undefined });
  const tool = fileFor(t);
  live(id, "working", `Editing ${tool}`);
  script([
    [700, () => upsert(id, { seq: seq + 1, kind: "thought", text: "Reading the relevant code first." })],
    [800, () => upsert(id, { seq: seq + 2, kind: "tool_call", toolCallId: `x${seq}`, title: `Edit ${tool}`, status: "in_progress", data: { kind: "edit" } })],
    [1400, () => upsert(id, { seq: seq + 2, kind: "tool_call", toolCallId: `x${seq}`, title: `Edit ${tool}`, status: "completed", data: { kind: "edit" } })],
    [
      700,
      () => {
        upsert(id, { seq: seq + 3, kind: "agent", text: replyText(text) });
        update(id, { status: "idle", unread: true, preview: "Done." });
        live(id, "done");
        emit("sidebar.changed", "");
        afterIdle(id);
      },
    ],
  ]);
}

/** When a thread goes idle with messages queued, the next one is sent (as the hub does). */
function afterIdle(id: string) {
  const d = w().details[id];
  const next = d?.queued?.shift();
  if (!next) return;
  setTimeout(() => respond(id, next.text), 5000); // after the "Done" moment
}

let started = false;
/** Background activity so the demo feels alive: the running threads finish on their own. */
function startScripts() {
  if (started) return;
  started = true;
  live("t-dark", "working", "Wire theme into ThemeProvider", 2, 4);
  live("t-stripe", "waiting");
  script([
    [
      7000,
      () => {
        upsert("t-dark", { seq: 7, kind: "tool_call", toolCallId: "c3", title: "Edit src/theme/ThemeProvider.tsx", status: "completed", data: { kind: "edit" } });
        live("t-dark", "working", "Persist choice and respect system setting", 3, 4);
      },
    ],
    [
      2500,
      () => {
        upsert("t-dark", { seq: 8, kind: "agent", text: "Dark mode is in. The toggle follows the system by default, and the choice survives restarts. Snapshot tests pass for both themes." });
        update("t-dark", { status: "idle", unread: true, preview: "Dark mode is in." });
        live("t-dark", "done", undefined, 4, 4);
        emit("sidebar.changed", "");
        afterIdle("t-dark");
      },
    ],
    [
      6000,
      () => {
        upsert("t-docs", { seq: 4, kind: "agent", text: "Served the generated spec at `/docs` (Swagger UI) and `/openapi.json`. 23 routes documented." });
        update("t-docs", { status: "idle", unread: true, preview: "Served the generated spec at /docs." });
        emit("sidebar.changed", "");
      },
    ],
  ]);
}

// ---------------- HTTP ----------------

type Res = { ok: boolean; status: number; json: () => Promise<any> };
const res = (body: unknown, status = 200): Res => ({ ok: status < 400, status, json: async () => JSON.parse(JSON.stringify(body)) });
const err = (status: number, code: string, message: string) => res({ error: { code, message } }, status);

let newIds = 0;

export async function demoFetch(url: string, init?: { method?: string; body?: any }): Promise<Res> {
  await new Promise((r) => setTimeout(r, 120)); // feel like a network
  // React Native's URL is incomplete, so split the path and query by hand.
  const [p, query = ""] = url.slice(DEMO_URL.length).split("?");
  const params: Record<string, string> = {};
  for (const kv of query.split("&").filter(Boolean)) {
    const [k, v = ""] = kv.split("=");
    params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  const q = (k: string) => params[k] ?? "";
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(init.body) : {};
  let m: RegExpExecArray | null;

  if (p === "/health") return res({ ok: true, agents: 2 });
  if (p === "/info") return res({ id: DEMO_HOST_ID, name: "Demo Mac", version: "demo" });
  if (p === "/zed/sidebar") return res({ projects: w().projects });
  if (p === "/agents") return res([{ agentId: "claude", name: "Claude Agent", zedName: "Claude Agent", keys: "", connections: 1 }, { agentId: "codex", name: "Codex", zedName: "Codex", keys: "", connections: 1 }]);
  if (p === "/zed/theme") return err(404, "demo", "In the demo there's no Zed to read a theme from.");
  if (p === "/git/status") return res(git);
  if (p === "/git/diff") return res({ diff: diff(q("file")) });
  if (p === "/git/commit") return res({ hash: "a1b2c3d" });
  if (p === "/git/push") return res({ output: "To github.com:demo/aurora-ui.git\n   9f2e1c4..a1b2c3d  feat/dark-mode -> feat/dark-mode" });
  if (p === "/files") return res({ files: files.filter((f) => f.toLowerCase().includes(q("q").toLowerCase())).map((f) => ({ path: f, dir: f.endsWith("/") })) });
  if (p === "/search") return res({ results: search(q("q")) });
  if (p === "/usage") return res(usage());
  if (p === "/devices") return res({ ok: true });
  if (p === "/devices/test") {
    await Notifications.scheduleNotificationAsync({
      content: { title: "pocket-ledger · Migrate payments", body: "Permission needed: npm test -- billing --coverage" },
      trigger: null,
    }).catch(() => {});
    return res({ ok: true });
  }
  if ((m = /^\/zed\/threads\/([^/]+)$/.exec(p))) {
    const t = row(decodeURIComponent(m[1]));
    return t ? res(detail(t)) : err(404, "not_found", "No such thread");
  }
  if ((m = /^\/zed\/threads\/([^/]+)\/meta$/.exec(p))) {
    update(decodeURIComponent(m[1]), body);
    emit("sidebar.changed", "");
    return res({ ok: true });
  }
  if (p === "/threads" && method === "POST") return res(newThread(body), 201);
  if ((m = /^\/threads\/pending\/([^/]+)\/cancel$/.exec(p))) return res({ ok: true });
  if ((m = /^\/threads\/([^/]+)\/([a-z]+)$/.exec(p))) {
    const id = decodeURIComponent(m[1]);
    const t = row(id);
    if (!t) return err(404, "not_found", "No such thread");
    const d = detail(t);
    switch (m[2]) {
      case "seen":
        t.unread = false;
        return res({ ok: true });
      case "prompt":
        if (t.status === "running") {
          const qm = { id: `q${Date.now()}`, text: body.text, images: 0, createdAt: Date.now() };
          (w().details[id].queued ??= []).push(qm);
          update(id, {});
          return res({ queued: qm });
        }
        respond(id, body.text);
        return res({ ok: true });
      case "queue": {
        const list = (w().details[id].queued ??= []);
        if (body.action === "clear") list.length = 0;
        else if (body.action === "remove") list.splice(list.findIndex((x) => x.id === body.id), 1);
        else if (body.action === "edit") Object.assign(list.find((x) => x.id === body.id) ?? {}, { text: body.text });
        else if (body.action === "send_now") {
          const [x] = list.splice(list.findIndex((y) => y.id === body.id), 1);
          if (x) setTimeout(() => respond(id, x.text), 300);
        }
        update(id, {});
        return res({ queued: list });
      }
      case "config": {
        const opts = (w().details[id].configOptions ??= d.configOptions ?? []);
        const o = opts.find((x) => x.id === body.configId);
        if (o) o.currentValue = body.value;
        return res({ configOptions: opts });
      }
      case "cancel":
        update(id, { status: "idle" });
        return res({ ok: true });
      case "permission":
        permission(id, body.optionId);
        return res({ ok: true });
      case "elicitation":
        elicitation(id, body.action, body.content);
        return res({ ok: true });
      case "adopt":
        return res({ ok: true });
      default:
        return res({ ok: true });
    }
  }
  if ((m = /^\/zed\/threads\/([^/]+)\/resume$/.exec(p))) return res({ ok: true });
  return err(404, "not_found", p);
}

function permission(id: string, optionId: string) {
  const d = w().details[id];
  d.pendingPermissions = [];
  if (optionId === "reject") {
    upsert(id, { seq: 4, kind: "tool_call", toolCallId: "s2", title: "npm test -- billing --coverage", status: "failed", data: { kind: "execute" } });
    upsert(id, { seq: 5, kind: "agent", text: "OK, I won't run the tests. The migration is done; run `npm test -- billing` yourself when you're ready." });
    update(id, { status: "idle" });
    live(id, "done");
    return;
  }
  update(id, { status: "running" });
  live(id, "working", "npm test -- billing --coverage");
  script([
    [300, () => upsert(id, { seq: 4, kind: "tool_call", toolCallId: "s2", title: "npm test -- billing --coverage", status: "in_progress", data: { kind: "execute" } })],
    [
      2200,
      () =>
        upsert(id, {
          seq: 4,
          kind: "tool_call",
          toolCallId: "s2",
          title: "npm test -- billing --coverage",
          status: "completed",
          data: { kind: "execute", content: [{ type: "content", content: { type: "text", text: "Tests: 64 passed, 64 total\nCoverage: 94.2% statements" } }] },
        }),
    ],
    [
      900,
      () => {
        upsert(id, { seq: 5, kind: "agent", text: "All **64 billing tests pass** (94% coverage). The webhook payloads are byte-for-byte the same as before, so nothing downstream changes." });
        update(id, { status: "idle", unread: true });
        live(id, "done");
        emit("sidebar.changed", "");
      },
    ],
  ]);
}

function elicitation(id: string, action: string, content?: Record<string, unknown>) {
  const d = w().details[id];
  d.pendingElicitations = [];
  if (action !== "accept") {
    upsert(id, { seq: 3, kind: "agent", text: "No problem, I'll stop here. Tell me how you'd like the limits applied and I'll pick it back up." });
    update(id, { status: "idle" });
    return;
  }
  const by = { key: "API key", ip: "IP address", both: "API key, with IP as a fallback" }[String(content?.strategy ?? "key")] ?? "API key";
  const store = String(content?.store ?? "redis") === "memory" ? "in memory" : "in Redis";
  respond(id, `Limit by ${by}, counters ${store}.`, false);
}

function newThread(b: { cwd: string; agentId: string; prompt?: string }): SidebarThread {
  const proj: Project = w().projects.find((p) => p.path === b.cwd) ?? w().projects[0];
  const id = `t-new-${++newIds}`;
  const title = b.prompt ? b.prompt.split("\n")[0].slice(0, 60) : "New thread";
  const t: SidebarThread = {
    id,
    title,
    agentId: b.agentId,
    agentName: b.agentId === "codex" ? "Codex" : "Claude Agent",
    kind: b.agentId,
    synced: true,
    status: "running",
    online: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    cwd: proj.path,
  };
  proj.threads.unshift(t);
  w().details[id] = { entries: [] };
  emit("thread.created", id);
  if (b.prompt) setTimeout(() => respond(id, b.prompt!), 400);
  else update(id, { status: "idle" });
  return t;
}

function search(qs: string): SearchHit[] {
  const q = qs.trim().toLowerCase();
  if (!q) return [];
  const out: SearchHit[] = [];
  for (const t of rows()) {
    for (const e of w().details[t.id]?.entries ?? []) {
      if ((e.kind !== "user" && e.kind !== "agent") || !e.text) continue;
      const i = e.text.toLowerCase().indexOf(q);
      if (i < 0) continue;
      out.push({ threadId: t.id, kind: e.kind, seq: e.seq, snippet: e.text.slice(Math.max(0, i - 40), i + 80), title: t.title, cwd: t.cwd, updatedAt: t.updatedAt });
    }
  }
  return out;
}

function usage(): UsageSummary {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    return { day: d.toISOString().slice(0, 10), cost: [1.9, 3.4, 2.2, 4.8, 3.1, 5.6, 2.21][i] };
  });
  const threads = rows().map((t, i) => {
    const u = w().details[t.id]?.usage;
    return { id: t.id, title: t.title, cwd: t.cwd, status: t.status, used: u?.used, size: u?.size, cost: u?.cost?.amount, week: [0.84, 2.1, 0.4, 1.37, 3.2, 0.9, 1.1, 0.6][i % 8], updatedAt: t.updatedAt };
  });
  return { currency: "USD", today: 2.21, days, threads };
}

// ---------------- events ----------------

export function demoSubscribe(onEvent: (e: HubEvent) => void, onState: (connected: boolean) => void): Subscription {
  listeners.add(onEvent);
  const up = setTimeout(() => onState(true), 150);
  startScripts();
  return {
    close: () => {
      clearTimeout(up);
      listeners.delete(onEvent);
    },
    reconnect: () => onState(true),
  };
}

/** Back to the starting state (used when the demo is opened again). */
export function resetDemo() {
  world = null;
  started = false;
}
