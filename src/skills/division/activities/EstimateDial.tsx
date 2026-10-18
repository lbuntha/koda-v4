import React, { useCallback, useMemo } from "react";

import type { ActivityProps } from "../../types";
import {
  SkillRound,
  composeHints,
  guideSetup,
  isPractice,
  modeAt,
  openWith,
  playCopy,
  useGuide,
  useSkillRound,
} from "../../kit";
import {
  buildEstimateQuestion,
  friendliestTotal,
  type EstimateMode,
  type EstimateQuestion,
  type EstimateSetup,
} from "../internal/data/divisionEstimate";
import { td } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

/**
 * Estimating, judging, and checking.
 *
 * The whole engine turns on one thing: division rounds to numbers that *divide*,
 * not to the nearest ten. `347 ÷ 6` is about `360 ÷ 6`, and 350 — the nearer
 * number — is the wrong choice. So the divisor is never touched and the total
 * moves to whichever neighbouring multiple is friendlier, which is a judgement
 * rather than a rule and is offered as a choice between two.
 */

interface EstimateParams {
  question?: EstimateSetup;
  mode?: EstimateMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: EstimateParams, index: number): EstimateQuestion {
  const setup: EstimateSetup = { ...params, ...params.question };
  const mode = modeAt<EstimateMode>(setup, index + 1, "compatible");
  return buildEstimateQuestion(setup, mode, index);
}

export const promptFor = (question: EstimateQuestion): string => question.prompt;

/**
 * The ladder, opening with the lesson's own words.
 *
 * All fifty-six division lessons author a `kidTip` and, until this, not one
 * was read: these ladders took the question and nothing else. `openWith`
 * puts it back as rung one without costing the worked step — see the kit.
 */
export function estimateHints(question: EstimateQuestion, kidTip?: string): string[] {
  return openWith(kidTip, estimateHintsRungs(question));
}

function estimateHintsRungs(question: EstimateQuestion): string[] {
  switch (question.mode) {
    case "compatible":
      return composeHints(
        td("estimate.hint.compatible1", { d: question.divisor }),
        td("estimate.hint.compatible2", { n: question.dividend, d: question.divisor }),
        td("estimate.hint.compatible3"),
      );
    case "reasonable":
      return composeHints(
        td("estimate.hint.reasonable1"),
        td("estimate.hint.reasonable2", { n: question.dividend, d: question.divisor }),
        td("estimate.hint.reasonable3"),
      );
    default:
      return composeHints(
        td("estimate.hint.check1"),
        td("estimate.hint.check2"),
        td("estimate.hint.check3"),
      );
  }
}

export const EstimateDial: React.FC<ActivityProps<EstimateParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  // Re-render when the language changes: every line below reads the catalog.
  useT();
  const setup: EstimateSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    /*
     * Nothing is read to the child when a round opens.
     *
     * The opening line exists because a five-year-old cannot read the
     * instruction. This skill starts at seven, and reading the question aloud
     * to a reader takes the reading out of the question — which in levels 49
     * to 55 is most of the work. The speaker button is still there for a child
     * who needs it; it is pull, not push. See `voice.json`.
     */
    intro: undefined,
    resumable: practising,
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1), [params]),
    onComplete,
  });
  const question = round.question as EstimateQuestion;

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const copy = playCopy(params);
  const hints = practising ? [] : estimateHints(question, copy.kidTip);
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    target: -1,
    progress: 0,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  if (!question) return null;

  const submit = (given: string, correct: boolean, message: string): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title: correct ? td("yes") : td("notQuite"), message });
  };

  const chooseTotal = (candidate: number): void => {
    const best = friendliestTotal(question.dividend, question.divisor);
    const correct = candidate === best;
    submit(
      String(candidate / question.divisor),
      correct,
      correct
        ? td("estimate.aboutRight", { total: candidate, d: question.divisor, q: candidate / question.divisor })
        : td("estimate.easier", { total: candidate, best, d: question.divisor }),
    );
  };

  const judge = (said: boolean): void => {
    const correct = said === (question.fault === "right");
    submit(
      said ? "yes" : "no",
      correct,
      correct
        ? question.fault === "right"
          ? td("estimate.fault.right")
          : question.fault === "ten-times-too-big"
            ? td("estimate.fault.tooBig")
            : question.fault === "ten-times-too-small"
              ? td("estimate.fault.tooSmall")
              : td("estimate.fault.droppedZero")
        : td("estimate.howManyFit", { n: question.dividend, d: question.divisor }),
    );
  };

  const checkWith = (text: string): void => {
    const correct = text === question.expected;
    submit(text, correct, correct ? td("estimate.rebuilds") : td("estimate.multiplyBack"));
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={td("estimate.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      iconName="Gauge"
      iconTone="cyan"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              void koda.speech.say(promptFor(question), { rate: koda.config.get("speechRate", 1) });
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {question.mode === "compatible" ? (
          <>
            <p className="text-center text-sm text-muted">
              {td("estimate.whichTotal", { d: question.divisor })}
            </p>
            <div className="flex justify-center gap-3">
              {(question.neighbours ?? []).map((candidate, i) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => chooseTotal(candidate)}
                  disabled={!!round.feedback}
                  className="min-h-11 flex-1 rounded-2xl bg-surface px-4 py-3 text-center shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <span className="block text-xl font-bold text-ink">{candidate}</span>
                  <span className="block text-xs text-muted">
                    ÷ {question.divisor} = {(question.estimates ?? [])[i]}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {question.mode === "reasonable" ? (
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => judge(true)}
              disabled={!!round.feedback}
              className="min-h-11 min-w-28 rounded-2xl bg-surface px-6 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {td("estimate.couldBe")}
            </button>
            <button
              type="button"
              onClick={() => judge(false)}
              disabled={!!round.feedback}
              className="min-h-11 min-w-28 rounded-2xl bg-surface px-6 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              {td("estimate.noChance")}
            </button>
          </div>
        ) : null}

        {question.mode === "check_back" ? (
          <div className="flex flex-col gap-2">
            {(question.rebuilds ?? []).map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => checkWith(text)}
                disabled={!!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-center text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                {text}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

export function printedFor(question: EstimateQuestion): { text: string; answer: string } | null {
  switch (question.mode) {
    case "compatible":
      return {
        text: td("estimate.prompt.compatible", { n: question.dividend, d: question.divisor }),
        answer: question.expected,
      };
    case "reasonable":
      return {
        text: td("estimate.printedClaim", { n: question.dividend, d: question.divisor, claim: question.claim ?? "" }),
        answer: question.expected,
      };
    default:
      return {
        text: td(question.remainder ? "estimate.printedCheckRemainder" : "estimate.printedCheck", {
          n: question.dividend,
          d: question.divisor,
          q: question.quotient,
          r: question.remainder,
        }),
        answer: question.expected,
      };
  }
}

export function methodFor(): string[] {
  return [
    td("estimate.method1"),
    td("estimate.method2"),
    td("estimate.method3"),
  ];
}
