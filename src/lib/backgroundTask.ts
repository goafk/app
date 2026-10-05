// Runs in the background (and with the app closed, on Android): notification buttons and
// the hub's silent progress pushes. Imported first from index.ts so it's defined in headless starts.
import { Platform } from "react-native";
import { NOTIFICATION_TASK, handleNotificationAction, pushData, showProgress } from "./notifyActions";

if (Platform.OS !== "web") {
  try {
    const TaskManager = require("expo-task-manager");
    const Notifications = require("expo-notifications");
    TaskManager.defineTask(NOTIFICATION_TASK, async ({ data, error }: { data: any; error: unknown }) => {
      if (error || !data) return;
      if ("actionIdentifier" in data) {
        await handleNotificationAction(data);
        return;
      }
      const d = pushData(data);
      if (d?.kind === "progress") await showProgress(d);
    });
    Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => {});
  } catch {
    // Task manager not in this build.
  }
}
