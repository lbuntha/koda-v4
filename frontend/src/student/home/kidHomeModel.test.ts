import assert from "node:assert/strict";
import test from "node:test";
import type {
  CourseQueueItem,
  CurriculumPath,
  PathSkill,
  SkillProgress,
  StudentProgress,
} from "../../api/course";
import {
  activityDifficulty,
  activityUnitLabel,
  buildKidRewards,
  buildKidSkillPaths,
  buildUnitCards,
  kidCatchUpItem,
  kidLastScore,
  kidReason,
  kidSkillMastery,
  kidStarsForLevel,
  kidStarsToday,
  kidStats,
  pickKidHero,
  questDotProgress,
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

test("an in-progress activity takes the hero slot without reordering the plan", () => {
  const queue = [
    queueItem("gap", "reinforce"),
    { ...queueItem("started", "continue"), status: "in_progress" as const },
    queueItem("fresh", "new"),
  ];

  const { hero, rest } = pickKidHero(queue);
  assert.equal(hero?.skillId, "started");
  assert.deepEqual(rest.map(item => item.skillId), ["gap", "fresh"]);
});

test("the hero falls back to the engine's first pick", () => {
  const queue = [queueItem("gap", "reinforce"), queueItem("fresh", "new")];

  const { hero, rest } = pickKidHero(queue);
  assert.equal(hero?.skillId, "gap");
  assert.deepEqual(rest.map(item => item.skillId), ["fresh"]);
  assert.deepEqual(pickKidHero([]), { hero: null, rest: [] });
});

test("completed activities do not appear again as active recommendations", () => {
  const completed = { ...queueItem("done"), status: "completed" as const };
  const ready = queueItem("ready");

  assert.deepEqual(pickKidHero([completed, ready]), { hero: ready, rest: [] });
  assert.deepEqual(pickKidHero([completed]), { hero: null, rest: [] });
});

test("kid reasons replace engine language for every bucket", () => {
  const kinds: CourseQueueItem["kind"][] = [
    "reinforce", "continue", "review", "new", "stretch", "free",
  ];

  kinds.forEach(kind => {
    const reason = kidReason({
      ...queueItem("skill", kind),
      reason: "Next skill at your learning frontier",
    });
    assert.notEqual(reason, "Next skill at your learning frontier");
    assert.ok(reason.length > 0);
  });
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
    skill({ skillId: "b", level: "proficient", skillLabel: "Count to 50" }),
    skill({ skillId: "c", level: "developing", isDue: true }),
    skill({ skillId: "d", unitId: "u2", unitLabel: "Addition", level: "beginner" }),
  ]));
  assert.equal(paths.length, 2);
  assert.equal(paths[0].id, "u1");
  assert.equal(paths[0].title, "Counting & Number Sense");
  assert.equal(paths[0].total, 3);
  assert.equal(paths[0].duePractice, 1);
  assert.equal(paths[0].milestone, "Mastered Count to 20");
  // "mastered" is master only, matching the welcome band's tile. `proficient` is "strong".
  assert.equal(paths[0].mastered, 1);
  assert.equal(paths[0].strong, 2);
  assert.equal(paths[1].title, "Addition");
});

test("path progress spans the whole ladder, not a mastered/total ratio", () => {
  const [path] = buildKidSkillPaths(progressWith([
    skill({ skillId: "a", level: "developing" }),
    skill({ skillId: "b", level: "developing" }),
  ]));
  // Two skills halfway up a five-rung ladder is genuinely half-way. Counting only masters
  // would report 0% and tell a child their real work counted for nothing.
  assert.equal(path.progress, 0.5);
  assert.equal(path.mastered, 0);
  assert.deepEqual(path.rungs, ["developing", "developing"]);
});

test("a fully mastered path reads 100% and asks for nothing next", () => {
  const [path] = buildKidSkillPaths(progressWith([
    skill({ skillId: "a", level: "master" }),
    skill({ skillId: "b", level: "master" }),
  ]));
  assert.equal(path.progress, 1);
  assert.equal(path.nextSkill, undefined);
});

test("the next skill is the first one not yet mastered, in curriculum order", () => {
  const [path] = buildKidSkillPaths(progressWith([
    skill({ skillId: "a", level: "master", skillLabel: "Count to 10" }),
    skill({ skillId: "b", level: "beginner", skillLabel: "See numbers quickly" }),
    skill({ skillId: "c", level: "not_started", skillLabel: "Count to 20" }),
  ]));
  assert.deepEqual(path.nextSkill, { label: "See numbers quickly", level: "beginner" });
});

test("paths keep the server's curriculum order rather than sorting by size", () => {
  const paths = buildKidSkillPaths(progressWith([
    skill({ skillId: "a", unitId: "u1", unitLabel: "Counting" }),
    skill({ skillId: "b", unitId: "u2", unitLabel: "Addition" }),
    skill({ skillId: "c", unitId: "u2", unitLabel: "Addition" }),
    skill({ skillId: "d", unitId: "u3", unitLabel: "Subtraction" }),
  ]));
  // Addition is the biggest unit; ordering by size used to float it to the front.
  assert.deepEqual(paths.map(path => path.title), ["Counting", "Addition", "Subtraction"]);
});

