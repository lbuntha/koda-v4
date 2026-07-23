import assert from "node:assert/strict";
import test from "node:test";

import { CountingTechnique } from "../types";
import { LearningEvent, AttemptOutcome, CURRENT_SCHEMA_VERSION } from "./logSchema";
import {
  scoreSkill,
  computeSkillScores,
  computeComponents,
  computeStudentRank,
  MASTER_SCORE,
  PROFICIENT_SCORE,
  DEVELOPING_SCORE,
} from "./scoringEngine";

// ── Event factory ──────────────────────────────────────────────────────────────

let seq = 0;
interface AttemptOpts {
  outcome?: AttemptOutcome;
  attemptNumber?: number;
  hint?: boolean;
  timeMs?: number;
  difficulty?: "easy" | "medium" | "hard";
  session?: string;
  day?: string; // "YYYY-MM-DD"
  student?: string | null;
  skillId?: string;
}

function attempt(o: AttemptOpts = {}): LearningEvent {
  const day = o.day ?? "2026-07-20";
  seq += 1;
  return {
    id: `evt-${seq}`,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sessionId: o.session ?? "s1",
    studentId: o.student ?? "stu-1",
    occurredAt: `${day}T10:00:${String(seq % 60).padStart(2, "0")}.000Z`,
    clientTimestampMs: Date.parse(`${day}T10:00:00Z`) + seq * 1000,
    questionId: `q-${seq}`,
    technique: CountingTechnique.ONE_TO_ONE,
    subjectArea: "counting",
    skillTags: ["one_to_one_counting"],
    curriculumSkillId: o.skillId ?? "count-to-10",
    slideIndex: 0,
    totalSlides: 12,
    eventType: "attempt",
    outcome: o.outcome ?? "correct",
    attemptNumber: o.attemptNumber ?? 1,
    hintUsedBeforeAttempt: o.hint ?? false,
    timeOnTaskMs: o.timeMs ?? 5000,
    actionSummary: "answered",
    details: o.difficulty ? { difficulty: o.difficulty } : undefined,
  };
}

/** N clean first-try-correct attempts across the given day/session. */
function cleanRun(n: number, o: AttemptOpts = {}): LearningEvent[] {
  return Array.from({ length: n }, () => attempt({ outcome: "correct", attemptNumber: 1, ...o }));
}

// ── Ladder rungs ───────────────────────────────────────────────────────────────

test("no events → not_started, no review scheduled", () => {
  const r = scoreSkill("stu-1", "count-to-10", []);
  assert.equal(r.level, "not_started");
  assert.equal(r.plays, 0);
  assert.equal(r.nextReviewAt, null);
  assert.equal(r.isDue, false);
});

test("a couple of shaky attempts → beginner", () => {
  const events = [
    attempt({ outcome: "incorrect", attemptNumber: 1 }),
    attempt({ outcome: "correct", attemptNumber: 2, hint: true }),
    attempt({ outcome: "incorrect", attemptNumber: 1 }),
  ];
  const r = scoreSkill("stu-1", "count-to-10", events);
  assert.equal(r.level, "beginner");
  assert.equal(r.nextLevel, "developing");
  assert.ok(r.toNextLevel.length > 0);
});

test("6 clean plays clears the Developing gate", () => {
  const r = scoreSkill("stu-1", "count-to-10", cleanRun(6));
  assert.ok(r.score >= DEVELOPING_SCORE);
  assert.equal(r.level, "developing");
});

test("high score but only one session cannot reach Proficient", () => {
  // 12 clean plays, all in one session/day → score is high, gate fails on sessions
  const r = scoreSkill("stu-1", "count-to-10", cleanRun(12, { session: "s1", day: "2026-07-20" }));
  assert.ok(r.score >= PROFICIENT_SCORE, `score ${r.score} should be high`);
  assert.equal(r.sessions, 1);
  assert.equal(r.level, "developing");
  assert.ok(r.toNextLevel.some(x => /session/.test(x)));
});

