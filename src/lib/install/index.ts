/**
 * "Add to home screen": what this browser can do, and the one-tap install
 * where it exists.
 *
 * Chrome, Edge and Samsung Internet hand a page a `beforeinstallprompt` event
 * when the app is installable; holding on to it is what lets our own button
 * open the browser's install box. The event can fire before React has drawn
 * anything, so the listener is attached when this module is first imported
 * (main.tsx imports it at boot), not when the menu opens.
 *
 * Safari on iPhone and iPad has no such event — Apple lets no site install
 * itself — so there the button explains Share → Add to Home Screen. In-app
 * browsers (Facebook, Messenger, Instagram…) cannot install at all; the person
 * has to open the link in Chrome or Safari first.
 */
import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallKind =
  /** Already running as an installed app: offer nothing. */
  | "installed"
  /** The browser's own install box is one tap away. */
  | "prompt"
  /** iPhone/iPad: every browser goes through Share → Add to Home Screen. */
  | "ios"
  /** Facebook, Messenger and friends: open in a real browser first. */
  | "in-app"
  /** A phone browser with no prompt to give: its menu has the item. */
  | "manual"
  /** A computer whose browser offers no install: nothing worth showing. */
  | "unsupported";

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep it for our button instead of the browser's own mini-bar.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * Where an iPhone or iPad keeps the Share button, so the guide can point at it.
 *
 * - `bottom`: Safari on iPhone up to 18, the middle of the bottom bar.
 * - `more`: Safari 26 on iPhone, inside the ••• button at the bottom right.
 * - `top`: Safari on iPad, and Chrome on iPhone and iPad, at the top right.
 * - `menu`: Firefox and Edge, inside their menu at the bottom right.
 */
export type ShareSpot = "bottom" | "more" | "top" | "menu";

export function shareSpot(ua: string = navigator.userAgent): ShareSpot {
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (/CriOS/.test(ua)) return "top";
  if (/FxiOS|EdgiOS/.test(ua)) return "menu";
  if (ipad) return "top";
  const safari = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
  return safari >= 26 ? "more" : "bottom";
}

export function installKind(ua: string = navigator.userAgent): InstallKind {
  if (installedNow || isStandalone()) return "installed";
  if (/FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|MicroMessenger|TikTok|Snapchat/i.test(ua)) return "in-app";
  if (deferred) return "prompt";
  const apple = /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  if (apple) return "ios";
  if (/Android|Mobile/i.test(ua)) return "manual";
  return "unsupported";
}

/** Open the browser's install box. Resolves with what the person chose. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  // A prompt can be shown once; the browser sends a fresh event if it may ask again.
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installedNow = true;
  notify();
  return outcome;
}

// ------------------------------------------------------------ the guide

let help: InstallKind | null = null;

/** The steps the guide is showing, or null when it is closed. */
export const installHelp = () => help;

export function closeInstallHelp(): void {
  help = null;
  notify();
}

/**
 * What the "Add to home screen" buttons do: the browser's own install box
 * where there is one, otherwise the guide for this browser.
 */
export async function startInstall(): Promise<void> {
  const kind = installKind();
  if (kind === "installed" || kind === "unsupported") return;
  if (kind === "prompt" && (await promptInstall()) !== "unavailable") return;
  help = kind === "prompt" ? "manual" : kind;
  notify();
}

/** Re-render when the install state or the guide changes. */
export function useInstallState(): void {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
    () => version,
  );
}

/** The current kind, re-read whenever the browser's answer changes. */
export function useInstallKind(): InstallKind {
  useInstallState();
  return typeof window === "undefined" ? "unsupported" : installKind();
}