test("unresolved history is bucketed separately and sorted last", () => {
  const paths = buildKidSkillPaths(progressWith([
    skill({ skillId: "legacy", unitId: null, unitLabel: null }),
    skill({ skillId: "a", unitId: "u1", unitLabel: "Counting" }),
  ]));
  assert.deepEqual(paths.map(path => path.title), ["Counting", "Earlier practice"]);
  assert.equal(buildKidSkillPaths(progressWith([skill({ unitId: "u9", unitLabel: null })]))[0].title, "Other skills");
  assert.deepEqual(buildKidSkillPaths(null), []);
});

test("next-up mastery reads the matching skill only", () => {
  const progress = progressWith([skill({ skillId: "s1", score: 0.65 })]);
  assert.equal(kidSkillMastery(progress, { curriculumId: "c1", skillId: "s1" }), 0.65);
  assert.equal(kidSkillMastery(progress, { curriculumId: "c1", skillId: "nope" }), undefined);
  assert.equal(kidSkillMastery(null, { curriculumId: "c1", skillId: "s1" }), undefined);
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

// ── Unit cards: the road joined with mastery ────────────────────────────────────

const pathSkill = (over: Partial<PathSkill> = {}): PathSkill => ({
  skillId: "s1",
  skillLabel: "Count to 10",
  unitId: "u1",
  unitLabel: "Counting",
  status: "new",
  level: "not_started",
  score: 0,
  position: 0,
  playable: true,
  ...over,
});

const pathWith = (units: CurriculumPath["units"]): CurriculumPath => ({
  pathRevision: "path-1",
  assignmentId: "a1",
  curriculumId: "c1",
  releaseId: "r1",
  gradeId: "grade-1",
  units,
  counts: { completed: 0, overdue: 0, inProgress: 0, new: 0, pending: 0, total: 0 },
  nextSkill: null,
});

test("a unit card carries the road's skills and the mastery ladder together", () => {
  const [card] = buildUnitCards(
    [pathWith([{
      unitId: "u1",
      unitLabel: "Counting",
      gradeId: "grade-1",
      skills: [
        pathSkill({ skillId: "a", status: "completed", level: "master" }),
        pathSkill({ skillId: "b", status: "overdue", level: "beginner" }),
        pathSkill({ skillId: "c", status: "pending", level: "not_started" }),
      ],
    }])],
    null,
  );
  assert.equal(card.title, "Counting");
  assert.deepEqual(card.skills.map(s => s.skillId), ["a", "b", "c"]);
  assert.deepEqual(card.rungs, ["master", "beginner", "not_started"]);
  assert.equal(card.mastered, 1);       // status completed, not level
  assert.equal(card.duePractice, 1);    // status overdue
  assert.equal(card.total, 3);
  // (4 + 1 + 0) / (3 * 4)
  assert.ok(Math.abs(card.progress - 5 / 12) < 1e-9);
});

test("the milestone comes from the most recent promotion inside that unit", () => {
  const progress = progressWith([
    skill({ skillId: "a", unitId: "u1", skillLabel: "Count to 10", promotedAt: "2026-07-01T00:00:00Z" }),
    skill({ skillId: "b", unitId: "u1", skillLabel: "Count to 20", promotedAt: "2026-07-20T00:00:00Z" }),
    skill({ skillId: "z", unitId: "u2", skillLabel: "Add", promotedAt: "2026-07-25T00:00:00Z" }),
  ]);
  const [card] = buildUnitCards(
    [pathWith([{ unitId: "u1", unitLabel: "Counting", gradeId: "grade-1", skills: [pathSkill()] }]),
],
    progress,
  );
  assert.equal(card.milestone, "Mastered Count to 20");
});

test("units keep the road's order across every assignment, and survive no progress", () => {
  const cards = buildUnitCards(
    [pathWith([
      { unitId: "u1", unitLabel: "Counting", gradeId: "grade-1", skills: [pathSkill()] },
      { unitId: "u2", unitLabel: "Addition", gradeId: "grade-1", skills: [pathSkill({ skillId: "x" })] },
    ])],
    null,
  );
  assert.deepEqual(cards.map(card => card.title), ["Counting", "Addition"]);
  assert.equal(cards[0].milestone, undefined);
  assert.deepEqual(buildUnitCards([], null), []);
});

test("last score reads the learner's most recent session, never a placeholder", () => {
  const progress = progressWith([
    skill({ skillId: "done", recentScore: 0.85, plays: 6 }),
    skill({ skillId: "perfect", recentScore: 1, plays: 4 }),
    skill({ skillId: "rough", recentScore: 0.24, plays: 3 }),
  ]);
  const at = (skillId: string) => kidLastScore(progress, { curriculumId: "c1", skillId });

  assert.equal(at("done"), "9/10");
  assert.equal(at("perfect"), "10/10");
  assert.equal(at("rough"), "2/10");
});

test("a skill with no scored evidence shows no score at all", () => {
  // Every completed card used to claim "9/10" regardless; absent must stay absent.
  assert.equal(kidLastScore(progressWith([skill({ skillId: "fresh", plays: 0 })]), { curriculumId: "c1", skillId: "fresh" }), undefined);
  assert.equal(kidLastScore(progressWith([]), { curriculumId: "c1", skillId: "missing" }), undefined);
  assert.equal(kidLastScore(null, { curriculumId: "c1", skillId: "any" }), undefined);
});

test("a score outside 0–1 is clamped rather than rendered as nonsense", () => {
  const progress = progressWith([skill({ skillId: "odd", recentScore: 1.4, plays: 2 })]);
  assert.equal(kidLastScore(progress, { curriculumId: "c1", skillId: "odd" }), "10/10");
});
