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

export interface Unit {
  id: string;         // "g1-math-unit-1"
  subjectId: string;  // FK -> Subject.id
  label: string;      // "Unit 1"
  order: number;
  description?: string;
  learningObjectives?: string[];
}

export interface Skill {
  id: string;            // "g1-math-u1-counting-0-120"
  unitId: string;        // FK -> Unit.id
  label: string;         // "Counting & Number Sense (0–120)"
  description?: string;
  /** Optional standards alignment, e.g. Common Core "1.NBT.A.1" — purely informational, nothing reads it yet. */
  standardRef?: string;
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
    accent?: "purple" | "blue" | "green" | "amber" | "pink";
  };
  /** Optional override for this skill's completion bonus. */
  completionXp?: number;
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

/**
 * Curriculum subjects that at least one question type can actually serve.
 * Every technique in logSchema.ts's TECHNIQUE_TAXONOMY is a counting/math
 * interaction today, so only Math is served — a Language Arts or Art skill can
 * be authored in the tree but has no playable question type behind it yet.
 *
 * This is the ONE place the studio checks. When a non-math technique lands
 * (a phonics game, say), add that subject's code (or label) here — don't
 * re-hardcode the check at the call site. Entries are matched
 * case-insensitively against a Subject's stable `code` first, then its `label`,
 * so renaming a subject's display label alone won't silently break coverage.
 */
export const SUBJECT_KEYS_WITH_QUESTION_SUPPORT = new Set(["math"]);

export function subjectHasQuestionSupport(subject: Pick<Subject, "code" | "label">): boolean {
  const code = subject.code?.trim().toLowerCase();
  if (code && SUBJECT_KEYS_WITH_QUESTION_SUPPORT.has(code)) return true;
  return SUBJECT_KEYS_WITH_QUESTION_SUPPORT.has(subject.label.trim().toLowerCase());
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

/**
 * Registry-style self-check, same shape/spirit as ai-generator's
 * auditRegistry() — run it in the studio to catch structural problems before
 * a teacher notices a skill quietly has 3 questions instead of 10.
 */
export interface CurriculumIssue {
  level: "grade" | "subject" | "unit" | "skill" | "question";
  id: string;
  severity: "error" | "warning";
  message: string;
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

  questionSkillIds.forEach((id, i) => {
    if (id && !skillIds.has(id)) {
      issues.push({ level: "question", id: `question[${i}]`, severity: "error", message: `assigned to missing skill "${id}"` });
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
