/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Standardized learning-event schema.
 *
 * This is written as if it were already a database table, because it will be
 * one later: stable UUIDs, ISO 8601 timestamps, nullable foreign-key-shaped
 * fields (studentId), a small closed set of enums, and a `schemaVersion` so
 * old rows never need silent reinterpretation when the shape changes.
 * `analyticsLogger` keeps a local read cache and uploads authenticated student
 * sessions to the server through an idempotent batch outbox.
 *
 * Today's gap this schema closes: only 4 of 8 possible event types are ever
 * logged (see analyticsLogger.ts), and `answer_check` only fires on SUCCESS —
 * there is no event type for a wrong attempt at all. A child who tries wrong
 * 5 times then gets it right on the 6th looks identical in today's logs to a
 * child who got it right immediately. That distinction is the entire basis
 * for "recommend this kid practice X" — so it's the first thing this schema
 * makes representable.
 */

import { CountingTechnique } from "../types";

// ── Taxonomy: "other subject" ────────────────────────────────────────────────

/**
 * The curriculum area a technique teaches. Coarser than `technique` (many
 * techniques teach counting) and coarser than `skillTags` (the specific
 * sub-skill) — this is the level a parent/teacher-facing report groups by.
 */
export type SubjectArea =
  | "counting"
  | "number_recognition"
  | "place_value"
  | "sequencing"
  | "addition"
  | "subtraction"
  | "multiplication"
  | "pattern_recognition"
  | "logic_puzzle"
  | "sorting_classification"
  | "algebraic_thinking"
  | "measurement"
  | "data_analysis"
  | "geometry";

/**
 * Fine-grained skill identifiers. Free-form strings (not an enum) because new
 * skills get added by editing this map, not by touching every call site —
 * same reasoning as the AI generator's schema-per-component design.
 */
export type SkillTag = string;

