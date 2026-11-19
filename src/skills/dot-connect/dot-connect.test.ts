import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";
import course from "../../curriculum/course.json";

describeSkillContract(skill);
describeActivitySmoke(skill);

type Q = { spec?: string; specs?: string[]; practice?: boolean; noHints?: boolean };
const question = (id: string) => (skill.lessons.find((l) => l.id === id)!.params as { question: Q }).question;

describe("Dot Connect registration", () => {
  it("ships the plan's 16 lessons on one engine, in order, as a draft", () => {
    expect(skill.lessons).toHaveLength(16);
    expect(skill.lessons.map((l) => (l.params as { level: number }).level)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(Object.keys(skill.activities)).toEqual(["connect"]);
    expect(skill.manifest.status).toBe("draft");
    expect(skill.assets).toEqual([]);
  });

  it("marks exactly the three practice lessons as practice, with no guide", () => {
    const practice = skill.lessons.filter((l) => question(l.id).practice);
    expect(practice.map((l) => l.id)).toEqual(["practice-joining", "practice-planning", "practice-dot-connect"]);
    for (const l of practice) {
      expect(l.title).toMatch(/^Practice: /);
      expect(l.concept).toBe("Practice Without Help");
      expect((l.params as { guide?: unknown }).guide).toBeUndefined();
    }
  });

  it("takes the hints away from On Your Own only", () => {
    expect(skill.lessons.filter((l) => question(l.id).noHints).map((l) => l.id)).toEqual(["on-your-own"]);
  });

  it("only requires concepts taught earlier in the skill", () => {
    const taught = new Set<string>();
    for (const lesson of skill.lessons) {
      for (const need of lesson.requires ?? []) expect(taught.has(need), `${lesson.id} needs ${need}`).toBe(true);
      if (lesson.conceptKey) taught.add(lesson.conceptKey);
    }
    expect([...taught].sort()).toEqual([...(skill.manifest.teaches ?? [])].sort());
  });

  it("uses only icon tones the app can draw", () => {
    const tones = new Set(["amber", "cyan", "indigo", "purple", "pink", "emerald"]);
    for (const l of skill.lessons) expect(tones.has(l.iconTone ?? ""), `${l.id}: ${l.iconTone}`).toBe(true);
  });

  it("places every lesson in the course once, teaching and practice in separate units", () => {
    const units = course.units.filter((u) => u.lessons.some((l) => l.startsWith("dot-connect/")));
    const placed = units.flatMap((u) => u.lessons);
    expect(placed).toEqual(skill.lessons.map((l) => `dot-connect/${l.id}`));
    for (const unit of units) {
      const kinds = new Set(unit.lessons.map((ref) => !!question(ref.split("/")[1]).practice));
      expect(kinds.size, unit.title).toBe(1);
    }
  });
});
