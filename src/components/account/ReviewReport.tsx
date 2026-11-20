import { useEffect, useReducer } from "react";
import { themeSystem } from "../../lib/themeSystem";
import { useT } from "../../lib/i18n";
import { addDays, dueTopics, fixedSince, readReview, type Mistake } from "../../lib/learning/review";
import { localDayOf } from "../../lib/learning/learningLog";

/**
 * Mistakes, for a grown-up: how many were fixed this week, and which are still
 * open, each with one real example of what the child answered.
 *
 * Read from the child's synced review record (`learning/review.ts`), which a
 * parent's device receives like the child's other records. Draws nothing until
 * the child has made a first-try mistake.
 */

const SHOWN = 5;

export function ReviewReport({
  learnerId,
  learnerName,
  lessonName,
}: {
  learnerId: string;
  learnerName: string;
  lessonName(skillId: string, lessonId: string): { lesson: string; skill: string } | null;
}) {
  const { t } = useT();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    /* A pulled copy lands as a storage nudge on this child's key. */
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.endsWith(`__${learnerId}`)) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [learnerId]);

  const today = localDayOf(new Date());
  const store = readReview(learnerId);
  const open = Object.values(store.mistakes).sort((a, b) => b.misses - a.misses || (a.dueDay < b.dueDay ? -1 : 1));
  const fixedWeek = fixedSince(store, addDays(today, -6)).length;
  const due = dueTopics(store, today).length;

  if (!open.length && !store.fixed.length) return null;

  const when = (m: Mistake) =>
    m.dueDay <= today ? t("reviewReport.dueNow") : t("reviewReport.dueOn", { day: m.dueDay });

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <div>
        <h2 className="text-lg font-black text-ink">{t("reviewReport.title")}</h2>
        <p className="text-sm text-muted">{t("reviewReport.intro", { name: learnerName })}</p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          { n: fixedWeek, label: t("reviewReport.fixedWeek"), tone: "text-emerald-600 dark:text-emerald-400" },
          { n: open.length, label: t("reviewReport.toFix"), tone: "text-rose-600 dark:text-rose-400" },
          { n: due, label: t("reviewReport.topicsDue"), tone: "text-sky-600 dark:text-sky-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border-2 border-line px-2 py-3">
            <dd className={`text-2xl font-black tabular-nums ${stat.tone}`}>{stat.n}</dd>
            <dt className="text-xs font-bold text-muted">{stat.label}</dt>
          </div>
        ))}
      </dl>

      {open.length ? (
        <ul className="space-y-2">
          {open.slice(0, SHOWN).map((m) => {
            const name = lessonName(m.skillId, m.lessonId);
            const example = m.examples[m.examples.length - 1];
            return (
              <li key={m.key} className="rounded-2xl border-2 border-line px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-bold text-ink">{name?.lesson ?? m.lessonId}</span>
                  <span className="shrink-0 text-xs font-bold text-muted">{when(m)}</span>
                </div>
                <div className="text-xs text-muted">
                  {name?.skill ? `${name.skill} · ` : ""}
                  {t("reviewReport.misses", { n: String(m.misses) })}
                  {m.rightDays.length ? ` · ${t("reviewReport.halfway")}` : ""}
                </div>
                {example?.given !== undefined && example.expected !== undefined ? (
                  <div className="mt-1 text-sm text-ink">
                    {t("reviewReport.example", { given: example.given, expected: example.expected })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {t("reviewReport.noneOpen")}
        </p>
      )}
      {open.length > SHOWN ? (
        <p className="text-xs text-muted">{t("reviewReport.more", { n: String(open.length - SHOWN) })}</p>
      ) : null}
    </section>
  );
}
