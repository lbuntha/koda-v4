/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Scoring engine — turns the raw LearningEvent log into a per-skill mastery
 * level on a fixed Beginner → Master ladder.
 *
 * Grain: ONE mastery state per (student, curriculumSkillId), exactly the
 * grouping computeCurriculumMastery already uses. A "skill" (curriculum/types.ts)
 * is the promotion unit — "Count objects up to 10" climbs independently of
 * "Count to 20" or "Addition within 20".
 *
 * Two rules the design leans on, both encoded here:
 *   1. Promotion needs a SCORE *and* a VOLUME/SPACING gate. A high score on
 *      three lucky questions is not Master — the gates (plays, distinct
 *      sessions/days, retention window) are what stop that.
 *   2. Difficulty is a refinement, not a second ladder: questions carry an
 *      optional `details.difficulty` ("easy"|"medium"|"hard"); the top rungs
 *      require clearing the HARD band. When no difficulty data exists at all,
 *      that gate degrades gracefully (skipped) so the engine still runs on
 *      today's logs.
 *
 * Pure and recomputable, same as computeSkillMastery — nothing here is
 * persisted, so a score never drifts from the events that produced it. The
 * 0.60 / 0.85 thresholds are the SAME REINFORCE/ADVANCE constants the rest of
 * the app uses (imported, not restated), so "proficient" means one thing
 * everywhere; Master adds a stricter tier on top.
 */

import {
  LearningEvent,
  AttemptOutcome,
  REINFORCE_THRESHOLD,
  ADVANCE_THRESHOLD,
} from "./logSchema";

// ── The ladder ────────────────────────────────────────────────────────────────

export type MasteryLevel =
  | "not_started"
  | "beginner"
  | "developing"
  | "proficient"
  | "master";

/** Low → high. Index is comparable: MASTERY_ORDER.indexOf(a) < indexOf(b). */
export const MASTERY_ORDER: MasteryLevel[] = [
  "not_started",
  "beginner",
  "developing",
  "proficient",
  "master",
];

export const MASTERY_LABEL: Record<MasteryLevel, string> = {
  not_started: "Not started",
  beginner: "Beginner",
  developing: "Developing",
  proficient: "Proficient",
  master: "Master",
};

// ── Score composition ─────────────────────────────────────────────────────────

/** Rewards getting it right the FIRST time, without hints, reasonably quickly. */
export const SCORE_WEIGHTS = {
  firstTry: 0.45,
  accuracy: 0.2,
  independence: 0.2, // 1 − hintRate
  speed: 0.15,
} as const;

/** Score thresholds. Developing/Proficient reuse the app-wide constants; Master is new. */
export const DEVELOPING_SCORE = REINFORCE_THRESHOLD; // 0.60
export const PROFICIENT_SCORE = ADVANCE_THRESHOLD; // 0.85
export const MASTER_SCORE = 0.92;

/** Volume + spacing gates. "plays" = questions answered (first-attempt events). */
export const GATES = {
  developing: { minPlays: 6 },
  proficient: { minPlays: 10, minSessions: 2, minHardPlays: 3 },
  master: { minPlays: 15, minDistinctDays: 3, minHardPlays: 3, minRecentScore: 0.9 },
} as const;

/** timeOnTask baseline for the speed component; speedScore = clamp(baseline/median, 0..1). */
export const SPEED_BASELINE_MS = 8000;

/** Spaced-review interval per level (days). This timer IS the scheduler's "what's due". */
export const REVIEW_INTERVAL_DAYS: Record<MasteryLevel, number | null> = {
  not_started: null, // never "due" — it's new, surfaced by curriculum order, not review
  beginner: 0, // always due until it climbs
  developing: 1,
  proficient: 4,
  master: 14,
};

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Injected config ─────────────────────────────────────────────────────────────

/**
 * Every scoring knob, in one injectable bundle. The exported constants above are
 * the *defaults* and the shared-fixture baseline; the live, server-authoritative
 * values arrive as a `ScoringConfig` (see docs §12). The backend port
 * (`backend/app/features/progression/scoring.py`) consumes the identical shape so
 * one config produces one result in both implementations.
 */
