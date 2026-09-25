import React, { useEffect, useState } from "react";
import { CheckCircle2, Flame, Hand, Plus, UserRound } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIAvatar, UIBanner, UIButton } from "../ui";
import { usePermissions, useSession } from "../../lib/sync";
import {
  cachedChildrenOverview,
  refreshChildrenOverview,
  isChildrenOverview,
  type ChildOverview,
  type StoredOverview,
} from "../../lib/childrenOverview";

/**
 * "Your children" — the first thing a parent sees on Home.
 *
 * One row per child: today's time, a met goal and a streak worth naming, or how
 * long it has been. Above them at most one banner, for a child away longer than
 * the absence threshold, worded by the absence message an admin can edit. A
 * tap opens that child's report.
 *
 * Parents only (`learner:create`). A family with no children gets an invitation
 * rather than a heading with nothing under it — this is the first thing a
 * parent sees on their first day, and the one action they need to take.
 *
 * Only once the answer is actually known. `data` is null while the first fetch
 * is in flight, and drawing "add your first child" then would greet a parent who
 * has three of them with an invitation to make one.
 */

/** What a child's row says under their name. */
export const dayOf = (child: ChildOverview): string => {
  if (child.today.rounds > 0) {
    return child.today.minutes < 1 ? "Practised today" : `${child.today.minutes} min today`;
  }
  if (child.daysAway === null) return "Hasn't started yet";
  if (child.daysAway <= 1) return "Last practised yesterday";
  return `Last practised ${child.daysAway} days ago`;
};

const ago = (savedAt: number, now: number): string => {
  const minutes = Math.round((now - savedAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};

export const ChildrenOverview: React.FC<{
  onOpenChild?: (learnerId: string) => void;
  /** Takes a parent to the Children page, where a profile is actually made. */
  onAddChild?: () => void;
}> = ({ onOpenChild, onAddChild }) => {
  const session = useSession();
  const { can } = usePermissions();
  const userId = session?.userId ?? null;
  const isParent = Boolean(session && !session.learnerId && can("learner:create"));
  const [data, setData] = useState<StoredOverview | null>(() => (userId ? cachedChildrenOverview(userId) : null));
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!isParent || !userId) return;
    let cancelled = false;
    setData(cachedChildrenOverview(userId));
    void refreshChildrenOverview(userId)
      .then((fresh) => {
        if (cancelled) return;
        setData(fresh);
        setStale(false);
      })
      .catch(() => {
        if (!cancelled) setStale(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isParent, userId]);

  if (!isParent || !data || !isChildrenOverview(data.overview)) return null;

  /*
   * A family of nobody yet.
   *
   * Koda is for the children, so an account with none has nothing to show and
   * exactly one thing to do. Saying so here beats the alternative this replaced:
   * Home fell through to its learner's empty state and told a parent to build
   * *their* learning list, which is not what they came for and not what the
   * button under it did.
   */
  if (data.overview.children.length === 0) {
    return (
      <section aria-labelledby="your-children" className={themeSystem.card("default", "p-6 text-center")}>
        <UserRound className="mx-auto h-10 w-10 text-indigo-500" />
        <h2 id="your-children" className="mt-3 text-lg font-semibold text-ink">
          Add your first child
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Koda is for them. Create a profile and they get their own learning space — you
          keep the settings, the goal and the progress.
        </p>
        {onAddChild && (
          <UIButton className="mt-4" icon={<Plus />} onClick={onAddChild}>
            Add child
          </UIButton>
        )}
      </section>
    );
  }

  const { overview, savedAt } = data;
  const attention = overview.attention;
  const l = themeSystem.list;

  return (
    <section aria-labelledby="your-children" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="your-children"
          className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400"
        >
          Your children
        </h2>
        {stale && <span className="text-[11px] text-muted">Updated {ago(savedAt, Date.now())}</span>}
      </div>

      {attention && (
        <UIBanner
          tone="primary"
          icon={<Hand />}
          title={attention.title}
          action={
            onOpenChild ? { label: "Open report", onClick: () => onOpenChild(attention.learnerId) } : undefined
          }
        >
          {attention.body}
        </UIBanner>
      )}

      <div className={l.group}>
        {overview.children.map((child) => (
          <button
            key={child.id}
            type="button"
            onClick={() => onOpenChild?.(child.id)}
            aria-label={`${child.displayName}: ${dayOf(child)}. Open report`}
            className={`${l.row} w-full cursor-pointer text-left`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <UIAvatar name={child.displayName} seed={child.avatarSeed} size="sm" decorative />
              <div className="min-w-0">
                <p className={l.rowTitle}>{child.displayName}</p>
                <p className={l.rowNote}>{dayOf(child)}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-semibold">
              {child.today.goalMet && (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Goal met
                </span>
              )}
              {child.streak >= 2 && (
                <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <Flame className="h-4 w-4 fill-current" aria-hidden="true" />
                  {child.streak}-day streak
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
