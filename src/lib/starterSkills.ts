import type { SkillCatalogEntry } from "./skillCatalog";

/**
 * What a learner with nothing yet should start with.
 *
 * Asked once, on the first day: no history, no mastery, nothing for
 * `recommendNow` to read. So the evidence is the only thing there is — the
 * learner's age and what can actually be opened today — and the answer is a
 * short list rather than a ranking of the whole shelf.
 *
 * - Only skills whose next lesson the caller says can start. Most lessons are
 *   gated behind earlier ones, and a "Start" that opens a padlock is the worst
 *   possible first tap.
 * - A skill made for this age before one this age is only stretched into.
 * - The most foundational first: the range that ends soonest is the one
 *   written for the youngest end, which is where a beginner belongs.
 * - One per subject before a second from any — three Math skills is a list,
 *   Math and Thinking is a choice.
 */
export function starterSkills(
  skills: SkillCatalogEntry[],
  options: { age: number | null | undefined; canStart(skill: SkillCatalogEntry): boolean; limit?: number },
): SkillCatalogEntry[] {
  const { age, canStart, limit = 3 } = options;
  const inRange = (skill: SkillCatalogEntry) =>
    !skill.ages || age == null || (age >= skill.ages[0] && age <= skill.ages[1]);
  const ranked = skills
    .filter((skill) => skill.status !== "draft" && skill.completedLessons === 0 && canStart(skill))
    .sort(
      (a, b) =>
        Number(inRange(b)) - Number(inRange(a)) ||
        (a.ages?.[1] ?? 99) - (b.ages?.[1] ?? 99) ||
        a.name.localeCompare(b.name),
    );

  const picked: SkillCatalogEntry[] = [];
  const subjects = new Set<string>();
  for (const skill of ranked) {
    const subject = skill.subjectId ?? skill.category;
    if (subjects.has(subject)) continue;
    subjects.add(subject);
    picked.push(skill);
    if (picked.length === limit) return picked;
  }
  for (const skill of ranked) {
    if (!picked.includes(skill)) picked.push(skill);
    if (picked.length === limit) break;
  }
  return picked;
}
