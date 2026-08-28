import { describe, it } from "vitest";
import type { Skill } from "../../types";
import { mountsCleanly } from "./renderActivity";

/**
 * Mount every activity a skill registers, with the params of a real lesson.
 *
 * Loops the registry rather than naming activities, so an activity added later
 * is covered the moment it is registered — no test edit, and no way to add one
 * that nothing ever mounts.
 */
export function describeActivitySmoke(skill: Skill): void {
  describe(`activities mount: ${skill.manifest.id}`, () => {
    for (const activity of Object.values(skill.activities)) {
      it(`${activity.id} opens a round and presents a question`, () => {
        mountsCleanly(skill, activity);
      });
    }
  });
}
