import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import {
  CHUNK_REFUSALS,
  buildChunkQuestion,
  chunkBlockedBecause,
  stepsThatFit,
  type ChunkBlock,
  type ChunkMode,
  type ChunkQuestion,
  type ChunkSetup,
} from "../internal/data/divisionChunk";

/**
 * Take away lots you are sure of, and keep the tally.
 *
 * The answer is never typed here. It accumulates: every chunk a child takes adds
 * its multiplier to a running tally, and when nothing more will fit, the tally
 * is already the quotient and what is left on the board is already the
 * remainder. That is the point of the method — it turns "what is 736 ÷ 8?" into
 * a sequence of questions a child can answer without hesitating.
 */

interface ChunkParams {
  question?: ChunkSetup;
  mode?: ChunkMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: ChunkParams, index: number, seen?: Set<string>): ChunkQuestion {
  const setup: ChunkSetup = { ...params, ...params.question };
  const mode = modeAt<ChunkMode>(setup, index + 1, "chunks");
  return buildChunkQuestion(setup, mode, index, seen);
}

export const promptFor = (question: ChunkQuestion): string => question.prompt;

export function chunkHints(question: ChunkQuestion): string[] {
  const ten = question.divisor * 10;
  return question.mode === "big_chunks"
    ? composeHints(
        `Start with the biggest chunk you are sure of. Ten lots of ${question.divisor} is ${ten}.`,
        `Would twenty lots fit? That is ${question.divisor * 20}.`,
        `You can get there in ${question.maxChunks ?? 3} goes. Take the big one first.`,
      )
    : composeHints(
        `Every chunk takes away some whole lots of ${question.divisor}.`,
        `Ten lots of ${question.divisor} is ${ten}. Start there if it fits.`,
        `Stop when what is left is smaller than ${question.divisor}.`,
      );
}

export const ChunkPad: React.FC<ActivityProps<ChunkParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: ChunkSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const notation = koda.config.get("remainderNotation", "r");

  const seen = useMemo(() => new Set<string>(), []);
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
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as ChunkQuestion;

  const [taken, setTaken] = useState<number[]>([]);
  const [refused, setRefused] = useState<ChunkBlock>(null);

  useEffect(() => {
    if (!question) return;
    setTaken([]);
    setRefused(null);
  }, [question]);

  if (!question) return null;

  const tally = taken.reduce((a, b) => a + b, 0);
  const remaining = question.dividend - tally * question.divisor;
  const block = chunkBlockedBecause(question, taken);
  const fits = stepsThatFit(remaining, question.divisor);

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const take = (step: number): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("pop");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
    setRefused(null);
    setTaken((current) => [...current, step]);
  };

  const undo = (): void => {
    setRefused(null);
    setTaken((current) => current.slice(0, -1));
  };

  const finish = (): void => {
    if (block) {
      setRefused(block);
      say(CHUNK_REFUSALS[block]);
      return;
    }
    const correct = tally === question.quotient && remaining === question.remainder;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: question.remainder === 0 ? String(tally) : `${tally} ${notation} ${remaining}`,
      expected: question.expected,
      title: correct ? "Yes!" : "Not yet",
      message: correct
        ? `${taken.length} chunk${taken.length === 1 ? "" : "s"}: ${taken.join(" + ")} lots of ${question.divisor}.`
        : "Count the tally again.",
    });
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Take Away Chunks"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : chunkHints(question)}
      iconName="Minus"
      iconTone="purple"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              say(promptFor(question));
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <div className="flex items-center justify-around rounded-2xl bg-surface p-3 text-center">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">Left</p>
            <p data-testid="remaining" className="text-2xl font-bold text-ink">
              {remaining}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">Lots so far</p>
            <p data-testid="tally" className="text-2xl font-bold text-emerald-600">
              {tally}
            </p>
          </div>
        </div>

        {taken.length > 0 ? (
          <ol className="flex flex-col gap-1 text-sm text-ink-soft">
            {taken.map((step, i) => (
              <li key={`${step}-${i}`}>
                − {step} × {question.divisor} = {step * question.divisor}
              </li>
            ))}
          </ol>
        ) : null}

        <div className="flex flex-wrap justify-center gap-2">
          {fits.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => take(step)}
              disabled={!!round.feedback}
              aria-label={`Take away ${step} lots of ${question.divisor}`}
              className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              − {step} × {question.divisor}
            </button>
          ))}
          {fits.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing more will fit.</p>
          ) : null}
        </div>

        {refused ? (
          <p role="status" className="text-center text-sm text-ink-soft">
            {CHUNK_REFUSALS[refused]}
          </p>
        ) : null}

        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={taken.length === 0 || !!round.feedback}
            aria-label="Undo the last chunk"
            className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm text-ink-soft shadow-sm disabled:opacity-30"
          >
            ↩
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={taken.length === 0 || !!round.feedback}
            className="min-h-11 rounded-2xl bg-violet-600 px-6 py-2 text-base font-bold text-white shadow-sm disabled:opacity-40"
          >
            That is all of them
          </button>
        </div>
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

export function printedFor(question: ChunkQuestion): { text: string; answer: string } | null {
  return {
    text: `${question.dividend} ÷ ${question.divisor} =        (take away lots of ${question.divisor} and keep a tally)`,
    answer: question.expected,
  };
}

export function methodFor(question: ChunkQuestion): string[] {
  return [
    `Take away a lot of ${question.divisor}s you are sure of — ten of them is ${question.divisor * 10}.`,
    "Write down how many lots you took, and carry on with what is left.",
    "Stop when what is left is too small for another lot. Add up your lots.",
  ];
}
