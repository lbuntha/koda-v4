import React, { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIToggle } from "../ui";
import {
  chooseNotification,
  disableNotifications,
  enableNotifications,
  notificationSchedule,
  setNotificationSchedule,
  type EnableOutcome,
  type NotificationSchedule,
  notificationPreferences,
  notificationsAreOn,
  pushSupport,
  testMyOwnDevices,
  type NotificationKind,
} from "../../lib/push";

/**
 * Notifications, from a parent's side of the screen.
 *
 * The browser gives you exactly one permission prompt, and a refusal is
 * permanent — so this is the only place in Koda that raises one, it is raised
 * by a tap on the switch below, and it is never rendered for a child's session.
 *
 * "Off" has four different meanings and only one of them is a dead end, so each
 * gets its own sentence rather than a disabled switch:
 *
 * * **needs-install** — iOS in a tab. Web push there needs the app on the Home
 *   Screen, so this is an instruction, not a failure.
 * * **denied** — the browser is blocking it and will not ask again. Saying
 *   where to undo it is the only useful thing left.
 * * **unsupported** — genuinely nothing to offer.
 * * **not-configured** — this deployment has no Firebase project, so the whole
 *   section is absent rather than offering a switch that cannot work.
 */
export const NotificationsSettings: React.FC = () => {
  const l = themeSystem.list;
  const [support, setSupport] = useState(() => pushSupport());
  /*
   * Whether this browser is registered — which is what the switch shows.
   *
   * Separate from `support`, because permission and registration part company
   * the moment somebody turns notifications off: the browser keeps the
   * permission for good, and only this says whether Koda is still allowed to
   * use it.
   */
  const [registered, setRegistered] = useState(() => notificationsAreOn());
  const [kinds, setKinds] = useState<NotificationKind[] | null>(null);
  const [deploymentSends, setDeploymentSends] = useState(true);
  const [busy, setBusy] = useState(false);
  /** What the last "send me one" attempt did, in a sentence. */
  const [tested, setTested] = useState<string | null>(null);
  /* Why the switch would not turn on. Cleared on the next attempt, so a
     stale reason never sits under a switch that has since worked. */
  const [trouble, setTrouble] = useState<string | null>(null);
  /* When this account may be rung: the reminder hour, and the window to be
     left alone in. Loaded with the switches, because it is only meaningful
     once notifications are on. */
  const [schedule, setSchedule] = useState<NotificationSchedule | null>(null);

  /**
   * An hour, written the way a person says it.
   *
   * Not `toLocaleTimeString` on a made-up date: this is a bare hour with no
   * day behind it, and formatting one through a Date is how "9 pm" becomes
   * "21:00" on one device and "9:00 PM" on another for no reason a reader
   * could name.
   */
  const hourLabel = (hour: number): string => {
    if (hour === 0) return "midnight";
    if (hour === 12) return "midday";
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  };

  const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

  const changeSchedule = async (patch: Partial<NotificationSchedule>) => {
    setBusy(true);
    try {
      setSchedule(await setNotificationSchedule(patch));
    } catch {
      // A courtesy setting that could not be saved is not an error a parent has
      // to read; the control springs back and the next attempt is a tap away.
      setSchedule(await notificationSchedule().catch(() => schedule));
    }
    setBusy(false);
  };

  const load = useCallback(async () => {
    try {
      const prefs = await notificationPreferences();
      setDeploymentSends(prefs.enabled);
      setKinds(prefs.kinds);
    } catch {
      // Offline, most likely. The switches are a courtesy; not drawing them is
      // better than an error a parent has to read.
      setKinds(null);
    }
  }, []);

  useEffect(() => {
    if (registered) void load();
    if (registered) void notificationSchedule().then(setSchedule).catch(() => setSchedule(null));
  }, [registered, load]);

  if (support.state === "not-configured") return null;

  const turnOn = async () => {
    setBusy(true);
    setTrouble(null);
    const result = await enableNotifications();
    setSupport(pushSupport());
    setRegistered(notificationsAreOn());
    if (result.state === "on") await load();
    // The switch used to discard this. A parent pressed it, nothing moved, and
    // the screen said nothing — which is the one outcome a switch may never
    // have. `denied` already has its own sentence in `note()`; this is for the
    // five ways registration can fail *after* permission was granted.
    if (result.state === "unavailable") setTrouble(explain(result));
    setBusy(false);
  };

  const turnOff = async () => {
    setBusy(true);
    await disableNotifications();
    setKinds(null);
    // The permission itself stays granted — only the browser's own settings can
    // undo that — so what changes here is registration, and that is what the
    // switch is bound to.
    setSupport(pushSupport());
    setRegistered(notificationsAreOn());
    setBusy(false);
  };

  const sendMyself = async () => {
    setBusy(true);
    setTested(null);
    try {
      const result = await testMyOwnDevices();
      setTested(
        result.sent > 0
          ? `Sent to ${result.sent === 1 ? "this browser" : `${result.sent} browsers`}. It should arrive in a moment.`
          : (result.note ?? "Nothing was sent."),
      );
    } catch {
      setTested("That could not be sent. Try again in a minute.");
    }
    setBusy(false);
  };

  const toggleKind = async (kind: NotificationKind) => {
    // Moved first, then confirmed: a switch that waits on a round trip before
    // it moves feels broken on a slow connection.
    setKinds((current) =>
      (current ?? []).map((k) => (k.id === kind.id ? { ...k, on: !k.on } : k)),
    );
    try {
      const prefs = await chooseNotification(kind.id, !kind.on);
      setKinds(prefs.kinds);
    } catch {
      void load();
    }
  };

  /**
   * One sentence for a parent, and the detail underneath for whoever is fixing
   * it. Both, because the two readers are often the same person on a laptop
   * setting a deployment up — and because "it did not work" is exactly the
   * answer preflight exists to improve on.
   */
  const explain = (result: Extract<EnableOutcome, { state: "unavailable" }>): string => {
    const detail = result.detail ? ` (${result.detail})` : "";
    switch (result.reason) {
      case "not-configured":
        return "Notifications are not set up on this service yet.";
      case "unsupported":
        return `This browser cannot show notifications${detail}.`;
      case "no-token":
        return `Your browser allowed it, but the notification service returned nothing${detail}. On a deployment this usually means the Web Push certificate belongs to a different Firebase project.`;
      case "mint-failed":
        return `Your browser allowed it, but the notification service refused to register it${detail}. Try again in a moment; if it keeps happening, the Web Push certificate is the thing to check.`;
      case "server-refused":
        return `Your browser is ready — Koda could not record it${detail}. It will try again next time you open the app.`;
    }
  };

  const note = (): string => {
    switch (support.state) {
      case "granted":
        if (!registered) return "Turn this on to be told about the things you choose.";
        return deploymentSends
          ? "This browser will be told about the things you pick below."
          : "Koda is not sending notifications on this service right now.";
      case "needs-install":
        return "Add Koda to your Home Screen to get these on an iPhone or iPad.";
      case "denied":
        return "Your browser is blocking notifications for Koda. Turn them back on in its site settings.";
      case "unsupported":
        return "This browser cannot show notifications.";
      default:
        return "A summary of how your child is getting on, sent to this browser.";
    }
  };

  const canAsk = support.state === "askable" || support.state === "granted";
  const on = registered;

  return (
    <section>
      <div className={l.groupLabel}>Notifications</div>
      <div className={l.group}>
        <div className={l.row}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={l.rowIcon}>
              {support.state === "needs-install" ? (
                <Smartphone className="text-ink" />
              ) : on ? (
                <Bell className="text-ink" />
              ) : (
                <BellOff className="text-ink" />
              )}
            </span>
            <div className="min-w-0">
              <h4 className={l.rowTitle}>Notifications on this device</h4>
              <p className={l.rowNote}>{note()}</p>
            </div>
          </div>
          {canAsk && (
            <UIToggle
              checked={on}
              disabled={busy}
              onChange={() => void (on ? turnOff() : turnOn())}
              label="Notifications on this device"
            />
          )}
        </div>

        {trouble && (
          <div className={l.row}>
            {/* Under the switch, not in a toast: it explains the control the
                reader is looking at, and it has to survive being read twice. */}
            <p className="text-xs text-rose-600 dark:text-rose-400 break-words">{trouble}</p>
          </div>
        )}

        {on &&
          deploymentSends &&
          (kinds ?? []).map((kind) => (
            <div key={kind.id} className={l.row}>
              <div className="flex items-center gap-3 min-w-0">
                <span className={l.rowIcon} aria-hidden />
                <h4 className={l.rowTitle}>{kind.label}</h4>
              </div>
              <UIToggle
                checked={kind.on}
                onChange={() => void toggleKind(kind)}
                label={kind.label}
              />
            </div>
          ))}

        {/*
          When, rather than whether. Drawn under the switches it governs and
          only once a kind that uses it is on: a reminder hour means nothing to
          somebody who has not asked for reminders, and quiet hours mean nothing
          to a browser that is not being rung at all.
        */}
        {on && deploymentSends && schedule && (kinds ?? []).some((k) => k.on) && (
          <>
            {(kinds ?? []).some(
              (k) => k.on && (k.id === "learn.practice_reminder" || k.id === "learn.streak_ending"),
            ) && (
              <div className={l.row}>
                <div className="min-w-0">
                  <h4 className={l.rowTitle}>Remind me at</h4>
                  <p className={l.rowNote}>
                    Once a day at most, and only when they have not had a go yet.
                  </p>
                </div>
                <select
                  disabled={busy}
                  value={schedule.reminderHour}
                  onChange={(e) => void changeSchedule({ reminderHour: Number(e.target.value) })}
                  aria-label="The hour to be reminded at"
                  className="bg-surface border border-line rounded-2xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-indigo-500"
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hourLabel(hour)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={l.row}>
              <div className="min-w-0">
                <h4 className={l.rowTitle}>Quiet hours</h4>
                <p className={l.rowNote}>
                  {schedule.quietFrom === schedule.quietTo
                    ? "Off — anything you have turned on can arrive at any hour."
                    : `Nothing arrives between ${hourLabel(schedule.quietFrom)} and ${hourLabel(
                        schedule.quietTo,
                      )}. A new sign-in still does — that one is about your account.`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  disabled={busy}
                  value={schedule.quietFrom}
                  onChange={(e) => void changeSchedule({ quietFrom: Number(e.target.value) })}
                  aria-label="Quiet hours start"
                  className="bg-surface border border-line rounded-2xl px-2 py-2 text-sm text-ink focus:outline-none focus:border-indigo-500"
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hourLabel(hour)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted">to</span>
                <select
                  disabled={busy}
                  value={schedule.quietTo}
                  onChange={(e) => void changeSchedule({ quietTo: Number(e.target.value) })}
                  aria-label="Quiet hours end"
                  className="bg-surface border border-line rounded-2xl px-2 py-2 text-sm text-ink focus:outline-none focus:border-indigo-500"
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hourLabel(hour)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {on && deploymentSends && (
          <div className={l.row}>
            <div className="min-w-0">
              <h4 className={l.rowTitle}>Send me one now</h4>
              <p className={l.rowNote}>
                {tested ?? "Checks that notifications actually arrive on this device."}
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() => void sendMyself()}
              className={themeSystem.button("secondary", "sm")}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
