import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, GraduationCap, Inbox, ShieldCheck, Sparkles } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIPageHeader } from "../ui";
import {
  markNotificationsRead,
  notificationHistory,
  type NotificationRecord,
} from "../../lib/push";
import { openNotification } from "../../lib/push/landing";

/**
 * Everything Koda has told this account, with room to read it.
 *
 * The bell is a glance — the last few, in a dropdown, on the way past. This is
 * the page you open when you are actually looking for something, and the
 * difference is not length but *shape*: a flat list of thirty is a wall
 * whichever way you scroll it.
 *
 * So two axes, and they answer different questions. **Category** answers "was
 * this about my account or about my child" — the same split §5 makes between
 * the account class and the courtesy class, which is the real division: one is
 * security, one is a pleasantry, and somebody hunting for "when did that device
 * sign in" should not be reading past a fortnight of good afternoons. **Day**
 * answers "when", and it is the order inside each category rather than a
 * competing filter, because a notification's date is how people remember it.
 *
 * The record exists whether or not a push was ever delivered, which is what
 * makes this page worth having at all: it works for somebody who never turned
 * notifications on, whose phone was off, or who is on an iPhone in a Safari tab
 * where web push does not exist.
 */

type Category = "all" | "learning" | "account";

/**
 * Which category a kind belongs to.
 *
 * Read off the kind id's own prefix rather than sent by the server. The id is
 * already `learn.goal_met` and `device.new_signin` — the grouping is a fact
 * about the name, and asking the API to repeat it would be a second place for
 * the two to disagree. Anything unrecognised is *account*: a notification
 * nobody has categorised is more likely to be about the account than about a
 * child, and the safer place to put an unknown is where somebody will see it.
 */
const categoryOf = (kind: string): Exclude<Category, "all"> =>
  kind.startsWith("learn.") ? "learning" : "account";

const ICONS: Record<string, React.ReactNode> = {
  "learn.goal_met": <Sparkles className="h-4 w-4 text-violet-500" />,
  "learn.weekly_summary": <GraduationCap className="h-4 w-4 text-sky-500" />,
  "learn.practice_reminder": <Bell className="h-4 w-4 text-emerald-500" />,
  "learn.streak_ending": <Bell className="h-4 w-4 text-rose-500" />,
};

/** A kind without artwork of its own still gets its category's mark. */
const iconFor = (kind: string): React.ReactNode =>
  ICONS[kind] ??
  (categoryOf(kind) === "learning" ? (
    <GraduationCap className="h-4 w-4 text-sky-500" />
  ) : (
    <ShieldCheck className="h-4 w-4 text-indigo-500" />
  ));

/** The day a notification belongs to, as a person would say it. */
function dayOf(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Earlier";
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "long" });
  return then.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function timeOf(iso: string): string {
  const then = new Date(iso);
  return Number.isNaN(then.getTime())
    ? ""
    : then.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const TABS: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "learning", label: "Learning" },
  { id: "account", label: "Account" },
];

export const NotificationsPage: React.FC = () => {
  const [rows, setRows] = useState<NotificationRecord[]>([]);
  const [wasNew, setWasNew] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<Category>("all");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const history = await notificationHistory();
      // Remember what was unread *before* reading the page marks it read, so a
      // reader can still see which of these they had not seen. The badge
      // clears; the answer stays on screen until they leave.
      setWasNew(new Set(history.notifications.filter((row) => !row.read).map((row) => row.id)));
      setRows(history.notifications);
      if (history.unread) setRows((await markNotificationsRead()).notifications);
    } catch {
      // Offline. An empty page says "nothing yet", which is wrong but harmless;
      // an error banner over a list of pleasantries is worse.
    }
    setLoaded(true);
  }, []);

  useEffect(() => void load(), [load]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      learning: rows.filter((row) => categoryOf(row.kind) === "learning").length,
      account: rows.filter((row) => categoryOf(row.kind) === "account").length,
    }),
    [rows],
  );

  const shown = useMemo(
    () => (category === "all" ? rows : rows.filter((row) => categoryOf(row.kind) === category)),
    [rows, category],
  );

  const groups = useMemo(() => {
    const out: { day: string; rows: NotificationRecord[] }[] = [];
    for (const row of shown) {
      const day = dayOf(row.createdAt);
      if (out.at(-1)?.day === day) out.at(-1)!.rows.push(row);
      else out.push({ day, rows: [row] });
    }
    return out;
  }, [shown]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <UIPageHeader
        eyebrow="Your account"
        title="Notifications"
        subtitle="What Koda has told you — kept here whether or not it reached your phone."
      />

      {/* One tab is not a choice, so an account with only one kind of
          notification is not asked to make one. */}
      {counts.learning > 0 && counts.account > 0 && (
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              aria-pressed={category === tab.id}
              className={
                category === tab.id
                  ? themeSystem.button("primary", "sm")
                  : themeSystem.button("secondary", "sm")
              }
            >
              {tab.label}
              <span className="ml-2 font-mono text-[10px] opacity-70">{counts[tab.id]}</span>
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <div className={themeSystem.card("default", `${themeSystem.spacing.card} text-center`)}>
          <Inbox className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 text-sm text-ink">
            {!loaded
              ? "Reading…"
              : rows.length === 0
                ? "Nothing yet."
                : "Nothing in this category."}
          </p>
          {loaded && rows.length === 0 && (
            <p className="mt-1 text-xs text-muted">
              Koda will tell you here when something happens on your account, or when one of your
              children reaches something worth hearing about.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ day, rows: group }) => (
            <section key={day} className="space-y-2">
              <h3 className="font-mono text-[10px] font-black uppercase tracking-wider text-muted">
                {day}
              </h3>
              <div className={themeSystem.card("default", "divide-y divide-line p-0")}>
                {group.map((row) => (
                  /*
                    A button, because every one of these is about something —
                    a child's record, a device, a plan. The path has been in the
                    payload since phase 2; the list was the last place a tap did
                    nothing.
                  */
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => openNotification(row.path, row.kind)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-muted focus:outline-none focus-visible:bg-surface-muted"
                  >
                    <span className="mt-0.5 shrink-0">{iconFor(row.kind)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                          {row.title}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted">
                          {timeOf(row.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-body">{row.body}</span>
                    </span>
                    {wasNew.has(row.id) && (
                      <>
                        <span
                          aria-hidden
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                        />
                        <span className="sr-only">New</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
