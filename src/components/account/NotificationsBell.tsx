import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import {
  markNotificationsRead,
  notificationHistory,
  type NotificationRecord,
} from "../../lib/push";

/**
 * What Koda has told you, where you can go back and read it.
 *
 * A push notification is gone the moment somebody swipes it away. For a
 * courtesy that costs nothing — a missed "goal met" is a missed pleasantry —
 * but "a new device signed in" is a security notice, and one nobody can check
 * afterwards is not much of one. So the record is written whether or not a
 * notification was ever delivered, and this is where it is read.
 *
 * Which also means this works for somebody who never turned notifications on,
 * or whose phone was off, or who is on an iPhone in a Safari tab where web
 * push does not exist. That is the point of keeping it.
 */
function whenSent(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export const NotificationsBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRecord[]>([]);
  const [unread, setUnread] = useState(0);
  const holder = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const history = await notificationHistory();
      setRows(history.notifications);
      setUnread(history.unread);
    } catch {
      // Offline. The bell simply shows what it last knew, which is better than
      // an error over a feature nobody opened this app for.
    }
  }, []);

  useEffect(() => void load(), [load]);

  // The worker tells the page when a push arrives, so a notification that
  // lands while Koda is open updates the bell rather than waiting for a reload.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === "KODA_PUSH") void load();
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      await load();
      // Opening the list is reading it: a badge that survives being looked at
      // is a badge people stop looking at.
      if (unread) {
        const history = await markNotificationsRead();
        setRows(history.notifications);
        setUnread(0);
      }
    }
  };

  return (
    <div className="relative" ref={holder}>
      <button
        onClick={() => void toggle()}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          /* A dot, not a number: the count is in the list, and a badge reading
             "23" on a screen a child may be looking at is a demand rather than
             a note. */
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-surface" />
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] ${themeSystem.card(
            "default",
            "p-0 overflow-hidden",
          )}`}
        >
          <div className="border-b border-line px-4 py-3">
            <h3 className="font-mono text-xs font-black uppercase tracking-wider text-muted">
              Notifications
            </h3>
          </div>

          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Nothing yet. Koda will tell you here when something happens on your account.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {rows.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-bold text-ink">{row.title}</p>
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {whenSent(row.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-body">{row.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
