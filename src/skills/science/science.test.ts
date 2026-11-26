import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract, describeSkillLocales } from "../kit/testing";
import { skill } from ".";
import { lessonIcons, lessonIconTones } from "../../components/ui/lessonIcons";
import { SVG_ASSET_IDS } from "../../assets/svg/ids";
import course from "../../curriculum/course.json";
import voice from "./voice.json";
import en from "./locales/en.json";
import km from "./locales/km.json";
import { readsAloud } from "./internal/readsAloud";

describeSkillContract(skill);
describeActivitySmoke(skill);
describeSkillLocales("science", { complete: ["km"], source: { dir: "src/skills/science", helper: "tx" } });

type L = (typeof skill.lessons)[number];
const q = (l: L) => (l.params as { level: number; question: Record<string, unknown> }).question;
const isPractice = (l: L) => Boolean(q(l).practice);
const teaching = skill.lessons.filter((l) => !isPractice(l));
const practice = skill.lessons.filter(isPractice);
const play = (l: L) => (l.params as { play: { audioPrompt: string } }).play;

describe("Wonder Lab registration", () => {
  it("ships Grade 1 as a draft: 15 lessons then 4 practice, levels contiguous from 1", () => {
    expect(teaching).toHaveLength(15);
    expect(practice.map((l) => l.id)).toEqual(["practice-living-things", "practice-light-sound-sky", "practice-sorting", "practice-in-order"]);
    expect(skill.lessons.slice(-4)).toEqual(practice);
    expect(skill.lessons.map((l) => (l.params as { level: number }).level)).toEqual(skill.lessons.map((_, i) => i + 1));
    expect(Object.keys(skill.activities)).toEqual(["pick", "sort", "order"]);
    expect(skill.manifest.status).toBe("draft");
  });

  it("is for Grade 1 (ages 6-7) and places every lesson in Cambodia's Grade 1", () => {
    for (const l of skill.lessons) {
      expect(l.ageBand, l.id).toEqual([6, 7]);
      expect(l.curricula?.KH, l.id).toBe("G1");
    }
  });

  it("cites only NGSS codes in their published shape, or none with a trajectory level", () => {
    for (const l of teaching) {
      for (const s of l.standards ?? []) expect(s, l.id).toMatch(/^NGSS\.(K|1)-(LS1|LS3|PS4|ESS1|ESS2)-\d$/);
      expect(l.trajectoryLevel, l.id).toBeTruthy();
    }
    // The codes each topic is assessed on (NGSS performance expectations).
    const std = Object.fromEntries(teaching.map((l) => [l.id, l.standards]));
    expect(std["sound-is-shaking"]).toEqual(["NGSS.1-PS4-1"]);
    expect(std["light-through-things"]).toEqual(["NGSS.1-PS4-3"]);
    expect(std["babies-and-parents"]).toEqual(["NGSS.1-LS3-1"]);
    expect(std["parents-help-babies"]).toEqual(["NGSS.1-LS1-2"]);
    expect(std["sun-moon-and-stars"]).toEqual(["NGSS.1-ESS1-1"]);
  });

  it("requires only concepts taught earlier in the skill", () => {
    const known = new Set(skill.manifest.requires ?? []);
    for (const l of skill.lessons) {
      for (const need of l.requires ?? []) expect(known, `${l.id} needs ${need}`).toContain(need);
      if (l.conceptKey) known.add(l.conceptKey);
    }
    expect(new Set(skill.lessons.map((l) => l.conceptKey))).toEqual(new Set(skill.manifest.teaches));
  });

  it("practises with no help, from the start, over every set its engine teaches", () => {
    for (const l of practice) {
      expect(l.title, l.id).toMatch(/^Practice: /);
      expect(l.concept).toBe("Practice Without Help");
      expect(l.requires).toEqual([]);
      expect(play(l).audioPrompt).toBe("");
      expect(teaching.map((t) => t.conceptKey)).toContain(l.conceptKey);
      const taught = new Set(teaching.filter((t) => t.activity === l.activity).map((t) => q(t).set));
      for (const set of q(l).sets as string[]) expect(taught, l.id).toContain(set);
      expect(q(l).questionsPerRound as number, l.id).toBeGreaterThanOrEqual(8);
    }
  });

  it("practises every set some teaching lesson teaches", () => {
    const taught = new Set(teaching.map((l) => `${l.activity}:${q(l).set}`));
    const practised = new Set(practice.flatMap((l) => (q(l).sets as string[]).map((s) => `${l.activity}:${s}`)));
    expect(practised).toEqual(taught);
  });

  it("names only icons, tones, art and a thumbnail that exist", () => {
    const tones = Object.keys(lessonIconTones).filter((t) => t !== "amber");
    const art = new Set<string>([...SVG_ASSET_IDS, ...(skill.assets ?? [])]);
    for (const l of skill.lessons) {
      expect(Object.keys(lessonIcons), l.id).toContain(l.iconName);
      expect(tones, l.id).toContain(l.iconTone);
      expect(art.has(l.icon ?? ""), `${l.id} icon ${l.icon}`).toBe(true);
    }
    expect(SVG_ASSET_IDS).toContain(skill.manifest.thumbnail);
  });
});