/** technique -> {subject, skills}. The one place that needs updating when a new canvas ships. */
export const TECHNIQUE_TAXONOMY: Record<CountingTechnique, { subjectArea: SubjectArea; skillTags: SkillTag[] }> = {
  [CountingTechnique.ONE_TO_ONE]: { subjectArea: "counting", skillTags: ["one_to_one_counting"] },
  [CountingTechnique.MOVE_AND_COUNT]: { subjectArea: "counting", skillTags: ["one_to_one_counting", "cardinality"] },
  [CountingTechnique.LINE_UP_AND_COUNT]: { subjectArea: "sequencing", skillTags: ["ordinal_counting", "sequencing"] },
  [CountingTechnique.GROUP_IN_TENS]: { subjectArea: "place_value", skillTags: ["tens_and_ones", "place_value"] },
  [CountingTechnique.COUNT_ON]: { subjectArea: "counting", skillTags: ["count_on", "addition_readiness"] },
  [CountingTechnique.COUNT_BACK]: { subjectArea: "counting", skillTags: ["count_back", "subtraction_readiness"] },
  [CountingTechnique.DIFFERENT_ARRANGEMENTS]: { subjectArea: "counting", skillTags: ["count_conservation"] },
  [CountingTechnique.COUNT_MAGNETS]: { subjectArea: "counting", skillTags: ["one_to_one_counting"] },
  [CountingTechnique.SUBITIZE]: { subjectArea: "number_recognition", skillTags: ["subitizing", "instant_recognition"] },
  [CountingTechnique.ADDITION_SANDBOX]: { subjectArea: "addition", skillTags: ["addition_within_20"] },
  [CountingTechnique.SUBTRACTION_SANDBOX]: { subjectArea: "subtraction", skillTags: ["subtraction_within_20"] },
  [CountingTechnique.MULTIPLICATION_ARRAY]: { subjectArea: "multiplication", skillTags: ["equal_groups", "arrays"] },
  [CountingTechnique.KODA_SUDOKU]: { subjectArea: "logic_puzzle", skillTags: ["row_col_box_uniqueness", "deductive_reasoning"] },
  [CountingTechnique.KODA_PATTERN]: { subjectArea: "pattern_recognition", skillTags: ["ab_patterns", "sequence_prediction"] },
  [CountingTechnique.FLEXIBLE_CANVAS]: { subjectArea: "sorting_classification", skillTags: ["classification"] },
  [CountingTechnique.ADDITION_TUTOR]: { subjectArea: "addition", skillTags: ["addition_carrying", "make_ten_regrouping"] },
  [CountingTechnique.ADDITION_COLUMN]: { subjectArea: "addition", skillTags: ["addition_carrying", "multi_digit_column_addition"] },
  [CountingTechnique.SUBTRACTION_COLUMN]: { subjectArea: "subtraction", skillTags: ["subtraction_borrowing", "multi_digit_column_subtraction"] },
  [CountingTechnique.ADDITION_COLUMN_MULTI]: { subjectArea: "addition", skillTags: ["addition_carrying", "multi_addend_column_addition"] },
  [CountingTechnique.SUBTRACTION_COLUMN_MULTI]: { subjectArea: "subtraction", skillTags: ["subtraction_borrowing", "multi_subtrahend_column_subtraction"] },
  [CountingTechnique.MULTIPLICATION_COLUMN]: { subjectArea: "multiplication", skillTags: ["partial_products", "multi_digit_column_multiplication"] },
  [CountingTechnique.LIQUID_SORT]: { subjectArea: "sorting_classification", skillTags: ["sorting", "classification"] },
  [CountingTechnique.GOODS_SORT]: { subjectArea: "sorting_classification", skillTags: ["goods_sorting", "classification", "logical_thinking", "planning_ahead"] },
  [CountingTechnique.NUMBER_PATH]: { subjectArea: "number_recognition", skillTags: ["count_to_120", "count_on", "numeral_recognition", "ten_more_ten_less"] },
  [CountingTechnique.STORY_PROBLEM_MAT]: { subjectArea: "addition", skillTags: ["addition_subtraction_stories", "word_problems", "unknown_quantities", "compare_problems"] },
  [CountingTechnique.PLACE_VALUE_LAB]: { subjectArea: "place_value", skillTags: ["tens_and_ones", "base_ten_blocks", "compose_decompose", "regroup_ten_ones"] },
  [CountingTechnique.EQUATION_MAT]: { subjectArea: "algebraic_thinking", skillTags: ["missing_addend", "equation_reasoning", "inverse_operations", "number_bonds"] },
  [CountingTechnique.COMPARE_NUMBERS]: { subjectArea: "place_value", skillTags: ["compare_two_digit", "tens_and_ones", "greater_less_equal"] },
  [CountingTechnique.CLOCK_READ]: { subjectArea: "measurement", skillTags: ["tell_time_hour", "tell_time_half_hour", "analog_clock"] },
  [CountingTechnique.MEASURE_LENGTH]: { subjectArea: "measurement", skillTags: ["length_units", "compare_lengths", "iterate_units"] },
  [CountingTechnique.DATA_CHART]: { subjectArea: "data_analysis", skillTags: ["organize_categories", "interpret_chart", "compare_counts"] },
  [CountingTechnique.SHAPE_LAB]: { subjectArea: "geometry", skillTags: ["shape_attributes", "compose_shapes", "equal_shares"] },
  [CountingTechnique.COUNT_CRATES]: { subjectArea: "counting", skillTags: ["count_out_a_number", "unitizing", "count_on", "compose_decompose", "regroup_ten_ones"] },
  [CountingTechnique.XTRA_MATH]: { subjectArea: "addition", skillTags: ["xtramath", "speed_math", "fluency", "math_facts"] },
};


export const getTaxonomy = (technique: CountingTechnique) =>
  TECHNIQUE_TAXONOMY[technique] || { subjectArea: "counting" as SubjectArea, skillTags: [] };

// ── Event schema ──────────────────────────────────────────────────────────────

export type LearningEventType =
  | "session_start"
  | "slide_view"
  | "attempt"
  | "hint_requested"
  | "slide_reset"
  | "lesson_complete";

/** Every "attempt" event carries one of these — the field the old schema was missing entirely. */
export type AttemptOutcome = "correct" | "incorrect" | "partial";

