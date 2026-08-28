import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CalendarDays, CircleHelp, Clock, HandHelping, Target } from "lucide-react";

import {
  ERROR_COPY,
  LEANING_ON_HELP,
  STATUS_COPY,
  evidenceGap,
  fetchChildReport,
  tooEarlyToRead,
  type ChildReport,
} from "../../lib/childReport";
import { ApiError, usePermissions } from "../../lib/sync";
import type { ConceptMastery, MasteryStatus } from "../../lib/learning/mastery";
import type { ErrorKind } from "../../lib/learning/events";
import { SKILLS } from "../../skills/registry";
import { themeSystem } from "../../lib/themeSystem";
import { UIAvatar, UIBadge, UIButton, UISectionHeader, UIStatGrid, UIStatTile } from "../ui";
import { NoAccess } from "./NoAccess";

/**
 * What one child has been doing, for the adult who looks after them.
 *
 * The engine has always known this. Until now it said so only inside the Skill
 * Manager, behind `content:write` — a platform right no parent holds — so the
 * one person who most needs the answer was the one person who could not see it.
 *
 * Two rules shape everything below.
 *
 * **The child never sees a score; the parent always sees the evidence.** The
 * recommender already splits `reason` from `kidMessage` for this reason, and
 * this page is entirely the first kind. Percentages, error names and counts
 * belong here and nowhere a child can read them.
 *
 * **Nothing is claimed that the rollup cannot support.** Where the evidence is
 * thin the page says so rather than rounding it into a confident number, and
 * where a figure is not derivable — rounds *this week*, say — it is not shown
 * at all. A parent who catches this page overstating once will not trust the
 * next thing it says.
 */

export interface ChildReportPageProps {
  learnerId: string;
  learnerName: string;
  avatarSeed?: string;
  /** Back to wherever the reader came from. Omitted when the page stands alone. */
  onBack?: () => void;
}

/**
 * Concept key → the lesson that teaches it.
 *
 * Read from the registry rather than the course, and ungated on purpose: this
 * is a *parent's* screen, and a concept the child has practised must still get
 * a name even when the reader's own viewer would not be offered that lesson.
 */
const conceptNames = (): Map<string, string> => {
  const names = new Map<string, string>();
  for (const skill of SKILLS) {
    for (const lesson of skill.lessons) {
      if (lesson.conceptKey && !names.has(lesson.conceptKey)) {
        names.set(lesson.conceptKey, lesson.title);
      }
    }
  }
  return names;
};

const STATUS_TONE: Record<MasteryStatus, "success" | "primary" | "info" | "warning" | "neutral"> = {
  mastered: "success",
  practising: "primary",
  learning: "info",
  struggling: "warning",
  "not-started": "neutral",
};

/** The order the sections read in: trouble first, settled last. */
const SECTIONS: MasteryStatus[] = ["struggling", "practising", "learning", "mastered"];

const percent = (value: number): string => `${Math.round(value * 100)}%`;

/** "3 days ago", and "today" rather than "0 days ago". */
const sinceWords = (iso?: string, now: Date = new Date()): string => {
  if (!iso) return "never";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "never";
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(then);
};

/**
 * One concept, with the reading behind it.
 *
 * Below `MIN_EVIDENCE` answers the accuracy figure is noise, so it is not
 * printed at all — what replaces it is how much more practice would make it
 * mean something. A parent given "33% right" from three answers will act on it,
 * and acting on noise about a five-year-old is worse than being told to wait.
 */
const ConceptRow: React.FC<{ concept: ConceptMastery; name: string }> = ({ concept, name }) => {
  const gap = evidenceGap(concept);

  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-3">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-bold text-ink">{name}</p>
        <p className="mt-0.5 text-xs text-muted">
          {concept.questionsAnswered === 0
            ? "No answers yet"
            : gap > 0
              ? `${concept.questionsAnswered} so far — about ${gap} more before this says anything`
              : `${concept.questionsAnswered} answers · ${percent(concept.firstTryAccuracy)} right first time · ${concept.daysPractised} ${concept.daysPractised === 1 ? "day" : "days"}`}
        </p>
      </div>
      <UIBadge variant={STATUS_TONE[concept.status]} className="shrink-0">
        {STATUS_COPY[concept.status].label}
      </UIBadge>
    </li>
  );
};

