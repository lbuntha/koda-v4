import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock,
  HandHelping,
  Target,
} from "lucide-react";

import {
  ERROR_COPY,
  LEANING_ON_HELP,
  STATUS_COPY,
  evidenceGap,
  fetchChildReport,
  nextStep,
  rhythmVerdict,
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
 * Concept key → the lesson that teaches it, and the skill that lesson belongs to.
 *
 * Read from the registry rather than the course, and ungated on purpose: this
 * is a *parent's* screen, and a concept the child has practised must still get
 * a name even when the reader's own viewer would not be offered that lesson.
 *
 * The skill name matters once a family has more than one installed: "Count the
 * Row" and "Count the Beat" are different lessons in different skills, and a
 * list of bare lesson titles stops being navigable the moment two of them read
 * alike. It is only ever *shown* when this child's record spans more than one
 * skill — a caption saying "Counting Quest" under every row of a page about
 * Counting Quest is noise.
 */
interface ConceptName {
  lesson: string;
  skill: string;
}

const conceptNames = (): Map<string, ConceptName> => {
  const names = new Map<string, ConceptName>();
  for (const skill of SKILLS) {
    for (const lesson of skill.lessons) {
      if (lesson.conceptKey && !names.has(lesson.conceptKey)) {
        names.set(lesson.conceptKey, { lesson: lesson.title, skill: skill.manifest.name });
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

/**
 * Which groups are open when the page loads.
 *
 * Every group is a disclosure, and the two that stay shut are the two that
 * cannot be acted on: "Just started" has too little evidence to advise on, and
 * "Secure" is finished. With a single skill installed those two were already
 * ten of the thirteen rows on screen — a parent scrolled past everything that
 * mattered to reach a wall of "too few answers so far". A family with five
 * skills would have sixty such rows, and the page would be unusable.
 *
 * Nothing is hidden: both open on a tap, and both say how many they hold in
 * their own heading.
 */
const OPEN_BY_DEFAULT: MasteryStatus[] = ["struggling", "practising"];

/**
 * Within a group, the concept most in need of attention first.
 *
 * Alphabetical was fine for eleven concepts and is wrong for a hundred: what a
 * parent wants off the top of a long group is the weakest one, not the one
 * beginning with A. "Just started" is sorted the other way — by how much
 * evidence there is — because its accuracy figures are noise by definition and
 * the useful ordering there is "closest to being readable".
 */
const orderWithin = (status: MasteryStatus, concepts: ConceptMastery[]): ConceptMastery[] =>
  [...concepts].sort((a, b) =>
    status === "learning"
      ? b.questionsAnswered - a.questionsAnswered
      : a.firstTryAccuracy - b.firstTryAccuracy,
  );

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
 * One concept: what it is, the evidence, and the one thing to do about it.
 *
 * Below `MIN_EVIDENCE` answers the accuracy figure is noise, so it is not
 * printed at all — what replaces it is how much more practice would make it
 * mean something. A parent given "33% right" from three answers will act on it,
 * and acting on noise about a five-year-old is worse than being told to wait.
 *
 * The status badge that used to sit on the right is gone. Every row lives under
 * a heading that already carries that badge, so it said the same word twice and
 * spent the whole right-hand column doing it. What is there instead is the
 * sentence a parent can act on tonight — which is the only thing on this page
 * that changes what a child does next.
 */
const ConceptRow: React.FC<{ concept: ConceptMastery; name: ConceptName; showSkill: boolean }> = ({
  concept,
  name,
  showSkill,
}) => {
  const gap = evidenceGap(concept);
  const evidence =
    concept.questionsAnswered === 0
      ? "no answers"
      : gap > 0
        ? `${concept.questionsAnswered} so far`
        : `${percent(concept.firstTryAccuracy)} · ${concept.questionsAnswered} answers · ${concept.daysPractised} ${concept.daysPractised === 1 ? "day" : "days"}`;

  return (
    <li className="rounded-2xl border border-line bg-surface-muted p-3">
      {/* Wraps rather than truncates on a narrow screen: the figures are the
          evidence the page is built on, and squeezing them onto one line with a
          lesson title is what pushes them off a phone. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="min-w-0 font-mono text-sm font-bold text-ink">{name.lesson}</p>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">{evidence}</span>
      </div>
      {showSkill && <p className="mt-0.5 text-[11px] text-muted">{name.skill}</p>}
      <p className="mt-1.5 text-xs leading-snug text-muted">{nextStep(concept)}</p>
    </li>
  );
};

/**
 * One status group, as a disclosure.
 *
 * A heading a parent can read without opening it — the badge, how many, and
 * what the band means — so a shut group still carries its share of the answer.
 */
const StatusGroup: React.FC<{
  status: MasteryStatus;
  concepts: ConceptMastery[];
  names: Map<string, ConceptName>;
  showSkill: boolean;
}> = ({ status, concepts, names, showSkill }) => (
  <details
    open={OPEN_BY_DEFAULT.includes(status)}
    className="group rounded-2xl border border-line bg-white dark:bg-surface"
  >
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl p-3 transition hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
      <UIBadge variant={STATUS_TONE[status]}>{STATUS_COPY[status].label}</UIBadge>
      <span className="font-mono text-xs font-bold tabular-nums text-ink">{concepts.length}</span>
      {/* On a phone the sentence takes a line of its own (`order-last` plus
          `basis-full`) so the badge, the count and the chevron stay on one row
          and the row stays a comfortable tap target. From `sm` it reads inline
          and the chevron goes back to the far right. */}
      <span className="order-last basis-full text-xs leading-snug text-muted sm:order-none sm:basis-auto">
        {STATUS_COPY[status].detail}
      </span>
      <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
    </summary>
    <ul className="grid gap-2 p-3 pt-0 sm:grid-cols-2">
      {orderWithin(status, concepts).map((concept) => (
        <ConceptRow
          key={concept.conceptKey}
          concept={concept}
          name={names.get(concept.conceptKey) ?? { lesson: concept.conceptKey, skill: "" }}
          showSkill={showSkill && Boolean(names.get(concept.conceptKey)?.skill)}
        />
      ))}
    </ul>
  </details>
);

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

  /* Whether a row has to say which skill it came from — see `conceptNames`. */
  const manySkills =
    new Set(
      (report?.concepts ?? [])
        .map((concept) => names.get(concept.conceptKey)?.skill)
        .filter(Boolean),
    ).size > 1;

  const played = (report?.rhythm.questionsEver ?? 0) > 0;

  return (
    <div className="min-h-full bg-white p-4 dark:bg-canvas md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* `flex-col-reverse` puts Back at the top on a phone, where a thumb
            expects it, without moving it in the DOM — and `items-start` stops a
            stretched column turning a small button into a full-width bar. */}
        <header className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <UIAvatar name={learnerName} seed={avatarSeed} size="lg" />
            <div className="min-w-0">
              <h1 className="koda-admin-page-title truncate text-2xl sm:text-3xl">{learnerName}</h1>
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
            {/*
              * HOW OFTEN — practice frequency, rather than how well it went.
              *
              * This was headed "Rhythm", which is what the engineers call it and
              * not a word that survives being read by a parent at nine in the
              * evening. Every label here is now the plain thing it counts, and
              * the verdict underneath says whether the week was enough — a
              * figure like "3 of 7" only means something to a reader who
              * already knows what good looks like.
              */}
            <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
              <UISectionHeader
                title="How often"
                subtitle={`How much ${learnerName} is practising. Little and often is what makes it stay.`}
                icon={<CalendarDays className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              />
              <UIStatGrid>
                <UIStatTile
                  icon={<Clock />}
                  value={sinceWords(report?.rhythm.lastSeenTs)}
                  label="Last played"
                />
                {/* Emerald rather than the amber `streak` tone. This is a
                    count of days, not the flame, and a saturated yellow at
                    24px next to three indigo tiles is the one thing on the
                    page the eye keeps snagging on. */}
                <UIStatTile
                  icon={<CalendarDays />}
                  tone="success"
                  value={`${report?.rhythm.daysThisWeek ?? 0} of 7`}
                  label="Days this week"
                />
                <UIStatTile
                  icon={<Target />}
                  value={report?.rhythm.roundsEver ?? 0}
                  label="Lessons finished"
                />
                <UIStatTile
                  icon={<BookOpen />}
                  value={report?.rhythm.questionsEver ?? 0}
                  label="Questions answered"
                />
              </UIStatGrid>
              {report && (
                <p className="text-sm leading-snug text-muted">
                  {rhythmVerdict(report.rhythm, learnerName)}
                </p>
              )}
            </section>

            {/* WHERE THEY ARE — the concept map, trouble first. */}
            <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
              <UISectionHeader
                title={`Where ${learnerName} is`}
                subtitle="Every idea they have met, and the one thing to do about each"
                icon={<Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              />
              <div className="space-y-2">
                {grouped.map(({ status, concepts }) => (
                  <StatusGroup
                    key={status}
                    status={status}
                    concepts={concepts}
                    names={names}
                    showSkill={manySkills}
                  />
                ))}
              </div>
            </section>

            {/* WHY — the part nothing else in the category tells a parent. */}
            <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
              <UISectionHeader
                title="What is going wrong"
                subtitle="The mistakes themselves, and what to try — on the ideas that are not settled yet"
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
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="font-mono text-sm font-bold text-ink">
                          {ERROR_COPY[kind].label}
                        </p>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                          {count} {count === 1 ? "time" : "times"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">{ERROR_COPY[kind].detail}</p>
                      {/* What to actually do about it. The diagnosis above is
                          the interesting half; this is the useful one, and
                          without it a parent is told their child is going wrong
                          and left to work out the rest. */}
                      <p className="mt-1.5 text-sm font-semibold text-ink">
                        Try: {ERROR_COPY[kind].fix}
                      </p>
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
                  subtitle={`${learnerName} gets these right, but reaches for a hint most times. One round with hints closed is the step to solo.`}
                  icon={<HandHelping className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
                />
                <ul className="grid gap-2 sm:grid-cols-2">
                  {leaning.map((concept) => (
                    <li
                      key={concept.conceptKey}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-3"
                    >
                      <p className="min-w-0 truncate font-mono text-sm font-bold text-ink">
                        {names.get(concept.conceptKey)?.lesson ?? concept.conceptKey}
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
