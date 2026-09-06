import { describe, expect, it } from "vitest";
import { skill } from ".";
import { buildQuestion } from "./activities/BottleSort";
import { isSolvedRack, legalPours } from "./internal/pour";
import { minimumPours } from "./internal/solve";
import { goalFor } from "./internal/goal";
import { RACK_SPECS, specFor } from "./internal/specs";
import type { Lesson } from "../types";

/**
 * Phase 6: everything at once.
 *
 * Each technique was taught in its own lesson, which means a child can pass
 * every one of them by knowing which lesson they are in — the cork lesson has
 * a cork, so look for the cork. The mixed rack removes that: the rule changes
 * between questions, and reading the rack is the only way to know which one
 * applies. So the thing to test is that the techniques really do cycle, and
 * that the big racks are still playable.
 */
const lesson = (id: string) => skill.lessons.find((l) => l.id === id) as unknown as Lesson;
const specsOf = (id: string) =>
  (lesson(id).params as { question: { specs: string[] } }).question.specs;

describe("the mixed rack", () => {
  it("cycles a different technique through every question of the round", () => {
    const specs = specsOf("mixed-racks");
    const round = (lesson("mixed-racks").params as { question: { questionsPerRound: number } })
      .question.questionsPerRound;
    // One question per technique: fewer and a technique never appears, more and
    // the child sees the same rule twice in a round they are meant to read.
    expect(specs).toHaveLength(round);

    const modes = specs.map((id) => specFor(id)!.mode);
    expect(new Set(modes).size, "two questions share a technique").toBe(specs.length);
    expect(new Set(modes)).toEqual(new Set(["plain", "locked", "oneway", "hidden", "budget"]));
  });

  it("puts every technique on the same big rack, so the size is not the tell", () => {
    const specs = specsOf("mixed-racks").map((id) => specFor(id)!);
    specs.forEach((spec) => {
      expect(spec.bottles, `${spec.id}`).toBeGreaterThanOrEqual(7);
      expect(spec.colours, `${spec.id}`).toBeGreaterThanOrEqual(5);
      expect(spec.cap, `${spec.id}`).toBe(5);
    });
  });

  it("deals each technique in turn as the round goes on", () => {
    const params = { specs: specsOf("mixed-racks"), questionsPerRound: 5, seed: "phase6" };
    const kinds = [1, 2, 3, 4, 5].map((i) => buildQuestion(params, i).taskKind);
    expect(new Set(kinds).size, "the round repeated a technique").toBe(5);
  });

  it("carries each technique's rule onto the rack it deals", () => {
    const params = { specs: specsOf("mixed-racks"), questionsPerRound: 5, seed: "phase6" };
    const racks = [1, 2, 3, 4, 5].map((i) => buildQuestion(params, i));
    expect(racks.some((q) => q.rack.some((b) => b.lockedBy !== undefined)), "no cork appeared").toBe(true);
    expect(racks.some((q) => q.rack.some((b) => b.oneWay)), "no one-way bottle appeared").toBe(true);
    expect(racks.some((q) => q.rack.some((b) => (b.shown ?? b.seg.length) < b.seg.length)),
      "nothing was covered").toBe(true);
    expect(racks.some((q) => q.budget !== undefined), "no budget appeared").toBe(true);
  });

  it("deals big racks that are still unfinished, alive and solvable", () => {
    specsOf("mixed-racks").forEach((id) => {
      const spec = specFor(id)!;
      const goal = goalFor(spec);
      for (let i = 1; i <= 12; i += 1) {
        const { rack } = buildQuestion({ spec: id, questionsPerRound: 3, seed: "phase6" }, i);
        expect(isSolvedRack(rack, goal), `${id} q${i} arrived finished`).toBe(false);
        expect(legalPours(rack, goal).length, `${id} q${i} has no move`).toBeGreaterThan(0);
        expect(minimumPours(rack, goal).moves, `${id} q${i} unsolvable`).not.toBeNull();
      }
    });
  });

  it("is the hardest thing the skill deals", () => {
    const mixed = specsOf("mixed-racks").map((id) => specFor(id)!);
    const smallest = Math.min(...mixed.map((s) => s.bottles * s.colours));
    const everythingElse = RACK_SPECS
      .filter((s) => !specsOf("mixed-racks").includes(s.id) && s.id !== "practice-bottle-sort");
    everythingElse.forEach((spec) =>
      expect(spec.bottles * spec.colours, `${spec.id} is as big as a mixed rack`).toBeLessThan(smallest));
  });
});

describe("the final practice", () => {
  it("draws from every technique the skill teaches, and offers no help", () => {
    const specs = specsOf("practice-bottle-sort");
    const modes = new Set(specs.map((id) => specFor(id)!.mode));
    // Every mode the skill has, including the ordering goals.
    ["plain", "locked", "oneway", "hidden", "budget", "numbered"].forEach((mode) =>
      expect(modes.has(mode as never), `practice never deals ${mode}`).toBe(true));
    expect((lesson("practice-bottle-sort").params as { play: { kidTip: string } }).play.kidTip)
      .toMatch(/No hints/);
  });

  it("names only real specs", () => {
    specsOf("practice-bottle-sort").forEach((id) =>
      expect(specFor(id), `${id} is not a spec`).toBeDefined());
  });
});

describe("every spec's rules point at bottles that exist", () => {
  it("never names a tube outside the rack", () => {
    // The mixed lock named tube 7 of a seven-bottle rack, so the cork was
    // applied to nothing and the lesson silently lost its technique.
    RACK_SPECS.forEach((spec) => {
      if (spec.oneWay !== undefined) {
        expect(spec.oneWay, `${spec.id} one-way`).toBeLessThan(spec.bottles);
      }
      if (spec.lock) {
        expect(spec.lock.tube, `${spec.id} lock tube`).toBeLessThan(spec.bottles);
        expect(spec.lock.on, `${spec.id} lock target`).toBeLessThan(spec.bottles);
        expect(spec.lock.tube, `${spec.id} locks itself`).not.toBe(spec.lock.on);
      }
      if (spec.caps) expect(spec.caps, `${spec.id} caps`).toHaveLength(spec.bottles);
    });
  });
});
