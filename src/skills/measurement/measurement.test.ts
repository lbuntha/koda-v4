import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";
import { lessonIcons, lessonIconTones } from "../../components/ui/lessonIcons";
import { SVG_ASSET_IDS } from "../../assets/svg/ids";
import course from "../../curriculum/course.json";
import en from "./locales/en.json";
import km from "./locales/km.json";
import voice from "./voice.json";
import { demoKindFor } from "./activities/CompareBench";
import { demoFacts } from "./activities/CompareDemo";
import { measureDemoFacts, unitsDemoFacts, unitsDemoSteps } from "./activities/MeasureDemos";
import { rulerDemoFacts, rulerDemoSteps } from "./activities/RulerDemo";
import { estimateDemoFacts } from "./activities/EstimateCards";
import { ESTIMATE_THINGS } from "./internal/estimate";
import { scaleDemoCheck, scaleDemoFacts } from "./activities/DialScale";
import { thermoDemoFacts } from "./activities/Thermometer";
import { storyDemoFacts } from "./activities/MeasureStory";
import { MASS_THINGS } from "./internal/balance";
import type { CompareMode } from "./internal/compare";

describeSkillContract(skill);
describeActivitySmoke(skill);

type L = (typeof skill.lessons)[number];
const levelOf = (lesson: L) => (lesson.params as { level: number }).level;
const modeOf = (lesson: L) => (lesson.params as { question: { mode: CompareMode } }).question.mode;
const isPractice = (lesson: L) => Boolean((lesson.params as { question: { practice?: boolean } }).question.practice);
const teaching = skill.lessons.filter((l) => !isPractice(l));
const practice = skill.lessons.filter(isPractice);
const playOf = (lesson: L) => (lesson.params as { play: { audioPrompt: string } }).play;

