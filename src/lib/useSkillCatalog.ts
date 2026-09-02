import { useMemo } from "react";
import { getCourseUnits, type ResolvedLesson } from "../curriculum";
import { getSkill } from "../skills/registry";
import { useAudienceViewer } from "../skills/viewer";
import { buildSkillCatalog, type SkillCatalogSource } from "./skillCatalog";
import { SkillRegistryAPI, useSkillRegistryVersion } from "./skillRegistryApi";
import { skillTitle, useInstalledSkills } from "./skillStore";

/**
 * One compact learner catalog resolver shared by Home and Learn.
 *
 * Visibility comes from the course gate (publication, enabled state and age).
 * Cards receive summary metadata and progress only; activity components are
 * not mounted until a learner starts a lesson.
 */
export function useSkillCatalog(completedLevels: Record<number, number>) {
  const viewer = useAudienceViewer();
  const installed = useInstalledSkills();
  const registryVersion = useSkillRegistryVersion();

  const skills = useMemo(() => {
    const lessonsBySkill = new Map<string, ResolvedLesson[]>();
    for (const unit of getCourseUnits(viewer)) {
      for (const lesson of unit.lessons) {
        lessonsBySkill.set(lesson.skillId, [
          ...(lessonsBySkill.get(lesson.skillId) ?? []),
          lesson,
        ]);
      }
    }

    const sources: SkillCatalogSource[] = [...lessonsBySkill].flatMap(([skillId, lessons]) => {
      const skill = getSkill(skillId);
      if (!skill) return [];
      const listing = installed.find((entry) => entry.id === skillId);
      const server = SkillRegistryAPI.get(skillId);
      return [{
        id: skillId,
        // The deployment's name for it, else the manifest's. Everything a
        // learner sees reads the catalog, so this is where a rename lands.
        name: skillTitle(skill.manifest.name, listing),
        description: skill.manifest.description,
        tagline: listing?.tagline ?? skill.manifest.tagline ?? skill.manifest.description,
        thumbnail: listing?.thumbnail ?? skill.manifest.thumbnail,
        iconName: skill.manifest.iconName,
        author: skill.manifest.author,
        version: skill.manifest.version,
        category: skill.manifest.audience.category,
        ages: skill.manifest.audience.ages,
        status: server?.status ?? skill.manifest.status,
        publishedAt: server?.publishedAt,
        modified: server?.modified,
        lessons,
      }];
    });
    return buildSkillCatalog(sources, completedLevels);
  }, [completedLevels, installed, registryVersion, viewer]);

  return { skills, viewer };
}
