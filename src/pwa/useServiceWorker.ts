import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

/**
 * Service worker registration, surfaced as state the UI can react to.
 *
 * Registration is deliberately not fire-and-forget. Two things need to reach
 * the screen: that a new version is waiting (the child chooses when to take it,
 * so an update cannot swap the app out mid-round), and that the app is ready to
 * run offline (worth telling a parent once, before they get on a plane).
 */
export interface ServiceWorkerState {
  /** A new build is downloaded and waiting for permission to take over. */
  updateReady: boolean;
  /** Everything needed to run without a network is cached. */
  offlineReady: boolean;
  /** Apply the waiting update. Reloads the page. */
  applyUpdate(): void;
  /** Dismiss either notice without acting on it. */
  dismiss(): void;
}

export function useServiceWorker(): ServiceWorkerState {
  const [updateReady, setUpdateReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setUpdateReady(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
    });
    // Stored in a setter callback: React would otherwise call the function,
    // treating it as a state updater rather than the value.
    setUpdate(() => updateSW);
  }, []);

  return {
    updateReady,
    offlineReady,
    applyUpdate: () => {
      setUpdateReady(false);
      void update?.(true);
    },
    dismiss: () => {
      setUpdateReady(false);
      setOfflineReady(false);
    },
  };
}

/**
 * Whether the browser currently has a network.
 *
 * `navigator.onLine` only reports whether an interface exists, so it can say
 * "online" on a captive wifi that reaches nothing. That is acceptable here:
 * this drives a hint, and every feature that needs the network already fails
 * softly on its own.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}
