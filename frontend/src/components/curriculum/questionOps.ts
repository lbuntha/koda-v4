/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The one file in src/components/curriculum/ allowed to import CountingQuestion
 * directly — curriculum/types.ts and curriculum/mutations.ts never do (see the
 * "two hard boundaries" note in the build plan). Everything here operates on
 * the real question deck; curriculum/types.ts only ever sees the skillIds
 * extracted from it.
 */

import { CountingQuestion, CountingTechnique } from "../../types";
import { ALL_TECHNIQUES } from "../../techniques";
import { createQuestionId } from "../../studio/questionIds";

/**
 * Build a complete question from the selected component's canonical schema.
 * This keeps Curriculum's Add Question flow aligned with every component's
 * real defaults instead of giving all techniques the old apple/5/empty-config
 * One-to-One placeholder.
 */
export function createBlankSkillQuestion(technique: CountingTechnique, skillId: string): CountingQuestion {
  const manifest = ALL_TECHNIQUES.find(item => item.technique === technique);
  if (!manifest) throw new Error(`Question component is not registered: ${technique}`);
  const defaults = manifest.schema.validate({
    targetCount: manifest.defaultTargetCount,
    config: {},
  }, 0);

  return {
    ...defaults,
    id: createQuestionId(),
    skillId,
    config: { ...defaults.config },
  };
}

/** Preserves the deck's own ordering — a skill's questions are just the subsequence of the full deck that points at it. */
export function filterAndSortBySkill(questions: CountingQuestion[], skillId: string): CountingQuestion[] {
  return questions.filter(q => q.skillId === skillId);
}

/**
 * Re-seats a skill's questions into the order given, without disturbing any
 * other question's position in the deck. orderedIds must be exactly the ids
 * currently returned by filterAndSortBySkill(questions, skillId), permuted.
 */
export function spliceReordered(questions: CountingQuestion[], skillId: string, orderedIds: string[]): CountingQuestion[] {
  const slots: number[] = [];
  questions.forEach((q, i) => {
    if (q.skillId === skillId) slots.push(i);
  });
  const byId = new Map(questions.map(q => [q.id, q]));
  const next = [...questions];
  slots.forEach((slotIndex, i) => {
    const replacement = byId.get(orderedIds[i]);
    if (replacement) next[slotIndex] = replacement;
  });
  return next;
}

/** "ONE_TO_ONE" -> "One To One" — a compact label for the grid badge, independent of the numbered/iconed picker array (extracted separately in Phase 4). */
export function formatTechniqueLabel(technique: CountingTechnique): string {
  return technique
    .toLowerCase()
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
