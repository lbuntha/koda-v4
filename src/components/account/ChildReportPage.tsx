import React, { useEffect, useMemo, useState } from "react";
import { LIBRARY_CONCEPT_NAMES } from "../../library/session";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock,
  HandHelping,
  History,
  Lightbulb,
  Target,
  X,
} from "lucide-react";

import {
  ERROR_COPY,
  LEANING_ON_HELP,
  STATUS_COPY,
  contributionsTo,
  evidenceGap,
  fetchChildReport,
  nextStep,
  rhythmVerdict,
  rightFirstTime,
  tooEarlyToRead,
  whatNext,
  type ChildReport,
  type Contribution,
} from "../../lib/childReport";
import { localDayOf } from "../../lib/learning/learningLog";
import { ApiError, usePermissions } from "../../lib/sync";
import type { ConceptMastery, MasteryStatus } from "../../lib/learning/mastery";
import type { ErrorKind } from "../../lib/learning/events";
import { SKILLS } from "../../skills/registry";
import { themeSystem } from "../../lib/themeSystem";
import { UIAvatar, UIBadge, UIButton, UISectionHeader, UIStatGrid, UIStatTile } from "../ui";
import { NoAccess } from "./NoAccess";
import { formatDate, translate, useT } from "../../lib/i18n";

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
 * skill — a caption saying "Counting" under every row of a page about
 * Counting is noise.
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
  // Koda Library is a module, not a skill, so its concepts are named here.
  for (const [key, name] of Object.entries(LIBRARY_CONCEPT_NAMES)) if (!names.has(key)) names.set(key, name);
  return names;
};

/*
 * Rose for the band that needs help, not amber.
 *
 * Amber on white is the hardest badge in the set to read, and this is the one
 * badge a parent most needs to spot on a page of thirteen rows. Rose is the
 * app's colour for "this one, now".
 */
const STATUS_TONE: Record<MasteryStatus, "success" | "primary" | "info" | "danger" | "neutral"> = {
  mastered: "success",
  practising: "primary",
  learning: "info",
  struggling: "danger",
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

/** "3 days ago", and "today" rather than "0 days ago". */
const sinceWords = (iso?: string, now: Date = new Date()): string => {
  if (!iso) return translate("report.since.never");
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return translate("report.since.never");
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return translate("report.since.today");
  if (days === 1) return translate("report.since.yesterday");
  if (days < 7) return translate("report.since.daysAgo", { count: days });
  if (days < 14) return translate("report.since.lastWeek");
  return formatDate(then, { day: "numeric", month: "short" });
};

/** A practised day, named the way a parent would say it. */
const dayWords = (day: string, now: Date = new Date()): string => {
  const today = localDayOf(now);
  if (day === today) return translate("report.day.today");
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localDayOf(yesterday)) return translate("report.day.yesterday");
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return formatDate(date, { weekday: "short", day: "numeric", month: "short" });
};

/** "4s", "1m 10s" — a typical answer, in units a person uses out loud. */
const durationWords = (ms: number): string => {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

/**
 * What a headline number is made of, opened from the tile that shows it.
 *
 * "16 questions answered" is a fact a parent can read in a second and do
 * nothing with. The same 16 split across the lessons they came from is the
 * first thing that points anywhere: one lesson carrying most of the answers is
 * a different evening from five lessons touched once each.
 *
 * Shut by default, and one at a time. This page's job is to be readable in
 * about ten seconds; a breakdown permanently on screen would be four more
 * blocks to scroll past before reaching the advice.
 */
const StatDetail: React.FC<{
  title: string;
  hint: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, hint, onClose, children }) => (
  <div className="rounded-2xl border border-line bg-surface-muted p-3 sm:p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted">{hint}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={translate("report.hideDetail")}
        className="-m-1 shrink-0 cursor-pointer rounded-xl p-1 text-muted transition hover:bg-white dark:hover:bg-surface"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
    {children}
  </div>
);

/**
 * A breakdown said in one line, before the list of it.
 *
 * The point of the whole panel, for a reader who has ten seconds: whether the
 * practice went into one thing or was spread thin. The list underneath is for
 * the reader who then wants to know which thing.
 */
const spreadWords = (
  rows: Contribution[],
  names: Map<string, ConceptName>,
  what: "questions" | "finishes",
): string => {
  const top = rows[0];
  if (!top) return "";
  const lesson = names.get(top.concept.conceptKey)?.lesson ?? top.concept.conceptKey;
  if (rows.length === 1) return translate("report.spread.all", { lesson });
  if (top.share >= 0.5) return translate(`report.spread.half.${what}`, { lesson });
  return translate("report.spread.across", { count: rows.length, lesson });
};

