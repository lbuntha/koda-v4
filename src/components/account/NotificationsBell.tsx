import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import {
  markNotificationsRead,
  notificationHistory,
  type NotificationRecord,
} from "../../lib/push";
import { openNotification } from "../../lib/push/landing";

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
/**
 * Which day a notification belongs to, as a person would say it.
 *
 * Thirty rows each stamped "3 h ago" or "12 Sep" is a wall: the eye has
 * nothing to rest on and no sense of how far back it has scrolled. A heading
 * per day gives the list a shape, and "Today" and "Yesterday" are what the two
 * that matter most are actually called.
 */
function dayOf(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Earlier";
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "long" });
  return then.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

/** The rows, in order, split into the days they happened on. */
function byDay(rows: NotificationRecord[]): { day: string; rows: NotificationRecord[] }[] {
  const groups: { day: string; rows: NotificationRecord[] }[] = [];
  for (const row of rows) {
    const day = dayOf(row.createdAt);
    if (groups.at(-1)?.day === day) groups.at(-1)!.rows.push(row);
    else groups.push({ day, rows: [row] });
  }
  return groups;
}

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
  /* Which rows were unread when the panel was opened. Held separately
     because opening marks them read on the server, and the highlight has to
     outlive that or the reader never sees what was new. */
  const [wasNew, setWasNew] = useState<Set<string>>(new Set());

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
    if (!next) {
      // Closing forgets what was new. Re-opening should not re-highlight rows
      // somebody has already been shown.
      setWasNew(new Set());
      return;
    }

    await load();
    // Opening the list is reading it: a badge that survives being looked at is
    // a badge people stop looking at.
    //
    // But marking everything read is also how the list erases the one thing
    // the reader came for — *which of these is new*. So the ids are kept for
    // as long as the panel is open, and the rows they name stay marked. The
    // badge clears immediately; the answer stays on screen.
    if (unread) {
      const history = await markNotificationsRead();
      setWasNew(new Set(rows.filter((row) => !row.read).map((row) => row.id)));
      setRows(history.notifications);
      setUnread(0);
    }
  };

  /** Follow a notification to whatever it is about. */
  const follow = (row: NotificationRecord) => {
    setOpen(false);
    setWasNew(new Set());
    openNotification(row.path, row.kind);
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
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h3 className="font-mono text-xs font-black uppercase tracking-wider text-muted">
              Notifications
            </h3>
            {/* The bell is a glance and the page is a search. A dropdown is the
                wrong shape for "when did that device sign in", so it says where
                the right one is rather than growing into it. */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setWasNew(new Set());
                openNotification("/notifications");
              }}
              className="font-mono text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:underline dark:text-indigo-400"
            >
              See all
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Nothing yet. Koda will tell you here when something happens on your account.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {byDay(rows).map(({ day, rows: group }) => (
                <section key={day}>
                  <h4 className="sticky top-0 z-10 bg-surface-muted/95 px-4 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-muted backdrop-blur">
                    {day}
                  </h4>
                  <ul className="divide-y divide-line">
                    {group.map((row) => (
                      <li key={row.id}>
                        {/*
                          A button, because every one of these is about
                          something: a child's record, a device, a plan. The
                          path has been in the payload since phase 2 and the
                          worker has followed it since phase 3 — the list was
                          the only place a tap did nothing.
                        */}
                        <button
                          type="button"
                          onClick={() => follow(row)}
                          className="w-full px-4 py-3 text-left transition hover:bg-surface-muted focus:outline-none focus-visible:bg-surface-muted"
                        >
                          <div className="flex items-baseline gap-2">
                            {/* The dot marks what was new when this was opened,
                                and outlives the read that opening performed. */}
                            <span
                              aria-hidden
                              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                                wasNew.has(row.id) ? "bg-indigo-500" : "bg-transparent"
                              }`}
                            />
                            <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                              {row.title}
                            </p>
                            <span className="shrink-0 font-mono text-[10px] text-muted">
                              {whenSent(row.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 pl-3.5 text-xs text-body">{row.body}</p>
                          {wasNew.has(row.id) && <span className="sr-only">New</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
