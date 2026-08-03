/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Curriculum hierarchy: Grade → Subject → Unit → Skill → Questions.
 *
 * This is a metadata layer ON TOP of the existing CountingQuestion model —
 * no canvas, no CountingTechnique, nothing about how a question plays
 * changes. A Question opts into the tree with one new optional field
 * (`skillId`); everything without it is simply not part of a curriculum yet,
 * exactly like every worksheet that already exists.
 *
 * Deliberately NOT modeled as one-to-one with CountingTechnique: a Skill is
 * a pedagogical target ("Counting & Number Sense"), not an implementation
 * detail. A single skill is typically served by MANY techniques — One-to-One
 * for a first pass, Count On for the next, Group in Tens once numbers pass
 * 10 — the same way a textbook unit mixes exercise types. See
 * services/logSchema.ts's TECHNIQUE_TAXONOMY for the (different, coarser)
 * technique→subject tagging used for analytics; this file is about
 * authored content organization, that one is about play-event tagging.
 */

import { LearningEvent, MasteryRecommendation, MIN_ATTEMPTS_FOR_SIGNAL, REINFORCE_THRESHOLD, ADVANCE_THRESHOLD } from "../services/logSchema";

/** Each level only points at its parent — never duplicate a grandparent id onto a child. Walk the tree with getSkillPath(). */

export interface Grade {
  id: string;      // "grade-1"
  label: string;   // "Grade 1"
  order: number;
  description?: string;
  ageRange?: string;
  code?: string;
  active?: boolean;
}

export interface Subject {
  id: string;       // "grade-1-math"
  gradeId: string;  // FK -> Grade.id
  label: string;    // "Math"
  order: number;
  description?: string;
  code?: string;
  icon?: string;
  color?: string;
  active?: boolean;
}

export type UnitIcon = "hash" | "brain" | "shapes" | "puzzle" | "sparkles" | "book" | "leaf" | "paw" | "weather";
export type UnitAccent = "purple" | "blue" | "green" | "amber" | "pink";

export interface Unit {
  id: string;         // "g1-math-unit-1"
  subjectId: string;  // FK -> Subject.id
  label: string;      // "Unit 1"
  order: number;
  description?: string;
  learningObjectives?: string[];
  /** Learner-facing unit marker. Skill artwork remains configured on each skill. */
  presentation?: {
    icon?: UnitIcon;
    accent?: UnitAccent;
  };
}

export interface Skill {
  id: string;            // "g1-math-u1-counting-0-120"
  unitId: string;        // FK -> Unit.id
  label: string;         // "Counting & Number Sense (0–120)"
  description?: string;
  /** Optional standards alignment, e.g. Common Core "1.NBT.A.1" — purely informational, nothing reads it yet. */
  standardRef?: string;
  /**
   * What this skill teaches, named so it survives the curriculum that teaches it:
   * `number.place-value.make-a-ten`.
   *
   * `id` is unique to one curriculum, so mastery keyed on it stops at the grade boundary —
   * Grade 2 cannot state a prerequisite on Grade 1's "make a ten", review it, or see that the
   * learner already knows it. A concept id is the same string in every grade that touches the
   * idea, which is what makes twelve grades one path instead of twelve islands.
   *
   * Recorded now, read later. Nothing consumes it yet — but releases are immutable, so a skill
   * published without one carries that gap forever, and the only later fix is a mapping table
   * that grows with every release ever cut.
   */
  conceptId?: string;
  order: number;
  /** "at least 10 questions" — configurable per skill since not every skill needs the same depth. */
  minQuestions: number;
  /** Student-facing presentation, resolved from the published release. */
  presentation?: {
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    /** Stable reference to an SVG saved in the adult account's shared library. */
    thumbnailAssetId?: string;
    /** Roughly how long this activity takes, shown to the learner. 1–90. */
    estimatedMinutes?: number;
    accent?: "purple" | "blue" | "green" | "amber" | "pink";
  };
  /** Optional override for this skill's completion bonus. */
  completionXp?: number;
  /** Include this skill when generating a diagnostic from a published release. */
  placementCheckpoint?: boolean;
}

export interface CurriculumRewards {
  quest: {
    label: string;
    activitiesPerSession: number;
  };
  xp: {
    correctAnswer: number;
    firstTryBonus: number;
    activityCompletion: number;
  };
  level: {
    xpPerLevel: number;
  };
  achievements: CurriculumAchievement[];
}

