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
      // Minutes east of UTC, the same sign convention the learning log uses.
      //
      // Sent with the token rather than asked for on a screen, and it has to
      // arrive at registration rather than being derived from practice: a
      // reminder is *for* a child who has not practised, and one who never has
      // leaves no event to read a timezone from.
      tzOffsetMinutes: -new Date().getTimezoneOffset(),
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
 * Why a registration did not happen.
 *
 * Five things can stop it and they used to collapse into the single word
 * "unavailable", which the switch then discarded — so a parent pressed the
 * switch, nothing moved, and the screen said nothing. That is the same failure
 * mode `docs/PUSH.md` §7 was written about ("its failure mode is *silence*"),
 * one layer up: silence is right for a *parent's notification*, and wrong for
 * the person standing in front of a switch that will not turn on.
 *
 * Rule 3 at the top of this file still holds — nothing here throws, nothing
 * interrupts, and a parent is never shown a stack trace. What changes is that
 * the reason survives long enough for a screen to say one sentence about it.
 */
export type EnableFailure =
  /** No Firebase project baked into this build. */
  | "not-configured"
  /** The browser cannot do web push at all, or not in this context. */
  | "unsupported"
  /** FCM answered, with nothing. Almost always a VAPID key from another project. */
  | "no-token"
  /** FCM refused. `detail` carries its own error code, which is the useful part. */
  | "mint-failed"
  /** The token exists; telling our own server about it failed. */
  | "server-refused";

export type EnableOutcome =
  | { state: "on" }
  | { state: "denied" }
  | { state: "unavailable"; reason: EnableFailure; detail?: string };

/** Firebase errors carry a `code` like `messaging/token-subscribe-failed`. */
function describeError(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === "string" && code) return code;
  if (typeof message === "string" && message) return message.slice(0, 200);
  return undefined;
}

/**
 * Ask for permission and register. Returns what the parent should be told.
 *
 * Call this from a tap, never from an effect.
 */
