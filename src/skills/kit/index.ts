/**
 * Shared skill furniture.
 *
 * Anything two skills would otherwise each build: round chrome first, with the
 * round loop and manipulatives to follow. Importing from here is allowed from
 * any skill — it is the sanctioned alternative to a cross-folder import.
 */
export {
  SkillRoundTopBar,
  type SkillRoundTopBarProps,
  type SkillVoiceContext,
} from "./chrome/SkillRoundTopBar";

export { SkillRound, type SkillRoundProps } from "./chrome/SkillRound";
/** Catches a throw inside an activity so it costs the round, not the app. */
export { ActivityErrorBoundary } from "./chrome/ActivityErrorBoundary";
export { PracticeStepHeader, DEFAULT_STEP_TAGS, type StepTagLabels } from "./chrome/PracticeStepHeader";
export { PracticeRoundCompleteModal } from "./chrome/RoundCompleteModal";
export { scoreRound, type RoundOutcome, type RoundScore } from "./round/scoreRound";
/** Speak a reaction to an answer. `useSkillRound` calls it; a skill with its
 *  own round loop can call it directly and sound the same. */
export { playAnswerSound, playChrome } from "./round/answerSound";
/** The shared motion vocabulary. Four springs, a stagger and an idle drift —
 *  use these rather than hand-tuning a spring per component. */
export { SPRING, stagger, idleFloat, useMotionOK } from "./motion";
export {
  useSkillRound,
  type AnswerOutcome,
  type RoundFeedback,
  type RoundQuestion,
  type RoundController,
  type UseSkillRoundOptions,
} from "./round/useSkillRound";
