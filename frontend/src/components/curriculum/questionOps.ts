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

/**
 * Deduplicate questions array by unique ID and content signature.
 * Prevents duplicated cards from growing or accumulating on skill worksheets.
 */
export function deduplicateQuestions(questions: CountingQuestion[]): CountingQuestion[] {
  if (!Array.isArray(questions)) return [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const unique: CountingQuestion[] = [];

  for (const q of questions) {
    if (!q || !q.id) continue;
    // Check ID uniqueness
    if (seenIds.has(q.id)) continue;

    // Check Signature uniqueness (skillId + technique + title + objectId + config)
    const configStr = JSON.stringify(q.config || {});
    const signature = `${q.skillId || ""}:${q.technique}:${q.title}:${q.objectId || ""}:${configStr}`;
    if (seenSignatures.has(signature)) continue;

    seenIds.add(q.id);
    seenSignatures.add(signature);
    unique.push(q);
  }

  return unique;
}

/**
 * Normalizes question deck so EVERY registered component has EXACTLY 1 sample question card:
 * 1. If a component has 0 questions, seeds 1 new sample question for it.
 * 2. If a component has > 1 questions, removes extra records so only 1 remains.
 */
export function ensureExactlyOneSamplePerComponent(questions: CountingQuestion[]): CountingQuestion[] {
  const byTechniqueMap = new Map<string, CountingQuestion>();

  // Collect the first question for each technique present in existing questions
  if (Array.isArray(questions)) {
    for (const q of questions) {
      if (q && q.technique && !byTechniqueMap.has(q.technique)) {
        byTechniqueMap.set(q.technique, q);
      }
    }
  }

  // Ensure every registered technique in ALL_TECHNIQUES has a sample card
  const result: CountingQuestion[] = [];
  for (const manifest of ALL_TECHNIQUES) {
    const existing = byTechniqueMap.get(manifest.technique);
    if (existing) {
      result.push(existing);
    } else {
      // Seed 1 new sample card for zero-count component
      try {
        const seeded = createBlankSkillQuestion(manifest.technique, "");
        seeded.title = `${formatTechniqueLabel(manifest.technique)} Sample`;
        result.push(seeded);
      } catch {
        // Fallback if schema generation fails
      }
    }
  }

  return result;
}

/** Preserves the deck's own ordering — a skill's questions are just the subsequence of the full deck that points at it. */
export function filterAndSortBySkill(questions: CountingQuestion[], skillId: string): CountingQuestion[] {
  const unique = deduplicateQuestions(questions);
  return unique.filter(q => q.skillId === skillId);
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