/** A block a section can borrow when it has nothing to report. */
const Note: React.FC<{ icon: React.ReactNode; title: string; detail: string }> = ({
  icon,
  title,
  detail,
}) => (
  <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line p-4">
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted [&>svg]:h-4 [&>svg]:w-4">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="font-mono text-sm font-bold text-ink">{title}</p>
      <p className="mt-0.5 text-sm text-muted">{detail}</p>
    </div>
  </div>
);

export const ChildReportPage: React.FC<ChildReportPageProps> = ({
  learnerId,
  learnerName,
  avatarSeed,
  onBack,
}) => {
  const { can } = usePermissions();
  const canRead = can("learner_data:read");
  const [report, setReport] = useState<ChildReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const names = useMemo(conceptNames, []);

  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchChildReport(learnerId, controller.signal)
      .then(setReport)
      .catch((err) => {
        if (controller.signal.aborted) return;
        const problem = err as ApiError;
        setError(
          problem.isOffline
            ? "No connection to the data service, so this is not available right now."
            : problem.message,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [canRead, learnerId]);

  /*
   * What is going wrong, gathered from the concepts that are not settled.
   *
   * Mastered concepts are excluded deliberately: every child makes mistakes on
   * the way to securing something, and listing those under "what to work on"
   * would send a parent to sit with a child over a thing they have finished.
   */
  const troubles = useMemo(() => {
    const counts = new Map<ErrorKind, number>();
    for (const concept of report?.concepts ?? []) {
      if (concept.status === "mastered" || concept.status === "not-started") continue;
      for (const error of concept.topErrors) {
        counts.set(error.kind, (counts.get(error.kind) ?? 0) + error.count);
      }
    }
    return [...counts.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [report]);

  /* Right when they answer, but reaching for a hint most of the time. */
  const leaning = useMemo(
    () =>
      (report?.concepts ?? []).filter(
        (concept) =>
          concept.supportRate >= LEANING_ON_HELP &&
          concept.questionsAnswered > 0 &&
          concept.status !== "struggling",
      ),
    [report],
  );

  if (!canRead) {
    return (
      <NoAccess
        title={`${learnerName}'s progress`}
        permission="learner_data:read"
        what="Only family members with access to a child's record can see what they have practised."
      />
    );
  }

  const grouped = SECTIONS.map((status) => ({
    status,
    concepts: (report?.concepts ?? []).filter((concept) => concept.status === status),
  })).filter((group) => group.concepts.length > 0);

  const played = (report?.rhythm.questionsEver ?? 0) > 0;

  return (
    <div className="min-h-full bg-white p-4 dark:bg-canvas md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <UIAvatar name={learnerName} seed={avatarSeed} size="lg" />
            <div className="min-w-0">
              <h1 className="koda-admin-page-title truncate">{learnerName}</h1>
              <p className="mt-1 text-sm text-[#6D6997] dark:text-muted">
                What {learnerName} has practised, and what it shows.
              </p>
            </div>
          </div>
          {onBack && (
            <UIButton variant="secondary" size="sm" icon={<ArrowLeft />} onClick={onBack}>
              Back
            </UIButton>
          )}
        </header>

        {error && <p className={themeSystem.flash("error")}>{error}</p>}

        {/*
          * A record that exists but is too young to read is its own answer, and
          * a different one from "has never played". Said once at the top, so the
          * sections below are read as early rather than as disappointing.
          */}
        {report && tooEarlyToRead(report) && (
          <p className={themeSystem.flash("info")}>
            Still getting to know {learnerName}. There is enough here to see the shape of what
            they are meeting, but not yet enough to say how securely — a few more rounds will
            settle it.
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted dark:bg-surface">
            Reading {learnerName}'s record…
          </div>
        ) : !played ? (
          <section className={themeSystem.card("default", "p-8 text-center")}>
            <BookOpen className="mx-auto h-10 w-10 text-indigo-300" />
            <h2 className="mt-3 text-lg font-semibold text-ink">Nothing to show yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Once {learnerName} has played a few rounds, this page fills in with what they know,
              what they are working on, and where they are going wrong.
            </p>
          </section>
        ) : (
          <>
            {/* RHYTHM — how often, rather than how well. */}
            <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
              <UISectionHeader
                title="Rhythm"
                subtitle="How regularly this child is practising — the thing that decides whether any of it sticks"
                icon={<CalendarDays className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              />
              <UIStatGrid>
                <UIStatTile
                  icon={<Clock />}
                  value={sinceWords(report?.rhythm.lastSeenTs)}
                  label="Last practised"
                />
                <UIStatTile
                  icon={<CalendarDays />}
                  tone="streak"
                  value={`${report?.rhythm.daysThisWeek ?? 0} of 7`}
                  label="Days this week"
                />
                <UIStatTile
                  icon={<Target />}
                  value={report?.rhythm.roundsEver ?? 0}
                  label="Rounds all time"
                />
                <UIStatTile
                  icon={<BookOpen />}
                  value={report?.rhythm.questionsEver ?? 0}
                  label="Questions answered"
                />
              </UIStatGrid>
            </section>

            {/* WHERE THEY ARE — the concept map, trouble first. */}
            <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
              <UISectionHeader
                title={`Where ${learnerName} is`}
                subtitle="Every idea they have met, grouped by how secure it is"
                icon={<Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              />
              {grouped.map(({ status, concepts }) => (
                <div key={status} className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <UIBadge variant={STATUS_TONE[status]}>{STATUS_COPY[status].label}</UIBadge>
                    <span className="text-xs text-muted">{STATUS_COPY[status].detail}</span>
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {concepts.map((concept) => (
                      <ConceptRow
                        key={concept.conceptKey}
                        concept={concept}
                        name={names.get(concept.conceptKey) ?? concept.conceptKey}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            {/* WHY — the part nothing else in the category tells a parent. */}
            <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
              <UISectionHeader
                title="What is going wrong"
                subtitle="The mistakes themselves, on the ideas that are not settled yet"
                icon={<CircleHelp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              />
              {troubles.length === 0 ? (
                <Note
                  icon={<CircleHelp />}
                  title="No pattern to report"
                  detail={`Nothing ${learnerName} is working on is going wrong often enough to name a cause.`}
                />
              ) : (
                <ul className="space-y-2">
                  {troubles.map(({ kind, count }) => (
                    <li key={kind} className="rounded-2xl border border-line bg-surface-muted p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-mono text-sm font-bold text-ink">
                          {ERROR_COPY[kind].label}
                        </p>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                          {count} {count === 1 ? "time" : "times"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">{ERROR_COPY[kind].detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* NEARLY SOLO — accurate, but still reaching for help. */}
            {leaning.length > 0 && (
              <section
                className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}
              >
                <UISectionHeader
                  title="Nearly solo"
                  subtitle="Getting these right, but still taking a hint most times — worth a round with the hints closed"
                  icon={<HandHelping className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
                />
                <ul className="grid gap-2 sm:grid-cols-2">
                  {leaning.map((concept) => (
                    <li
                      key={concept.conceptKey}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-3"
                    >
                      <p className="min-w-0 truncate font-mono text-sm font-bold text-ink">
                        {names.get(concept.conceptKey) ?? concept.conceptKey}
                      </p>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                        help on {percent(concept.supportRate)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};
