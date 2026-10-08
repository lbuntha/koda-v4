import type { Lesson, SettingField, SkillFeature, SkillInfo, SkillManifest } from "./types";

interface ManifestJson {
  features: unknown;
  settings: unknown;
  settingsSchema: unknown;
  [field: string]: unknown;
}

/**
 * A skill's description, from its two JSON files.
 *
 * One reader for every skill, used twice: the registry builds the always-loaded
 * list from it, and each skill's `index.ts` spreads it into the full `Skill`,
 * so the two can never disagree about a skill's manifest or lessons.
 *
 * The casts are the JSON trust boundary. `ages.test.ts` holds every manifest's
 * audience to a [min, max] pair, which JSON alone would widen to `number[]`.
 */
export function describeSkill(manifestJson: ManifestJson, lessonsJson: { lessons: unknown }): SkillInfo {
  const { features, settings, settingsSchema, ...manifestFields } = manifestJson;
  return {
    manifest: manifestFields as unknown as SkillManifest,
    features: features as SkillFeature[],
    settings: settings as Record<string, unknown>,
    settingsSchema: settingsSchema as SettingField[],
    lessons: lessonsJson.lessons as Lesson[],
  };
}