export type AchievementMetric =
  | "xpEarned"
  | "lessonsCompleted"
  | "firstTryCorrect"
  | "proficientSkills"
  | "masteredSkills"
  | "streakDays";

export type AchievementIcon = "star" | "medal" | "award" | "trophy" | "gem" | "flame";

export interface CurriculumAchievement {
  id: string;
  label: string;
  description: string;
  metric: AchievementMetric;
  target: number;
  icon: AchievementIcon;
  accent: "purple" | "blue" | "green" | "amber" | "pink";
}

export interface CurriculumTree {
  id?: string;
  title?: string;
  description?: string;
  version?: string;
  /** Primary catalog context shown when Curriculum Studio opens. */
  primaryGradeId?: string;
  primarySubjectId?: string;
  rewards?: CurriculumRewards;
  grades: Grade[];
  subjects: Subject[];
  units: Unit[];
  skills: Skill[];
}

/**
 * The "who". Deliberately minimal — no auth exists yet, so this is the
 * smallest shape that lets a play session mean something: which grade
 * they're enrolled in (so the curriculum tree can filter to what's theirs)
 * and a name for the teacher's UI. Nothing else in the app currently
 * identifies a student — see the note on GameLauncher wiring at the bottom
 * of this file for the one missing link this doesn't solve by itself.
 */
export interface Student {
  id: string;
  name: string;
  /** FK -> Grade.id — current enrollment. Move a student up a grade by changing this one field; no history is tracked, matching every other entity here. */
  gradeId: string;
  avatarEmoji?: string;
  joinedAt: string; // ISO date
}

export const DEFAULT_MIN_QUESTIONS = 10;
export const DEFAULT_CURRICULUM_REWARDS: CurriculumRewards = {
  quest: { label: "Today’s quest", activitiesPerSession: 3 },
  xp: { correctAnswer: 0, firstTryBonus: 0, activityCompletion: 0 },
  level: { xpPerLevel: 0 },
  achievements: [],
};

export const curriculumRewards = (tree: CurriculumTree): CurriculumRewards => ({
  quest: {
    label: tree.rewards?.quest?.label || DEFAULT_CURRICULUM_REWARDS.quest.label,
    activitiesPerSession: tree.rewards?.quest?.activitiesPerSession
      ?? DEFAULT_CURRICULUM_REWARDS.quest.activitiesPerSession,
  },
  xp: {
    correctAnswer: tree.rewards?.xp?.correctAnswer
      ?? DEFAULT_CURRICULUM_REWARDS.xp.correctAnswer,
    firstTryBonus: tree.rewards?.xp?.firstTryBonus
      ?? DEFAULT_CURRICULUM_REWARDS.xp.firstTryBonus,
    activityCompletion: tree.rewards?.xp?.activityCompletion
      ?? DEFAULT_CURRICULUM_REWARDS.xp.activityCompletion,
  },
  level: {
    xpPerLevel: tree.rewards?.level?.xpPerLevel
      ?? DEFAULT_CURRICULUM_REWARDS.level.xpPerLevel,
  },
  achievements: tree.rewards?.achievements ?? [],
});

/*
 * There was a `SUBJECT_KEYS_WITH_QUESTION_SUPPORT = new Set(["math"])` allow-list here,
 * behind a studio warning that no question type could serve the selected subject.
 *
 * Its premise ("every technique is a counting interaction") stopped being true: the
 * taxonomy in services/logSchema.ts gives KODA_SUDOKU `logic_puzzle`, KODA_PATTERN
 * `pattern_recognition`, and LIQUID_SORT / FLEXIBLE_CANVAS `sorting_classification`.
 * The list then warned on four of five real subjects — including Science and
 * Thinking & Logic, both of which ship published, playable, server-graded questions.
 *
 * It is deliberately not replaced with a longer list: any new subject would inherit
 * the same false warning until someone remembered to edit it. Whether a subject can
 * actually be played is already answered by data rather than a constant — `content_ready`
 * on the subject (an active offering exists) and the per-skill question counts the
 * studio sidebar already renders.
 */

// ── Authored duration ─────────────────────────────────────────────────────

/**
 * Bounds for `presentation.estimatedMinutes`. The studio's number input and its validation
 * message read the same two constants, so the field can never advertise a range it rejects.
 */
export const SKILL_MINUTES_MIN = 1;
export const SKILL_MINUTES_MAX = 90;