describe("Measure It registration", () => {
  it("ships Stage 1 (comparing) as a draft, levels contiguous from 1", () => {
    expect(skill.lessons.map((l) => l.id)).toEqual([
      "what-can-we-measure", "longer-shorter", "taller-shorter", "line-them-up", "order-three", "compare-with-string",
      "heavier-lighter", "holds-more",
      "measure-with-blocks", "spot-the-mistake", "big-unit-small-unit", "balance-with-cubes", "fill-with-cups",
      "read-the-ruler", "measure-it", "draw-a-line", "broken-ruler", "how-much-longer",
      "cm-or-m", "estimate-length", "lengths-on-a-number-line", "inches-and-feet", "half-and-quarter-inches", "millimetres",
      "kg-or-g", "read-the-scale", "scale-steps", "kilogram-scales", "pounds-and-ounces",
      "read-the-jug", "fill-to-the-line", "cups-pints-quarts-gallons",
      "read-the-thermometer", "below-zero", "warmer-colder", "fahrenheit", "add-and-subtract-measures",
      "practice-scales", "practice-jugs", "practice-thermometers", "practice-measure-stories",
    ]);
    expect(skill.lessons.map(levelOf)).toEqual(skill.lessons.map((_, i) => i + 1));
    expect(Object.keys(skill.activities)).toEqual(["compare", "balance", "capacity", "units", "ruler", "estimate", "scale", "thermo", "story"]);
    expect(skill.manifest.status).toBe("draft");
  });

  it("gives each comparing lesson its own engine and mode", () => {
    expect(teaching.map((l) => `${l.activity.split("/")[1]}:${modeOf(l)}`)).toEqual([
      "compare:attribute", "compare:pick", "compare:pick_vertical", "compare:align", "compare:order", "compare:indirect",
      "balance:compare", "capacity:pour",
      "units:lay", "units:spot", "units:unit_size", "balance:cubes", "capacity:cups",
      "ruler:read", "ruler:place", "ruler:draw", "ruler:offset", "ruler:difference",
      "estimate:choose_unit", "estimate:benchmark", "ruler:numberline", "ruler:read_inch", "ruler:read_inch_fraction", "ruler:read_mm",
      "estimate:choose_unit", "scale:read", "scale:interval", "scale:read_kg", "scale:read_lb",
      "capacity:jug", "capacity:fill", "capacity:customary",
      "thermo:read", "thermo:negative", "thermo:change", "thermo:read_f", "story:same_unit",
    ]);
  });

  it("practises each Stage 4 engine with every mode it teaches, unhelped, open from the start", () => {
    const taught = (engine: string) => [...new Set(teaching.filter((l) => l.activity === engine).map(modeOf))];
    expect(practice.map((l) => l.activity)).toEqual(["measurement/scale", "measurement/capacity", "measurement/thermo", "measurement/story"]);
    for (const l of practice) {
      const q = (l.params as { question: { modes?: string[]; mode?: string; questionsPerRound: number } }).question;
      const modes = q.modes ?? [q.mode!];
      const own = taught(l.activity).filter((m) => l.activity !== "measurement/capacity" || ["jug", "fill", "customary"].includes(m));
      expect(modes, l.id).toEqual(own);
      expect(q.questionsPerRound, l.id).toBe(10);
      expect(l.title, l.id).toMatch(/^Practice: /);
      expect(l.concept, l.id).toBe("Practice Without Help");
      expect(l.requires, l.id).toEqual([]);
      expect(teaching.map((t) => t.conceptKey), l.id).toContain(l.conceptKey);
      expect(l.regions, `${l.id}: practice drops US-only modes itself`).toBeUndefined();
    }
  });

  it("names only icons, tones, art and a thumbnail that exist", () => {
    const tones = Object.keys(lessonIconTones).filter((t) => t !== "amber");
    const art = new Set<string>([...SVG_ASSET_IDS, ...(skill.assets ?? [])]);
    for (const lesson of skill.lessons) {
      expect(Object.keys(lessonIcons), lesson.id).toContain(lesson.iconName);
      expect(tones, lesson.id).toContain(lesson.iconTone);
      expect(art.has(lesson.icon ?? ""), `${lesson.id} icon ${lesson.icon}`).toBe(true);
    }
    expect(SVG_ASSET_IDS).toContain(skill.manifest.thumbnail);
  });

  it("requires concepts taught earlier, starting from counting's comparer", () => {
    const known = new Set(skill.manifest.requires ?? []);
    for (const lesson of skill.lessons) {
      for (const need of lesson.requires ?? []) expect(known, `${lesson.id} needs ${need}`).toContain(need);
      if (lesson.conceptKey) known.add(lesson.conceptKey);
    }
    expect(new Set(skill.lessons.map((l) => l.conceptKey))).toEqual(new Set(skill.manifest.teaches));
  });

  it("starts at age 5, stays within ages 5-12, with a US standard and a UK year on every lesson", () => {
    expect(skill.lessons[0].ageBand?.[0]).toBe(5);
    for (const lesson of skill.lessons) {
      expect(lesson.ageBand?.[0], lesson.id).toBeGreaterThanOrEqual(5);
      expect(lesson.ageBand?.[1], lesson.id).toBeLessThanOrEqual(12);
    }
    for (const lesson of teaching) {
      // CCSS first when the US has the idea; otherwise empty, with a trajectory level (plan §2.3).
      if (lesson.standards?.length) expect(lesson.standards[0], lesson.id).toMatch(/^CCSS\.(K|\d)\.(MD|NS)\./);
      else expect(lesson.trajectoryLevel, lesson.id).toBeTruthy();
      // England has a year for every lesson it sees; US-only lessons have none.
      if (lesson.regions && !lesson.regions.includes("GB")) expect(lesson.curricula?.GB, lesson.id).toBeUndefined();
      else expect(lesson.curricula?.GB, lesson.id).toMatch(/^Y[1-6]$/);
      // Cambodia's grades wait for the MoEYS textbooks (plan §13); none is invented.
      expect(lesson.curricula?.KH, lesson.id).toBeUndefined();
    }
  });

  it("shows comparing for everyone: Stage 1 is the same in every country", () => {
    for (const lesson of skill.lessons.slice(0, 8)) expect(lesson.regions, lesson.id).toBeUndefined();
  });

  it("keeps inches for the US only, and never gates a lesson everyone sees on one", () => {
    const usOnly = skill.lessons.filter((l) => l.regions).map((l) => [l.id, l.regions]);
    expect(usOnly).toEqual([
      ["inches-and-feet", ["US"]], ["half-and-quarter-inches", ["US"]], ["pounds-and-ounces", ["US"]],
      ["cups-pints-quarts-gallons", ["US"]], ["fahrenheit", ["US"]],
    ]);
    const regionKeys = new Set(skill.lessons.filter((l) => l.regions).map((l) => l.conceptKey));
    for (const lesson of skill.lessons.filter((l) => !l.regions))
      for (const need of lesson.requires ?? []) expect(regionKeys.has(need), `${lesson.id} needs ${need}`).toBe(false);
  });
});

describe("Measure It in the course", () => {
  const units = (course as { units: { id: string; lessons: string[]; title: string; icon: string }[] }).units;
  const ours = units.filter((u) => u.lessons.some((ref) => ref.startsWith("measurement/")));

  it("places every lesson exactly once, in level order, after Box Split, in the plan's units", () => {
    expect(ours.map((u) => [u.id, u.lessons.length])).toEqual([["u155", 4], ["u156", 4], ["u157", 5], ["u158", 5], ["u159", 6], ["u160", 8], ["u161", 5], ["u162", 4]]);
    expect(ours.flatMap((u) => u.lessons)).toEqual(skill.lessons.map((l) => `measurement/${l.id}`));
    expect(ours[0].id).toBe("u155");
  });

  it("gives every unit an icon from the art library", () => {
    const art = new Set<string>([...SVG_ASSET_IDS, ...(skill.assets ?? [])]);
    for (const unit of ours) expect(art.has(unit.icon), unit.title).toBe(true);
  });
});

