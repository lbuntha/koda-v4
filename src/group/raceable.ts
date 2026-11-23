/**
 * Whether a skill's lessons can be raced on this device.
 *
 * Three things must agree: the owner's switch (`group.skills`), a signed-in
 * user, and the skill's own `group_play` feature — the operator's choice in
 * the Skill Manager, or what the manifest declares when nobody has chosen. The
 * server checks the same before it opens a room (`routers/group_rooms.py`).
 */

import { SkillStoreAPI } from "../lib/skillStore";
import { getSkill } from "../skills/registry";

export const skillCanRace = (skillId: string, { signedIn, allowed }: { signedIn: boolean; allowed: boolean }): boolean => {
  if (!signedIn || !allowed) return false;
  const declared = getSkill(skillId)?.features.some((f) => f.id === "group_play" && f.isEnabled) ?? false;
  return declared && SkillStoreAPI.isFeatureEnabled(skillId, "group_play", declared);
};
