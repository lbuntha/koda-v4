import React from "react";
import { Check, Play } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { useT } from "../../lib/i18n";
import type { PlanStep, PlanStepKind, TodayPlan } from "../../lib/todayPlan";
import { UIButton, UIProgressBar } from "../ui";

/**
 * Today's plan, as one card with one big button.
 *
 * The button always means "do the next thing", so a child never has to decide
 * where to start: it opens the first step not yet done. The list under it is
 * there to show how far they have come, and each row also opens its own step
 * for a child who wants to pick.
 */

const KIND_TONE: Record<PlanStepKind, string> = {
  review: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  fix: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  new: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  continue: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  read: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  write: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  puzzle: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
};

export interface TodayPlanCardProps {
  plan: TodayPlan;
  /** One per step, in order. */
  done: boolean[];
  /** A lesson step's title and subject, in the language on screen. */
  lessonLabel(ref: string): { title: string; subject: string } | null;
  onStart(step: PlanStep): void;
  /** The run so far, for the cheer line. Weeks are left out: "3 days" must not mean three weeks. */
  streak?: { count: number; cadence: "daily" | "weekly" };
}

/**
 * The one friendly line at the top of the card.
 *
 * One, chosen by what matters most today, because three messages are read as
 * none: back after a break first (be welcoming), then mistakes waiting (the
 * point of the plan), then the streak (keep coming back). Never a scolding —
 * mistakes are "waiting to be fixed", not "you got wrong".
 */
export function planMessage(
  plan: TodayPlan,
  done: boolean[],
  streak: TodayPlanCardProps["streak"],
): { key: string; values?: Record<string, string> } | null {
  const allDone = done.length > 0 && done.every(Boolean);
  const days = streak?.cadence === "daily" ? streak.count : 0;
  if (allDone) return days >= 2 ? { key: "todayPlan.cheer.doneStreak", values: { n: String(days) } } : null;
  if (plan.welcomeBack) return { key: "todayPlan.welcomeBack" };
  const fixesLeft = plan.steps.filter((s, i) => s.kind === "fix" && !done[i]).length;
  if (fixesLeft === 1) return { key: "todayPlan.cheer.oneMistake" };
  if (fixesLeft > 1) return { key: "todayPlan.cheer.mistakes", values: { n: String(fixesLeft) } };
  if (days >= 2) return { key: "todayPlan.cheer.streak", values: { n: String(days) } };
  return null;
}

export const TodayPlanCard: React.FC<TodayPlanCardProps> = ({ plan, done, lessonLabel, onStart, streak }) => {
  const { t } = useT();
  const total = plan.steps.length;
  const finished = done.filter(Boolean).length;
  const next = plan.steps.findIndex((_, i) => !done[i]);
  const allDone = next === -1;
  const message = planMessage(plan, done, streak);

  const labelOf = (step: PlanStep): { title: string; subject: string } => {
    if (step.ref) return lessonLabel(step.ref) ?? { title: step.ref, subject: "" };
    if (step.kind === "puzzle") return { title: t("wordGuess.title"), subject: t("todayPlan.puzzleSubject") };
    return { title: step.title ?? "", subject: t(step.kind === "read" ? "learnHub.books" : "learnHub.trace") };
  };

  return (
    <section
      aria-label={t("todayPlan.title")}
      className={`${themeSystem.card("default")} ${themeSystem.spacing.card} mt-3 space-y-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-ink">{t("todayPlan.title")}</h2>
          <p className="text-sm text-muted">{allDone ? t("todayPlan.allDoneNote") : t("todayPlan.hint")}</p>
          {message ? (
            <p className="mt-1 text-sm font-bold text-violet-700 dark:text-violet-300">{t(message.key, message.values)}</p>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-sm font-black text-ink tabular-nums">
          {t("todayPlan.progress", { done: String(finished), total: String(total) })}
        </span>
      </div>

      <UIProgressBar value={finished} max={total} label={t("todayPlan.title")} />

      {allDone ? (
        <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-center font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {t("todayPlan.allDone")}
        </p>
      ) : (
        <UIButton
          fullWidth
          size="lg"
          icon={<Play className="h-5 w-5" />}
          onClick={() => onStart(plan.steps[next])}
        >
          {finished ? t("todayPlan.continue") : t("todayPlan.start")}
        </UIButton>
      )}

      <ol className="space-y-2">
        {plan.steps.map((step, i) => {
          const { title, subject } = labelOf(step);
          const isNext = i === next;
          return (
            <li key={`${step.kind}-${step.ref ?? step.bookId ?? step.collectionId ?? ""}`}>
              <button
                type="button"
                onClick={() => onStart(step)}
                className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isNext ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/50" : "border-line bg-surface"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${
                    done[i] ? "bg-emerald-500 text-white" : "border-2 border-line text-muted"
                  }`}
                >
                  {done[i] ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-bold ${done[i] ? "text-muted line-through" : "text-ink"}`}>{title}</span>
                  {subject ? <span className="block truncate text-xs text-muted">{subject}</span> : null}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${KIND_TONE[step.kind]}`}>
                  {t(`todayPlan.kind.${step.kind}`)}
                </span>
                <span className="sr-only">{done[i] ? t("todayPlan.doneLabel") : ""}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
