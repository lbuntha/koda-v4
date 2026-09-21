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
/** Four near misses in an order a child cannot learn, stable per question. */
export { answerChoices, type AnswerChoiceOptions } from "./round/answerChoices";
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
  type HintController,
  type UseSkillRoundOptions,
} from "./round/useSkillRound";
/** The hint ladder: the lesson's own copy, the words a skill adds for the
 *  question on screen, and the panel that reads them out. */
export {
  composeHints,
  openWith,
  hintAt,
  playCopy,
  MAX_HINTS,
  type LessonPlayCopy,
} from "./round/hints";
export { SkillHint, type SkillHintProps } from "./chrome/SkillHint";
/** Help the skill offers rather than help the child asked for: the standard
 *  bubble, with the lesson's method behind Back and Next. */
export {
  useGuide,
  guideSetup,
  levelFor,
  waitMs,
  GUIDE_DEFAULTS,
  PATIENCE,
  type GuideController,
  type GuideCue,
  type GuideLevel,
  type GuideReason,
  type GuideSetup,
  type UseGuideOptions,
} from "./round/useGuide";
export {
  SkillGuide,
  type SkillGuideProps,
  type SkillGuideCue,
} from "./chrome/SkillGuide";
/** Hold a round open until the last spoken number has been heard, so the
 *  praise clip cannot cut the answer off mid-word. */
export {
  useSpokenFinish,
  SPOKEN_FLOOR_MS,
  SPOKEN_CAP_MS,
  type SpokenFinish,
  type SpokenFinishOptions,
} from "./round/useSpokenFinish";
/** Practice: the same engine with the hints, the voice and the explanation off. */
export { isPractice, modeAt, withoutPracticeLabel, type PracticeSetup } from "./practice";
