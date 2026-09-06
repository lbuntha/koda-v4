import React, { useCallback, useMemo } from "react";
import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, playCopy, useSkillRound, type RoundQuestion } from "../../kit";
import { buildPrediction } from "../internal/predict";
import { specFor } from "../internal/specs";
import { GLYPH, cssColour, nameOf, shapeOf } from "../internal/paint";
import { topRun, type Pour, type Rack } from "../internal/types";

/**
 * "Which rack comes next?"
 *
 * Lessons 23 and 24. The child reads a rack, is told one or two pours, and
 * picks the result from four — so this scores from a picture rather than from
 * doing, which is the whole point: predicting a pour is a different skill from
 * making one, and a child who can sort by trial and error may not be able to
 * say in advance what a pour will do.
 *
 * The racks are drawn small and flat. There is no animation, nothing to pick
 * up, and no pour rule enforced here — the rules live in `internal/`, the
 * distractors live in `internal/predict.ts`, and this file only draws and
 * scores.
 */

interface PredictSetup {
  spec?: string;
  specs?: string[];
  questionsPerRound?: number;
  practice?: boolean;
  seed?: string;
  /** Pours to imagine before choosing. */
  steps?: 1 | 2;
}

export interface PredictParams extends PredictSetup {
  question?: PredictSetup;
}

export interface PredictQuestion extends RoundQuestion {
  start: Rack;
  moves: Pour[];
  choices: Rack[];
  answer: number;
  hues: number[];
}

const say = (moves: Pour[]): string =>
  moves.map((m) => `bottle ${m.from + 1} into bottle ${m.to + 1}`).join(", then ");

export function buildQuestion(params: PredictParams, index: number): PredictQuestion {
  const setup = { ...params, ...params.question };
  const cycle = setup.specs?.length ? setup.specs : [setup.spec ?? "guess-the-result"];
  const spec = specFor(cycle[(index - 1) % cycle.length]) ?? specFor("guess-the-result")!;
  const steps: 1 | 2 = setup.steps === 2 ? 2 : 1;
  const p = buildPrediction(spec, setup.seed ?? "bottle-sort", index, steps);
  return {
    id: `predict-${spec.id}-${index}`,
    taskKind: `predict_${spec.id}`,
    prompt: `Pour ${say(p.moves)}. Which rack comes next?`,
    // The answer key is the rack, described: a choice index would say nothing
    // in the log once the shuffle changed.
    expected: describe(p.choices[p.answer]),
    itemCount: p.choices.length,
    start: p.start,
    moves: p.moves,
    choices: p.choices,
    answer: p.answer,
    hues: p.hues,
  };
}

/** A rack in words, for the answer key and the accessible name. */
function describe(rack: Rack): string {
  return rack
    .map((b, i) => `bottle ${i + 1}: ${b.seg.length ? b.seg.map(nameOf).join(", ") : "empty"}`)
    .join("; ");
}

export function predictHints(question: PredictQuestion): string[] {
  const first = question.moves[0];
  const run = topRun(question.start[first.from]);
  return composeHints(
    "A pour moves the whole run of one colour, not just one.",
    `Bottle ${first.from + 1} has ${run.n} ${nameOf(run.colour)} on top.`,
    `Count the room in bottle ${first.to + 1}, then move as many as will fit.`,
  );
}

export const promptFor = (q: PredictQuestion): string => q.prompt ?? "Which rack comes next?";
export const printedFor = (): null => null;

/**
 * Geometry for a small, still bottle. The sorter's is animated and stateful,
 * and far too large to reuse at four racks to a screen.
 *
 * Symmetric on purpose: the first draft flared only the left shoulder, which
 * drew a bottle with a stub growing out of one side of its neck.
 */
const W = 34, LAYER = 13, NECK = 3, SHOULDER = 7;
const NL = 12, NR = W - 12;

