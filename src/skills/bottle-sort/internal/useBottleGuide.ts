import type { KodaSDK } from "../../types";
import type { RoundController } from "../../kit";
import { guideSetup, useGuide, type GuideController } from "../../kit";

export function useBottleGuide(options: {
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

export const bottleGuideMethod = (params: unknown): string[] | undefined =>
  (params as { play?: { stepByStep?: string[] } } | null | undefined)?.play?.stepByStep;
