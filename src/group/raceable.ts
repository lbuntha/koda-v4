/**
 * Whether a skill's lessons can be raced on this device.
 *
 * Four things must agree: the owner's switch (`group.skills`), a signed-in
 * user, the child's grown-up ("Play with others"), and the skill's own `group_play` feature — the operator's choice in
 * the Skill Manager, or what the manifest declares when nobody has chosen. The
 * server checks the same before it opens a room (`routers/group_rooms.py`).
 */

import { ChildSettingsAPI } from "../lib/childSettings";
import { SkillStoreAPI } from "../lib/skillStore";
import { getSkill } from "../skills/registry";

/** The child's grown-up has left "Play with others" on (the default). */
export const childMayPlayWithOthers = (): boolean => ChildSettingsAPI.current().groupPlayEnabled;

export const skillCanRace = (skillId: string, { signedIn, allowed }: { signedIn: boolean; allowed: boolean }): boolean => {
  if (!signedIn || !allowed || !childMayPlayWithOthers()) return false;
  const declared = getSkill(skillId)?.features.some((f) => f.id === "group_play" && f.isEnabled) ?? false;
  return declared && SkillStoreAPI.isFeatureEnabled(skillId, "group_play", declared);
};
