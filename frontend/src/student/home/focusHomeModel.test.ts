import assert from "node:assert/strict";
import test from "node:test";
import type { CourseQueueItem, StudentProgress } from "../../api/course";
import {
  estimateFocusMinutes,
  focusBarHeight,
  focusDueCount,
  focusItemIsDue,
  focusProficiency,
} from "./focusHomeModel";

const item = (
  skillId: string,
  kind: CourseQueueItem["kind"] = "new",
  cards = 2,
): CourseQueueItem => ({
  assignmentId: "assignment-1",
  releaseId: "release-1",
  curriculumId: "curriculum-1",
  curriculumRevision: 1,
  skillId,
  skillLabel: skillId,
  kind,
  reason: "",
  optional: false,
  questions: Array.from({ length: cards }, (_, index) => ({ id: `${skillId}-${index}` } as CourseQueueItem["questions"][number])),
});

const progress = {
  studentId: "student-1",
  scoringRevision: 1,
  engineRevision: "test",
  rank: {
    tier: "silver",
    tierLabel: "Silver",
    mastered: 1,
    proficientPlus: 3,
    totalSkills: 4,
    assignedSkills: 5,
    progressToNext: 0.5,
  },
  skills: [
    {
      curriculumId: "curriculum-1",
      skillId: "due-from-progress",
      isDue: true,
    },
  ],
} as StudentProgress;

test("focus estimates thirty seconds per card", () => {
  assert.equal(estimateFocusMinutes([item("one", "new", 3), item("two", "review", 2)]), 3);
  assert.equal(estimateFocusMinutes([]), 1);
});

test("focus proficiency uses assigned skills as the denominator", () => {
  assert.equal(focusProficiency(progress), 60);
  assert.equal(focusProficiency(null), 0);
});

test("focus due state combines recommendation kind and mastery due state", () => {
  assert.equal(focusItemIsDue(item("review", "review"), progress), true);
  assert.equal(focusItemIsDue(item("due-from-progress"), progress), true);
  assert.equal(focusItemIsDue(item("new"), progress), false);
  assert.equal(focusDueCount([
    item("review", "review"),
    item("due-from-progress"),
    item("new"),
  ], progress), 2);
});

test("focus activity bars use bounded static height classes", () => {
  assert.equal(focusBarHeight(0, 10), "h-1");
  assert.equal(focusBarHeight(2, 10), "h-3");
  assert.equal(focusBarHeight(10, 10), "h-20");
});
