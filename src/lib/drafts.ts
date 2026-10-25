// Unsent messages, kept per thread on the phone: switch threads or restart the app and the draft
// is still there. Sent (or emptied) drafts are dropped.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";

const PREFIX = "afk.draft.";

/** Loads the draft for `key` into the input, and saves edits back to it (debounced). */
export function useDraft(key: string | undefined, text: string, setText: (v: string) => void) {
  // Whose text is in the input right now: never save one thread's words under another's key.
  const owner = useRef<string | undefined>(undefined);
  const pending = useRef<{ key: string; text: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const flush = () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    write(p.key, p.text);
  };

  useEffect(() => {
    flush();
    owner.current = undefined;
    if (!key) return;
    let live = true;
    AsyncStorage.getItem(PREFIX + key)
      .catch(() => null)
      .then((saved) => {
        if (!live) return;
        setText(saved ?? "");
        owner.current = key;
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!key || owner.current !== key) return;
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { key, text, timer: setTimeout(flush, 400) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, text]);

  // Leaving the thread: save what's there now rather than losing the last keystrokes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => flush, []);
}

function write(key: string, text: string) {
  (text.trim() ? AsyncStorage.setItem(PREFIX + key, text) : AsyncStorage.removeItem(PREFIX + key)).catch(() => {});
}
