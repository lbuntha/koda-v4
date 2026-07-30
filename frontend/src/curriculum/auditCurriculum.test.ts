import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditCurriculum, questionSkillIdsForCurriculum, type CurriculumTree } from "./types";

const tree: CurriculumTree = {
  grades: [{ id: "grade-1", label: "Grade 1", order: 1 }],
  subjects: [{ id: "math", gradeId: "grade-1", label: "Math", order: 1 }],
  units: [{ id: "counting", subjectId: "math", label: "Counting", order: 1 }],
  skills: [{ id: "count-10", unitId: "counting", label: "Count to 10", order: 1, minQuestions: 1 }],
};

describe("curriculum question health", () => {
  it("does not include questions that belong to another curriculum", () => {
    const scopedIds = questionSkillIdsForCurriculum(tree, "math-curriculum", [
      { curriculumId: "math-curriculum", skillId: "count-10" },
      { curriculumId: "science-curriculum", skillId: "science-living" },
      { skillId: "count-10" },
    ]);
    const issues = auditCurriculum(tree, scopedIds);

    assert.equal(issues.some(issue => issue.level === "question"), false);
    assert.deepEqual(scopedIds, ["count-10", "count-10"]);
  });

  it("groups genuine orphan questions by their deleted skill", () => {
    const scopedIds = questionSkillIdsForCurriculum(tree, "math-curriculum", [
      { curriculumId: "math-curriculum", skillId: "count-10" },
      { curriculumId: "math-curriculum", skillId: "deleted-skill" },
      { curriculumId: "math-curriculum", skillId: "deleted-skill" },
      { curriculumId: "science-curriculum", skillId: "science-living" },
    ]);
    const issues = auditCurriculum(tree, scopedIds).filter(issue => issue.level === "question");

    assert.deepEqual(issues, [{
      level: "question",
      id: "deleted-skill",
      severity: "error",
      message: "2 questions are assigned to deleted skill \"deleted-skill\"",
    }]);
  });
});
