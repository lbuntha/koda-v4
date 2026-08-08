import assert from "node:assert/strict";
import test from "node:test";
import { CountingTechnique } from "../../types";
import { ALL_TECHNIQUES } from "../../techniques";
import { RETIRED_TECHNIQUES, ABSORBED_TECHNIQUES } from "../../techniques/manifest";
import { CANVAS_BY_TECHNIQUE } from "../studio/canvasRegistry";
import { TECHNIQUE_OPTIONS } from "../studio/techniqueOptions";
import { TECHNIQUE_PANELS } from "../studio/panels";
import { SCHEMA_REGISTRY } from "../studio/ai-generator/schemas";
import { createBlankSkillQuestion } from "./questionOps";

/**
 * Every technique that still ships a game of its own — the enum minus the deliberately
 * retired ones, and minus those absorbed into another game's settings.
 */
const live = Object.values(CountingTechnique)
  .filter(t => !RETIRED_TECHNIQUES.has(t) && !ABSORBED_TECHNIQUES.has(t));

test("Curriculum Add Question exposes every registered component", () => {
  assert.equal(ALL_TECHNIQUES.length, live.length);
  assert.deepEqual(new Set(TECHNIQUE_OPTIONS.map(option => option.id)), new Set(live));
  assert.deepEqual(new Set(Object.keys(CANVAS_BY_TECHNIQUE)), new Set(live));
  assert.deepEqual(new Set(SCHEMA_REGISTRY.map(schema => schema.technique)), new Set(live));
  // Panels are the one registry an absorbed technique stays in — see below.
  assert.deepEqual(
    new Set(Object.keys(TECHNIQUE_PANELS)),
    new Set([...live, ...ABSORBED_TECHNIQUES.keys()]),
  );
});

/**
 * Retirement has to be all-or-nothing. A technique left in one registry but not another is the
 * shape that breaks quietly later: the picker offers a game whose canvas was never bundled, or
 * a schema generates questions nothing can render.
 */
test("a retired component is absent from every registry", () => {
  for (const technique of RETIRED_TECHNIQUES) {
    assert.ok(!ALL_TECHNIQUES.some(m => m.technique === technique), `${technique} in ALL_TECHNIQUES`);
    assert.ok(!TECHNIQUE_OPTIONS.some(o => o.id === technique), `${technique} in the picker`);
    assert.ok(!(technique in TECHNIQUE_PANELS), `${technique} has a panel`);
    assert.ok(!(technique in CANVAS_BY_TECHNIQUE), `${technique} has a canvas`);
    assert.ok(!SCHEMA_REGISTRY.some(s => s.technique === technique), `${technique} has an AI schema`);
  }
});

/**
 * Absorbing is the opposite of retiring, and the difference is exactly one registry. The
 * absorbed id leaves the picker, the catalog and the AI schema set — nothing should offer it
 * as a choice any more — but keeps a panel, because a question already published on it can
 * still be opened and edited, and it is edited by the game that absorbed it.
 */
test("an absorbed component leaves the picker but stays editable", () => {
  for (const [absorbed, owner] of ABSORBED_TECHNIQUES) {
    assert.ok(!ALL_TECHNIQUES.some(m => m.technique === absorbed), `${absorbed} in ALL_TECHNIQUES`);
    assert.ok(!TECHNIQUE_OPTIONS.some(o => o.id === absorbed), `${absorbed} in the picker`);
    assert.ok(!SCHEMA_REGISTRY.some(s => s.technique === absorbed), `${absorbed} has an AI schema`);

    assert.ok(!RETIRED_TECHNIQUES.has(absorbed), `${absorbed} is both retired and absorbed`);
    assert.ok(live.includes(owner), `${absorbed} was absorbed into ${owner}, which does not ship`);
    assert.equal(TECHNIQUE_PANELS[absorbed], TECHNIQUE_PANELS[owner], `${absorbed} must edit as ${owner}`);
  }
});

test("a retired or absorbed component keeps its identity for released content", () => {
  // Immutable releases still hold questions authored on these, and logged events still name
  // them. The enum entry is what keeps that old data resolvable.
  for (const technique of [...RETIRED_TECHNIQUES, ...ABSORBED_TECHNIQUES.keys()]) {
    assert.ok(Object.values(CountingTechnique).includes(technique), `${technique} left the enum`);
  }
});

test("Curriculum Add Question creates a complete schema-backed row for every component", () => {
  for (const technique of live) {
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
