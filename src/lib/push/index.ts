/**
 * Turning notifications on, keeping the token fresh, and turning them off.
 *
 * Three rules run through all of it:
 *
 * 1. **The permission prompt is raised by a tap and nothing else.** A browser
 *    gives you one refusal and then the prompt is gone for good, so asking on
 *    load — before a parent has read what it is for — is how a feature becomes
 *    permanently unavailable to the people it was for.
 * 2. **The Firebase SDK is imported only when it is needed.** It is ~60KB that
 *    a child playing a counting game offline never has to download, so it
 *    arrives as its own chunk at the moment somebody turns the switch on.
 * 3. **Nothing here is allowed to fail loudly.** This is a courtesy channel;
 *    a stalled registration must never produce an error a parent has to read,
 *    and `request()` already puts a deadline on the call so an unstable
 *    connection queues rather than hangs.
 */

import { request } from "../sync/api";
import { accessToken } from "../sync/session";
import { firebaseConfig, pushSupport } from "./support";

export { pushSupport } from "./support";
export type { PushSupport } from "./support";

/** The token this browser last told the server about. */
const TOKEN_KEY = "koda_push_token_v1";

export interface NotificationKind {
  id: string;
  label: string;
  on: boolean;
}

export interface NotificationPreferences {
  /** The deployment's master switch. False means Koda sends nothing here. */
  enabled: boolean;
  kinds: NotificationKind[];
}

/**
 * Whether *this browser* is currently signed up to be rung.
 *
 * Deliberately not `Notification.permission === "granted"`. Permission is
 * granted once and then stays granted for good — a browser has no way to
 * withdraw it on the site's behalf — so a switch that reads permission springs
 * back to on the instant somebody turns it off. What "on" means here is that a
 * token exists *and* the server has been told about it, which is exactly what
 * turning the switch off undoes.
 */
export function notificationsAreOn(): boolean {
  return (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    remembered() !== null
  );
}

function remembered(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function remember(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // A browser with storage disabled still gets notifications; it just
    // re-registers every launch, which the server treats as one row.
  }
}

/**
 * Mint a registration token, bound to Koda's own service worker.
 *
 * `serviceWorkerRegistration` is the argument that matters: without it the
 * Firebase SDK registers `firebase-messaging-sw.js` itself, which is a second
 * worker on this origin — the thing `docs/PUSH.md` §3 exists to avoid.
 */
async function mintToken(): Promise<string | null> {
  const config = firebaseConfig();
  if (!config) return null;

  const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);

  if (!(await isSupported())) return null;

  const app = getApps()[0] ?? initializeApp(config);
  const registration = await navigator.serviceWorker.ready;

  return await getToken(getMessaging(app), {
    vapidKey: config.vapidKey,
    serviceWorkerRegistration: registration,
  });
}

async function tellTheServer(token: string): Promise<void> {
  await request("/push/tokens", {
    method: "POST",
    token: await accessToken(),
    body: {
      token,
      ua: navigator.userAgent.slice(0, 400),
      platform: describeThisBrowser(),
    },
  });
  remember(token);
}

/** "Chrome on Android" — what a device list can print instead of a token. */
function describeThisBrowser(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const platform = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Macintosh/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : "this device";
  return `${browser} on ${platform}`;
}

/**
 * Ask for permission and register. Returns what the parent should be told.
 *
 * Call this from a tap, never from an effect.
 */
export async function enableNotifications(): Promise<"on" | "denied" | "unavailable"> {
  const support = pushSupport();
  if (support.state === "denied") return "denied";
  if (support.state !== "granted" && support.state !== "askable") return "unavailable";

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  try {
    const token = await mintToken();
    if (!token) return "unavailable";
    await tellTheServer(token);
    return "on";
  } catch {
    // Permission was granted; only the round trip failed. The next launch
    // re-registers, so this is a retry rather than a failure to report.
    return "unavailable";
  }
}

