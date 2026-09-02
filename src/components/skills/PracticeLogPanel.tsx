import React, { useMemo, useState, useSyncExternalStore } from "react";
import { Download, Gauge, Repeat, Timer, TrendingUp } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import {
  UIBadge,
  UIButton,
  UIDataTable,
  type UIDataTableColumn,
  UIStatGrid,
  UIStatTile,
} from "../ui";
import {
  LearningLog,
  MIN_PRACTICE_ANSWERS,
  type PracticeAnswer,
  type PracticeRun,
  type PracticeStanding,
  TREND_SAMPLE,
  activeLearnerId,
  getPracticeRuns,
  getPracticeStandings,
  getTopSpeeds,
  learnerNameOf,
} from "../../lib/learning";
import { getCourseLessons, practiceTitle } from "../../curriculum";

/**
 * A lesson id, as the family would name it.
 *
 * The log stores ids ("practice-bonds") because that is what survives a
 * rewording; a grown-up reading the table needs the words. Built per render
 * rather than cached, so a lesson renamed in the Skill Manager shows up here on
 * the next look. The word "Practice" comes off — the table is practice.
 */
const lessonNames = (): Map<string, string> => {
  const names = new Map<string, string>();
  for (const lesson of getCourseLessons()) {
    names.set(`${lesson.skillId}/${lesson.id}`, practiceTitle(lesson.title));
  }
  return names;
};

/**
 * The practice record: who is quick, who is getting quicker, and the evidence.
 *
 * A grown-up's screen, like the learning log beside it, and a different question
 * from the one that log answers. Mastery asks whether a technique is understood
 * and is deliberately slow to decide. This asks how fluent it has become — how
 * long the child takes when nobody is helping — which is the thing a parent
 * actually says out loud, usually as "is she getting faster?".
 *
 * Everything here is read off practice rounds alone, because they are the only
 * rounds where the clock measures thinking rather than how long Koda talked
 * for. And every headline is backed by the rows that produced it: the fastest
 * answers are listed with the question that was asked, so a figure somebody
 * disagrees with can be checked rather than argued with.
 */

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