/**
 * One lesson's share of a headline number.
 *
 * The figure on the right is always two lines: the count this row contributes,
 * and the one thing that says whether it went well. A parent scanning the
 * column is reading the second line — a lesson with 9 answers and 3 right
 * first time is where the next session goes, and no other screen says so.
 */
const BreakdownRow: React.FC<{
  name: ConceptName;
  showSkill: boolean;
  count: string;
  note: string;
}> = ({ name, showSkill, count, note }) => (
  <li className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-white p-3 dark:bg-surface">
    <div className="min-w-0">
      <p className="text-sm font-bold text-ink">{name.lesson}</p>
      {showSkill && <p className="mt-0.5 text-[11px] text-muted">{name.skill}</p>}
    </div>
    <div className="shrink-0 text-right">
      <p className="text-sm font-bold tabular-nums text-ink">{count}</p>
      <p className="mt-0.5 text-[11px] tabular-nums text-muted">{note}</p>
    </div>
  </li>
);

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
  /*
   * Said as a count, not a rate.
   *
   * "100% · 9 answers · 1 day" is three figures in a row a parent has to
   * assemble into a sentence themselves, and the percentage is the hardest of
   * the three — 78% of what? "7 of 9 right first time" is the same fact with
   * the work already done.
   */
  const right = rightFirstTime(concept);
  const evidence =
    concept.questionsAnswered === 0
      ? translate("report.evidence.notPlayed")
      : gap > 0
        ? translate("report.evidence.soFar", { count: concept.questionsAnswered })
        : `${translate("report.evidence.rightOf", { right, total: concept.questionsAnswered })} · ${translate("streak.days", { count: concept.daysPractised })}`;

  return (
    <li className="rounded-2xl border border-line bg-surface-muted p-3">
      {/* Wraps rather than truncates on a narrow screen: the figures are the
          evidence the page is built on, and squeezing them onto one line with a
          lesson title is what pushes them off a phone. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="min-w-0 text-sm font-bold text-ink">{name.lesson}</p>
        <span className="shrink-0 text-[11px] tabular-nums text-muted">{evidence}</span>
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
      {/* "1" on its own read as a rank, or a score. It is a count of lessons,
          so it says so. */}
      <span className="text-xs font-bold tabular-nums text-ink">
        {translate("skillCard.lessons", { count: concepts.length })}
      </span>
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

export const ChildReportPage: React.FC<ChildReportPageProps> = ({
  learnerId,
  learnerName,
  avatarSeed,
  onBack,
}) => {
  const { can } = usePermissions();
  const { t, language } = useT();
  const canRead = can("learner_data:read");
  const [report, setReport] = useState<ChildReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* Which headline number has been opened up, if any. One at a time. */
  const [detail, setDetail] = useState<"lessons" | "questions" | null>(null);
  const names = useMemo(conceptNames, []);

  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);
    fetchChildReport(learnerId, controller.signal)
      .then(setReport)
      .catch((err) => {
        if (controller.signal.aborted) return;
        const problem = err as ApiError;
        setError(
          problem.isOffline
            ? t("report.offline")
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

  /*
   * The two headline numbers, split back into the lessons that made them.
   *
   * Computed whether or not a panel is open — both are a single pass over a
   * list the page already holds, and gating them on state would buy nothing but
   * a branch.
   */
  const answerRows = useMemo(
    () => contributionsTo(report?.concepts ?? [], (c) => c.questionsAnswered),
    [report],
  );
  const lessonRows = useMemo(
    () => contributionsTo(report?.concepts ?? [], (c) => c.lessonsCompleted),
    [report],
  );

  /*
   * The one thing to do next — the answer to the question the page is opened
   * with, worked out once and printed at the top.
   */
  const move = useMemo(
    () =>
      report
        ? whatNext(report, learnerName, (key) => names.get(key)?.lesson ?? key)
        : null,
    // `language`: the advice is a sentence, and it is worded in the language on screen.
    [report, learnerName, names, language],
  );

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
        title={t("report.progressOf", { name: learnerName })}
        permission="learner_data:read"
        what={t("report.noAccess")}
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
                {t("report.subtitle", { name: learnerName })}
              </p>
            </div>
          </div>
          {onBack && (
            <UIButton variant="secondary" size="sm" icon={<ArrowLeft />} onClick={onBack}>
              {t("reader.back")}
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
            {t("report.tooEarly", { name: learnerName })}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted dark:bg-surface">
            {t("report.loading", { name: learnerName })}
          </div>
        ) : !played ? (
          <section className={themeSystem.card("default", "p-8 text-center")}>
            <BookOpen className="mx-auto h-10 w-10 text-indigo-300" />
            <h2 className="mt-3 text-lg font-semibold text-ink">{t("common.nothingYet")}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">{t("report.emptyNote", { name: learnerName })}</p>
          </section>
        ) : (
          <>
            {/*
              * DO THIS NEXT — the whole page in one sentence.
              *
              * Everything below is evidence, and a parent standing in a kitchen
              * does not want evidence, they want an instruction. The bands, the
              * counts and the mistakes are all still there for the reader who
              * wants to check the working; this is for the one who has a minute
              * and a child to sit with.
              *
              * Never a second opinion: it is picked from the same concepts and
              * the same thresholds the rows below use, so it always names a
              * lesson the reader can then find further down.
              */}
            {move && (
              <section
                className={themeSystem.card(
                  "default",
                  `${themeSystem.spacing.card} space-y-2 border-indigo-200 dark:border-indigo-500/40`,
                )}
              >
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  {t("report.doNext")}
                </p>
                <p className="text-lg font-bold leading-snug text-ink sm:text-xl">{move.action}</p>
                <p className="text-sm leading-snug text-muted">{move.why}</p>
              </section>
            )}

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
                title={t("report.howOften")}
                subtitle={t("report.howOftenNote", { name: learnerName })}
                icon={<CalendarDays className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              />
              <UIStatGrid>
                <UIStatTile
                  icon={<Clock />}
                  value={sinceWords(report?.rhythm.lastSeenTs)}
                  label={t("report.lastPlayed")}
                />
                {/* Emerald rather than the amber `streak` tone. This is a
                    count of days, not the flame, and a saturated yellow at
                    24px next to three indigo tiles is the one thing on the
                    page the eye keeps snagging on. */}
                <UIStatTile
                  icon={<CalendarDays />}
                  tone="success"
                  value={t("skillCard.xOfY", { done: report?.rhythm.daysThisWeek ?? 0, total: 7 })}
                  label={t("report.daysThisWeek")}
                />
                {/* The two tiles that open. A total is a fact; the lessons
                    behind it are the first thing a parent can act on, and
                    `interactive` is what says the tile is worth a tap. */}
                <UIStatTile
                  icon={<Target />}
                  value={report?.rhythm.roundsEver ?? 0}
                  label={t("report.lessonsFinished")}
                  onClick={() => setDetail((open) => (open === "lessons" ? null : "lessons"))}
                />
                <UIStatTile
                  icon={<BookOpen />}
                  value={report?.rhythm.questionsEver ?? 0}
                  label={t("report.questionsAnswered")}
                  onClick={() => setDetail((open) => (open === "questions" ? null : "questions"))}
                />
              </UIStatGrid>

              {/* Discoverability, in one line. The tiles get a hover border from
                  `interactive`, and a hover border is invisible to the half of
                  these readers holding a phone. */}
              {detail === null && (
                <p className="text-xs leading-snug text-muted">
                  {t("report.tapNumber")}
                </p>
              )}

              {detail === "questions" && (
                <StatDetail
                  title={t("report.questionsFrom", { count: report?.rhythm.questionsEver ?? 0 })}
                  hint={`${spreadWords(answerRows, names, "questions")} ${t("report.questionsHint")}`}
                  onClose={() => setDetail(null)}
                >
                  {answerRows.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">{t("report.nothingAnswered")}</p>
                  ) : (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {answerRows.map((row) => (
                        <BreakdownRow
                          key={row.concept.conceptKey}
                          name={
                            names.get(row.concept.conceptKey) ?? {
                              lesson: row.concept.conceptKey,
                              skill: "",
                            }
                          }
                          showSkill={manySkills}
                          count={t("studio.questions", { count: row.count })}
                          note={t("report.rightFirstTime", { count: rightFirstTime(row.concept) })}
                        />
                      ))}
                    </ul>
                  )}
                </StatDetail>
              )}

              {detail === "lessons" && (
                <StatDetail
                  title={t("report.finishedRounds", { count: report?.rhythm.roundsEver ?? 0 })}
                  hint={`${spreadWords(lessonRows, names, "finishes")} ${t("report.finishedHint")}`}
                  onClose={() => setDetail(null)}
                >
                  {lessonRows.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">
                      {t("report.nothingFinished", { name: learnerName })}
                    </p>
                  ) : (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {lessonRows.map((row) => (
                        <BreakdownRow
                          key={row.concept.conceptKey}
                          name={
                            names.get(row.concept.conceptKey) ?? {
                              lesson: row.concept.conceptKey,
                              skill: "",
                            }
                          }
                          showSkill={manySkills}
                          count={t("report.nFinished", { count: row.count })}
                          note={t("report.last", { when: sinceWords(row.concept.lastSeenTs) })}
                        />
                      ))}
                    </ul>
                  )}
                </StatDetail>
              )}

              {report && (
                <p className="text-sm leading-snug text-muted">
                  {rhythmVerdict(report.rhythm, learnerName)}
                </p>
              )}
            </section>

            {/*
              * RECENT ACTIVITY — the days themselves, newest first.
              *
              * "1 of 7 days" says how often; this says what those days held,
              * which is the question a parent actually asks at the dinner table
              * and the one the page could not answer. Lessons rather than
              * counts, because the rollup knows a concept was met on a day and
              * genuinely cannot say how many questions that day carried.
              */}
            {(report?.activity.length ?? 0) > 0 && (
              <section
                className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}
              >
                <UISectionHeader
                  title={t("report.recent")}
                  /* Says how many, because the list is capped: "the days
                     they played" would be a promise of all of them. */
                  subtitle={
                    (report?.activity.length ?? 0) === 1
                      ? t("report.recentOne", { name: learnerName })
                      : t("report.recentMany", { count: report?.activity.length ?? 0, name: learnerName })
                  }
                  icon={<History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
                />
                <ol className="space-y-2">
                  {(report?.activity ?? []).map(({ day, conceptKeys }) => (
                    <li key={day} className="rounded-2xl border border-line bg-surface-muted p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="font-mono text-sm font-bold text-ink">{dayWords(day)}</p>
                        <span className="font-mono text-[11px] tabular-nums text-muted">
                          {t("skillCard.lessons", { count: conceptKeys.length })}
                        </span>
                      </div>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {conceptKeys.map((key) => {
                          const name = names.get(key);
                          return (
                            <li
                              key={key}
                              className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-body dark:bg-surface"
                            >
                              {name?.lesson ?? key}
                              {manySkills && name?.skill && (
                                <span className="text-muted"> · {name.skill}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* WHERE THEY ARE — the concept map, trouble first. */}
            <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
              <UISectionHeader
                title={t("report.everyLesson")}
                subtitle={t("report.everyLessonNote", { name: learnerName })}
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

            {/*
              * WHY — the part nothing else in the category tells a parent.
              *
              * Drawn only when there is a pattern. A whole card headed "What is
              * going wrong" whose only content was "no pattern to report" cost
              * a parent a scroll to learn nothing, and made a page that is
              * mostly good news read as a page about problems.
              */}
            {troubles.length > 0 && (
            <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
              <UISectionHeader
                title={t("report.mistakes")}
                subtitle={t("report.mistakesNote")}
                icon={<CircleHelp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              />
              <ul className="space-y-2">
                {troubles.map(({ kind, count }) => (
                  <li key={kind} className="rounded-2xl border border-line bg-surface-muted p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="text-sm font-bold text-ink">{ERROR_COPY[kind].label}</p>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {t("report.times", { count })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{ERROR_COPY[kind].detail}</p>
                    {/* What to actually do about it. The diagnosis above is
                        the interesting half; this is the useful one, and
                        without it a parent is told their child is going wrong
                        and left to work out the rest. */}
                    <p className="mt-1.5 text-sm font-semibold text-ink">
                      {t("report.try", { fix: ERROR_COPY[kind].fix })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            )}

            {/* NEARLY SOLO — accurate, but still reaching for help. */}
            {leaning.length > 0 && (
              <section
                className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}
              >
                <UISectionHeader
                  title={t("report.stillHints")}
                  subtitle={t("report.stillHintsNote", { name: learnerName })}
                  icon={<HandHelping className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
                />
                <ul className="grid gap-2 sm:grid-cols-2">
                  {leaning.map((concept) => (
                    <li
                      key={concept.conceptKey}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-3"
                    >
                      <p className="min-w-0 truncate text-sm font-bold text-ink">
                        {names.get(concept.conceptKey)?.lesson ?? concept.conceptKey}
                      </p>
                      {/* A count, not a rate: "help on 75%" makes a parent do
                          the arithmetic before they can picture it. */}
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {t("report.hintsIn", {
                          hints: Math.round(concept.supportRate * concept.questionsAnswered),
                          total: concept.questionsAnswered,
                        })}
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