describe("Wonder Lab in the course", () => {
  const units = (course as { units: { id: string; lessons: string[]; icon: string; title: string }[] }).units;
  const ours = units.filter((u) => u.lessons.some((ref) => ref.startsWith("science/")));

  it("places every lesson once, in level order, teaching units before the practice unit", () => {
    expect(ours.flatMap((u) => u.lessons)).toEqual(skill.lessons.map((l) => `science/${l.id}`));
    expect(ours.at(-1)!.lessons.every((ref) => ref.startsWith("science/practice-"))).toBe(true);
    expect(ours.slice(0, -1).flatMap((u) => u.lessons).some((ref) => ref.includes("/practice-"))).toBe(false);
    expect(units.at(-1)).toBe(ours.at(-1));
  });

  it("gives every unit an icon from the art library", () => {
    const art = new Set<string>([...SVG_ASSET_IDS, ...(skill.assets ?? [])]);
    for (const unit of ours) expect(art.has(unit.icon), unit.title).toBe(true);
  });
});

describe("Wonder Lab words and voice", () => {
  it("has Khmer copy for every lesson and only real lessons", () => {
    expect(Object.keys(km.lessons).sort()).toEqual(skill.lessons.map((l) => l.id).sort());
    expect(Object.keys(en)).not.toContain("lessons");
  });

  it("reads every Grade 1 teaching prompt aloud, and declares each one word for word", () => {
    expect(voice.speaksPrompts).toBe(false);
    for (const l of teaching) {
      expect(readsAloud(l.id), l.id).toBe(true);
      expect(voice.prompts, l.id).toContain(play(l).audioPrompt);
    }
    expect(voice.prompts).toHaveLength(new Set(teaching.map((l) => play(l).audioPrompt)).size);
  });

  it("declares every question, answer and reason for the recorder, generated from the words", () => {
    // Grade 1 cannot read, so the speaker button reads all of it; the script keeps the list exact.
    expect(() => execFileSync("node", ["scripts/science-voice-lines.mjs", "--check"], { stdio: "pipe" })).not.toThrow();
    expect(voice.phrases).toContain(en.pick.see.moon.no.own);
    expect(voice.phrases).toContain(en.sort.living.item.dog);
  });

  it("uses no yellow anywhere", () => {
    const src = Object.values(import.meta.glob("./**/*.{tsx,svg}", { query: "?raw", import: "default", eager: true }) as Record<string, string>).join("\n");
    expect(src).not.toMatch(/yellow|amber|#FACC15|#FBBF24|#EAB308|#FDE047|#FEF08A/i);
  });
});
