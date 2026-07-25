import assert from "node:assert/strict";
import test from "node:test";
import type {
  CourseQueueItem,
  SkillProgress,
  StudentProgress,
} from "../../api/course";
import {
  buildKidRewards,
  kidCatchUpItem,
  kidStarsForLevel,
  kidStarsToday,
} from "./kidHomeModel";

const queueItem = (
  skillId: string,
  kind: CourseQueueItem["kind"] = "free",
): CourseQueueItem => ({
  assignmentId: "assignment-1",
  releaseId: "release-1",
  curriculumId: "curriculum-1",
  curriculumRevision: 1,
  skillId,
  skillLabel: `Skill ${skillId}`,
  kind,
  reason: "",
  optional: kind === "free",
  questions: [{ id: `question-${skillId}` } as CourseQueueItem["questions"][number]],
});

const skillProgress = (
  skillId: string,
  overrides: Partial<SkillProgress> = {},
): SkillProgress => ({
  curriculumId: "curriculum-1",
  skillId,
  skillLabel: `Skill ${skillId}`,
  level: "beginner",
  highestEarnedLevel: "beginner",
  score: 0.4,
  components: {},
  plays: 1,
  sessions: 1,
  distinctDays: 1,
  hardPlays: 0,
  recentScore: 0.4,
  lastPracticedAt: "2026-07-24T03:00:00.000Z",
  nextReviewAt: null,
  isDue: false,
  nextLevel: "developing",
  toNextLevel: [],
  promotedAt: null,
  projectionStatus: "current",
  ...overrides,
});

const studentProgress = (skills: SkillProgress[]): StudentProgress => ({
  studentId: "student-1",
  scoringRevision: 1,
  engineRevision: "test",
  rank: {
    tier: "rookie",
    tierLabel: "Rookie",
    mastered: 0,
    proficientPlus: 0,
    totalSkills: skills.length,
    assignedSkills: skills.length,
    progressToNext: 0,
  },
  skills,
});

test("kid rewards only include played skills that have a playable catalog item", () => {
  const progress = studentProgress([
    skillProgress("older", { lastPracticedAt: "2026-07-22T03:00:00.000Z" }),
    skillProgress("newer", { level: "master", lastPracticedAt: "2026-07-24T03:00:00.000Z" }),
    skillProgress("missing"),
    skillProgress("unplayed", { plays: 0 }),
  ]);

  const rewards = buildKidRewards(progress, [
    queueItem("older"),
    queueItem("newer"),
    queueItem("unplayed"),
  ]);

  assert.deepEqual(rewards.map(reward => reward.item.skillId), ["newer", "older"]);
  assert.deepEqual(rewards.map(reward => reward.stars), [3, 1]);
});

test("kid star levels stay in the three-icon reward scale", () => {
  assert.equal(kidStarsForLevel("not_started"), 0);
  assert.equal(kidStarsForLevel("beginner"), 1);
  assert.equal(kidStarsForLevel("developing"), 1);
  assert.equal(kidStarsForLevel("proficient"), 2);
  assert.equal(kidStarsForLevel("master"), 3);
});

test("today count uses the learner's local calendar day", () => {
  const now = new Date(2026, 6, 24, 12);
  const today = new Date(2026, 6, 24, 8).toISOString();
  const yesterday = new Date(2026, 6, 23, 23).toISOString();
  const progress = studentProgress([
    skillProgress("today", { lastPracticedAt: today }),
    skillProgress("yesterday", { lastPracticedAt: yesterday }),
  ]);

  assert.equal(kidStarsToday(progress, now), 1);
});

test("catch-up chooses a due item after the hero", () => {
  const queue = [
    queueItem("hero", "new"),
    queueItem("stretch", "stretch"),
    queueItem("review", "review"),
  ];

  assert.equal(kidCatchUpItem(queue)?.skillId, "review");
  assert.equal(kidCatchUpItem([queueItem("hero", "reinforce")]), null);
});
