import { describe, expect, it } from "vitest";
import { skill } from ".";
import lessonsJson from "./lessons.json";
import { isPracticeLesson } from "../../curriculum";
import type { Lesson } from "../types";

/**
 * The manifest is what the Skill Manager, the catalog and the server seed all
 * read. Nothing here is visible while playing a round, which is why each of
 * these went wrong once in another skill before it was pinned: an audience band
 * that no longer matched the lessons, a settings key nothing read, a `teaches`
 * list that had stopped tracking the concepts actually taught.
 */

const lessons = skill.lessons as unknown as Lesson[];
const manifest = skill.manifest;
const settings = skill.settings as Record<string, unknown>;

describe("the subtraction manifest pins its identity", () => {
  it("keeps the id, audience and category the course was built against", () => {
    expect(manifest.id).toBe("subtraction");
    expect(manifest.name).toBe("Subtraction");
    expect(manifest.category).toBe("core");
    expect(manifest.audience).toEqual({ ages: [5, 9], category: "operations" });
  });

  it("covers every age its own lessons are written for", () => {
    const [low, high] = manifest.audience!.ages;
    for (const lesson of lessons) {
      if (!lesson.ageBand) continue;
      expect(lesson.ageBand[0], `${lesson.id} starts below the skill's audience`).toBeGreaterThanOrEqual(low);
      expect(lesson.ageBand[1], `${lesson.id} runs past the skill's audience`).toBeLessThanOrEqual(high);
    }
  });

  it("teaches exactly the concepts its lessons carry", () => {
    const taught = new Set(lessons.map((lesson) => lesson.conceptKey!));
    const declared = new Set(manifest.teaches ?? []);
    for (const key of taught) expect(declared.has(key), `${key} is taught but not declared`).toBe(true);
    for (const key of declared) expect(taught.has(key), `${key} is declared but no lesson teaches it`).toBe(true);
  });

  it("requires only concepts it does not teach first, or reuses them deliberately", () => {
    // `comparer`, `five-benchmark`, `make-ten`, `part-whole-decomposer`,
    // `place-value-builder`, `fact-family` and `doubles-knower` appear in both
    // lists on purpose: §2.1 reuses those records rather than opening a second
    // one for the same competence.
    const reused = new Set(["comparer", "five-benchmark", "make-ten", "part-whole-decomposer",
      "place-value-builder", "fact-family", "doubles-knower"]);
    const taught = new Set(lessons.map((lesson) => lesson.conceptKey!));
    for (const key of manifest.requires ?? []) {
      if (taught.has(key)) expect(reused.has(key), `${key} is required and taught without being a declared reuse`).toBe(true);
    }
  });

  it("ships sixty-three lessons: fifty-two teaching and eleven practice", () => {
    expect(lessons).toHaveLength(63);
    expect(lessons.filter((lesson) => isPracticeLesson(lesson))).toHaveLength(11);
    expect(lessons.filter((lesson) => !isPracticeLesson(lesson))).toHaveLength(52);
  });

  it("gives every lesson the standards or the trajectory that places it", () => {
    for (const lesson of lessons) {
      const hasStandard = (lesson.standards ?? []).length > 0;
      expect(hasStandard || Boolean(lesson.trajectoryLevel),
        `${lesson.id} sits in no standard and no trajectory`).toBe(true);
      for (const standard of lesson.standards ?? []) {
        expect(standard, `${lesson.id} has a short-form standard id`).toMatch(/^CCSS\./);
      }
    }
  });

  it("keeps the finger lesson on a trajectory instead of a standard", () => {
    const fingers = lessons.find((lesson) => lesson.id === "use-fingers")!;
    expect(fingers.standards).toEqual([]);
    expect(fingers.trajectoryLevel).toBeTruthy();
  });
});

describe("every feature and setting has a reader", () => {
  const source = JSON.stringify(lessonsJson);

  it("declares the eight features the activities check", () => {
    const declared = skill.features.map((feature) => feature.id).sort();
    expect(declared).toEqual([
      "audio_speech", "counting_badges", "haptic_feedback", "premium_lessons",
      "running_difference_badge", "sound_chimes", "step_context_tags", "strategy_scaffold",
    ]);
  });

  it("gives every setting a default of the type its schema promises", () => {
    for (const field of skill.settingsSchema ?? []) {
      const value = settings[field.key];
      expect(value, `${field.key} has no default`).toBeDefined();
      if (field.type === "number") expect(typeof value).toBe("number");
      if (field.type === "text") expect(typeof value).toBe("string");
      if (field.type === "choice") {
        expect(field.options!.map((option) => option.value)).toContain(value);
      }
    }
  });

  it("declares no setting the schema does not describe", () => {
    const described = new Set((skill.settingsSchema ?? []).map((field) => field.key));
    for (const key of Object.keys(settings)) {
      expect(described.has(key), `${key} is a setting no schema row explains`).toBe(true);
    }
  });

  it("uses no lesson copy that leaves a template placeholder unfilled", () => {
    // `{a}`, `{b}`, `{difference}`, `{claim}` and the story cast tokens are
    // filled by the engines; anything else reaches a child as literal braces.
    const known = /\{(a|b|difference|claim|item|itemOne|who|other|place|v0|v1|v2)\}/g;
    const leftovers = source.replace(known, "").match(/\{[a-zA-Z]+\}/g) ?? [];
    expect(leftovers, `unfilled placeholders: ${[...new Set(leftovers)].join(", ")}`).toHaveLength(0);
  });
});

describe("every lesson can actually be played", () => {
  it("points at an activity this skill defines and a mode it implements", () => {
    for (const lesson of lessons) {
      const [skillId, activityId] = lesson.activity.split("/");
      expect(skillId).toBe("subtraction");
      const activity = skill.activities[activityId];
      expect(activity, `${lesson.id} wants ${lesson.activity}`).toBeDefined();

      // Building one question is the cheapest proof the mode resolves: an
      // unknown mode falls back silently rather than throwing.
      const params = (lesson.params as { question?: Record<string, unknown> }).question ?? {};
      const built = activity.worksheet!.build!(params, 1, new Set(), undefined) as { mode?: string; expected: string };
      expect(built.expected, `${lesson.id} builds a question with no expected answer`).toBeTruthy();
      const wanted = params.mode ?? (params.modes as string[] | undefined)?.[0];
      if (wanted) expect(built.mode, `${lesson.id} asked for ${wanted} and got ${built.mode}`).toBe(wanted);
    }
  });

  it("prints a worksheet question and answer for every lesson", () => {
    for (const lesson of lessons) {
      const activity = skill.activities[lesson.activity.split("/")[1]];
      const params = (lesson.params as { question?: Record<string, unknown> }).question ?? {};
      const question = activity.worksheet!.build!(params, 1, new Set(), undefined);
      const printed = activity.worksheet!.printed!(question as never);
      expect(printed.text, `${lesson.id} prints no question`).toBeTruthy();
      expect(String(printed.answer), `${lesson.id} prints no answer`).toBeTruthy();
      expect(activity.worksheet!.method!(question as never).length, `${lesson.id} prints no method`).toBeGreaterThan(0);
    }
  });
});
