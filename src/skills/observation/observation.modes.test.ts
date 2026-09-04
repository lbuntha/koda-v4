import { describe, expect, it } from "vitest";
import { buildQuestion } from "./activities/ObjectHunt";
import { OBJECT_BY_ID } from "./internal/data";
import { keyOf } from "./internal/types";
import { validateScene } from "./internal/validation";
import lessons from "./lessons.json";

const lesson = (id: string) => {
  const found = lessons.lessons.find((l) => l.id === id)!;
  return { ...found.params.question, seed: `modes-${id}` } as never;
};

describe("the five advanced modes", () => {
  it("overlap spills art across neighbours without tangling the hit boxes", () => {
    const q = buildQuestion(lesson("untangle-the-pile"), 1);
    expect(q.mode).toBe("overlap");
    // Art is drawn past its own box, which is what makes shapes cross.
    expect(q.objects.every((o) => (o.visualScale ?? 1) > 3)).toBe(true);
    // Art must cross the ~19% gap between slots or nothing overlaps.
    expect(q.objects.every((o) => o.width * (o.visualScale ?? 1) > 19)).toBe(true);
    // The boxes themselves must stay apart, or a tap becomes ambiguous.
    expect(validateScene({ ...q.scene, objects: q.objects })).toEqual([]);
  });

  it("mirror only asks about objects whose reflection differs", () => {
    for (let i = 1; i <= 5; i += 1) {
      const q = buildQuestion(lesson("same-or-mirrored"), i);
      // Flipping a frog or a crown changes nothing a child could see, so a
      // symmetric object can never be the answer to a mirror question.
      q.targets.forEach((key) => {
        const object = q.objects.find((o) => keyOf(o) === key)!;
        expect(OBJECT_BY_ID.get(object.id)?.mirrorSafe, key).toBe(true);
      });
      // Nothing symmetric is flipped either; that would just be noise.
      q.objects.filter((o) => o.mirrored)
        .forEach((o) => expect(OBJECT_BY_ID.get(o.id)?.mirrorSafe, o.id).toBe(true));
    }
    const q = buildQuestion(lesson("same-or-mirrored"), 1);
    const flipped = q.objects.filter((o) => o.mirrored);
    expect(flipped.length).toBeGreaterThan(0);
    expect(flipped.length).toBeLessThan(q.objects.length);
    // If only distractors were flipped, "pick the unflipped one" would win.
    expect(flipped.some((o) => q.targets.includes(keyOf(o)))).toBe(true);
  });

  it("camouflage and shadow change presentation, not the answer", () => {
    (["hiding-in-the-pattern", "follow-the-shadow"] as const).forEach((id) => {
      const q = buildQuestion(lesson(id), 1);
      expect(q.targets.length).toBeGreaterThan(0);
      expect(q.targets.every((key) => q.objects.some((o) => keyOf(o) === key))).toBe(true);
      expect(validateScene({ ...q.scene, objects: q.objects })).toEqual([]);
    });
    expect(buildQuestion(lesson("hiding-in-the-pattern"), 1).mode).toBe("camouflage");
    expect(buildQuestion(lesson("follow-the-shadow"), 1).mode).toBe("shadow");
  });

  it("category asks for a group and makes every member of it a target", () => {
    for (let i = 1; i <= 5; i += 1) {
      const q = buildQuestion(lesson("find-what-belongs"), i);
      expect(q.mode).toBe("category");
      expect(q.category).toBeTruthy();
      expect(q.prompt).toMatch(/^Find \d+ /);
      // Every target belongs to the named group...
      q.targets.forEach((key) => {
        const object = q.objects.find((o) => keyOf(o) === key)!;
        expect(OBJECT_BY_ID.get(object.id)?.category, key).toBe(q.category);
      });
      // ...and nothing of that group is left off the answer, or a complete
      // sweep of the scene would still score as wrong.
      const missed = q.objects.filter((o) => OBJECT_BY_ID.get(o.id)?.category === q.category && !q.targets.includes(keyOf(o)));
      expect(missed, `question ${i}`).toEqual([]);
      expect(q.targets.length).toBeGreaterThan(1);
    }
  });

  it("shows a group name instead of pictures in a category round", async () => {
    const { renderActivity } = await import("../kit/testing");
    const { skill } = await import(".");
    const h = renderActivity(skill.activities["object-hunt"], { params: lesson("find-what-belongs") });
    const tray = h.screen.getByLabelText("Objects to find");
    // A preview would hand back the template the level exists to remove.
    expect(tray.querySelectorAll("svg")).toHaveLength(0);
    expect(tray.textContent).toMatch(/things you can eat|animals|tools|things you can wear|toys|things that hold/);
    h.unmount();
  });

  it("gives every catalog object a category worth searching by", () => {
    const uncategorised = [...OBJECT_BY_ID.values()].filter((o) => !o.category);
    // Not every object needs one, but the groups must be big enough to search.
    const counts = new Map<string, number>();
    OBJECT_BY_ID.forEach((o) => { if (o.category) counts.set(o.category, (counts.get(o.category) ?? 0) + 1); });
    counts.forEach((n, category) => expect(n, category).toBeGreaterThanOrEqual(9));
    expect(uncategorised.length).toBeLessThan(OBJECT_BY_ID.size / 2);
  });
});