export function isValidSkillMinutes(minutes: number | undefined): boolean {
  return minutes === undefined
    || (Number.isInteger(minutes) && minutes >= SKILL_MINUTES_MIN && minutes <= SKILL_MINUTES_MAX);
}

/**
 * A skill's authored duration, or null when the author left it blank. Never estimated from
 * question count: the learner card shows what the curriculum authored rather than guessing a
 * duration, and the studio has to show the author the same truth.
 */
export function formatSkillMinutes(skill: Skill): string | null {
  const minutes = skill.presentation?.estimatedMinutes;
  return typeof minutes === "number" ? `${minutes} min` : null;
}

export interface UnitMinutes {
  /** Sum of the authored minutes present. Skills without one contribute nothing. */
  total: number;
  /** How many skills still need a duration — what an author has left to fill in. */
  missing: number;
}

/** Unit-level rollup of authored durations, for the unit header. */
export function sumSkillMinutes(skills: Skill[]): UnitMinutes {
  return skills.reduce<UnitMinutes>((totals, skill) => {
    const minutes = skill.presentation?.estimatedMinutes;
    return typeof minutes === "number"
      ? { total: totals.total + minutes, missing: totals.missing }
      : { total: totals.total, missing: totals.missing + 1 };
  }, { total: 0, missing: 0 });
}

// ── Tree lookups ──────────────────────────────────────────────────────────

export interface SkillPath {
  grade: Grade;
  subject: Subject;
  unit: Unit;
  skill: Skill;
}

/** Walks a skill up to its grade — the "Grade 1 / Math / Unit 1 / Counting & Number Sense" breadcrumb. */
export function getSkillPath(skillId: string, tree: CurriculumTree): SkillPath | null {
  const skill = tree.skills.find(s => s.id === skillId);
  if (!skill) return null;
  const unit = tree.units.find(u => u.id === skill.unitId);
  if (!unit) return null;
  const subject = tree.subjects.find(s => s.id === unit.subjectId);
  if (!subject) return null;
  const grade = tree.grades.find(g => g.id === subject.gradeId);
  if (!grade) return null;
  return { grade, subject, unit, skill };
}

export function formatSkillPath(path: SkillPath, sep = " / "): string {
  return [path.grade.label, path.subject.label, path.unit.label, path.skill.label].join(sep);
}

// ── Coverage — the "at least 10 questions" rule, made checkable ───────────

export interface SkillCoverage {
  skill: Skill;
  questionCount: number;
  minQuestions: number;
  isComplete: boolean;
  /** How many more questions this skill needs to hit its minimum. 0 if already met. */
  shortfall: number;
}

/**
 * questionSkillIds: the skillId of every question in the deck (question.skillId),
 * already extracted by the caller so this module has no dependency on the
 * CountingQuestion type.
 */
