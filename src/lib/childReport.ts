import { accessToken, request } from "./sync";
import { localDayOf, type ConceptTotals } from "./learning/learningLog";
import {
  MASTERY_ACCURACY,
  MASTERY_DAYS,
  MIN_EVIDENCE,
  masteryFrom,
  type ConceptMastery,
  type MasteryStatus,
} from "./learning/mastery";
import type { ErrorKind } from "./learning/events";

/**
 * What one child has learned, read by an adult.
 *
 * The child's own device answers this from its local log. Nobody else's can —
 * a parent's tablet has never seen the rounds — so this reads the server's
 * rollup instead, and then applies *exactly* the same judgement:
 * `masteryFrom()`, the one place the thresholds live.
 *
 * That the two sources agree is not luck. `concept_totals` folds events the way
 * the local log folds them, field for field, and `docs/ARCHITECTURE.md` §5
 * states it as a contract. If it ever drifts, this screen and the child's own
 * screen start describing different children.
 *
 * Deliberately free of the skill system, for the reason `learning/recommend.ts`
 * gives for the same choice: concepts arrive as keys, and turning a key into a
 * lesson title is the caller's job. That keeps this module testable against a
 * hand-written rollup with no registry loaded.
 */

interface ProfileResponse {
  learnerId: string;
  concepts: Partial<ConceptTotals>[];
  eventsStored: number;
}

/** How many days back "this week" reaches, today included. */
export const WEEK_DAYS = 7;

/**
 * Help taken on this share of questions or more: the child has the idea but is
 * not yet working alone.
 *
 * A judgement rather than a layout choice, so it sits here with the other
 * thresholds instead of inside a component. `mastery.ts` names this case in its
 * doc comment — "high + accurate means not yet solo" — and never acts on it;
 * this is the number that acts on it.
 */
export const LEANING_ON_HELP = 0.4;

/**
 * How many more answers before this concept's figures mean anything.
 *
 * `mastery.ts` already refuses to judge below `MIN_EVIDENCE` — it returns
 * "learning" rather than a verdict. This turns that refusal into something a
 * parent can read: not "we don't know", but "three more rounds and we will".
 *
 * Zero once there is enough evidence, so a caller can treat it as a flag.
 */
export const evidenceGap = (concept: ConceptMastery): number =>
  Math.max(0, MIN_EVIDENCE - concept.questionsAnswered);

/**
 * True when a child has played, but nothing they have touched is settled enough
 * to describe yet.
 *
 * Worth its own answer because it is a genuinely different page from "has never
 * played": the record exists and is simply too young to read. Saying so beats
 * showing four sections of shrugging.
 */
export const tooEarlyToRead = (report: ChildReport): boolean =>
  report.rhythm.questionsEver > 0 &&
  report.concepts.every((concept) => evidenceGap(concept) > 0);

export interface Rhythm {
  /** When this child last answered anything, or undefined if they never have. */
  lastSeenTs?: string;
  /** Distinct days practised within the last `WEEK_DAYS`. */
  daysThisWeek: number;
  /** Distinct days practised, ever. */
  daysEver: number;
  /** Rounds finished, ever. Deliberately not "this week" — see below. */
  roundsEver: number;
  questionsEver: number;
}

export interface ChildReport {
  learnerId: string;
  /** Raw events the server still holds. Ages out at 400 days; the rollup does not. */
  eventsStored: number;
  /** Every concept this child has touched, hardest-first. */
  concepts: ConceptMastery[];
  rhythm: Rhythm;
}

/** The order a grown-up wants to read them in: trouble first, settled last. */
const STATUS_ORDER: MasteryStatus[] = [
  "struggling",
  "practising",
  "learning",
  "mastered",
  "not-started",
];

/**
 * Fill in what a rollup row may not carry.
 *
 * `concept_totals` rows are built by `$inc` and `$addToSet`, so a field that
 * has never been incremented is simply absent rather than zero. The API model
 * defaults most of them, but `lastSeenTs` is nullable there and is not here —
 * and a missing count must read as 0, never `NaN` on the first division.
 */
const normalise = (row: Partial<ConceptTotals>): ConceptTotals => ({
  conceptKey: row.conceptKey ?? "",
  skillIds: row.skillIds ?? [],
  questionsAnswered: row.questionsAnswered ?? 0,
  correctFirstTry: row.correctFirstTry ?? 0,
  supportsUsed: row.supportsUsed ?? 0,
  lessonsCompleted: row.lessonsCompleted ?? 0,
  lessonsAbandoned: row.lessonsAbandoned ?? 0,
  totalResponseMs: row.totalResponseMs ?? 0,
  errors: row.errors ?? {},
  practisedOn: row.practisedOn ?? [],
  lastSeenTs: row.lastSeenTs ?? "",
});

