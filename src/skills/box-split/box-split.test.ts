import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";
import { lessonIcons, lessonIconTones } from "../../components/ui/lessonIcons";
import { SVG_ASSET_IDS } from "../../assets/svg/ids";
import course from "../../curriculum/course.json";
import en from "./locales/en.json";
import km from "./locales/km.json";
import voice from "./voice.json";
import { promptOf } from "./activities/BoxSplit";

describeSkillContract(skill);
describeActivitySmoke(skill);

const isPracticeLesson = (lesson: (typeof skill.lessons)[number]): boolean =>
  Boolean((lesson.params as { question?: { practice?: boolean } }).question?.practice);
const levelOf = (lesson: (typeof skill.lessons)[number]) => (lesson.params as { level: number }).level;

describe("Box Split registration", () => {
  it("ships 40 teaching lessons and 8 practice lessons on one engine, as a draft", () => {
    expect(skill.lessons).toHaveLength(48);
    expect(skill.lessons.map(levelOf)).toEqual(Array.from({ length: 48 }, (_, i) => i + 1));
    expect(skill.lessons.filter(isPracticeLesson).map(levelOf)).toEqual([41, 42, 43, 44, 45, 46, 47, 48]);
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

  it("covers ages 5 to 18, youngest first", () => {
    const teaching = skill.lessons.filter((l) => !isPracticeLesson(l));
    expect(teaching[0].ageBand?.[0]).toBe(5);
    expect(Math.max(...skill.lessons.map((l) => l.ageBand?.[1] ?? 0))).toBe(18);
    const starts = teaching.map((l) => l.ageBand?.[0] ?? 0);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});

describe("Box Split in the course", () => {
  const units = (course as { units: { lessons: string[]; title: string; icon: string }[] }).units;
  const ours = units.filter((u) => u.lessons.some((ref) => ref.startsWith("box-split/")));

  it("places every lesson exactly once, in level order", () => {
    expect(ours.flatMap((u) => u.lessons)).toEqual(skill.lessons.map((l) => `box-split/${l.id}`));
  });

  it("keeps teaching and practice in separate units, practice last", () => {
    const kinds = ours.map((u) => u.lessons.map((ref) => isPracticeLesson(skill.lessons.find((l) => `box-split/${l.id}` === ref)!)));
    for (const unit of kinds) expect(new Set(unit).size).toBe(1);
    expect(kinds.map((u) => u[0])).toEqual([false, false, false, false, false, false, false, false, true, true]);
  });

  it("gives every unit an icon from the art library, not an emoji", () => {
    const art = new Set<string>([...SVG_ASSET_IDS, ...(skill.assets ?? [])]);
    for (const unit of ours) expect(art.has(unit.icon), unit.title).toBe(true);
  });
});

describe("Box Split words", () => {
  const keys = (tree: object, prefix = ""): string[] =>
    Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));

  it("has a Khmer line for every English one", () => {
    expect(keys(en).filter((k) => !keys(km).includes(k))).toEqual([]);
    expect(keys(km).filter((k) => !keys(en).includes(k))).toEqual([]);
  });

  /* A clip plays only when its words match what is said exactly. */
  it("declares every How to play caption Koda says, word for word", () => {
    expect(voice.phrases).toEqual(Object.values(en.demo));
  });

  it("has the board's prompt, word for word, in the voice script and every lesson", () => {
    expect(voice.prompts).toEqual([promptOf()]);
    for (const lesson of skill.lessons) {
      expect((lesson.params as { play: { audioPrompt: string } }).play.audioPrompt, lesson.id).toBe(promptOf());
    }
  });
});
