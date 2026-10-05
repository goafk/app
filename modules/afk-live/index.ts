// JS side of the native AfkLive module (Android): live "agent working" notifications that can
// sit in the status-bar chip on Android 16 (Live Updates). Absent elsewhere: callers check for null.
import { Platform } from "react-native";

type AfkLive = {
  supported(): boolean;
  canPromote(): boolean;
  show(key: string, title: string, text: string, chip: string, done: number, total: number, url: string): boolean;
  dismiss(key: string): void;
  dismissAll(): void;
  openSettings(): void;
};

let mod: AfkLive | null | undefined;
export function afkLive(): AfkLive | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS === "android") {
    try {
      mod = require("expo-modules-core").requireNativeModule("AfkLive");
    } catch {
      mod = null;
    }
  }
  return mod ?? null;
}