test("Proficient needs the hard band when difficulty is tagged", () => {
  // 12 clean plays across 2 sessions, but zero hard questions → blocked at developing
  const easy = [
    ...cleanRun(6, { session: "s1", day: "2026-07-20", difficulty: "easy" }),
    ...cleanRun(6, { session: "s2", day: "2026-07-21", difficulty: "easy" }),
  ];
  const blocked = scoreSkill("stu-1", "count-to-10", easy);
  assert.equal(blocked.difficultyTagged, true);
  assert.equal(blocked.level, "developing");
  assert.ok(blocked.toNextLevel.some(x => /hard/.test(x)));

  // same volume/sessions but with 3 hard plays → Proficient
  const withHard = [
    ...cleanRun(4, { session: "s1", day: "2026-07-20", difficulty: "easy" }),
    ...cleanRun(3, { session: "s1", day: "2026-07-20", difficulty: "hard" }),
    ...cleanRun(5, { session: "s2", day: "2026-07-21", difficulty: "medium" }),
  ];
  const r = scoreSkill("stu-1", "count-to-10", withHard);
  assert.equal(r.hardPlays, 3);
  assert.equal(r.level, "proficient");
});

test("Master needs 15 plays across 3 distinct days with a strong recent window", () => {
  const events = [
    ...cleanRun(5, { session: "s1", day: "2026-07-20", difficulty: "hard" }),
    ...cleanRun(5, { session: "s2", day: "2026-07-22", difficulty: "hard" }),
    ...cleanRun(5, { session: "s3", day: "2026-07-24", difficulty: "hard" }),
  ];
  const r = scoreSkill("stu-1", "count-to-10", events);
  assert.equal(r.plays, 15);
  assert.equal(r.distinctDays, 3);
  assert.ok(r.score >= MASTER_SCORE);
  assert.equal(r.level, "master");
  assert.equal(r.nextLevel, null);
  assert.equal(r.toNextLevel.length, 0);
});

test("two distinct days is not enough for Master even at a top score", () => {
  const events = [
    ...cleanRun(8, { session: "s1", day: "2026-07-20", difficulty: "hard" }),
    ...cleanRun(8, { session: "s2", day: "2026-07-21", difficulty: "hard" }),
  ];
  const r = scoreSkill("stu-1", "count-to-10", events);
  assert.ok(r.score >= MASTER_SCORE);
  assert.equal(r.distinctDays, 2);
  assert.equal(r.level, "proficient");
  assert.ok(r.toNextLevel.some(x => /day/.test(x)));
});

// ── Worked example from the design: "Count to 10", Maya ─────────────────────────

test("Maya's Count-to-10: high score, 2 days → Proficient, not Master", () => {
  // 10 first-try-correct + 2 questions that needed a 2nd attempt, over 2 days,
  // a couple of hints, quick answers, 3 hard questions.
  const events: LearningEvent[] = [
    ...cleanRun(7, { session: "s1", day: "2026-07-20", timeMs: 6000, difficulty: "easy" }),
    ...cleanRun(3, { session: "s2", day: "2026-07-21", timeMs: 6000, difficulty: "hard" }),
    // two questions wrong-then-right (first try incorrect, second correct)
    attempt({ outcome: "incorrect", attemptNumber: 1, session: "s1", day: "2026-07-20", hint: true }),
    attempt({ outcome: "correct", attemptNumber: 2, session: "s1", day: "2026-07-20" }),
    attempt({ outcome: "incorrect", attemptNumber: 1, session: "s2", day: "2026-07-21", hint: true }),
    attempt({ outcome: "correct", attemptNumber: 2, session: "s2", day: "2026-07-21" }),
  ];
  const r = scoreSkill("stu-1", "count-to-10", events);
  assert.equal(r.plays, 12); // 12 first-attempt events
  assert.equal(r.components.firstTryAccuracy, 10 / 12);
  assert.ok(r.score >= PROFICIENT_SCORE && r.score < MASTER_SCORE, `score ${r.score}`);
  assert.equal(r.distinctDays, 2);
  assert.equal(r.level, "proficient");
});

// ── Speed component renormalizes when timing is absent ──────────────────────────