export async function enableNotifications(): Promise<EnableOutcome> {
  const support = pushSupport();
  if (support.state === "denied") return { state: "denied" };
  if (support.state === "not-configured") {
    return { state: "unavailable", reason: "not-configured" };
  }
  if (support.state !== "granted" && support.state !== "askable") {
    return { state: "unavailable", reason: "unsupported", detail: support.state };
  }

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { state: "denied" };

  let token: string | null;
  try {
    token = await mintToken();
  } catch (error) {
    // The most informative failure there is, and the one that used to vanish.
    // `messaging/token-subscribe-failed` here almost always means the VAPID key
    // in the bundle belongs to a different Firebase project than the one the
    // service account sends from — a mismatch nothing else in the system can
    // see, because both halves are individually valid.
    return { state: "unavailable", reason: "mint-failed", detail: describeError(error) };
  }

  if (!token) return { state: "unavailable", reason: "no-token" };

  try {
    await tellTheServer(token);
    return { state: "on" };
  } catch (error) {
    // Permission was granted and FCM minted a token; only our own round trip
    // failed. The next launch re-registers, so this really is a retry — but it
    // is still worth saying, because "press it again in a minute" and "your
    // VAPID key is wrong" are different instructions.
    return { state: "unavailable", reason: "server-refused", detail: describeError(error) };
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

/**
 * Ring this account's own browsers, so a parent can check it works.
 *
 * The plain "did that arrive?" question, answerable without a staff account.
 * No recipient, and none possible.
 */
export async function testMyOwnDevices(): Promise<{ sent: number; note?: string }> {
  return await request("/push/test", { method: "POST", token: await accessToken() });
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
  /** `null` means the check could not be run — which is not a failure. */
  ok: boolean | null;
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

/**
 * Ring the caller's own browsers, and nobody else's.
 *
 * `kind` names *which wording to preview*, filled with sample values — not who
 * to send to. There is no recipient here and there must never be one.
 */
export async function sendTestNotification(kind?: string): Promise<TestSendResult> {
  return await request<TestSendResult>("/system/push/test", {
    method: "POST",
    token: await accessToken(),
    body: { kind: kind ?? null },
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

export interface NotificationRecord {
  id: string;
  kind: string;
  title: string;
  body: string;
  path: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationHistory {
  notifications: NotificationRecord[];
  unread: number;
}

/**
 * What Koda has told this account, newest first.
 *
 * The durable half of push: a lock-screen banner is gone the moment somebody
 * swipes it, and this is where it can still be found — which is also why it
 * has nothing to do with whether notifications were ever switched on.
 */
export async function notificationHistory(): Promise<NotificationHistory> {
  return await request<NotificationHistory>("/notifications", { token: await accessToken() });
}

export async function markNotificationsRead(): Promise<NotificationHistory> {
  return await request<NotificationHistory>("/notifications/read", {
    method: "POST",
    token: await accessToken(),
  });
}

export interface JobDefinition {
  id: string;
  description: string;
}

/** One line of a preview: what a parent would read, and whether they already have. */
export interface WouldSend {
  familyId: string;
  learnerId: string;
  learner: string | null;
  days: number;
  title: string;
  body: string;
  alreadySent: boolean;
  /** When this family's summary is actually due, in their own time. */
  theirSundayEvening: string;
}

export interface JobReport {
  job: string;
  preview?: boolean;
  families?: number;
  due?: number;
  summaries?: number;
  sent?: number;
  cursor?: string | null;
  skipped?: string;
  /** When the soonest family this run passed over is next due, in their time. */
  nextDue?: string | null;
  would_send?: WouldSend[];
  /** The sweep's counts. */
  tokens?: number;
  notifications?: number;
  runs?: number;
}

export interface JobRun {
  job: string;
  preview: boolean;
  report: JobReport;
}

/** Which jobs can be run by hand. Read rather than hardcoded on the screen. */
export async function notificationJobs(): Promise<JobDefinition[]> {
  const body = await request<{ jobs: JobDefinition[] }>("/system/push/jobs", {
    token: await accessToken(),
  });
  return body.jobs;
}

/**
 * Run a scheduled job now, or show what it would do.
 *
 * `preview` is the one to reach for on any day that is not Sunday: a real
 * summary run on a Tuesday correctly does nothing, because it is nobody's
 * Sunday evening, which makes it a useless way to check anything. The preview
 * drops that filter, claims nothing and sends nothing.
 */
export async function runNotificationJob(job: string, preview = false): Promise<JobRun> {
  return await request<JobRun>(
    `/system/push/jobs/${job}${preview ? "?preview=true" : ""}`,
    { method: "POST", token: await accessToken() },
  );
}

export interface SendRecord {
  id: string;
  kind: string;
  title: string;
  body: string;
  people: string[];
  familyId: string | null;
  driver: string;
  devices: number;
  delivered: number;
  /** FCM's own vocabulary, counted: `dead`, `soft`, `config`, `quota`. */
  outcomes: Record<string, number>;
  at: string;
}

export interface SendSummary {
  kind: string;
  sends: number;
  devices: number;
  delivered: number;
  last: string;
}

export interface PushLog {
  summary: SendSummary[];
  sends: SendRecord[];
}

/**
 * What this deployment has sent, and what became of it.
 *
 * Preflight answers "will a notification work" before one is sent; this answers
 * "did it" afterwards. Nothing did: the delivery outcome lived in a return
 * value and a log line, so a question asked on Monday about Sunday's summary
 * had no answer at all.
 */
export async function notificationLog(limit = 50): Promise<PushLog> {
  return await request<PushLog>(`/system/push/log?limit=${limit}`, { token: await accessToken() });
}

export interface NotificationSchedule {
  /** The hour a reminder goes out, in this account's own local time. */
  reminderHour: number;
  /** The window nothing courtesy-class arrives in. Equal values mean none. */
  quietFrom: number;
  quietTo: number;
}

export async function notificationSchedule(): Promise<NotificationSchedule> {
  return await request<NotificationSchedule>("/push/schedule", { token: await accessToken() });
}

/**
 * Change the reminder hour, or the window to be left alone in.
 *
 * One field at a time, like the switches: two browsers moving two controls at
 * the same moment must not overwrite each other.
 */
export async function setNotificationSchedule(
  patch: Partial<NotificationSchedule>,
): Promise<NotificationSchedule> {
  return await request<NotificationSchedule>("/push/schedule", {
    method: "PUT",
    token: await accessToken(),
    body: { ...patch, tzOffsetMinutes: -new Date().getTimezoneOffset() },
  });
}

/**
 * Tell the server a notification of this kind was opened.
 *
 * The other half of §9's self-limiting rule: a kind delivered eight times
 * without a tap stops being sent, and this is the only thing that ever resets
 * that. Without it the counter is a one-way door — every courtesy kind would
 * eventually switch itself off for everybody and never come back.
 *
 * A kind, not an id: what the counter measures is whether this *sort* of
 * notification is still read, and one opened weekly summary answers that for
 * weekly summaries.
 *
 * Silent and unawaited at every call site. A tap's job is to open a screen, and
 * a parent must never wait on our bookkeeping to see their child's record.
 */
export async function noteNotificationOpened(kind: string): Promise<void> {
  try {
    await request("/notifications/opened", {
      method: "POST",
      token: await accessToken(),
      body: { kind },
    });
  } catch {
    // The next tap says the same thing. A counter that is one late is a
    // notification somebody gets anyway.
  }
}
