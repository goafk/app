// Opens the demo Mac (adding it the first time), then goes home. Used by the first-run screen
// and by the zedthreads://demo link.
import { router } from "expo-router";
import { useCallback } from "react";
import { useStore } from "../store";
import { DEMO_HOST_ID, DEMO_URL, resetDemo } from "./hub";

export function useStartDemo() {
  const { hosts, addHost, switchHost } = useStore();
  return useCallback(async () => {
    if (hosts.some((h) => h.id === DEMO_HOST_ID)) switchHost(DEMO_HOST_ID);
    else {
      resetDemo();
      await addHost({ id: DEMO_HOST_ID, name: "Demo Mac", urls: [DEMO_URL], lastUrl: DEMO_URL, key: "demo", addedAt: Date.now(), customName: true });
    }
    router.replace("/");
  }, [hosts, addHost, switchHost]);
}
