import React, { useCallback, useEffect, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import type { ActivityProps } from "../../types";
import { SPRING, SkillRound, composeHints, isPractice, playCopy, useMotionOK, useSkillRound, type RoundQuestion } from "../../kit";
import { tx } from "../internal/i18n";
import { buildOrder, type BankSetup, type OrderQuestion } from "../internal/build";
import type { OrderSetId } from "../internal/bank";
import { readsAloud } from "../internal/readsAloud";
import { Pic } from "./pics";
import { sayLines, useAnswerFeel } from "./feel";

/**
 * In Order — a life cycle or a day in the sky, as cards to line up.
 *
 * Tap a card and it moves to the next empty step; tap a placed card to take it
 * back. The line is judged once, when the last card goes in, so one attempt is
 * one whole order. A wrong line stays on the board — the child fixes the card
 * that is out of place rather than starting from nothing — and Start over
 * clears it in one go.
 */

type OrderParams = BankSetup<OrderSetId> & { question?: BankSetup<OrderSetId> };

export interface OrderRoundQuestion extends RoundQuestion {
  q: OrderQuestion;
}

const base = (q: OrderQuestion) => `order.${q.set}.${q.seq.id}`;
export const stepName = (q: OrderQuestion, step: string) => tx(`${base(q)}.step.${step}`);
export const orderPrompt = (q: OrderQuestion) => tx(`${base(q)}.ask`);
const lineOf = (q: OrderQuestion, steps: string[]) => steps.map((s) => stepName(q, s)).join(" → ");

export function buildOrderQuestion(params: OrderParams, index: number): OrderRoundQuestion {
  const q = buildOrder({ ...params, ...params.question }, index);
  return {
    id: `order-${index}-${q.set}-${q.seq.id}`,
    taskKind: `order_${q.set}`,
    prompt: orderPrompt(q),
    expected: lineOf(q, q.seq.steps),
    itemCount: q.seq.steps.length,
    q,
  };
}

/** Ordering is an action, so the last rung may name the first step outright. */
export function orderHints(q: OrderQuestion, kidTip?: string): string[] {
  return composeHints(kidTip, tx(`${base(q)}.clue`));
}

export const PutInOrder: React.FC<ActivityProps<OrderParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = { ...params, ...params.question };
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 4;
  const motionOK = useMotionOK();
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const feel = useAnswerFeel(koda);
  const [line, setLine] = useState<string[]>([]);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising || !readsAloud(lesson?.id) ? undefined : copy.audioPrompt,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildOrderQuestion(params, i), [params]),
    onComplete,
  });
  const question = round.question as OrderRoundQuestion;
  const q = question.q;
  const locked = round.feedback?.status === "correct";
  const steps = q.seq.steps;

  // A new question starts with an empty line.
  useEffect(() => setLine([]), [question.id]);

  const judge = (next: string[]) => {
    const correct = next.every((s, i) => s === steps[i]);
    feel(correct);
    round.submit({
      correct,
      given: lineOf(q, next),
      expected: question.expected,
      title: tx(correct ? "title.right" : "title.wrong"),
      message: correct ? tx(`${base(q)}.why`) : tx("order.wrong"),
    });
  };

  const put = (step: string) => {
    if (locked || line.includes(step)) return;
    const next = [...line, step];
    setLine(next);
    if (koda.config.isEnabled("sound_chimes", true) && koda.sound.isEnabled()) koda.sound.play("pop");
    if (next.length === steps.length) judge(next);
  };
  const takeBack = (step: string) => {
    if (locked) return;
    setLine((now) => now.filter((s) => s !== step));
  };

  const readAloud = () => {
    round.useSupport("audio_replay");
    const lines = round.feedback?.message ? [round.feedback.message] : [orderPrompt(q), ...q.dealt.map((s) => stepName(q, s))];
    void sayLines(koda, lines);
  };

  const waiting = q.dealt.filter((s) => !line.includes(s));
  const card = "flex flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-surface p-2 text-center text-sm font-bold leading-tight text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
  const cols = steps.length === 4 ? "grid-cols-4" : "grid-cols-3";
  const spring = motionOK ? SPRING.settle : { duration: 0 };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="In Order"
      round={round}
      totalQuestions={total}
      prompt={orderPrompt(q)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : orderHints(q, copy.kidTip)}
      iconName="footprints"
      iconTone="purple"
      onReadAloud={practising || !speechEnabled ? undefined : readAloud}
      onStartOver={line.length > 0 && !locked ? () => setLine([]) : undefined}
    >
      <LayoutGroup id={`science-order-${question.id}`}>
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
          <ol className={`grid ${cols} gap-2`} aria-label={tx("ui.line")}>
            {steps.map((_, i) => {
              const step = line[i];
              const right = locked;
              return (
                <li key={i} className="flex flex-col items-center gap-1">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white" aria-hidden="true">{i + 1}</span>
                  {step ? (
                    <motion.button
                      // Keyed by the card, not the slot: when a card is taken
                      // back the ones after it slide up, and each must stay
                      // its own element or its layout animation stalls hidden.
                      key={step}
                      layoutId={motionOK ? `${question.id}-${step}` : undefined}
                      transition={spring}
                      type="button"
                      onClick={() => takeBack(step)}
                      disabled={locked}
                      aria-label={tx("ui.takeBack", { step: stepName(q, step) })}
                      className={`${card} aspect-square w-full ${right ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-violet-300"}`}
                      data-placed={step}
                    >
                      <Pic id={`${q.seq.id}-${step}`} className="h-12 w-12" />
                      <span className="line-clamp-2 text-xs">{stepName(q, step)}</span>
                    </motion.button>
                  ) : (
                    <div
                      className="flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-dashed border-line text-xs font-semibold text-muted"
                      aria-label={`${tx("ui.slot", { n: i + 1 })}: ${tx("ui.empty")}`}
                    />
                  )}
                  {i < steps.length - 1 && <span className="sr-only">→</span>}
                </li>
              );
            })}
          </ol>

          <div className={`grid ${cols} gap-2`} role="group" aria-label={tx("ui.cards")}>
            {waiting.map((step) => (
              <motion.button
                key={step}
                layoutId={motionOK ? `${question.id}-${step}` : undefined}
                transition={spring}
                type="button"
                onClick={() => put(step)}
                disabled={locked}
                aria-label={tx("ui.place", { step: stepName(q, step) })}
                whileTap={motionOK ? { scale: 0.95 } : undefined}
                className={`${card} aspect-square w-full border-line`}
                data-card={step}
              >
                <Pic id={`${q.seq.id}-${step}`} className="h-12 w-12" />
                <span className="line-clamp-2 text-xs">{stepName(q, step)}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </LayoutGroup>
    </SkillRound>
  );
};