/** Stop this browser being rung. Local state goes even if the request does not. */
export async function disableNotifications(): Promise<void> {
  const token = remembered();
  remember(null);
  if (!token) return;
  try {
    await request(`/push/tokens/${encodeURIComponent(token)}`, {
      method: "DELETE",
      token: await accessToken(),
    });
  } catch {
    // The row also dies with the device on sign-out, so a failure here costs
    // at most one more notification.
  }
}

/**
 * Re-register on launch when — and only when — the token has changed.
 *
 * FCM rotates tokens on its own schedule. A device that registered once and
 * never again goes quiet after a rotation, and nobody finds out: no error, no
 * bounce, just a parent who stops hearing from Koda.
 */
export async function refreshNotificationToken(): Promise<void> {
  if (pushSupport().state !== "granted") return;
  // Only for a browser that is *opted in*. Refreshing on permission alone would
  // quietly re-register the browser of somebody who had just turned
  // notifications off, on their very next launch — an opt-out that does not
  // survive a reload is not an opt-out.
  if (remembered() === null) return;
  try {
    const token = await mintToken();
    if (token && token !== remembered()) await tellTheServer(token);
  } catch {
    // Offline, most likely. Next launch.
  }
}

export async function notificationPreferences(): Promise<NotificationPreferences> {
  return await request<NotificationPreferences>("/push/preferences", { token: await accessToken() });
}

export async function chooseNotification(kind: string, on: boolean): Promise<NotificationPreferences> {
  return await request<NotificationPreferences>("/push/preferences", {
    method: "PUT",
    token: await accessToken(),
    body: { kind, on },
  });
}

/* ---------------------------------------------------------------- *
 * The operator's two functions. Staff only — the API refuses anyone
 * without `system:write`, so nothing below is a second gate, only the
 * shape of the answer.
 * ---------------------------------------------------------------- */

export interface PreflightCheck {
  check: string;
  ok: boolean;
  detail: string;
  /** Present only when the check failed: the sentence that fixes it. */
  fix: string | null;
}

export interface Preflight {
  ok: boolean;
  checks: PreflightCheck[];
}

export interface TestSendResult {
  driver: string;
  sent: number;
  results: { device: string; ok: boolean; error?: string | null }[];
  note?: string;
}

/** Is push actually working here? Answered without sending anything. */
export async function pushPreflight(): Promise<Preflight> {
  return await request<Preflight>("/system/push/preflight", { token: await accessToken() });
}

/** Ring the caller's own browsers, and nobody else's. Takes no recipient. */
export async function sendTestNotification(): Promise<TestSendResult> {
  return await request<TestSendResult>("/system/push/test", {
    method: "POST",
    token: await accessToken(),
  });
}

export interface NotificationTemplate {
  id: string;
  label: string;
  class: string;
  title: string;
  body: string;
  /** What a sender may substitute — `{device}`, `{learner}` and so on. */
  placeholders: string[];
  /** Whether these are the shipped words or somebody's edit. */
  edited: boolean;
}

export async function notificationTemplates(): Promise<NotificationTemplate[]> {
  const body = await request<{ templates: NotificationTemplate[] }>("/system/push/templates", {
    token: await accessToken(),
  });
  return body.templates;
}

export async function rewordNotification(
  kind: string,
  wording: { title: string; body: string },
): Promise<NotificationTemplate[]> {
  const body = await request<{ templates: NotificationTemplate[] }>(
    `/system/push/templates/${kind}`,
    { method: "PATCH", token: await accessToken(), body: wording },
  );
  return body.templates;
}

/** Back to the words the code ships. */
export async function resetNotificationWording(kind: string): Promise<NotificationTemplate[]> {
  const body = await request<{ templates: NotificationTemplate[] }>(
    `/system/push/templates/${kind}`,
    { method: "DELETE", token: await accessToken() },
  );
  return body.templates;
}
