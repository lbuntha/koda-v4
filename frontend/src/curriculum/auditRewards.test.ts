/**
 * Rewards that are absent, inert, or impossible for the curriculum they belong to.
 *
 * Found on the real database: "Grade 1 Mathematics" — 11 units, 30 skills, published — had no
 * rewards block at all. The engine correctly refuses to mint XP nobody authored, so a learner
 * assigned to it would have earned nothing while the app showed no error of any kind. The
 * only way to discover it was to read the collection.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { auditRewards, CurriculumRewards, CurriculumTree } from "./types";

function tree(skillCount: number, rewards?: CurriculumRewards): CurriculumTree {
  return {
    title: "Test", description: "", version: "1.0",
    grades: [], subjects: [], units: [],
    skills: Array.from({ length: skillCount }, (_, i) => ({
      id: `skill-${i}`, label: `Skill ${i}`, unitId: "u1",
    })) as CurriculumTree["skills"],
    rewards,
  } as CurriculumTree;
}

const WORKING: CurriculumRewards = {
  quest: { label: "Today's quest", activitiesPerSession: 3 },
  xp: { correctAnswer: 4, firstTryBonus: 2, activityCompletion: 12 },
  level: { xpPerLevel: 120 },
  achievements: [],
};

const messages = (t: CurriculumTree) => auditRewards(t).map(i => i.message).join(" | ");

describe("a curriculum that rewards nothing", () => {
  test("no rewards block at all is reported", () => {
    const issues = auditRewards(tree(30));
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /no rewards are configured/);
    assert.equal(issues[0].severity, "warning");
  });

  test("a rewards block where every award is zero is just as inert", () => {
    const inert = { ...WORKING, xp: { correctAnswer: 0, firstTryBonus: 0, activityCompletion: 0 } };
    assert.match(messages(tree(30, inert)), /every XP award is 0/);
  });

  test("earning XP but never levelling up is reported", () => {
    const noLevel = { ...WORKING, level: { xpPerLevel: 0 } };
    assert.match(messages(tree(30, noLevel)), /never level up/);
  });

  test("a working configuration reports nothing", () => {
    assert.deepEqual(auditRewards(tree(30, WORKING)), []);
  });
});

describe("badges have to be reachable in this curriculum", () => {
  const withBadge = (target: number, metric: "proficientSkills" | "masteredSkills" | "xpEarned") => ({
    ...WORKING,
    achievements: [{
      id: "badge", label: "Big Badge", description: "d",
      metric, target, icon: "trophy", accent: "purple",
    }] as CurriculumRewards["achievements"],
  });

  test("asking for more mastered skills than the curriculum contains can never be earned", () => {
    const issues = auditRewards(tree(30, withBadge(50, "masteredSkills")));
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /needs 50 skills but this curriculum only has 30/);
  });

  test("the same applies to proficiency", () => {
    assert.match(messages(tree(10, withBadge(11, "proficientSkills"))), /can never be earned/);
  });

  test("a target the curriculum can just reach is fine", () => {
    assert.deepEqual(auditRewards(tree(30, withBadge(30, "masteredSkills"))), []);
  });

  test("XP targets are not capped by skill count — XP accumulates", () => {
    assert.deepEqual(auditRewards(tree(3, withBadge(5000, "xpEarned"))), []);
  });
});