/**
 * Turn a child's rollup into the reading a screen shows.
 *
 * Pure, so the shape of the answer can be tested without a server.
 */
export function buildReport(
  learnerId: string,
  rows: Partial<ConceptTotals>[],
  eventsStored: number = 0,
  now: Date = new Date(),
): ChildReport {
  const totals = rows.map(normalise).filter((t) => t.conceptKey);
  const concepts = totals
    .map(masteryFrom)
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        a.conceptKey.localeCompare(b.conceptKey),
    );

  /*
   * A day appears once per concept, so the union is the answer and a sum would
   * count a single afternoon three times over.
   */
  const days = new Set<string>();
  for (const t of totals) for (const day of t.practisedOn) days.add(day);

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - (WEEK_DAYS - 1));
  const firstDay = localDayOf(cutoff);

  /*
   * Rounds are counted ever, not this week, because the rollup cannot answer
   * the second question: `practisedOn` carries dates and `lessonsCompleted`
   * carries a cumulative count, and nothing ties one to the other. Showing an
   * invented weekly figure would be worse than showing an honest lifetime one.
   */
  return {
    learnerId,
    eventsStored,
    concepts,
    rhythm: {
      lastSeenTs: totals.map((t) => t.lastSeenTs).filter(Boolean).sort().pop() || undefined,
      daysThisWeek: [...days].filter((day) => day >= firstDay).length,
      daysEver: days.size,
      roundsEver: totals.reduce((sum, t) => sum + t.lessonsCompleted, 0),
      questionsEver: totals.reduce((sum, t) => sum + t.questionsAnswered, 0),
    },
  };
}

/**
 * One child's report, from the server.
 *
 * Needs `learner_data:read`, which the route enforces — an owner, a parent or a
 * caregiver has it. A child's own device may call this only for itself, and the
 * server decides that, not this function.
 */
export async function fetchChildReport(
  learnerId: string,
  signal?: AbortSignal,
): Promise<ChildReport> {
  const token = await accessToken();
  const profile = await request<ProfileResponse>(`/sync/profile/${learnerId}`, { token, signal });
  return buildReport(profile.learnerId, profile.concepts ?? [], profile.eventsStored ?? 0);
}

/**
 * What a mistake actually was, in a sentence a parent can act on.
 *
 * The taxonomy is already documented where it is declared (`learning/events.ts`);
 * this is the same distinction said to a grown-up rather than to a developer.
 * It is the most useful thing on the page: everything else says *how much* a
 * child has practised, and only this says *what is going wrong*.
 */
export const ERROR_COPY: Record<ErrorKind, { label: string; detail: string; fix: string }> = {
  off_by_one: {
    label: "Off by one",
    detail: "Lands next to the right answer — the idea is there, the count slips at the end.",
    fix: "Count out loud together and touch each thing once. The last word said is the answer.",
  },
  off_by_more: {
    label: "Not close",
    detail: "The answer is far from the target, which usually means the method was not used.",
    fix: "Drop to smaller numbers for a round or two, until the method is being used again.",
  },
  reversed: {
    label: "The wrong way round",
    detail: "Right numbers, wrong direction — comparing or ordering the opposite way.",
    fix: "Say it as a sentence before answering: “six is more than four”.",
  },
  guessed_fast: {
    label: "Guessing",
    detail: "Answering faster than the thinking takes. Often boredom, sometimes avoidance.",
    fix: "Ask them to say the answer out loud before they tap it.",
  },
  timed_out: {
    label: "Ran out of time",
    detail: "No answer given. Worth watching whether the question is hard or just long.",
    fix: "Sit alongside for one round and see where the pause comes.",
  },
  miscounted_items: {
    label: "Lost count",
    detail: "Counted more or fewer things than were there — one-to-one matching is not secure yet.",
    fix: "Move each thing aside as it is counted, so nothing is counted twice or missed.",
  },
  sequence_slip: {
    label: "Broke the pattern",
    detail: "Wrong next term in a sequence: the rule, rather than the arithmetic.",
    fix: "Say the run aloud from the start — 2, 4, 6 — and ask what comes next.",
  },
  place_value: {
    label: "Tens and ones",
    detail: "Reading tens and ones the wrong way round — 15 for 51, or 3 tens read as 3.",
    fix: "Build the number with ten-sticks and single ones before writing it down.",
  },
  unknown: {
    label: "Not classified",
    detail: "A mistake the activity could not put a name to.",
    fix: "Watch one round to see what is actually happening.",
  },
};