export interface ScoringConfig {
  weights: { firstTry: number; accuracy: number; independence: number; speed: number };
  developingScore: number;
  proficientScore: number;
  masterScore: number;
  /** Minimum one-session score that advances the spaced-review clock. */
  successfulReviewScore: number;
  gates: {
    developing: { minPlays: number };
    proficient: { minPlays: number; minSessions: number; minHardPlays: number };
    master: { minPlays: number; minDistinctDays: number; minHardPlays: number; minRecentScore: number };
  };
  speedBaselineMs: number;
  reviewIntervalDays: Record<MasteryLevel, number | null>;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: { ...SCORE_WEIGHTS },
  developingScore: DEVELOPING_SCORE,
  proficientScore: PROFICIENT_SCORE,
  masterScore: MASTER_SCORE,
  successfulReviewScore: 0.8,
  gates: {
    developing: { ...GATES.developing },
    proficient: { ...GATES.proficient },
    master: { ...GATES.master },
  },
  speedBaselineMs: SPEED_BASELINE_MS,
  reviewIntervalDays: { ...REVIEW_INTERVAL_DAYS },
};

// ── Shapes ────────────────────────────────────────────────────────────────────

export interface ScoreComponents {
  firstTryAccuracy: number; // 0..1
  overallAccuracy: number; // 0..1
  independence: number; // 0..1  (1 − hintRate)
  speedScore: number; // 0..1
  /** False when no attempt carried a timeOnTaskMs — speed is then dropped and the other weights renormalized. */
  speedMeasured: boolean;
}

export interface SkillScore {
  studentId: string | null;
  skillId: string;
  level: MasteryLevel;
  /** Composite 0..1 over all of this skill's attempts. */
  score: number;
  components: ScoreComponents;

  // Gate inputs (also useful for teacher-facing UI)
  plays: number; // questions answered (first-attempt events)
  attempts: number; // raw attempt events (a question can have several)
  sessions: number; // distinct sessionId
  distinctDays: number; // distinct calendar days on the learner's own clock
  hardPlays: number; // first-attempt events tagged difficulty "hard"
  difficultyTagged: boolean; // was any attempt difficulty-tagged at all
  hintRate: number; // 0..1
  avgTimeOnTaskMs: number;
  /** Score recomputed over only the most-recent session — the retention check for Master. */
  recentScore: number;

  lastPracticedAt: string; // ISO
  lastSuccessfulReviewAt: string; // ISO; empty until a session clears the review threshold
  lastReviewOutcome: "successful" | "unsuccessful" | null;
  nextReviewAt: string | null; // ISO, null for not_started
  isDue: boolean; // now >= nextReviewAt (beginner/developing/… ), false for not_started

  nextLevel: MasteryLevel | null;
  /** Human-readable list of what's still missing to reach nextLevel — for the "4 more strong tries →" UI. */
  toNextLevel: string[];
}

