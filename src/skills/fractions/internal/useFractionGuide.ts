import type { KodaSDK } from "../../types";
import type { RoundController } from "../../kit";
import { guideSetup, useGuide, type GuideController } from "../../kit";

/**
 * Fractions' common Smart Guide wiring.
 *
 * The technique-specific words stay in each engine's hint builder. This hook
 * only makes those same three rungs available proactively, so asking for a
 * hint and being offered help never produce two different explanations.
 */
export function useFractionGuide(options: {
  params: unknown;
  koda: KodaSDK;
  practising: boolean;
  questionId: string;
  rungs: string[];
  round: RoundController;
  progress?: number;
  target?: number;
}): GuideController {
  const setup = guideSetup(options.params);
  return useGuide({
    koda: options.koda,
    enabled:
      !options.practising &&
      (setup.enabled ?? false) &&
      options.koda.config.isEnabled("guide_coach", true),
    setup,
    questionId: options.questionId,
    rungs: options.rungs,
    target: options.target ?? -1,
    progress: options.progress ?? 0,
    done: false,
    paused: Boolean(options.round.feedback) || Boolean(options.round.score),
    useSupport: options.round.useSupport,
  });
}

/** The lesson method becomes the guide bubble's optional page-through recap. */
export const fractionGuideMethod = (params: unknown): string[] | undefined =>
  (params as { play?: { stepByStep?: string[] } } | null | undefined)?.play?.stepByStep;
