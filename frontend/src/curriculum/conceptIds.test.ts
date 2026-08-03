/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Concept ids are the one identifier meant to survive the curriculum that defines them — the
 * thing a Grade 2 skill will point at to say "they learned this last year". That only works if
 * one concept id means one thing, so the two ways of breaking it are checked here.
 *
 * The silence is deliberate and is tested too: existing content has no concept ids at all, and
 * warning on every one of those skills would bury the issues worth reading.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditConceptIds, CONCEPT_ID_PATTERN, type CurriculumTree } from "./types";

const treeWith = (skills: Array<{ id: string; conceptId?: string }>): CurriculumTree => ({
  grades: [{ id: "grade-1", label: "Grade 1", order: 1 }],
  subjects: [{ id: "math", gradeId: "grade-1", label: "Math", order: 1 }],
  units: [{ id: "counting", subjectId: "math", label: "Counting", order: 1 }],
  skills: skills.map((skill, index) => ({
    unitId: "counting",
    label: skill.id,
    order: index + 1,
    minQuestions: 1,
    ...skill,
  })),
});

describe("concept ids", () => {
  it("accepts a dotted lowercase name", () => {
    assert.deepEqual(auditConceptIds(treeWith([{ id: "a", conceptId: "number.place-value.make-a-ten" }])), []);
  });

  it("says nothing about skills that have none", () => {
    assert.deepEqual(auditConceptIds(treeWith([{ id: "a" }, { id: "b" }])), []);
  });

  it("rejects two skills claiming the same concept", () => {
    const issues = auditConceptIds(treeWith([
      { id: "a", conceptId: "number.counting.to-20" },
      { id: "b", conceptId: "number.counting.to-20" },
    ]));

    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "error");
    assert.equal(issues[0].id, "b");
    assert.match(issues[0].message, /already used by skill "a"/);
  });

  it("warns about a name that will not match across grades", () => {
    // Case and spaces are the two that look fine in the studio and never match later.
    for (const conceptId of ["Number.Counting", "number counting", "number..counting", "number.-counting"]) {
      const issues = auditConceptIds(treeWith([{ id: "a", conceptId }]));
      assert.equal(issues.length, 1, conceptId);
      assert.equal(issues[0].severity, "warning", conceptId);
    }
  });

  it("uses the same pattern the release validator enforces", () => {
    assert.ok(CONCEPT_ID_PATTERN.test("number"));
    assert.ok(CONCEPT_ID_PATTERN.test("number.counting.to-20"));
    assert.ok(!CONCEPT_ID_PATTERN.test("Number"));
    assert.ok(!CONCEPT_ID_PATTERN.test("number."));
  });
});