describe("Measure It words", () => {
  const keys = (tree: object, prefix = ""): string[] =>
    Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));
  const { lessons: kmLessons, ...kmEngine } = km;

  it("has a Khmer line for every English engine line, and no extra", () => {
    expect(keys(en).filter((k) => !keys(kmEngine).includes(k))).toEqual([]);
    expect(keys(kmEngine).filter((k) => !keys(en).includes(k))).toEqual([]);
  });

  it("has Khmer copy for every lesson and only for real lessons", () => {
    expect(Object.keys(kmLessons).sort()).toEqual(skill.lessons.map((l) => l.id).sort());
  });

  it("declares every How to play caption Koda says, word for word", () => {
    expect(voice.phrases).toEqual([...Object.values(en.demo), ...Object.values(en.demo2), ...Object.values(en.demo3), ...Object.values(en.demo4), ...Object.values(en.demo5)]);
  });

  it("declares every lesson's spoken prompt in the voice script", () => {
    // Practice says nothing, so it has no prompt to record.
    for (const lesson of teaching) expect(voice.prompts, lesson.id).toContain(playOf(lesson).audioPrompt);
    for (const lesson of practice) expect(playOf(lesson).audioPrompt, lesson.id).toBe("");
  });

  it("uses no yellow anywhere", () => {
    const src = Object.values(import.meta.glob("./**/*.{tsx,svg}", { query: "?raw", import: "default", eager: true }) as Record<string, string>).join("\n");
    expect(src).not.toMatch(/yellow|amber|#FACC15|#FBBF24|#EAB308/i);
  });
});

describe("Measure It demos", () => {
  it("shows the comparing demo for look-and-pick lessons, ordering for ordering, none otherwise", () => {
    expect(demoKindFor("pick")).toBe("compare");
    expect(demoKindFor("pick_vertical")).toBe("compare");
    expect(demoKindFor("align")).toBe("compare");
    expect(demoKindFor("order")).toBe("order");
    expect(demoKindFor("attribute")).toBeNull();
    expect(demoKindFor("indirect")).toBeNull();
  });

  it("demonstrates the scale, thermometer and story with the numbers the captions say", () => {
    const sc = scaleDemoCheck();
    expect(sc.onMark).toBe(true);
    expect(en.demo5.scaleBefore).toContain(`${sc.before}.`);
    expect(en.demo5.scaleSteps).toContain(`${scaleDemoFacts().dial.step} g`);
    expect(en.demo5.scaleAnswer).toContain(`${scaleDemoFacts().value} g`);
    const th = thermoDemoFacts();
    expect((th.value - th.scale.min) % th.scale.step).toBe(0);
    expect(en.demo5.thermoCount).toContain(`by ${th.scale.step}s`);
    expect(en.demo5.thermoCount).toContain(`${th.value}.`);
    expect(en.demo5.thermoAnswer).toContain(`${th.value} degrees`);
    const st = storyDemoFacts();
    expect(st.answer).toBe(st.a - st.b);
    expect(en.demo5.storyAnswer).toContain(`${st.a} − ${st.b} = ${st.answer} g`);
  });

  it("demonstrates the ruler and the door with the numbers the captions say", () => {
    const f = rulerDemoFacts();
    expect(en.demo4.readEnd).toContain(`ends at ${f.read}`);
    expect(en.demo4.readAnswer).toContain(`${f.read} cm`);
    expect(en.demo4.placeRead).toContain(`${f.place} cm`);
    expect(en.demo4.drawIntro).toContain(`${f.draw} cm`);
    for (const d of ["read", "place", "draw"] as const) expect(rulerDemoSteps(d).length).toBeGreaterThan(2);
    const door = estimateDemoFacts();
    expect(ESTIMATE_THINGS[door.thing]).toMatchObject({ size: door.right, unit: "m" });
    expect(door.wrong).toBe(door.right * 10);
    expect(en.demo4.estimateTap).toContain(`${door.right} m, not ${door.wrong} m`);
  });

  it("demonstrates blocks covering the pencil, and says the count it shows", () => {
    const n = unitsDemoFacts().length;
    // The caption counts out loud to exactly the blocks the scene lays.
    expect(en.demo3.unitsCount).toContain(Array.from({ length: n }, (_, i) => i + 1).join(", "));
    expect(unitsDemoSteps().length).toBeGreaterThan(2);
  });

  it("demonstrates real answers on the balance, cups and jug", () => {
    const f = measureDemoFacts();
    // The balloon is drawn bigger, and the rock is heavier: the point of the demo.
    expect(MASS_THINGS[f.balance.left].size).toBeGreaterThan(MASS_THINGS[f.balance.right].size);
    expect(MASS_THINGS[f.balance.right].grams).toBeGreaterThan(MASS_THINGS[f.balance.left].grams);
    // The jar (tall) fills fewer cups than the bowl, as the caption says.
    expect(f.pour.cups[1]).toBeGreaterThan(f.pour.cups[0]);
    expect(f.jug.ml % f.jug.step).toBe(0);
    expect(en.demo2.jugRead).toContain(String(f.jug.ml));
  });

  it("demonstrates a real answer: the late one looks longer but is shorter", () => {
    const { long, short, shortStart } = demoFacts().compare;
    expect(short).toBeLessThan(long);
    expect(shortStart + short).toBeGreaterThan(long);
    const { sizes, order } = demoFacts().order;
    expect(order.map((i) => sizes[i])).toEqual([...sizes].sort((a, b) => a - b));
  });
});