const when = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: "2-digit", month: "short" })} ${d.toLocaleTimeString(
    undefined,
    { hour: "2-digit", minute: "2-digit", hour12: false },
  )}`;
};

/**
 * Who a row is about.
 *
 * The name the family typed, when this device has been told it; the raw id when
 * it has not, rather than a made-up label. The learner playing right now is
 * marked, because on a shared tablet that is the row a grown-up is checking.
 */
const LearnerName: React.FC<{ learnerId: string }> = ({ learnerId }) => {
  const name = learnerNameOf(learnerId);
  const isCurrent = learnerId === activeLearnerId();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={name ? "font-bold" : "font-mono text-xs"}>{name ?? learnerId}</span>
      {isCurrent && <UIBadge variant="neutral">signed in</UIBadge>}
    </span>
  );
};

/** Positive is faster than they used to be, and that is the direction that reads as good. */
const Trend: React.FC<{ standing: PracticeStanding }> = ({ standing }) => {
  if (standing.speedUpPercent === undefined) {
    return (
      <span className="text-slate-400 dark:text-slate-500">
        needs {TREND_SAMPLE * 2} answers
      </span>
    );
  }
  const change = Math.round(standing.speedUpPercent);
  // Below ten per cent either way is noise on a median of eight answers, and
  // drawing it as a trend invites a parent to read a good afternoon as progress.
  if (Math.abs(change) < 10) return <span className="text-slate-500">holding steady</span>;
  return (
    <span className={change > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
      {change > 0 ? `${change}% faster` : `${Math.abs(change)}% slower`}
    </span>
  );
};

const STANDING_COLUMNS: UIDataTableColumn<PracticeStanding>[] = [
  {
    key: "learner",
    header: "Learner",
    render: (s) => <LearnerName learnerId={s.learnerId} />,
    sortValue: (s) => learnerNameOf(s.learnerId) ?? s.learnerId,
    nowrap: true,
  },
  {
    key: "pace",
    header: "Usual pace",
    // The median, not the best: a headline speed set by one lucky question is
    // the number a child cannot repeat, and repeating it is what fluency means.
    render: (s) => (s.enoughEvidence ? secs(s.medianResponseMs) : "—"),
    sortValue: (s) => (s.enoughEvidence ? s.medianResponseMs : Number.MAX_SAFE_INTEGER),
    align: "right",
    numeric: true,
    nowrap: true,
  },
  {
    key: "best",
    header: "Top speed",
    render: (s) => (s.fastestCorrectMs === undefined ? "—" : secs(s.fastestCorrectMs)),
    sortValue: (s) => s.fastestCorrectMs ?? Number.MAX_SAFE_INTEGER,
    align: "right",
    numeric: true,
    nowrap: true,
  },
  {
    key: "trend",
    header: "Getting faster",
    render: (s) => <Trend standing={s} />,
    sortValue: (s) => s.speedUpPercent ?? Number.MIN_SAFE_INTEGER,
    nowrap: true,
  },
  {
    key: "accuracy",
    header: "First-try",
    // Beside the speed on purpose: quick and wrong is not fast, and the two
    // figures are only meaningful read together.
    render: (s) => (
      <span className={s.accuracy < 0.5 ? "text-rose-600 dark:text-rose-400" : undefined}>
        {pct(s.accuracy)}
      </span>
    ),
    sortValue: (s) => s.accuracy,
    align: "right",
    numeric: true,
  },
  {
    key: "answers",
    header: "Answers",
    render: (s) =>
      s.enoughEvidence ? (
        String(s.questionsAnswered)
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {s.questionsAnswered}
          <UIBadge variant="warning">too few</UIBadge>
        </span>
      ),
    sortValue: (s) => s.questionsAnswered,
    align: "right",
    numeric: true,
    nowrap: true,
  },
  {
    key: "rounds",
    header: "Rounds",
    render: (s) => `${s.runsFinished}/${s.runs}`,
    sortValue: (s) => s.runs,
    align: "right",
    numeric: true,
    muted: true,
    nowrap: true,
  },
  {
    key: "days",
    header: "Days",
    render: (s) => String(s.daysPractised),
    sortValue: (s) => s.daysPractised,
    align: "right",
    numeric: true,
    muted: true,
  },
  {
    key: "last",
    header: "Last practised",
    render: (s) => when(s.lastPractisedTs),
    sortValue: (s) => s.lastPractisedTs,
    numeric: true,
    nowrap: true,
    muted: true,
  },
];

/** The lesson's name, or its id when the course no longer has it — a lesson can
 *  be removed from a build while a child's record of playing it remains. */
const nameOf = (skillId: string, lessonId: string): string =>
  lessonNames().get(`${skillId}/${lessonId}`) ?? lessonId;

const RUN_COLUMNS: UIDataTableColumn<PracticeRun>[] = [
  {
    key: "startedAt",
    header: "Date & time",
    render: (r) => when(r.startedAt),
    sortValue: (r) => r.startedAt,
    numeric: true,
    nowrap: true,
    muted: true,
  },
  {
    key: "learner",
    header: "Learner",
    render: (r) => <LearnerName learnerId={r.learnerId} />,
    sortValue: (r) => learnerNameOf(r.learnerId) ?? r.learnerId,
    nowrap: true,
  },
  {
    key: "lesson",
    header: "Practice",
    render: (r) => `${r.skillId} · ${nameOf(r.skillId, r.lessonId)}`,
    sortValue: (r) => `${r.skillId}${nameOf(r.skillId, r.lessonId)}`,
    nowrap: true,
  },
  {
    key: "questions",
    header: "Answered",
    render: (r) => String(r.questionsAnswered),
    sortValue: (r) => r.questionsAnswered,
    align: "right",
    numeric: true,
  },
  {
    key: "accuracy",
    header: "First-try",
    render: (r) => pct(r.accuracy),
    sortValue: (r) => r.accuracy,
    align: "right",
    numeric: true,
  },
  {
    key: "pace",
    header: "Pace",
    render: (r) => secs(r.medianResponseMs),
    sortValue: (r) => r.medianResponseMs,
    align: "right",
    numeric: true,
    nowrap: true,
  },
  {
    key: "best",
    header: "Best",
    render: (r) => (r.fastestCorrectMs === undefined ? "—" : secs(r.fastestCorrectMs)),
    sortValue: (r) => r.fastestCorrectMs ?? Number.MAX_SAFE_INTEGER,
    align: "right",
    numeric: true,
    nowrap: true,
  },
  {
    key: "state",
    header: "Round",
    render: (r) =>
      r.finished ? (
        <UIBadge variant="success">finished</UIBadge>
      ) : r.abandoned ? (
        <UIBadge variant="warning">left early</UIBadge>
      ) : (
        <UIBadge variant="neutral">in progress</UIBadge>
      ),
    sortValue: (r) => (r.finished ? 2 : r.abandoned ? 1 : 0),
    nowrap: true,
  },
];

const SPEED_COLUMNS: UIDataTableColumn<PracticeAnswer>[] = [
  {
    key: "time",
    header: "Time",
    render: (a) => <span className="font-black">{secs(a.responseMs)}</span>,
    sortValue: (a) => a.responseMs,
    align: "right",
    numeric: true,
    nowrap: true,
  },
  {
    key: "learner",
    header: "Learner",
    render: (a) => <LearnerName learnerId={a.learnerId} />,
    sortValue: (a) => learnerNameOf(a.learnerId) ?? a.learnerId,
    nowrap: true,
  },
  {
    key: "prompt",
    header: "Question",
    render: (a) => a.prompt ?? <span className="italic">{a.lessonId}</span>,
    sortValue: (a) => a.prompt ?? a.lessonId,
  },
  {
    key: "answer",
    header: "Answered",
    render: (a) => a.given ?? "✓",
    numeric: true,
    nowrap: true,
  },
  {
    key: "askedAt",
    header: "When",
    render: (a) => when(a.askedAt),
    sortValue: (a) => a.askedAt,
    numeric: true,
    nowrap: true,
    muted: true,
  },
];

export const PracticeLogPanel: React.FC = () => {
  // Live while a round is played in another tab, the same way the learning log is.
  const version = useSyncExternalStore(
    (cb) => LearningLog.subscribe(cb),
    () => LearningLog.all().length,
  );
  const [skillFilter, setSkillFilter] = useState<string>("all");

  const { standings, runs, speeds, skills } = useMemo(() => {
    const filter = skillFilter === "all" ? undefined : { skillId: skillFilter };
    const allRuns = getPracticeRuns();
    return {
      standings: getPracticeStandings(filter),
      runs: skillFilter === "all" ? allRuns : allRuns.filter((r) => r.skillId === skillFilter),
      speeds: getTopSpeeds(10, filter),
      skills: [...new Set(allRuns.map((r) => r.skillId))].sort(),
    };
    // `version` is the store's change signal, not an unused value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, skillFilter]);

  const answers = standings.reduce((n, s) => n + s.questionsAnswered, 0);
  const best = speeds[0];
  /** The learner who has improved most — the "fast learner" the table is for. */
  const improved = standings
    .filter((s) => s.enoughEvidence && s.speedUpPercent !== undefined)
    .sort((a, b) => (b.speedUpPercent ?? 0) - (a.speedUpPercent ?? 0))[0];
  const quickest = standings.find((s) => s.enoughEvidence);

  const download = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), standings, runs, topSpeeds: speeds },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `koda-practice-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (runs.length === 0 && skillFilter === "all") {
    return (
      <div className={themeSystem.card("default", "p-6 text-center")}>
        <p className="text-sm font-bold text-slate-900 dark:text-white">No practice yet</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Speed is only read off practice rounds — the ones with the hints, the voice and the
          explanation switched off. Play one from the Practice section of a skill's path.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <UIStatGrid>
        <UIStatTile
          icon={<Timer />}
          value={best ? secs(best.responseMs) : "—"}
          label={best ? `Top speed · ${learnerNameOf(best.learnerId) ?? "this device"}` : "Top speed"}
          tone="success"
        />
        <UIStatTile
          icon={<Gauge />}
          value={quickest ? secs(quickest.medianResponseMs) : "—"}
          label={
            quickest
              ? `Quickest pace · ${learnerNameOf(quickest.learnerId) ?? "this device"}`
              : "Quickest pace"
          }
        />
        <UIStatTile
          icon={<TrendingUp />}
          value={
            improved?.speedUpPercent === undefined
              ? "—"
              : `${Math.round(improved.speedUpPercent)}%`
          }
          label={
            improved
              ? `Faster than they were · ${learnerNameOf(improved.learnerId) ?? "this device"}`
              : "Faster than they were"
          }
          tone="success"
        />
        <UIStatTile icon={<Repeat />} value={String(answers)} label="Practice answers" />
      </UIStatGrid>

      <div className={themeSystem.card("default", "p-4 space-y-1")}>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Timed from the question appearing to the first answer, in practice rounds only. An answer
          only counts towards a speed if it was <strong>right</strong>, <strong>unaided</strong> and
          slower than a reflex tap — a lucky jab at the keypad is kept in the log and kept out of
          the record.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          A learner is ranked once they have {MIN_PRACTICE_ANSWERS} practice answers, and{" "}
          <em>getting faster</em> compares their most recent {TREND_SAMPLE} with their first{" "}
          {TREND_SAMPLE}. Below that the row still shows — it just is not judged.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Learners</h3>
        <div className="flex flex-wrap items-center gap-2">
          {skills.length > 1 &&
            ["all", ...skills].map((id) => (
              <button
                key={id}
                onClick={() => setSkillFilter(id)}
                className={themeSystem.button(skillFilter === id ? "primary" : "secondary", "sm")}
              >
                {id === "all" ? "All skills" : id}
              </button>
            ))}
          <UIButton variant="secondary" size="sm" onClick={download}>
            <Download />
            Export
          </UIButton>
        </div>
      </div>

      <UIDataTable
        columns={STANDING_COLUMNS}
        rows={standings}
        rowKey={(s) => s.learnerId}
        defaultSort={{ key: "pace", direction: "asc" }}
        caption="Practice speed per learner, quickest pace first"
        emptyMessage="Nobody has practised this skill yet."
      />

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Fastest answers</h3>
        <UIDataTable
          columns={SPEED_COLUMNS}
          rows={speeds}
          rowKey={(a) => a.questionId}
          defaultSort={{ key: "time", direction: "asc" }}
          caption="The quickest correct unaided answers on record, with the question that was asked"
          emptyMessage="No answer has qualified for a speed record yet."
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Practice rounds</h3>
        <UIDataTable
          columns={RUN_COLUMNS}
          rows={runs}
          rowKey={(r) => r.runId}
          defaultSort={{ key: "startedAt", direction: "desc" }}
          maxHeight="28rem"
          caption="Every practice round, finished or not"
          emptyMessage="No practice rounds for this skill."
        />
      </div>
    </div>
  );
};
