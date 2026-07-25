import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { curriculumRewards, type CurriculumTree } from "./types";

const tree = (rewards?: CurriculumTree["rewards"]): CurriculumTree => ({
  grades: [],
  subjects: [],
  units: [],
  skills: [],
  rewards,
});

describe("curriculumRewards", () => {
  it("does not mint XP or achievements without admin configuration", () => {
    assert.deepEqual(curriculumRewards(tree()), {
      quest: { label: "Today’s quest", activitiesPerSession: 3 },
      xp: { correctAnswer: 0, firstTryBonus: 0, activityCompletion: 0 },
      level: { xpPerLevel: 0 },
      achievements: [],
    });
  });

  it("uses authored quest and XP values", () => {
    const rewards = {
      quest: { label: "Number mission", activitiesPerSession: 4 },
      xp: { correctAnswer: 8, firstTryBonus: 3, activityCompletion: 15 },
      level: { xpPerLevel: 80 },
      achievements: [{
        id: "winner",
        label: "Winner",
        description: "Finish one activity.",
        metric: "lessonsCompleted" as const,
        target: 1,
        icon: "trophy" as const,
        accent: "amber" as const,
      }],
    };
    assert.deepEqual(curriculumRewards(tree(rewards)), rewards);
  });
});