export interface ComputeOptions {
  /** Injectable clock for deterministic tests / server use. */
  now?: number;
  /** Overrides `config.speedBaselineMs` when set (kept for back-compat). */
  speedBaselineMs?: number;
  /** Full scoring config; defaults to DEFAULT_SCORING_CONFIG. */
  config?: ScoringConfig;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";

function difficultyOf(e: LearningEvent): Difficulty | null {
  const d = e.details?.difficulty;
  return d === "easy" || d === "medium" || d === "hard" ? d : null;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** The attempt events this engine scores: an "attempt" with a real outcome. */
function isScorable(e: LearningEvent): e is LearningEvent & { outcome: AttemptOutcome } {
  return e.eventType === "attempt" && !!e.outcome;
}

// ── Components ─────────────────────────────────────────────────────────────────

/**
 * Composite score over one skill's attempt events. `firstTry*` is measured on
 * attemptNumber === 1 events (attemptNumber resets to 1 on every slide_view,
 * so there is exactly one per question visit — that count is also "plays").
 * When no attempt carries attemptNumber, every attempt is treated as a first
 * attempt so the engine still produces a sane number on sparse logs.
 */
export function computeComponents(
  attempts: (LearningEvent & { outcome: AttemptOutcome })[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): { components: ScoreComponents; score: number; plays: number; correctFirstTry: number } {
  const total = attempts.length;
  if (!total) {
    return {
      components: { firstTryAccuracy: 0, overallAccuracy: 0, independence: 0, speedScore: 0, speedMeasured: false },
      score: 0,
      plays: 0,
      correctFirstTry: 0,
    };
  }

  const numbered = attempts.filter(e => typeof e.attemptNumber === "number");
  const firstAttempts = numbered.length ? attempts.filter(e => e.attemptNumber === 1) : attempts;
  const plays = firstAttempts.length || total;
  const correctFirstTry = firstAttempts.filter(e => e.outcome === "correct").length;
  const firstTryAccuracy = plays ? correctFirstTry / plays : 0;

  const overallAccuracy = attempts.filter(e => e.outcome === "correct").length / total;
  const hintRate = attempts.filter(e => e.hintUsedBeforeAttempt).length / total;
  const independence = 1 - hintRate;

  const times = attempts.map(e => e.timeOnTaskMs).filter((n): n is number => typeof n === "number");
  const speedMeasured = times.length > 0;
  const med = median(times);
  const speedScore = speedMeasured && med > 0 ? clamp01(config.speedBaselineMs / med) : 0;

  // Weighted mean; if speed wasn't measured, drop it and renormalize the rest.
  const parts: { w: number; v: number }[] = [
    { w: config.weights.firstTry, v: firstTryAccuracy },
    { w: config.weights.accuracy, v: overallAccuracy },
    { w: config.weights.independence, v: independence },
  ];
  if (speedMeasured) parts.push({ w: config.weights.speed, v: speedScore });
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  const score = clamp01(parts.reduce((s, p) => s + p.w * p.v, 0) / totalW);

  return {
    components: { firstTryAccuracy, overallAccuracy, independence, speedScore, speedMeasured },
    score,
    plays,
    correctFirstTry,
  };
}

// ── Level derivation ───────────────────────────────────────────────────────────

interface GateStats {
  score: number;
  plays: number;
  sessions: number;
  distinctDays: number;
  hardPlays: number;
  difficultyTagged: boolean;
  recentScore: number;
}

function meetsDeveloping(s: GateStats, c: ScoringConfig): boolean {
  return s.score >= c.developingScore && s.plays >= c.gates.developing.minPlays;
}

function meetsProficient(s: GateStats, c: ScoringConfig): boolean {
  const hardOk = !s.difficultyTagged || s.hardPlays >= c.gates.proficient.minHardPlays;
  return (
    s.score >= c.proficientScore &&
    s.plays >= c.gates.proficient.minPlays &&
    s.sessions >= c.gates.proficient.minSessions &&
    hardOk
  );
}

function meetsMaster(s: GateStats, c: ScoringConfig): boolean {
  const hardOk = !s.difficultyTagged || s.hardPlays >= c.gates.master.minHardPlays;
  return (
    meetsProficient(s, c) &&
    s.score >= c.masterScore &&
    s.plays >= c.gates.master.minPlays &&
    s.distinctDays >= c.gates.master.minDistinctDays &&
    s.recentScore >= c.gates.master.minRecentScore &&
    hardOk
  );
}

function deriveLevel(s: GateStats, c: ScoringConfig): MasteryLevel {
  if (s.plays === 0) return "not_started";
  if (meetsMaster(s, c)) return "master";
  if (meetsProficient(s, c)) return "proficient";
  if (meetsDeveloping(s, c)) return "developing";
  return "beginner";
}

/** What's still missing to reach the next rung — plain phrases for the UI. */
function unmetRequirements(next: MasteryLevel, s: GateStats, c: ScoringConfig): string[] {
  const need: string[] = [];
  const round2 = (n: number) => Math.round(n * 100) / 100;

  if (next === "developing") {
    if (s.score < c.developingScore) need.push(`raise score to ${c.developingScore.toFixed(2)} (now ${round2(s.score)})`);
    if (s.plays < c.gates.developing.minPlays) need.push(`${c.gates.developing.minPlays - s.plays} more questions`);
  } else if (next === "proficient") {
    if (s.score < c.proficientScore) need.push(`raise score to ${c.proficientScore.toFixed(2)} (now ${round2(s.score)})`);
    if (s.plays < c.gates.proficient.minPlays) need.push(`${c.gates.proficient.minPlays - s.plays} more questions`);
    if (s.sessions < c.gates.proficient.minSessions) need.push(`practice on ${c.gates.proficient.minSessions - s.sessions} more session(s)`);
    if (s.difficultyTagged && s.hardPlays < c.gates.proficient.minHardPlays) need.push(`${c.gates.proficient.minHardPlays - s.hardPlays} more hard question(s)`);
  } else if (next === "master") {
    if (s.score < c.masterScore) need.push(`raise score to ${c.masterScore.toFixed(2)} (now ${round2(s.score)})`);
    if (s.plays < c.gates.master.minPlays) need.push(`${c.gates.master.minPlays - s.plays} more questions`);
    if (s.distinctDays < c.gates.master.minDistinctDays) need.push(`practice on ${c.gates.master.minDistinctDays - s.distinctDays} more day(s)`);
    if (s.recentScore < c.gates.master.minRecentScore) need.push(`keep the last session strong (≥ ${c.gates.master.minRecentScore.toFixed(2)})`);
    if (s.difficultyTagged && s.hardPlays < c.gates.master.minHardPlays) need.push(`${c.gates.master.minHardPlays - s.hardPlays} more hard question(s)`);
  }
  return need;
}

// ── Public: score one skill's events ───────────────────────────────────────────

/**
 * `attempts` MUST already be filtered to a single (student, skill). Callers
 * normally use computeSkillScores() which does the grouping; this is exported
 * for direct testing and for a caller that already has one skill's slice.
 */
export function scoreSkill(
  studentId: string | null,
  skillId: string,
  events: LearningEvent[],
  opts: ComputeOptions = {},
): SkillScore {
  const now = opts.now ?? Date.now();
  const config: ScoringConfig = opts.speedBaselineMs != null
    ? { ...(opts.config ?? DEFAULT_SCORING_CONFIG), speedBaselineMs: opts.speedBaselineMs }
    : (opts.config ?? DEFAULT_SCORING_CONFIG);
  const attempts = events.filter(isScorable);

  const byTime = [...attempts].sort((a, b) => a.clientTimestampMs - b.clientTimestampMs);
  const { components, score, plays } = computeComponents(attempts, config);

  const sessions = new Set(attempts.map(e => e.sessionId)).size;
  const distinctDays = new Set(attempts.map(e => e.occurredAt.slice(0, 10))).size;
  const difficultyTagged = attempts.some(e => difficultyOf(e) !== null);
  const numbered = attempts.filter(e => typeof e.attemptNumber === "number");
  const firstAttempts = numbered.length ? attempts.filter(e => e.attemptNumber === 1) : attempts;
  const hardPlays = firstAttempts.filter(e => difficultyOf(e) === "hard").length;
  const hintRate = attempts.length ? attempts.filter(e => e.hintUsedBeforeAttempt).length / attempts.length : 0;
  const timed = attempts.map(e => e.timeOnTaskMs).filter((n): n is number => typeof n === "number");
  const avgTimeOnTaskMs = timed.length ? timed.reduce((a, b) => a + b, 0) / timed.length : 0;

  // Retention window: the most recent session only.
  const latestSessionId = byTime[byTime.length - 1]?.sessionId;
  const recentAttempts = attempts.filter(e => e.sessionId === latestSessionId);
  const recentScore = sessions <= 1 ? score : computeComponents(recentAttempts, config).score;
  const successfulReviewScore = config.successfulReviewScore ?? 0.8;
  const attemptsBySession = new Map<string, typeof attempts>();
  for (const event of byTime) {
    const bucket = attemptsBySession.get(event.sessionId) ?? [];
    bucket.push(event);
    attemptsBySession.set(event.sessionId, bucket);
  }
  const sessionReviews = [...attemptsBySession.values()].map(sessionAttempts => {
    const last = sessionAttempts.reduce((a, b) => a.clientTimestampMs >= b.clientTimestampMs ? a : b);
    return {
      score: computeComponents(sessionAttempts, config).score,
      occurredAt: last.occurredAt,
      clientTimestampMs: last.clientTimestampMs,
    };
  });
  const successfulReviews = sessionReviews.filter(review => review.score >= successfulReviewScore);
  const lastSuccessfulReview = successfulReviews
    .sort((a, b) => b.clientTimestampMs - a.clientTimestampMs)[0];
  const latestReview = [...sessionReviews].sort((a, b) => b.clientTimestampMs - a.clientTimestampMs)[0];
  const lastSuccessfulReviewAt = lastSuccessfulReview?.occurredAt || "";
  const lastReviewOutcome = latestReview
    ? (latestReview.score >= successfulReviewScore ? "successful" : "unsuccessful")
    : null;

  const stats: GateStats = { score, plays, sessions, distinctDays, hardPlays, difficultyTagged, recentScore };
  const level = deriveLevel(stats, config);

  const lastPracticedAt = byTime[byTime.length - 1]?.occurredAt || "";
  const reviewAnchor = lastSuccessfulReviewAt || lastPracticedAt;
  const interval = config.reviewIntervalDays[level];
  let nextReviewAt: string | null = null;
  let isDue = false;
  if (level !== "not_started" && reviewAnchor) {
    const due = new Date(reviewAnchor).getTime() + (interval ?? 0) * DAY_MS;
    nextReviewAt = new Date(due).toISOString();
    isDue = now >= due;
  }

  const idx = MASTERY_ORDER.indexOf(level);
  const nextLevel = level === "master" ? null : (MASTERY_ORDER[idx + 1] as MasteryLevel);
  const toNextLevel = nextLevel && nextLevel !== "not_started" ? unmetRequirements(nextLevel, stats, config) : [];

  return {
    studentId,
    skillId,
    level,
    score,
    components,
    plays,
    attempts: attempts.length,
    sessions,
    distinctDays,
    hardPlays,
    difficultyTagged,
    hintRate,
    avgTimeOnTaskMs,
    recentScore,
    lastPracticedAt,
    lastSuccessfulReviewAt,
    lastReviewOutcome,
    nextReviewAt,
    isDue,
    nextLevel,
    toNextLevel,
  };
}

// ── Public: score every skill in an event log ──────────────────────────────────

/**
 * Groups the whole event log by (studentId, curriculumSkillId) and scores each
 * — the shape a student "skill map" or a parent report reads from. Only events
 * from curated, skill-assigned questions count (same rule as
 * computeCurriculumMastery); un-curated play still logs but isn't laddered here.
 * Sorted weakest-first — what a teacher wants at the top.
 */
export function computeSkillScores(events: LearningEvent[], opts: ComputeOptions = {}): SkillScore[] {
  const groups = new Map<string, LearningEvent[]>();
  for (const e of events) {
    if (!isScorable(e) || !e.curriculumSkillId) continue;
    const key = `${e.studentId ?? "anonymous"}::${e.curriculumSkillId}`;
    const bucket = groups.get(key) || [];
    bucket.push(e);
    groups.set(key, bucket);
  }

  const out: SkillScore[] = [];
  for (const [key, bucket] of groups) {
    const sep = key.indexOf("::");
    const studentKey = key.slice(0, sep);
    const skillId = key.slice(sep + 2);
    out.push(scoreSkill(studentKey === "anonymous" ? null : studentKey, skillId, bucket, opts));
  }
  return out.sort((a, b) => MASTERY_ORDER.indexOf(a.level) - MASTERY_ORDER.indexOf(b.level) || a.score - b.score);
}

// ── Public: overall student rank (rollup) ──────────────────────────────────────

export type RankTier = "rookie" | "bronze" | "silver" | "gold" | "master";

export const RANK_LABEL: Record<RankTier, string> = {
  rookie: "Rookie",
  bronze: "Bronze Explorer",
  silver: "Silver Explorer",
  gold: "Gold Explorer",
  master: "Grand Master",
};

export interface StudentRank {
  studentId: string | null;
  totalSkills: number; // skills with any activity in the scored set
  proficientPlus: number; // proficient + master
  mastered: number; // master only
  tier: RankTier;
  tierLabel: string;
  /** 0..1 toward the next tier boundary. 1 when already at Grand Master. */
  progressToNext: number;
}

/**
 * Headline "beginner → master" badge: a rollup over one student's skill scores,
 * driven by the share of skills at Proficient+. Purely derived (never stored).
 * Tier boundaries are named constants below on purpose — they're the most
 * likely thing to tune once real cohorts play, and renaming them shouldn't mean
 * hunting through logic.
 */
export const RANK_BOUNDARIES: { tier: RankTier; minRatio: number }[] = [
  { tier: "master", minRatio: 1.0 },
  { tier: "gold", minRatio: 0.66 },
  { tier: "silver", minRatio: 0.34 },
  { tier: "bronze", minRatio: 0.0001 }, // any proficient skill clears Rookie
  { tier: "rookie", minRatio: 0 },
];

export function computeStudentRank(scores: SkillScore[]): StudentRank {
  const studentId = scores[0]?.studentId ?? null;
  const totalSkills = scores.length;
  const proficientPlus = scores.filter(s => s.level === "proficient" || s.level === "master").length;
  const mastered = scores.filter(s => s.level === "master").length;
  const ratio = totalSkills ? proficientPlus / totalSkills : 0;

  const tier = (RANK_BOUNDARIES.find(b => ratio >= b.minRatio)?.tier ?? "rookie") as RankTier;

  // progress toward the next boundary up
  const ascending = [...RANK_BOUNDARIES].sort((a, b) => a.minRatio - b.minRatio);
  const currentIdx = ascending.findIndex(b => b.tier === tier);
  const next = ascending[currentIdx + 1];
  const currentMin = ascending[currentIdx].minRatio;
  const progressToNext = !next ? 1 : clamp01((ratio - currentMin) / (next.minRatio - currentMin || 1));

  return { studentId, totalSkills, proficientPlus, mastered, tier, tierLabel: RANK_LABEL[tier], progressToNext };
}