export function computeSkillCoverage(tree: CurriculumTree, questionSkillIds: (string | undefined)[]): SkillCoverage[] {
  const counts = new Map<string, number>();
  for (const id of questionSkillIds) {
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return tree.skills.map(skill => {
    const questionCount = counts.get(skill.id) || 0;
    const min = skill.minQuestions || DEFAULT_MIN_QUESTIONS;
    return {
      skill,
      questionCount,
      minQuestions: min,
      isComplete: questionCount >= min,
      shortfall: Math.max(0, min - questionCount),
    };
  });
}

export interface CurriculumQuestionReference {
  curriculumId?: string;
  skillId?: string;
}

/** Scope the account-wide question deck to one curriculum, retaining legacy rows by skill. */
export function questionSkillIdsForCurriculum(
  tree: CurriculumTree,
  curriculumId: string | undefined,
  questions: CurriculumQuestionReference[],
): (string | undefined)[] {
  if (!curriculumId) return questions.map(question => question.skillId);
  const currentSkillIds = new Set(tree.skills.map(skill => skill.id));
  return questions
    .filter(question => (
      question.curriculumId
        ? question.curriculumId === curriculumId
        : Boolean(question.skillId && currentSkillIds.has(question.skillId))
    ))
    .map(question => question.skillId);
}

/**
 * Registry-style self-check, same shape/spirit as ai-generator's
 * auditRegistry() — run it in the studio to catch structural problems before
 * a teacher notices a skill quietly has 3 questions instead of 10.
 */
export interface CurriculumIssue {
  level: "grade" | "subject" | "unit" | "skill" | "question" | "rewards";
  id: string;
  severity: "error" | "warning";
  message: string;
}

/** Dotted lowercase segments: `number.place-value.make-a-ten`. */
export const CONCEPT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/**
 * Concept ids are only useful if they mean the same thing everywhere, so the two ways of
 * breaking that are checked — and nothing else.
 *
 * Deliberately silent about skills that have no concept id at all. Most existing content has
 * none, and a warning on every one of them would bury the issues worth reading.
 */
export function auditConceptIds(tree: CurriculumTree): CurriculumIssue[] {
  const issues: CurriculumIssue[] = [];
  const seen = new Map<string, string>();

  tree.skills.forEach(skill => {
    const conceptId = skill.conceptId?.trim();
    if (!conceptId) return;
    if (!CONCEPT_ID_PATTERN.test(conceptId)) {
      issues.push({
        level: "skill", id: skill.id, severity: "warning",
        message: `concept id "${conceptId}" is not a dotted lowercase name, e.g. "number.counting.to-20"`,
      });
    }
    const owner = seen.get(conceptId);
    if (owner) {
      // Two skills claiming one concept makes the learner's history for it ambiguous.
      issues.push({
        level: "skill", id: skill.id, severity: "error",
        message: `concept id "${conceptId}" is already used by skill "${owner}"`,
      });
    } else {
      seen.set(conceptId, skill.id);
    }
  });

  return issues;
}

export function auditCurriculum(tree: CurriculumTree, questionSkillIds: (string | undefined)[]): CurriculumIssue[] {
  const issues: CurriculumIssue[] = [];

  const gradeIds = new Set(tree.grades.map(g => g.id));
  const subjectIds = new Set(tree.subjects.map(s => s.id));
  const unitIds = new Set(tree.units.map(u => u.id));
  const skillIds = new Set(tree.skills.map(s => s.id));

  tree.subjects.forEach(s => { if (!gradeIds.has(s.gradeId)) issues.push({ level: "subject", id: s.id, severity: "error", message: `references missing grade "${s.gradeId}"` }); });
  tree.units.forEach(u => { if (!subjectIds.has(u.subjectId)) issues.push({ level: "unit", id: u.id, severity: "error", message: `references missing subject "${u.subjectId}"` }); });
  tree.skills.forEach(sk => { if (!unitIds.has(sk.unitId)) issues.push({ level: "skill", id: sk.id, severity: "error", message: `references missing unit "${sk.unitId}"` }); });

  tree.units.forEach(u => {
    if (!tree.skills.some(sk => sk.unitId === u.id)) {
      issues.push({ level: "unit", id: u.id, severity: "warning", message: `"${u.label}" has no skills yet` });
    }
  });

  computeSkillCoverage(tree, questionSkillIds).forEach(cov => {
    if (!cov.isComplete) {
      issues.push({
        level: "skill", id: cov.skill.id, severity: "warning",
        message: `"${cov.skill.label}" has ${cov.questionCount}/${cov.minQuestions} questions — needs ${cov.shortfall} more`,
      });
    }
  });

  issues.push(...auditConceptIds(tree));

  const orphanCounts = new Map<string, number>();
  questionSkillIds.forEach(id => {
    if (id && !skillIds.has(id)) orphanCounts.set(id, (orphanCounts.get(id) || 0) + 1);
  });
  orphanCounts.forEach((count, id) => {
    issues.push({
      level: "question",
      id,
      severity: "error",
      message: `${count} question${count === 1 ? " is" : "s are"} assigned to deleted skill "${id}"`,
    });
  });

  issues.push(...auditRewards(tree));

  return issues;
}

/**
 * Rewards that are absent, inert, or impossible for *this* curriculum.
 *
 * A curriculum with no rewards block awards nothing, by design — the engine refuses to mint
 * XP nobody authored. But that failure is invisible: no error, no warning, just a counter
 * that never moves while a child keeps playing. It is only discoverable by reading the
 * database, which is how it was found.
 *
 * The reachability check is the part that has to know the curriculum: a badge asking for more
 * proficient skills than the curriculum contains can never be earned, and a child chasing it
 * has no way to know that.
 */
export function auditRewards(tree: CurriculumTree): CurriculumIssue[] {
  const issues: CurriculumIssue[] = [];
  const rewards = tree.rewards;

  if (!rewards) {
    issues.push({
      level: "rewards", id: "rewards", severity: "warning",
      message: "no rewards are configured — learners earn 0 XP and never level up",
    });
    return issues;
  }

  const xp = rewards.xp ?? ({} as CurriculumRewards["xp"]);
  const perActivity =
    (xp.correctAnswer ?? 0) + (xp.firstTryBonus ?? 0) + (xp.activityCompletion ?? 0);
  if (perActivity <= 0) {
    issues.push({
      level: "rewards", id: "rewards.xp", severity: "warning",
      message: "every XP award is 0 — playing earns nothing",
    });
  }

  if (!rewards.level?.xpPerLevel) {
    issues.push({
      level: "rewards", id: "rewards.level", severity: "warning",
      message: "no XP-per-level threshold — learners never level up",
    });
  }

  // What this curriculum can actually produce, so an unreachable badge is caught here rather
  // than by a child who keeps trying.
  const skillCount = tree.skills.length;
  const ceilings: Partial<Record<AchievementMetric, { max: number; noun: string }>> = {
    proficientSkills: { max: skillCount, noun: "skills" },
    masteredSkills: { max: skillCount, noun: "skills" },
  };

  (rewards.achievements ?? []).forEach(achievement => {
    const ceiling = ceilings[achievement.metric];
    if (ceiling && achievement.target > ceiling.max) {
      issues.push({
        level: "rewards", id: achievement.id, severity: "warning",
        message: `"${achievement.label}" needs ${achievement.target} ${ceiling.noun} but this curriculum only has ${ceiling.max} — it can never be earned`,
      });
    }
  });

  return issues;
}

// ── Student mastery — where a Student's real play data meets the curriculum tree ──

export interface CurriculumMasterySnapshot {
  studentId: string | null;
  skillId: string;
  /** Full Grade / Subject / Unit / Skill breadcrumb — null only if the event references a skill no longer in the tree. */
  path: SkillPath | null;
  attempts: number;
  correct: number;
  accuracy: number; // 0-1
  avgAttemptsToSolve: number;
  lastPracticedAt: string;
  recommendation: MasteryRecommendation;
}

/**
 * The function that actually answers "is this student learning this skill?" —
 * groups LearningEvents by (studentId, curriculumSkillId) instead of
 * logSchema's coarser (studentId, technique-taxonomy subjectArea/skillTag).
 * Only events from curated, skill-assigned questions count; play on
 * un-curated questions still logs (via subjectArea) but doesn't appear here.
 *
 * Same thresholds as services/logSchema.ts's computeSkillMastery — imported,
 * not restated — so "reinforce" means one thing across the whole app.
 */
export function computeCurriculumMastery(events: LearningEvent[], tree: CurriculumTree): CurriculumMasterySnapshot[] {
  const attempts = events.filter(
    (e): e is LearningEvent & { outcome: NonNullable<LearningEvent["outcome"]>; curriculumSkillId: string } =>
      e.eventType === "attempt" && !!e.outcome && !!e.curriculumSkillId
  );

  const groups = new Map<string, LearningEvent[]>();
  for (const e of attempts) {
    const key = `${e.studentId ?? "anonymous"}::${e.curriculumSkillId}`;
    const bucket = groups.get(key) || [];
    bucket.push(e);
    groups.set(key, bucket);
  }

  const snapshots: CurriculumMasterySnapshot[] = [];
  for (const [key, bucket] of groups) {
    const separatorIdx = key.indexOf("::");
    const studentKey = key.slice(0, separatorIdx);
    const skillId = key.slice(separatorIdx + 2);

    const correct = bucket.filter(e => e.outcome === "correct").length;
    const accuracy = correct / bucket.length;
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
      skillId,
      path: getSkillPath(skillId, tree),
      attempts: bucket.length,
      correct,
      accuracy,
      avgAttemptsToSolve: attemptNumbers.length ? attemptNumbers.reduce((a, b) => a + b, 0) / attemptNumbers.length : 0,
      lastPracticedAt: sortedByTime[sortedByTime.length - 1]?.occurredAt || "",
      recommendation,
    });
  }

  return snapshots.sort((a, b) => a.accuracy - b.accuracy);
}

/**
 * ── The one missing link ──────────────────────────────────────────────
 *
 * StudentCurriculumPlayer now supplies the authenticated learner plus the
 * published curriculum id/revision. GameLauncher adds the question's skillId,
 * and the server always replaces the payload student id with the token owner.
 */