const MiniRack: React.FC<{ rack: Rack; hues: number[] }> = ({ rack, hues }) => {
  const tallest = Math.max(...rack.map((b) => b.cap));
  const height = NECK + SHOULDER + tallest * LAYER + 4;
  return (
    <div className="flex items-end justify-center gap-1">
      {rack.map((b, i) => {
        const bodyTop = NECK + SHOULDER;
        const bottom = bodyTop + b.cap * LAYER;
        const shown = b.shown ?? b.seg.length;
        const buried = b.seg.length - shown;
        const body = `M${NL} ${NECK} v3`
          + ` C${NL} ${bodyTop - 3} 3 ${bodyTop - 4} 3 ${bodyTop}`
          + ` V${bottom - 4} q0 4 4 4 h${W - 14} q4 0 4 -4 V${bodyTop}`
          + ` C${W - 3} ${bodyTop - 4} ${NR} ${bodyTop - 3} ${NR} ${NECK + 3}`
          + ` V${NECK} Z`;
        return (
          <svg key={i} viewBox={`0 0 ${W} ${height}`} className="h-auto w-full max-w-[34px]" aria-hidden="true">
            <path d={body} className="fill-white/70 dark:fill-white/10" />
            <clipPath id={`mini-cap-${b.cap}`}><path d={body} /></clipPath>
            <g clipPath={`url(#mini-cap-${b.cap})`}>
              {b.seg.map((colour, k) => {
                const y = bottom - (k + 1) * LAYER;
                if (k < buried) {
                  return (
                    <g key={k}>
                      <rect x="0" y={y} width={W} height={LAYER} className="fill-slate-300 dark:fill-slate-700" />
                      <text x={W / 2} y={y + LAYER / 2 + 3} textAnchor="middle"
                        className="fill-slate-500 text-[9px] font-bold dark:fill-slate-400">?</text>
                    </g>
                  );
                }
                return (
                  <g key={k}>
                    <rect x="0" y={y} width={W} height={LAYER} fill={cssColour(hues, colour)} />
                    <path d={GLYPH[shapeOf(colour)]} transform={`translate(${W / 2} ${y + LAYER / 2}) scale(.62)`}
                      fill="#fff" fillOpacity=".92" />
                  </g>
                );
              })}
            </g>
            <path d={body} fill="none" strokeWidth="1.6"
              className="stroke-slate-400 dark:stroke-slate-500" />
          </svg>
        );
      })}
    </div>
  );
};

export const PredictThePour: React.FC<ActivityProps<PredictParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 3;

  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const hintsEnabled = koda.config.isEnabled("move_hints", true);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    answerSoundDelayMs: (correct) => (correct ? 560 : 240),
    nextQuestion: useCallback((index: number) => buildQuestion(setup, index), [setup]),
    onComplete,
  });
  const question = round.question as PredictQuestion;

  const choose = (index: number) => {
    if (round.feedback) return;
    const correct = index === question.answer;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success(); else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: describe(question.choices[index]),
      expected: question.expected,
      errorKind: correct ? undefined : "miscounted_items",
      title: correct ? "That is the one" : "Not that one",
      message: correct
        ? "A pour moves the whole run of one colour."
        : "Look again at how many move, and how much room there is.",
    });
  };

  return (
    <SkillRound
      koda={koda} lesson={lesson} fallbackTitle="Which rack comes next?"
      round={round} totalQuestions={total}
      prompt={promptFor(question)} onExit={() => koda.ui.exit()}
      hints={practising || !hintsEnabled ? [] : predictHints(question)}
      iconName="FlaskConical" iconTone="cyan">
      <section aria-label="Predict the pour" className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
        <div className="rounded-2xl bg-slate-100 px-3 py-4 dark:bg-slate-900/50">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Now
          </p>
          <MiniRack rack={question.start} hues={question.hues} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {question.choices.map((choice, i) => (
            <button key={i} type="button" data-choice={i} disabled={!!round.feedback}
              onClick={() => choose(i)}
              aria-label={`Choice ${i + 1}. ${describe(choice)}`}
              className="min-h-11 rounded-2xl border-2 border-slate-300 bg-white px-2 py-3 transition-colors hover:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800">
              <MiniRack rack={choice} hues={question.hues} />
            </button>
          ))}
        </div>
      </section>
    </SkillRound>
  );
};
