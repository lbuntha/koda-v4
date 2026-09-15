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
import { describeThisDevice } from "../thisDevice";

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
  /** The email channel's master. False means Koda sends no notification email. */
  emailEnabled?: boolean;
  /** Only a verified address is emailed, so the screen asks for one first. */
  emailVerified?: boolean;
  emailAddress?: string | null;
  /** The courtesy kinds this account may choose to get by email. */
  emailKinds?: NotificationKind[];
  /** "Stop all progress emails" is on. */
  emailStopped?: boolean;
}

export type NotificationChannel = "push" | "email";

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
const describeThisBrowser = describeThisDevice;

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

/** `kind` "*" on the email channel is "all progress emails". */
export async function chooseNotification(
  kind: string,
  on: boolean,
  channel: NotificationChannel = "push",
): Promise<NotificationPreferences> {
  return await request<NotificationPreferences>("/push/preferences", {
    method: "PUT",
    token: await accessToken(),
    body: { kind, on, channel },
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
  /** The email version, when this build emails the kind at all. */
  email?: EmailWording | null;
  /** Which channels it goes on. The daily digest is email only. */
  channels?: NotificationChannel[];
}

export interface EmailWording {
  subject: string;
  body: string;
  /** The kind's own placeholders plus `{parent}`, `{family}` and `{app_link}`. */
  placeholders: string[];
  edited: boolean;
}

export type EmailFramePart = "body" | "footer" | "accountFooter";

/** The greeting and footers every notification email is wrapped in. */
export interface EmailFrame {
  body: string;
  footer: string;
  accountFooter: string;
  placeholders: Record<EmailFramePart, string[]>;
  /** The placeholder a part cannot be saved without. */
  required: Partial<Record<EmailFramePart, string>>;
  edited: boolean;
}

export interface NotificationWording {
  templates: NotificationTemplate[];
  frame: EmailFrame;
}

/** Every kind's push and email wording, and the email frame. */
export async function notificationWording(): Promise<NotificationWording> {
  return await request<NotificationWording>("/system/push/templates", { token: await accessToken() });
}

export async function rewordNotificationEmail(
  kind: string,
  wording: { subject: string; body: string },
): Promise<NotificationWording> {
  return await request<NotificationWording>(`/system/push/templates/${kind}/email`, {
    method: "PATCH",
    token: await accessToken(),
    body: wording,
  });
}

export async function resetNotificationEmail(kind: string): Promise<NotificationWording> {
  return await request<NotificationWording>(`/system/push/templates/${kind}/email`, {
    method: "DELETE",
    token: await accessToken(),
  });
}

export async function rewordEmailFrame(
  frame: Pick<EmailFrame, "body" | "footer" | "accountFooter">,
): Promise<NotificationWording> {
  return await request<NotificationWording>("/system/email/frame", {
    method: "PATCH",
    token: await accessToken(),
    body: frame,
  });
}

export async function resetEmailFrame(): Promise<NotificationWording> {
  return await request<NotificationWording>("/system/email/frame", {
    method: "DELETE",
    token: await accessToken(),
  });
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

/**
 * One line of a preview: what a parent would read, and whether they already have.
 *
 * Three jobs compose three different things, so a preview line is a union
 * rather than one shape with most of its fields optional. The screen branches
 * on `run.job` — a summary line carries the Sunday it is due, a reminder line
 * carries why it would be sent, and an announcement line carries the skill.
 * Flattening them is what put a literal "Invalid Date" in front of an operator.
 */
export interface SummaryLine {
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

export interface ReminderLine {
  familyId: string;
  learnerId: string;
  learner: string | null;
  /** `learn.streak_ending` or `learn.practice_reminder` — a different reason, not a variant. */
  kind: string;
  title: string;
  body: string;
  /** Days at stake. Zero for a plain reminder, which is how the two are told apart. */
  streak: number;
  /** How many adults here have asked for this, at this hour. */
  people: number;
}

export interface AnnouncementLine {
  familyId: string;
  skillId: string;
  skill: string;
  title: string;
  body: string;
  alreadySent: boolean;
  /** The hour on this family's own clock — quiet hours are the only schedule here. */
  theirLocalHour: number;
}

export interface AbsenceLine {
  familyId: string;
  learnerId: string;
  learner: string | null;
  title: string;
  body: string;
  /** Whole days since the child last practised. */
  away: number;
  alreadySent: boolean;
}

export interface DigestLine {
  familyId: string;
  title: string;
  body: string;
  /** Parents whose digest hour this is. */
  people: number;
}

export type WouldSend = SummaryLine | ReminderLine | AnnouncementLine | AbsenceLine | DigestLine;

export interface JobReport {
  job: string;
  preview?: boolean;
  families?: number;
  due?: number;
  sent?: number;
  cursor?: string | null;
  skipped?: string;
  /** The summary's counts. */
  summaries?: number;
  /** When the soonest family this run passed over is next due, in their time. */
  nextDue?: string | null;
  /** The reminder run's counts, split by reason. */
  reminders?: number;
  streaks?: number;
  /** The announcement run's counts: skills found, families told. */
  skills?: number;
  announcements?: number;
  /** The absence check's and the digest's counts. */
  absences?: number;
  digests?: number;
  emailed?: number;
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

export type AnnouncementAudience = "families" | "staff" | "everyone";

export interface AnnouncementDraft {
  /** Blank sends as "Koda". */
  title: string;
  message: string;
  audience: AnnouncementAudience;
  /** Also email it, to the verified addresses in that audience. */
  email?: boolean;
}

export interface AnnouncementReport {
  job: "announcement";
  preview: boolean;
  audience: AnnouncementAudience;
  /** The words as sent, after the operator's wording frame is applied. */
  title?: string;
  body?: string;
  families: number;
  staff: number;
  /** Adults addressed. A parent who switched announcements off is counted but not rung. */
  people: number;
  /** Live browsers among them — a preview only. */
  devices?: number;
  /** Browsers that FCM accepted it for. Always zero on the console driver. */
  sent: number;
  /** Why nothing could be sent at all. */
  skipped?: string;
  /** Emails that left for a mail server. Present only when email was asked for. */
  emailed?: number;
  /** Verified addresses in the audience — a preview with email asked for. */
  emails?: number;
  /** Why email was asked for and not sent. */
  emailSkipped?: string;
}

/**
 * Send an announcement now, or with `preview` report who it would reach.
 *
 * An audience, never a person. The real send waits for every family to be rung
 * before it answers, so it gets a longer deadline than an ordinary request.
 */
export async function sendAnnouncement(
  draft: AnnouncementDraft,
  preview = false,
): Promise<AnnouncementReport> {
  return await request<AnnouncementReport>(
    `/system/push/announcement${preview ? "?preview=true" : ""}`,
    {
      method: "POST",
      token: await accessToken(),
      body: draft,
      ...(preview ? {} : { timeoutMs: 60_000 }),
    },
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
  channel?: NotificationChannel;
}

export interface SendSummary {
  kind: string;
  channel?: NotificationChannel;
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

export interface AudienceDevice {
  platform: string | null;
  ua: string | null;
  createdAt: string | null;
  refreshedAt: string | null;
  failures: number;
  /** Retired after repeated soft failures; the nightly sweep removes it. */
  retired: boolean;
}

export interface AudiencePerson {
  userId: string;
  email: string | null;
  name: string | null;
  role: string | null;
  familyId: string | null;
  familyName: string | null;
  devices: AudienceDevice[];
  liveDevices: number;
  /** Labels of the courtesy kinds this person currently accepts. */
  kinds: string[];
  reminderHour: number;
  quietFrom: number;
  quietTo: number;
  tzOffsetMinutes: number | null;
}

export interface PushAudience {
  people: number;
  families: number;
  liveDevices: number;
  retiredDevices: number;
  truncated: boolean;
  rows: AudiencePerson[];
}

/** Everyone who has turned notifications on, and on which browsers. Never the tokens. */
export async function notificationAudience(): Promise<PushAudience> {
  return await request<PushAudience>("/system/push/audience", { token: await accessToken() });
}

export interface PushTokenRow {
  token: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  role: string | null;
  familyId: string | null;
  familyName: string | null;
  platform: string | null;
  ua: string | null;
  createdAt: string | null;
  refreshedAt: string | null;
  failures: number;
  retired: boolean;
}

export interface PushTokenReport {
  truncated: boolean;
  rows: PushTokenRow[];
}

/** Every FCM registration token, by user. Platform admins only. */
export async function pushTokenReport(): Promise<PushTokenReport> {
  return await request<PushTokenReport>("/system/push/tokens", { token: await accessToken() });
}

export interface NotificationSchedule {
  /** The hour a reminder goes out, in this account's own local time. */
  reminderHour: number;
  /** The window nothing courtesy-class arrives in. Equal values mean none. */
  quietFrom: number;
  quietTo: number;
  /** The hour the daily digest email goes, for a parent who asked for one. */
  digestHour?: number;
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

/* ---------------------------------------------------------------- *
 * Events: every kind, its channels, and when its job runs. Staff
 * only, like everything above.
 * ---------------------------------------------------------------- */

export interface NotifyChannelState {
  /** Whether this build sends the kind on this channel at all. */
  available: boolean;
  /** The switch that turns it off for the deployment, if it has one. */
  settingId: string | null;
  on: boolean;
  /** Sent whenever the channel's master is on, with no switch of its own. */
  locked: boolean;
}

export interface NotifyEvent {
  id: string;
  label: string;
  class: string;
  push: NotifyChannelState;
  email: NotifyChannelState;
  /** The job that sends it, when a clock rather than an event does. */
  job: string | null;
}

export interface NotifyJob {
  id: string;
  description: string;
  enabled: boolean;
  /** Monday is 0 — the server's numbering. Only the weekly summary has one. */
  weekday: number | null;
  hour: number | null;
  /** Days away before a parent is told. Only the absence check has one. */
  days?: number | null;
  lastRunAt: string | null;
  lastSent: number | null;
  lastSkipped: string | null;
}

export interface NotifyEvents {
  pushEnabled: boolean;
  emailEnabled: boolean;
  pushDriver: string;
  mailDriver: string;
  events: NotifyEvent[];
  jobs: NotifyJob[];
}

export async function notifyEvents(): Promise<NotifyEvents> {
  return await request<NotifyEvents>("/system/notify/events", { token: await accessToken() });
}

/** Throw one of the deployment's switches — a channel master or a kind's own. */
export async function setNotifySwitch(settingId: string, value: boolean): Promise<void> {
  await request(`/system/settings/${settingId}`, {
    method: "PATCH",
    token: await accessToken(),
    body: { value },
  });
}

export async function setNotifyJob(
  job: string,
  patch: Partial<Pick<NotifyJob, "enabled" | "weekday" | "hour" | "days">>,
): Promise<NotifyEvents> {
  return await request<NotifyEvents>(`/system/notify/jobs/${job}`, {
    method: "PATCH",
    token: await accessToken(),
    body: patch,
  });
}

export interface EmailStatus {
  driver: string;
  from: string;
  host: string | null;
  enabled: boolean;
  you: string | null;
  youVerified: boolean;
}

export async function emailStatus(): Promise<EmailStatus> {
  return await request<EmailStatus>("/system/email/status", { token: await accessToken() });
}

export interface TestEmailResult {
  driver: string;
  sent: boolean;
  to: string | null;
  note: string | null;
}

/** Email the caller's own address. `kind` previews that kind's wording; never a recipient. */
export async function sendTestEmail(kind?: string): Promise<TestEmailResult> {
  return await request<TestEmailResult>("/system/email/test", {
    method: "POST",
    token: await accessToken(),
    body: { kind: kind ?? null },
  });
}
