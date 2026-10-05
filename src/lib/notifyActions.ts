// Notification buttons and live progress, also when the app is closed.
// - Buttons: Allow / Reject on permission requests, Answer on simple questions, Reply when a
//   thread finishes. They act directly on the Mac, without opening the app.
// - Progress: the hub sends silent pushes while an agent works; we keep one quiet, ongoing
//   notification per thread up to date, and remove it when the turn ends.
// On Android the background task runs both, even when afk isn't open.
import { Platform } from "react-native";
import { makeApi } from "./api";
import { connOf, loadHosts } from "./hosts";
import { afkLive } from "../../modules/afk-live";

type N = typeof import("expo-notifications");
const Notifications: N | null = Platform.OS === "web" ? null : require("expo-notifications");

export const NOTIFICATION_TASK = "afk-notifications";

/** Registers the button sets the hub refers to by categoryId, and the quiet progress channel. */
export async function setupNotificationCategories(): Promise<void> {
  if (!Notifications) return;
  const quiet = { opensAppToForeground: false };
  await Promise.all([
    Notifications.setNotificationCategoryAsync("permission", [
      { identifier: "allow", buttonTitle: "Allow", options: quiet },
      { identifier: "reject", buttonTitle: "Reject", options: { ...quiet, isDestructive: true } },
    ]),
    Notifications.setNotificationCategoryAsync("answer", [
      { identifier: "answer", buttonTitle: "Answer", textInput: { submitButtonTitle: "Send", placeholder: "Your answer" }, options: quiet },
    ]),
    Notifications.setNotificationCategoryAsync("reply", [
      { identifier: "reply", buttonTitle: "Reply", textInput: { submitButtonTitle: "Send", placeholder: "Message the agent" }, options: quiet },
    ]),
  ]).catch(() => {});
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("progress", {
      name: "Agents working",
      description: "A quiet, ongoing notification while an agent works on your computer.",
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      vibrationPattern: null,
      enableVibrate: false,
      showBadge: false,
    }).catch(() => {});
  }
}

async function apiFor(hubId: string | undefined) {
  const { hosts, activeId } = await loadHosts();
  const h = hosts.find((x) => x.id === hubId) ?? hosts.find((x) => x.id === activeId) ?? hosts[0];
  if (!h) throw new Error("No computer paired");
  return makeApi(connOf(h));
}

/** Performs a notification button's action. Returns true when handled (not a plain tap). */
export async function handleNotificationAction(r: { actionIdentifier: string; userText?: string; notification: { request: { identifier: string; content: { data?: any } } } }): Promise<boolean> {
  if (!Notifications) return false;
  const id = r.actionIdentifier;
  if (!["allow", "reject", "answer", "reply"].includes(id)) return false;
  const d = r.notification.request.content.data ?? {};
  const threadId = String(d.threadId ?? "");
  const text = (r.userText ?? "").trim();
  try {
    const api = await apiFor(d.hubId);
    if (id === "allow" || id === "reject") await api.permission(threadId, d.requestId, String(id === "allow" ? d.allowId : d.rejectId));
    else if (id === "answer") {
      if (!text) return true;
      await api.answer(threadId, d.requestId, "accept", { [String(d.field)]: text });
    } else if (id === "reply") {
      if (!text) return true;
      await api.prompt(threadId, text);
    }
    await Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
  } catch (e: any) {
    // Couldn't reach the Mac (or the request was already answered): say so, and let a tap open the thread.
    await Notifications.scheduleNotificationAsync({
      identifier: r.notification.request.identifier,
      content: {
        title: "Couldn't send that to your computer",
        body: /not_found|no pending/i.test(String(e?.message)) ? "It was already answered. Open afk to see the thread." : "Open afk to try again.",
        data: { threadId, hubId: d.hubId },
      },
      trigger: null,
    }).catch(() => {});
  }
  return true;
}

export type ProgressPush = { kind: "progress"; hubId: string; hubName?: string; threadId: string; title: string; project: string; running: boolean; step?: string; done?: number; total?: number };

/** Shows, updates or removes the ongoing "agent working" notification for one thread. */
export async function showProgress(p: ProgressPush): Promise<void> {
  if (!Notifications || Platform.OS !== "android") return;
  const identifier = `progress:${p.hubId}:${p.threadId}`;
  // Android 16: a Live Update, shown in the status-bar chip by the camera (and on the lock screen).
  const live = afkLive();
  if (live) {
    try {
      if (!p.running) live.dismiss(identifier);
      else {
        const waiting = p.step === "Waiting for you";
        const chip = waiting ? "Needs you" : p.total ? `${p.done ?? 0}/${p.total}` : "Working";
        live.show(
          identifier,
          `${p.hubName ? `${p.hubName} · ` : ""}${p.project} · ${p.title}`,
          p.step ?? "Working…",
          chip,
          p.done ?? 0,
          p.total ?? 0,
          `zedthreads://thread/${encodeURIComponent(p.threadId)}`,
        );
      }
      return;
    } catch {
      // Fall back to a regular notification below.
    }
  }
  if (!p.running) {
    await Notifications.dismissNotificationAsync(identifier).catch(() => {});
    return;
  }
  const plan = p.total ? `${p.done ?? 0}/${p.total} · ` : "";
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: `${p.hubName ? `${p.hubName} · ` : ""}${p.project} · ${p.title}`,
      body: `${plan}${p.step ?? "Working…"}`,
      sticky: true,
      autoDismiss: false,
      sound: false,
      priority: "low",
      data: { threadId: p.threadId, hubId: p.hubId, progress: true },
    } as any,
    trigger: { channelId: "progress" } as any,
  }).catch(() => {});
}

/** Pulls the hub's data out of a data-only push (Android delivers it as a JSON string). */
export function pushData(payload: any): any {
  const d = payload?.data ?? payload ?? {};
  if (typeof d.dataString === "string") {
    try {
      return JSON.parse(d.dataString);
    } catch {}
  }
  if (typeof d.body === "string") {
    try {
      return JSON.parse(d.body);
    } catch {}
  }
  return d;
}

/** Removes every live-progress notification (when the setting is turned off). */
export async function clearProgress(): Promise<void> {
  if (!Notifications) return;
  try {
    afkLive()?.dismissAll();
  } catch {}
  const shown = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  await Promise.all(shown.filter((n) => (n.request.content.data as any)?.progress).map((n) => Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {})));
}
