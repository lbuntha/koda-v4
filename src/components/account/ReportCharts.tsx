import React, { useState } from "react";

import { GOOD_WEEK_DAYS, WEEK_DAYS, evidenceGap, rightFirstTime } from "../../lib/childReport";
import { useT } from "../../lib/i18n";
import { MASTERY_ACCURACY, type ConceptMastery, type MasteryStatus } from "../../lib/learning/mastery";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge } from "../ui";
import { BAND_FILL } from "./ReportGlance";

/* Every band wears the badge tone it wears in the groups below. */
const BAND_BADGE: Record<MasteryStatus, "success" | "primary" | "info" | "danger" | "neutral"> = {
  mastered: "success",
  practising: "primary",
  learning: "info",
  struggling: "danger",
  "not-started": "neutral",
};

/* Each chart sits in the theme's stat-tile frame, standing as a block. */
const FRAME = themeSystem.statTile.tile("default", "!block");

/**
 * The two pictures on a child's report.
 *
 * Each answers one decision: *is the habit growing?* (practice by week, against
 * the goal) and *which lesson needs me?* (right first try per lesson, against
 * the line where it counts as learned). Plain HTML rather than a chart library:
 * two small marks do not justify a dependency on a page that has to load on a
 * slow phone connection.
 *
 * Single series each, so no legend box — the title names it. Values live in
 * ink, never in the bar colour; a tap or hover says the exact figure.
 */

/** Days practised per week, oldest on the left, this week on the right. */
export const PracticeTrend: React.FC<{ weeks: number[] }> = ({ weeks }) => {
  const { t } = useT();
  const last = weeks.length - 1;
  const [active, setActive] = useState(last);
  const label = (i: number) =>
    i === last ? t("report.glance.thisWeek") : t("report.glance.weeksAgo", { count: last - i });
  const goal = (GOOD_WEEK_DAYS / WEEK_DAYS) * 100;

  return (
    <figure className={FRAME}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-bold text-ink">{t("report.glance.trendTitle")}</span>
        {/* The readout: the hovered or tapped week, this week until then. */}
        <span className="text-xs tabular-nums text-muted" aria-live="polite">
          {label(active)} · <b className="text-ink">{t("report.glance.daysIn", { count: weeks[active] ?? 0 })}</b>
        </span>
      </figcaption>
      <p className="mt-0.5 text-[11px] leading-snug text-muted">
        {t("report.glance.trendNote", { target: GOOD_WEEK_DAYS })}
      </p>

      <div className="relative mt-3 h-28" onMouseLeave={() => setActive(last)}>
        {/* Recessive baseline and the goal line. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-line" />
        <div
          className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-emerald-500"
          style={{ bottom: `${goal}%` }}
        >
          <span className={`absolute bottom-full right-0 mb-0.5 rounded bg-surface px-1 text-[10px] font-bold leading-tight ${themeSystem.statTile.tone("success")}`}>
            {t("report.glance.trendGoal")} {GOOD_WEEK_DAYS}
          </span>
        </div>
        <ol className="absolute inset-0 flex items-end gap-[2px]">
          {weeks.map((days, i) => (
            <li key={i} className="flex h-full flex-1 items-end justify-center">
              {/* The hit target is the whole column, not the bar: a week with
                  no practice still has to be tappable. */}
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-label={`${label(i)}: ${t("report.glance.daysIn", { count: days })}`}
                className="flex h-full w-full cursor-pointer items-end justify-center rounded-md transition hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-indigo-500"
              >
                <span
                  className={`block w-3/5 max-w-8 rounded-t-[4px] transition-colors ${
                    i === active ? BAND_FILL.practising : "bg-indigo-200 dark:bg-indigo-500/40"
                  }`}
                  style={{ height: days > 0 ? `${(Math.min(days, WEEK_DAYS) / WEEK_DAYS) * 100}%` : "2px" }}
                />
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted">
        <span>{label(0)}</span>
        <span>{label(last)}</span>
      </div>
    </figure>
  );
};

/** How many lessons the bar list shows before folding the rest away. */
const LESSON_ROWS = 6;

/**
 * Right first try for every lesson with enough answers to judge, weakest first.
 *
 * Lessons below the evidence floor are left off and counted underneath — a bar
 * drawn from three answers would be read as a verdict, and it is not one.
 */
export const LessonBars: React.FC<{
  concepts: ConceptMastery[];
  lessonOf: (key: string) => string;
}> = ({ concepts, lessonOf }) => {
  const { t } = useT();
  const [all, setAll] = useState(false);
  const judged = concepts
    .filter((c) => c.questionsAnswered > 0 && evidenceGap(c) === 0)
    .sort((a, b) => a.firstTryAccuracy - b.firstTryAccuracy);
  const unjudged = concepts.filter((c) => c.questionsAnswered > 0 && evidenceGap(c) > 0).length;
  if (judged.length === 0) return null;
  const shown = all ? judged : judged.slice(0, LESSON_ROWS);
  const mark = Math.round(MASTERY_ACCURACY * 100);

  return (
    <figure className={FRAME}>
      <figcaption className="text-sm font-bold text-ink">{t("report.glance.lessonsTitle")}</figcaption>
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{t("report.glance.lessonsNote", { mark })}</p>
      <ul className="mt-3 space-y-2.5">
        {shown.map((c) => {
          const pct = Math.round(c.firstTryAccuracy * 100);
          const lesson = lessonOf(c.conceptKey);
          return (
            <li
              key={c.conceptKey}
              title={`${lesson}: ${t("report.evidence.rightOf", { right: rightFirstTime(c), total: c.questionsAnswered })}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-xs font-bold text-ink">{lesson}</p>
                <span className="flex shrink-0 items-center gap-1.5">
                  <UIBadge variant={BAND_BADGE[c.status]}>{t(`report.status.${c.status}.label`)}</UIBadge>
                  <b className="text-xs tabular-nums text-ink">{pct}%</b>
                </span>
              </div>
              <div className="relative mt-1 h-2.5 rounded-full bg-surface-muted">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${BAND_FILL[c.status]}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
                {/* The learned line, ringed in the surface colour so it reads over a bar. */}
                <span
                  className="absolute -inset-y-1 w-[2px] rounded-full bg-ink ring-2 ring-surface"
                  style={{ left: `${mark}%` }}
                  aria-hidden="true"
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {unjudged > 0 ? (
          <p className="text-[11px] leading-snug text-muted">{t("report.glance.tooFewNote", { count: unjudged })}</p>
        ) : (
          <span />
        )}
        {judged.length > LESSON_ROWS && (
          <button
            type="button"
            onClick={() => setAll((open) => !open)}
            className={`min-h-9 cursor-pointer rounded-full px-3 text-xs font-bold hover:bg-surface-muted ${themeSystem.statTile.tone("primary")}`}
          >
            {all ? t("common.showLess") : t("report.glance.showAllLessons", { count: judged.length })}
          </button>
        )}
      </div>
    </figure>
  );
};
