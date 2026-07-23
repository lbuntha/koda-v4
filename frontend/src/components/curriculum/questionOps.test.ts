import assert from "node:assert/strict";
import test from "node:test";
import { CountingTechnique } from "../../types";
import { ALL_TECHNIQUES } from "../../techniques";
import { CANVAS_BY_TECHNIQUE } from "../studio/canvasRegistry";
import { TECHNIQUE_OPTIONS } from "../studio/techniqueOptions";
import { TECHNIQUE_PANELS } from "../studio/panels";
import { SCHEMA_REGISTRY } from "../studio/ai-generator/schemas";
import { createBlankSkillQuestion } from "./questionOps";

test("Curriculum Add Question exposes every registered component", () => {
  const techniques = Object.values(CountingTechnique);

  assert.equal(ALL_TECHNIQUES.length, techniques.length);
  assert.deepEqual(new Set(TECHNIQUE_OPTIONS.map(option => option.id)), new Set(techniques));
  assert.deepEqual(new Set(Object.keys(TECHNIQUE_PANELS)), new Set(techniques));
  assert.deepEqual(new Set(Object.keys(CANVAS_BY_TECHNIQUE)), new Set(techniques));
  assert.deepEqual(new Set(SCHEMA_REGISTRY.map(schema => schema.technique)), new Set(techniques));
});

test("Curriculum Add Question creates a complete schema-backed row for every component", () => {
  for (const technique of Object.values(CountingTechnique)) {
    const question = createBlankSkillQuestion(technique, "skill-test");
    assert.ok(question.id, `${technique} must have an id`);
    assert.equal(question.technique, technique);
    assert.equal(question.skillId, "skill-test");
    assert.ok(question.title.trim(), `${technique} must have a title`);
    assert.ok(question.instruction.trim(), `${technique} must have an instruction`);
    assert.ok(question.objectId.trim(), `${technique} must have an objectId`);
    assert.ok(Number.isFinite(question.targetCount) && question.targetCount > 0, `${technique} must have a targetCount`);
    assert.ok(question.config && typeof question.config === "object", `${technique} must have config`);
  }
});
