import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";
import { RACK_SPECS } from "./internal/specs";

describeSkillContract(skill);
describeActivitySmoke(skill);

describe("Bottle Sort registration", () => {
  it("ships the whole lesson map on two engines, with no artwork", () => {
    // 32 = the plan's 29 teaching lessons and 3 practice. Level 31 is not
    // skipped as the plan has it: the linked-bottle lesson was withdrawn, and
    // a gap in the numbering is a worse record of that than a footnote.
    expect(skill.lessons).toHaveLength(32);
    expect(skill.lessons.map((l) => (l.params as { level: number }).level))
      .toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    // Two engines, because predicting is scored from a picture the child
    // chooses rather than from a rack they build.
    expect(Object.keys(skill.activities)).toEqual(["sort", "predict"]);
    // Bottles are geometry; there is deliberately nothing in assets/.
    expect(skill.assets).toEqual([]);
    // Phase 9. Publishing is a one-line change by design: everything that
    // makes the skill fit to publish was done in the eight phases before it.
    expect(skill.manifest.status).toBe("published");
  });

  it("names a real rack spec in every lesson", () => {
    skill.lessons.forEach((lesson) => {
      const q = (lesson.params as { question: { spec?: string; specs?: string[] } }).question;
      // A practice lesson names several, so its pace spans the techniques taught.
      const named = q.specs ?? [q.spec];
      expect(named.length, `${lesson.id} names no spec`).toBeGreaterThan(0);
      named.forEach((id) => expect(RACK_SPECS.some((s) => s.id === id), `${lesson.id} -> ${id}`).toBe(true));
    });
  });

  it("keeps practice out of the teaching unit and free of help", () => {
    const practice = skill.lessons.filter((l) => (l.params as { question: { practice?: boolean } }).question.practice);
    expect(practice.map((l) => l.id))
      .toEqual(["practice-pouring", "practice-planning", "practice-bottle-sort"]);
    practice.forEach((lesson) => {
      // Drawn from several specs, or it measures pace on one rack shape only.
      const { specs } = (lesson.params as { question: { specs: string[] } }).question;
      expect(specs.length, `${lesson.id} draws from too few specs`).toBeGreaterThan(3);
      // Practice passes no hint ladder; help is what the teaching lessons are for.
      expect((lesson.params as { play: { kidTip: string } }).play.kidTip).toMatch(/No hints/);
    });
  });

  it("raises the difficulty from pouring to planning", () => {
    const scrambleOf = (id: string) => RACK_SPECS.find((s) => s.id === id)!.scramble;
    // The planning lessons are not just new rules on the same rack: they are
    // harder racks. Every one of them scrambles further than the hardest
    // pouring lesson taught before them.
    const pouring = ["one-pour", "two-pours", "use-the-empty-bottle", "pour-the-whole-run",
      "sort-three-colours", "short-and-tall", "will-it-fit", "fill-to-the-top", "count-before-you-pour"];
    const hardestTaught = Math.max(...pouring.map(scrambleOf));
    const planning = ["four-colours", "taller-bottles", "one-space-left", "no-free-bottle",
      "the-locked-bottle", "two-locks", "the-one-way-bottle", "think-before-you-pour", "the-shortest-way"];
    planning.forEach((id) => {
      // The two budget lessons buy their difficulty from the budget instead, so
      // they are allowed to sit level with the hardest pouring rack.
      const floor = id.includes("way") || id.includes("think") ? hardestTaught : hardestTaught + 1;
      expect(scrambleOf(id), `${id} is no harder than pouring`).toBeGreaterThanOrEqual(floor);
    });
  });
});