export const CURRENT_SCHEMA_VERSION = 1;

export interface LearningEvent {
  // ── Identity (DB primary key + foreign keys) ──
  id: string;
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  /** One per play-through. Stand-in for a real user session until auth exists. */
  sessionId: string;
  /** Null until there's a real student/roster system — kept nullable on purpose, not omitted, so the DB column exists from day one. */
  studentId: string | null;
  /** ISO 8601 UTC — sortable, timezone-safe, what a DB column should hold (not the old localized "02:51:43 PM" display string). */
  occurredAt: string;
  /** Redundant with occurredAt but cheap and avoids re-parsing ISO strings for latency math. */
  clientTimestampMs: number;

  // ── What slide/activity ──
  questionId: string;
  technique: CountingTechnique;
  /** Coarse, technique-level tagging — always present, from TECHNIQUE_TAXONOMY. Works even for questions nobody has curated yet. */
  subjectArea: SubjectArea;
  skillTags: SkillTag[];
  /**
   * Precise, content-level tagging — present only when the question being
   * played has a `skillId` (curriculum/types.ts). This is what lets mastery
   * roll up against the actual tree a teacher built ("Grade 1 / Math / Unit 1
   * / Addition Within 20") instead of just the generic "addition" bucket
   * subjectArea gives you. The two are independent on purpose: an
   * uncurated question still logs useful subjectArea data; a curated one
   * logs both.
   */
  curriculumSkillId?: string;
  /** Published curriculum document/revision that supplied this play session. */
  curriculumId?: string;
  curriculumRevision?: number;
  /** Immutable content snapshot that supplied this question. */
  releaseId?: string;
  /** Assigned learning path; populated when assignment delivery is enabled. */
  assignmentId?: string;
  /** Recommendation decision that selected this skill for the session. */
  recommendationRunId?: string;
  slideIndex: number;
  totalSlides: number;

  // ── What happened ──
  eventType: LearningEventType;
  /** Present only on "attempt" events. */
  outcome?: AttemptOutcome;
  /** 1st try, 2nd try... within this slide visit. Resets on slide_view. */
  attemptNumber?: number;
  /** Was a hint showing/used before this attempt — a wrong answer after a hint means something different than a cold wrong answer. */
  hintUsedBeforeAttempt?: boolean;
  /** Time since this slide's slide_view event, in ms. */
  timeOnTaskMs?: number;

  // ── Diagnostic detail — the "why" behind right/wrong, for recommendations ──
  /** The correct answer/value, stringified for storage uniformity across techniques (a number, an emoji, a grid cell). */
  expected?: unknown;
  /** What the child actually selected/produced. */
  selected?: unknown;
  /** |expected-selected| when both are numeric — lets a report rank "off by one" vs. "wild guess" differently. */
  errorMagnitude?: number;

  /** Human-readable, for teacher-facing UI and CSV export. */
  actionSummary: string;
  /** Free-form technique-specific extras that don't deserve their own column yet. */
  details?: Record<string, any>;
}

// ── Derived aggregate — the actual "recommend right or wrong" output ──────────

export type MasteryRecommendation =
  | "reinforce"        // accuracy low enough to indicate a real gap — flag for re-teaching
  | "practice_more"    // getting there, not yet automatic
  | "ready_to_advance" // consistently correct — could skip ahead
  | "insufficient_data";

export interface SkillMasterySnapshot {
  studentId: string | null;
  subjectArea: SubjectArea;
  skillTag: SkillTag;
  attempts: number;
  correct: number;
  accuracy: number; // 0-1
  avgAttemptsToSolve: number;
  avgTimeOnTaskMs: number;
  hintRate: number; // 0-1
  lastPracticedAt: string;
  recommendation: MasteryRecommendation;
}

// Exported — curriculum/types.ts reuses these for its skill-level rollup
// (computeCurriculumMastery) so "reinforce" means the same accuracy band
// everywhere in the app, not two thresholds that quietly drift apart.
export const MIN_ATTEMPTS_FOR_SIGNAL = 3;
export const REINFORCE_THRESHOLD = 0.6;
export const ADVANCE_THRESHOLD = 0.85;

