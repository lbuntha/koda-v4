import React, { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIToggle } from "../ui";
import {
  chooseNotification,
  disableNotifications,
  enableNotifications,
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
  }, [registered, load]);

  if (support.state === "not-configured") return null;

  const turnOn = async () => {
    setBusy(true);
    const result = await enableNotifications();
    setSupport(pushSupport());
    setRegistered(notificationsAreOn());
    if (result === "on") await load();
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
