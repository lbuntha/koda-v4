import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";
import { lessonIcons, lessonIconTones } from "../../components/ui/lessonIcons";
import { SVG_ASSET_IDS } from "../../assets/svg/ids";
import course from "../../curriculum/course.json";
import en from "./locales/en.json";
import km from "./locales/km.json";
import voice from "./voice.json";

describeSkillContract(skill);
describeActivitySmoke(skill);

const isPracticeLesson = (lesson: (typeof skill.lessons)[number]): boolean =>
  Boolean((lesson.params as { question?: { practice?: boolean } }).question?.practice);
const levelOf = (lesson: (typeof skill.lessons)[number]) => (lesson.params as { level: number }).level;

describe("Number Merge registration", () => {
  it("ships 39 teaching lessons and 11 practice lessons on one engine, as a draft", () => {
    expect(skill.lessons).toHaveLength(50);
    expect(skill.lessons.map(levelOf)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(skill.lessons.filter(isPracticeLesson).map(levelOf)).toEqual([33, 34, 35, 36, 37, 38, 39, 40, 48, 49, 50]);
    expect(Object.keys(skill.activities)).toEqual(["board"]);
    expect(skill.manifest.status).toBe("draft");
  });

  it("opens with no prerequisite from another skill", () => {
    expect(skill.manifest.requires).toEqual([]);
    expect(skill.lessons[0].requires).toEqual([]);
  });

  it("names only icons, tones, art and a thumbnail that exist — and no emoji", () => {
    const tones = Object.keys(lessonIconTones).filter((t) => t !== "amber");
    const art = new Set<string>([...SVG_ASSET_IDS, ...(skill.assets ?? [])]);
    for (const lesson of skill.lessons) {
      expect(Object.keys(lessonIcons), lesson.id).toContain(lesson.iconName);
      expect(tones, lesson.id).toContain(lesson.iconTone);
      expect(art.has(lesson.icon ?? ""), `${lesson.id} icon ${lesson.icon}`).toBe(true);
    }
    expect(SVG_ASSET_IDS).toContain(skill.manifest.thumbnail);
  });

  it("requires concepts that are taught earlier in the skill", () => {
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

describe("Number Merge in the course", () => {
  const units = (course as { units: { lessons: string[]; title: string; icon: string }[] }).units;
  const ours = units.filter((u) => u.lessons.some((ref) => ref.startsWith("number-merge/")));

  it("places every lesson exactly once, in level order", () => {
    expect(ours.flatMap((u) => u.lessons)).toEqual(skill.lessons.map((l) => `number-merge/${l.id}`));
  });

  it("keeps teaching and practice in separate units, each block ending in practice", () => {
    const kinds = ours.map((u) => u.lessons.map((ref) => isPracticeLesson(skill.lessons.find((l) => `number-merge/${l.id}` === ref)!)));
    for (const unit of kinds) expect(new Set(unit).size).toBe(1);
    expect(kinds.map((u) => u[0])).toEqual([false, false, false, false, false, false, false, false, true, false, false, false, true]);
  });

  it("gives every unit an icon from the art library, not an emoji", () => {
    const art = new Set<string>([...SVG_ASSET_IDS, ...(skill.assets ?? [])]);
    for (const unit of ours) expect(art.has(unit.icon), unit.title).toBe(true);
  });
});

describe("Number Merge words", () => {
  const keys = (tree: object, prefix = ""): string[] =>
    Object.entries(tree).flatMap(([k, v]) =>
      typeof v === "string" ? [`${prefix}${k}`] : ["one", "other"].some((p) => p in v) ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`));

  it("has a Khmer line for every English one", () => {
    expect(keys(en).filter((k) => !keys(km).includes(k))).toEqual([]);
  });
});

describe("Number Merge voice script", () => {
  /* A clip plays only when its words match what is said exactly. */
  it("has a prompt line for every lesson's target, worded as the board says it", async () => {
    const { promptOf, setupOf } = await import("./activities/Merge");
    for (const lesson of skill.lessons) {
      const prompt = promptOf(setupOf(lesson.params as Parameters<typeof setupOf>[0]));
      expect(voice.prompts, lesson.id).toContain(prompt);
    }
  });
});