/**
 * Turns raw "attempt" events into one row per (student, skill) — the shape a
 * "recommend this kid practice X" dashboard actually reads from. Pure
 * function over the event log; nothing here is persisted separately, so it's
 * always a fresh recomputation and never drifts from the source events.
 */
export function computeSkillMastery(events: LearningEvent[]): SkillMasterySnapshot[] {
  const attempts = events.filter((e): e is LearningEvent & { outcome: AttemptOutcome } =>
    e.eventType === "attempt" && !!e.outcome
  );

  const groups = new Map<string, LearningEvent[]>();
  for (const e of attempts) {
    for (const skillTag of e.skillTags.length ? e.skillTags : ["_ungrouped"]) {
      const key = `${e.studentId ?? "anonymous"}::${e.subjectArea}::${skillTag}`;
      const bucket = groups.get(key) || [];
      bucket.push(e);
      groups.set(key, bucket);
    }
  }

  const snapshots: SkillMasterySnapshot[] = [];
  for (const [key, bucket] of groups) {
    const [studentKey, subjectArea, skillTag] = key.split("::");
    const correct = bucket.filter(e => e.outcome === "correct").length;
    const accuracy = correct / bucket.length;
    const withHints = bucket.filter(e => e.hintUsedBeforeAttempt).length;
    const timed = bucket.filter(e => typeof e.timeOnTaskMs === "number");
    const attemptNumbers = bucket.filter(e => typeof e.attemptNumber === "number").map(e => e.attemptNumber!);
    const sortedByTime = [...bucket].sort((a, b) => a.clientTimestampMs - b.clientTimestampMs);

    let recommendation: MasteryRecommendation = "insufficient_data";
    if (bucket.length >= MIN_ATTEMPTS_FOR_SIGNAL) {
      recommendation = accuracy < REINFORCE_THRESHOLD ? "reinforce"
        : accuracy >= ADVANCE_THRESHOLD ? "ready_to_advance"
        : "practice_more";
    }

    snapshots.push({
      studentId: studentKey === "anonymous" ? null : studentKey,
      subjectArea: subjectArea as SubjectArea,
      skillTag,
      attempts: bucket.length,
      correct,
      accuracy,
      avgAttemptsToSolve: attemptNumbers.length ? attemptNumbers.reduce((a, b) => a + b, 0) / attemptNumbers.length : 0,
      avgTimeOnTaskMs: timed.length ? timed.reduce((a, e) => a + (e.timeOnTaskMs || 0), 0) / timed.length : 0,
      hintRate: withHints / bucket.length,
      lastPracticedAt: sortedByTime[sortedByTime.length - 1]?.occurredAt || "",
      recommendation,
    });
  }

  return snapshots.sort((a, b) => a.accuracy - b.accuracy); // weakest skills first — what a teacher wants to see first
}

/**
 * An ISO timestamp carrying the learner's own UTC offset, e.g. `2026-07-27T06:30:00.000+07:00`.
 *
 * `Date.toISOString()` always emits `Z`, so every event reached the server as UTC and the
 * learner's local calendar was unrecoverable. Anything that asks "which day was this?" then
 * answered in UTC: at +07:00 the first seven hours of a learner's day were credited to the
 * one before — a 6am practice extended yesterday's streak and left today looking empty.
 *
 * The instant is unchanged; only the frame it is expressed in. Both the streak
 * (`streak_days`) and the mastery engines' `distinctDays` read the date off this string, so
 * both now count the learner's days rather than Greenwich's.
 */
export function localIsoTimestamp(date: Date): string {
  const pad = (value: number, width = 2) => String(Math.abs(value)).padStart(width, "0");
  // getTimezoneOffset() is minutes *behind* UTC, so east of Greenwich is negative.
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes < 0 ? "-" : "+";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    + `.${pad(date.getMilliseconds(), 3)}`
    + `${sign}${pad(Math.trunc(offsetMinutes / 60))}:${pad(offsetMinutes % 60)}`
  );
}
