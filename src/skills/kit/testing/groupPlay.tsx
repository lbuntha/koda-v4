import { describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import type { Skill } from "../../types";
import { withRaceSeed } from "../../host/SkillHost";
import { renderActivity } from "./renderActivity";

/** The feature a skill declares when its rounds can be raced (`server/app/routers/group_rooms.py`). */
export const GROUP_FEATURE = "group_play";

export const declaresGroupPlay = (skill: Skill): boolean => skill.features.some((f) => f.id === GROUP_FEATURE);

/**
 * The promise `group_play` makes: the same seed gives every player the same round.
 *
 * Mounts every lesson twice with one seed, as two players' devices would, and
 * compares what the round presented. A skill whose questions came from
 * `Math.random` would pass every other test and still hand two children in the
 * same race different sums — this is the test that notices.
 */
export function describeGroupPlay(skill: Skill): void {
  describe(`group play: ${skill.manifest.id}`, () => {
    it("declares the group_play feature", () => {
      expect(declaresGroupPlay(skill)).toBe(true);
    });

    it.each(skill.lessons.map((l) => [l.id, l] as const))("%s deals the same first question for the same seed", (_id, lesson) => {
      const [, activityId] = lesson.activity.split("/");
      const activity = skill.activities[activityId];
      expect(activity, lesson.activity).toBeDefined();
      const first = (seed: string) => {
        const h = renderActivity(activity, { params: withRaceSeed(lesson.params as Record<string, unknown>, seed), settings: { praiseMs: 0 } });
        const presented = h.koda.only("learning.present")[0]?.args[0] as { prompt?: string; expected?: string; questionId?: string } | undefined;
        const screen = h.text();
        h.unmount();
        cleanup();
        return { presented, screen };
      };
      const a = first("race-seed");
      const b = first("race-seed");
      expect(a.presented, "a question was presented").toBeDefined();
      expect(b.presented).toEqual(a.presented);
      expect(b.screen).toEqual(a.screen);
    });
  });
}
