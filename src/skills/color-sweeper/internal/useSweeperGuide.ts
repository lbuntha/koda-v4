import type { KodaSDK } from "../../types";
import type { RoundController } from "../../kit";
import { guideSetup, useGuide, type GuideController } from "../../kit";

/**
 * Shared timing and telemetry for Color Sweeper's three different engines.
 *
 * Each engine still owns its reasoning: the board follows the next deduction,
 * the lens follows the neighbourhood being read, and the reason lab never
 * points at a correct choice. This only makes their existing ladder available
 * through the same offered/asked guide used by the other skills.
 */
export function useSweeperGuide(options: {
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

export const sweeperGuideMethod = (params: unknown): string[] | undefined =>
  (params as { play?: { stepByStep?: string[] } } | null | undefined)?.play?.stepByStep;
