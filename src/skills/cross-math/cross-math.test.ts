import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";
import { lessonIcons, lessonIconTones } from "../../components/ui/lessonIcons";
import { SVG_ASSET_IDS } from "../../assets/svg/ids";
import course from "../../curriculum/course.json";
import en from "./locales/en.json";
import km from "./locales/km.json";

describeSkillContract(skill);
describeActivitySmoke(skill);

const isPracticeLesson = (lesson: (typeof skill.lessons)[number]): boolean =>
  Boolean((lesson.params as { question?: { practice?: boolean } }).question?.practice);

describe("Cross Math registration", () => {
  it("ships 30 teaching lessons and 6 practice lessons on one engine, as a draft", () => {
    expect(skill.lessons).toHaveLength(36);
    expect(skill.lessons.map((l) => (l.params as { level: number }).level))
      .toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
    expect(skill.lessons.filter(isPracticeLesson).map((l) => (l.params as { level: number }).level))
      .toEqual([31, 32, 33, 34, 35, 36]);
    expect(Object.keys(skill.activities)).toEqual(["grid"]);
    expect(skill.manifest.status).toBe("draft");
  });

  it("names only icons, tones and a thumbnail that exist", () => {
    const tones = Object.keys(lessonIconTones).filter((t) => t !== "amber");
    for (const lesson of skill.lessons) {
      expect(Object.keys(lessonIcons), lesson.id).toContain(lesson.iconName);
      expect(tones, lesson.id).toContain(lesson.iconTone);
    }
    expect(SVG_ASSET_IDS).toContain(skill.manifest.thumbnail);
  });

  it("requires concepts that are taught earlier in the skill or declared by the manifest", () => {
    const known = new Set(skill.manifest.requires ?? []);
    for (const lesson of skill.lessons) {
      for (const need of lesson.requires ?? []) expect(known, `${lesson.id} needs ${need}`).toContain(need);
      if (lesson.conceptKey) known.add(lesson.conceptKey);
    }
    expect(new Set(skill.lessons.map((l) => l.conceptKey))).toEqual(new Set(skill.manifest.teaches));
  });

  it("titles practice as practice, and flags it in params", () => {
    for (const lesson of skill.lessons) {
      expect(lesson.title.startsWith("Practice:"), lesson.id).toBe(isPracticeLesson(lesson));
    }
  });
});

describe("Cross Math in the course", () => {
  const units = (course as { units: { lessons: string[]; title: string }[] }).units;
  const ours = units.filter((u) => u.lessons.some((ref) => ref.startsWith("cross-math/")));

  it("places every lesson exactly once, in level order", () => {
    const refs = ours.flatMap((u) => u.lessons);
    expect(refs).toEqual(skill.lessons.map((l) => `cross-math/${l.id}`));
  });

  it("keeps teaching and practice in separate units, practice last", () => {
    const kinds = ours.map((u) => u.lessons.map((ref) => isPracticeLesson(skill.lessons.find((l) => `cross-math/${l.id}` === ref)!)));
    for (const unit of kinds) expect(new Set(unit).size).toBe(1);
    expect(kinds.map((u) => u[0])).toEqual([false, false, false, false, false, false, true, true]);
  });
});

describe("Cross Math words", () => {
  const keys = (tree: object, prefix = ""): string[] =>
    Object.entries(tree).flatMap(([k, v]) =>
      typeof v === "string" ? [`${prefix}${k}`] : ["one", "other"].some((p) => p in v) ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`));

  it("has a Khmer line for every English one", () => {
    expect(keys(en).filter((k) => !keys(km).includes(k))).toEqual([]);
  });
});
