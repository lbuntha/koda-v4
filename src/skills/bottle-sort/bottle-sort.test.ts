import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";
import { RACK_SPECS } from "./internal/specs";

describeSkillContract(skill);
describeActivitySmoke(skill);

describe("Bottle Sort registration", () => {
  it("ships Phases 1 and 2 on one engine, with no artwork", () => {
    expect(skill.lessons).toHaveLength(10);
    expect(Object.keys(skill.activities)).toEqual(["sort"]);
    // Bottles are geometry; there is deliberately nothing in assets/.
    expect(skill.assets).toEqual([]);
    expect(skill.manifest.status).toBe("draft");
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
    expect(practice).toHaveLength(1);
    expect(practice[0].id).toBe("practice-pouring");
    // Drawn from several specs, or it measures pace on one rack shape only.
    expect((practice[0].params as { question: { specs: string[] } }).question.specs.length).toBeGreaterThan(3);
  });
});
