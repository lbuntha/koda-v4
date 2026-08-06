/**
 * Put the correct choice in an authored slot while preserving distractor order.
 *
 * Sorting every choice list numerically made the right answer land in the middle for most
 * questions, teaching children to guess "B" instead of reading the task. Grade 1 curriculum
 * questions now store an `answerChoiceSlot`; this helper applies it consistently.
 */
export function balancedChoiceOrder<T>(choices: readonly T[], answer: T, authoredSlot: unknown): T[] {
  const unique = choices.filter((choice, index) => choices.indexOf(choice) === index);
  const answerIndex = unique.indexOf(answer);
  if (answerIndex < 0 || unique.length < 2) return unique;

  const parsedSlot = Number(authoredSlot);
  const slot = Number.isFinite(parsedSlot)
    ? ((Math.round(parsedSlot) % unique.length) + unique.length) % unique.length
    : 0;
  const [correct] = unique.splice(answerIndex, 1);
  unique.splice(slot, 0, correct);
  return unique;
}