test("score with no timing renormalizes and doesn't collapse", () => {
  const noTime = cleanRun(6).map(e => ({ ...e, timeOnTaskMs: undefined }));
  const { components, score } = computeComponents(noTime as any);
  assert.equal(components.speedMeasured, false);
  // all-correct, no hints, first try → the other three components are all 1.0
  assert.equal(score, 1);
});

// ── Review scheduling ──────────────────────────────────────────────────────────

test("a Developing skill practiced 3 days ago is due for review", () => {
  const now = Date.parse("2026-07-23T10:00:00Z");
  const r = scoreSkill("stu-1", "count-to-10", cleanRun(6, { day: "2026-07-20" }), { now });
  assert.equal(r.level, "developing");
  assert.ok(r.nextReviewAt);
  assert.equal(r.isDue, true); // developing interval is 1 day
});

test("an unsuccessful review does not move the due date forward", () => {
  const now = Date.parse("2026-07-23T12:00:00Z");
  const successful = cleanRun(6, { session: "s1", day: "2026-07-20" });
  const failed = attempt({
    outcome: "incorrect",
    session: "s2",
    day: "2026-07-23",
  });
  const r = scoreSkill("stu-1", "count-to-10", [...successful, failed], { now });
  assert.equal(r.lastReviewOutcome, "unsuccessful");
  assert.equal(r.lastSuccessfulReviewAt.slice(0, 10), "2026-07-20");
  assert.equal(r.nextReviewAt?.slice(0, 10), "2026-07-21");
  assert.equal(r.isDue, true);
});

test("a Master skill reviewed yesterday is not yet due", () => {
  const now = Date.parse("2026-07-25T10:00:00Z");
  const events = [
    ...cleanRun(5, { session: "s1", day: "2026-07-20", difficulty: "hard" }),
    ...cleanRun(5, { session: "s2", day: "2026-07-22", difficulty: "hard" }),
    ...cleanRun(5, { session: "s3", day: "2026-07-24", difficulty: "hard" }),
  ];
  const r = scoreSkill("stu-1", "count-to-10", events, { now });
  assert.equal(r.level, "master");
  assert.equal(r.isDue, false); // master interval is 14 days
});

// ── Grouping + rollup ──────────────────────────────────────────────────────────

test("computeSkillScores groups by (student, skill) and ignores uncurated events", () => {
  const events: LearningEvent[] = [
    ...cleanRun(6, { skillId: "count-to-10" }),
    ...cleanRun(3, { skillId: "count-to-20" }),
    // an attempt with no curriculumSkillId is not laddered
    { ...attempt(), curriculumSkillId: undefined },
  ];
  const scores = computeSkillScores(events);
  assert.equal(scores.length, 2);
  const ids = scores.map(s => s.skillId).sort();
  assert.deepEqual(ids, ["count-to-10", "count-to-20"]);
});

test("student rank rolls up Proficient+ share into a tier", () => {
  // 1 mastered + 1 proficient + 1 developing = 2/3 proficient+ → gold (>= 0.67)
  const mastered = [
    ...cleanRun(5, { skillId: "a", session: "s1", day: "2026-07-20", difficulty: "hard" }),
    ...cleanRun(5, { skillId: "a", session: "s2", day: "2026-07-22", difficulty: "hard" }),
    ...cleanRun(5, { skillId: "a", session: "s3", day: "2026-07-24", difficulty: "hard" }),
  ];
  const proficient = [
    ...cleanRun(4, { skillId: "b", session: "s1", day: "2026-07-20", difficulty: "easy" }),
    ...cleanRun(3, { skillId: "b", session: "s1", day: "2026-07-20", difficulty: "hard" }),
    ...cleanRun(5, { skillId: "b", session: "s2", day: "2026-07-21", difficulty: "medium" }),
  ];
  const developing = cleanRun(6, { skillId: "c" });
  const scores = computeSkillScores([...mastered, ...proficient, ...developing]);
  const rank = computeStudentRank(scores);
  assert.equal(rank.totalSkills, 3);
  assert.equal(rank.mastered, 1);
  assert.equal(rank.proficientPlus, 2);
  assert.equal(rank.tier, "gold");
});
