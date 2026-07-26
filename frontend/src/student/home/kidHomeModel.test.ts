import assert from "node:assert/strict";
import test from "node:test";
import type {
  CourseQueueItem,
  SkillProgress,
  StudentProgress,
} from "../../api/course";
import {
  activityDifficulty,
  activityUnitLabel,
  buildKidRewards,
  buildKidSkillPaths,
  kidCatchUpItem,
  kidSkillMastery,
  kidStarsForLevel,
  kidStarsToday,
  kidStats,
  questDotProgress,
  skillPathGlyph,
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

test("quest dots fill proportionally without misreporting the count", () => {
  assert.deepEqual(questDotProgress(0, 3), { dots: 3, filled: 0, done: 0 });
  assert.deepEqual(questDotProgress(2, 3), { dots: 3, filled: 2, done: 2 });
  assert.deepEqual(questDotProgress(3, 3), { dots: 3, filled: 3, done: 3 });
  // Past the cap the label keeps the real numbers — this used to read "8 / 8 done".
  assert.deepEqual(questDotProgress(10, 12), { dots: 8, filled: 7, done: 10 });
  assert.deepEqual(questDotProgress(12, 12), { dots: 8, filled: 8, done: 12 });
});

test("quest dots survive nonsense input", () => {
  assert.deepEqual(questDotProgress(5, 0), { dots: 0, filled: 0, done: 0 });
  assert.deepEqual(questDotProgress(-2, 3), { dots: 3, filled: 0, done: 0 });
  assert.deepEqual(questDotProgress(9, 3), { dots: 3, filled: 3, done: 3 });
  assert.deepEqual(questDotProgress(1, -4), { dots: 0, filled: 0, done: 0 });
});

const skill = (over: Partial<SkillProgress> = {}): SkillProgress => ({
  curriculumId: "c1",
  skillId: "s1",
  skillLabel: "Count to 10",
  unitId: "u1",
  unitLabel: "Counting & Number Sense",
  subjectId: "sub1",
  level: "beginner",
  highestEarnedLevel: "beginner",
  score: 0.5,
  components: {},
  plays: 1,
  sessions: 1,
  distinctDays: 1,
  hardPlays: 0,
  recentScore: 0.6,
  lastPracticedAt: null,
  nextReviewAt: null,
  isDue: false,
  nextLevel: "developing",
  toNextLevel: [],
  promotedAt: null,
  projectionStatus: "current",
  ...over,
});

const progressWith = (skills: SkillProgress[], over: Partial<StudentProgress> = {}): StudentProgress => ({
  studentId: "stu",
  scoringRevision: 1,
  engineRevision: "e1",
  rank: {
    tier: "bronze",
    tierLabel: "Bronze",
    mastered: 3,
    proficientPlus: 4,
    totalSkills: 10,
    assignedSkills: 10,
    progressToNext: 0.4,
  },
  rewardProfile: {
    totalXp: 240,
    level: null,
    achievements: [
      {
        curriculumId: "c1",
        id: "first-win",
        label: "First Win",
        description: "",
        metric: "lessonsCompleted",
        target: 1,
        icon: "award",
        accent: "amber",
        current: 8,
        earned: true,
        progress: 1,
      },
    ],
  },
  skills,
  ...over,
});

test("welcome-band stats come from real contract fields", () => {
  const stats = kidStats(progressWith([skill()]), 5);
  assert.deepEqual(stats, { streakDays: 5, totalXp: 240, mastered: 3, activitiesDone: 8 });
});

test("stats degrade to zeros without progress, and never show a negative streak", () => {
  assert.deepEqual(kidStats(null, -3), { streakDays: 0, totalXp: 0, mastered: 0, activitiesDone: 0 });
});

test("skill paths group by unit, count mastery and due work, and name the last milestone", () => {
  const paths = buildKidSkillPaths(progressWith([
    skill({ skillId: "a", level: "master", promotedAt: "2026-07-01T00:00:00Z", skillLabel: "Count to 20" }),
    skill({ skillId: "b", level: "proficient" }),
    skill({ skillId: "c", level: "developing", isDue: true }),
    skill({ skillId: "d", unitId: "u2", unitLabel: "Addition", level: "beginner" }),
  ]));
  assert.equal(paths.length, 2);
  assert.deepEqual(
    { ...paths[0] },
    {
      id: "u1",
      title: "Counting & Number Sense",
      mastered: 2,
      total: 3,
      duePractice: 1,
      milestone: "Mastered Count to 20",
    },
  );
  assert.equal(paths[1].title, "Addition");
});

test("skills with no unit label fall back to a neutral bucket, never a raw id", () => {
  const paths = buildKidSkillPaths(progressWith([skill({ unitId: "u9", unitLabel: null })]));
  assert.equal(paths[0].title, "Other skills");
  assert.deepEqual(buildKidSkillPaths(null), []);
});

test("next-up mastery reads the matching skill only", () => {
  const progress = progressWith([skill({ skillId: "s1", score: 0.65 })]);
  assert.equal(kidSkillMastery(progress, { curriculumId: "c1", skillId: "s1" }), 0.65);
  assert.equal(kidSkillMastery(progress, { curriculumId: "c1", skillId: "nope" }), undefined);
  assert.equal(kidSkillMastery(null, { curriculumId: "c1", skillId: "s1" }), undefined);
});

test("skill-path glyphs follow the unit name, with counting as the default", () => {
  assert.equal(skillPathGlyph("Addition"), "+");
  assert.equal(skillPathGlyph("Subtraction"), "−");
  assert.equal(skillPathGlyph("Take away within 10"), "−");
  assert.equal(skillPathGlyph("Multiplication tables"), "×");
  assert.equal(skillPathGlyph("Division"), "÷");
  assert.equal(skillPathGlyph("Counting & Number Sense"), "123");
  assert.equal(skillPathGlyph(""), "123");
});

const recItem = (over: Partial<CourseQueueItem> = {}): CourseQueueItem => ({
  assignmentId: "a1",
  releaseId: "r1",
  curriculumId: "c1",
  curriculumRevision: 1,
  skillId: "s1",
  skillLabel: "Spot the number",
  kind: "new",
  reason: "Because you practised counting",
  optional: false,
  questions: [],
  ...over,
});

const q = (difficulty: string) => ({ id: `q-${difficulty}`, difficulty }) as never;

test("difficulty is set by the hardest question, never advertised easier than it plays", () => {
  assert.deepEqual(activityDifficulty(recItem({ questions: [q("easy"), q("easy")] })), {
    level: "easy", label: "Easy", filled: 1,
  });
  assert.deepEqual(activityDifficulty(recItem({ questions: [q("easy"), q("medium")] })), {
    level: "medium", label: "Medium", filled: 2,
  });
  assert.deepEqual(activityDifficulty(recItem({ questions: [q("easy"), q("hard"), q("medium")] })), {
    level: "hard", label: "Hard", filled: 3,
  });
});

test("difficulty is omitted when no question declares one", () => {
  assert.equal(activityDifficulty(recItem({ questions: [] })), null);
  assert.equal(activityDifficulty(recItem({ questions: [q("unknown")] })), null);
});

test("the unit subtitle comes from the matching progress row", () => {
  const progress = progressWith([skill({ skillId: "s1", unitLabel: "Counting & Number Sense" })]);
  assert.equal(activityUnitLabel(progress, { curriculumId: "c1", skillId: "s1" }), "Counting & Number Sense");
  assert.equal(activityUnitLabel(progress, { curriculumId: "c1", skillId: "other" }), undefined);
  assert.equal(activityUnitLabel(null, { curriculumId: "c1", skillId: "s1" }), undefined);
});
