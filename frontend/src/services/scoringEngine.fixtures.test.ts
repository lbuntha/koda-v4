/**
 * Cross-language parity test. The SAME fixtures
 * (../../../shared/scoring-fixtures.json) are asserted by the backend engine in
 * backend/tests/test_scoring_fixtures.py. If this TS engine and the Python port
 * ever diverge for one config + one event set, one side fails here. The fixtures
 * are generated from the backend engine; this file proves the frontend reference
 * reproduces them.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { scoreSkill, ScoringConfig } from "./scoringEngine";
import { LearningEvent } from "./logSchema";

interface Fixture {
  nowMs: number;
  cases: {
    name: string;
    events: any[];
    config?: ScoringConfig;
    expected: {
      level: string;
      plays: number;
      attempts: number;
      sessions: number;
      distinctDays: number;
      hardPlays: number;
      difficultyTagged: boolean;
      nextLevel: string | null;
      isDue: boolean;
      lastSuccessfulReviewAt: string;
      lastReviewOutcome: "successful" | "unsuccessful" | null;
      nextReviewAtMs: number | null;
      score6: number;
      recentScore6: number;
    };
  }[];
}

const fixtures: Fixture = JSON.parse(
  readFileSync(new URL("../../../shared/scoring-fixtures.json", import.meta.url), "utf-8"),
);

for (const c of fixtures.cases) {
  test(`parity · ${c.name}`, () => {
    const r = scoreSkill("stu-1", "skill-1", c.events as LearningEvent[], {
      now: fixtures.nowMs,
      config: c.config,
    });
    const e = c.expected;

    assert.equal(r.level, e.level, "level");
    assert.equal(r.plays, e.plays, "plays");
    assert.equal(r.attempts, e.attempts, "attempts");
    assert.equal(r.sessions, e.sessions, "sessions");
    assert.equal(r.distinctDays, e.distinctDays, "distinctDays");
    assert.equal(r.hardPlays, e.hardPlays, "hardPlays");
    assert.equal(r.difficultyTagged, e.difficultyTagged, "difficultyTagged");
    assert.equal(r.nextLevel, e.nextLevel, "nextLevel");
    assert.equal(r.isDue, e.isDue, "isDue");
    assert.equal(r.lastSuccessfulReviewAt, e.lastSuccessfulReviewAt, "lastSuccessfulReviewAt");
    assert.equal(r.lastReviewOutcome, e.lastReviewOutcome, "lastReviewOutcome");
    assert.equal(r.nextReviewAt ? Date.parse(r.nextReviewAt) : null, e.nextReviewAtMs, "nextReviewAt");

    // score is a float derived identically in both engines; compare against the
    // 6dp expected within a tolerance that immunizes against rounding-mode noise.
    assert.ok(Math.abs(r.score - e.score6) < 1e-6, `score ${r.score} vs ${e.score6}`);
    assert.ok(Math.abs(r.recentScore - e.recentScore6) < 1e-6, `recentScore ${r.recentScore} vs ${e.recentScore6}`);
  });
}