/**
 * Words for each status, aimed at the adult reading them.
 *
 * `detail` says what the group *is*; the sentence a parent acts on is
 * `nextStep`, per concept, because the useful instruction differs between two
 * children sitting in the same band.
 */
export const STATUS_COPY: Record<MasteryStatus, { label: string; detail: string }> = {
  mastered: { label: "Secure", detail: "Done. Worth one round each in a week or two so it stays." },
  practising: { label: "Getting there", detail: "A round or two from finished. Best use of the next session." },
  learning: { label: "Just started", detail: "Too new to read. More rounds is the only thing that helps." },
  struggling: { label: "Stuck", detail: "Going wrong more often than right. Start here." },
  "not-started": { label: "Not met yet", detail: "No rounds on this one." },
};

/**
 * How many days a week of practice is the bar worth aiming for.
 *
 * Spacing is the single strongest thing a family controls: `mastery.ts` will
 * not call anything secure until it has been practised on more than one day,
 * for exactly this reason. Three short sessions is the number the page asks
 * for, because it is reachable — a bar nobody hits is a bar nobody reads twice.
 */
export const GOOD_WEEK_DAYS = 3;

/**
 * This week's practice, said as a verdict rather than a number.
 *
 * "3 of 7" is a fact, and a parent has to already know what good looks like to
 * read it. The tile keeps the fact; this says whether it is enough, and what to
 * do when it is not. Every branch names a concrete next action, never "practise
 * more".
 */
export const rhythmVerdict = (rhythm: Rhythm, name: string): string => {
  const days = rhythm.daysThisWeek;
  if (days === 0) {
    return `${name} has not played this week. Ten minutes today is worth more than an hour on Sunday.`;
  }
  if (days >= 5) return `Practising most days. This is the thing that makes it stick — keep it.`;
  if (days >= GOOD_WEEK_DAYS) {
    return `${days} days this week. Three or more is the bar, and ${name} is over it.`;
  }
  return `${days} ${days === 1 ? "day" : "days"} this week. Aim for ${GOOD_WEEK_DAYS} short sessions rather than one long one — spacing is what makes it stay.`;
};

/**
 * The one thing to do about this concept next, in a sentence.
 *
 * The point of the whole page. A status badge tells a parent where a child is;
 * it does not tell them what to do on Tuesday evening, and "practising" is the
 * band most children spend most of their time in, so a page that stops at the
 * badge says nothing actionable about almost everything on it.
 *
 * Every branch names the *actual* missing ingredient rather than offering
 * encouragement. A concept sits at "practising" for exactly one of four
 * reasons, and `mastery.ts` knows which: help still being taken, only one day
 * of practice, first-try accuracy under the bar, or no finished round yet.
 * Saying which one is what turns a report into an instruction — "one round on
 * another day" is something a parent can do; "keep practising" is not.
 */
export const nextStep = (concept: ConceptMastery): string => {
  const gap = evidenceGap(concept);
  if (concept.questionsAnswered === 0) return "Not played yet.";
  // Said before the status, because below MIN_EVIDENCE the status is a
  // placeholder and any advice drawn from it would be advice about noise.
  if (gap > 0) {
    return `About ${gap} more ${gap === 1 ? "answer" : "answers"} before this can say anything.`;
  }

  switch (concept.status) {
    case "struggling":
      return "Sit with them for one round of this — more is going wrong than right.";
    case "practising":
      if (concept.supportRate >= LEANING_ON_HELP) {
        return "Right most times, but with a hint. Try one round with hints closed.";
      }
      if (concept.daysPractised < MASTERY_DAYS) {
        return "Going well. One more round on a different day settles it.";
      }
      if (concept.firstTryAccuracy < MASTERY_ACCURACY) {
        return "Close. A round with fewer first-try slips will finish it.";
      }
      return "One finished round away from secure — a round left part-done does not count.";
    case "mastered":
      return "Secure. Come back in a week or two so it stays that way.";
    default:
      return "Nothing to do here yet.";
  }
};
