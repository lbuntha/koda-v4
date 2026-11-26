import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import type { ActivityProps } from "../../types";
import { SPRING, SkillRound, composeHints, isPractice, playCopy, useMotionOK, useSkillRound, type RoundQuestion } from "../../kit";
import { tx } from "../internal/i18n";
import { buildSort, type BankSetup, type SortQuestion } from "../internal/build";
import { SORT_SETS, type SortSetId } from "../internal/bank";
import { readsAloud } from "../internal/readsAloud";
import { Pic } from "./pics";
import { sayLines, useAnswerFeel } from "./feel";

/**
 * Sort It — one thing at a time, into the group it belongs to.
 *
 * Each placement is one answer, so the log says which things a child sorted
 * wrongly (the car, the Moon), not only that a sort went wrong. Things sorted
 * earlier in the round stay in their bins: that growing pile is the rule made
 * visible. They are derived from the question numbers, not kept in state, so a
 * restart clears them without bookkeeping.
 *
 * A wrong tap restates the rule, never the bin: with two bins, naming the
 * right one would be the answer.
 */

type SortParams = BankSetup<SortSetId> & { question?: BankSetup<SortSetId> };

export interface SortRoundQuestion extends RoundQuestion {
  q: SortQuestion;
}

const itemName = (q: SortQuestion) => tx(`sort.${q.set}.item.${q.item.id}`);
const binName = (set: SortSetId, bin: string) => tx(`sort.${set}.bin.${bin}`);
export const sortPrompt = (q: SortQuestion) => tx(`sort.${q.set}.ask`);

export function buildSortQuestion(params: SortParams, index: number): SortRoundQuestion {
  const q = buildSort({ ...params, ...params.question }, index);
  return {
    id: `sort-${index}-${q.set}-${q.item.id}`,
    taskKind: `sort_${q.set}`,
    prompt: sortPrompt(q),
    expected: binName(q.set, q.item.bin),
    itemCount: SORT_SETS[q.set].bins.length,
    q,
  };
}

export function sortHints(q: SortQuestion, kidTip?: string): string[] {
  return composeHints(kidTip, tx(`sort.${q.set}.rule`));
}

export const SortBins: React.FC<ActivityProps<SortParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = { ...params, ...params.question };
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 6;
  const motionOK = useMotionOK();
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const feel = useAnswerFeel(koda);
  const [missed, setMissed] = useState<{ q: string; bin: string } | null>(null);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising || !readsAloud(lesson?.id) ? undefined : copy.audioPrompt,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildSortQuestion(params, i), [params]),
    onComplete,
  });
  const question = round.question as SortRoundQuestion;
  const q = question.q;
  const bank = SORT_SETS[q.set];
  const locked = Boolean(round.feedback);
  const justSorted = round.feedback?.status === "correct";

  /** Everything sorted before this question, plus this one once it is right. Same set only. */
  const sorted = useMemo(() => {
    const upTo = justSorted ? round.index : round.index - 1;
    const out: SortQuestion[] = [];
    for (let i = 1; i <= upTo; i += 1) {
      const earlier = buildSortQuestion(params, i).q;
      if (earlier.set === q.set && !out.some((o) => o.item.id === earlier.item.id)) out.push(earlier);
    }
    return out;
  }, [params, round.index, justSorted, q.set]);

  const place = (bin: string) => {
    if (locked) return;
    const correct = bin === q.item.bin;
    feel(correct);
    setMissed(correct ? null : { q: question.id, bin });
    round.submit({
      correct,
      given: binName(q.set, bin),
      expected: question.expected,
      title: tx(correct ? "title.right" : "title.wrong"),
      message: correct ? tx(`sort.${q.set}.why.${q.item.id}`) : tx(`sort.${q.set}.rule`),
    });
  };

  const readAloud = () => {
    round.useSupport("audio_replay");
    const lines = round.feedback?.message
      ? [round.feedback.message]
      : [tx(`sort.${q.set}.ask`), itemName(q), ...bank.bins.map((b) => binName(q.set, b.id))];
    void sayLines(koda, lines);
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Sort It"
      round={round}
      totalQuestions={total}
      prompt={sortPrompt(q)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : sortHints(q, copy.kidTip)}
      iconName="layers"
      iconTone="cyan"
      onReadAloud={practising || !speechEnabled ? undefined : readAloud}
    >
      <LayoutGroup id="science-sort">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
          <div className="flex h-36 items-center justify-center">
            <AnimatePresence mode="popLayout">
              {!justSorted && (
                <motion.div
                  key={question.id}
                  layoutId={motionOK ? `sort-${q.set}-${q.item.id}` : undefined}
                  className="flex w-32 flex-col items-center gap-1 rounded-3xl border-2 border-line bg-surface p-3 shadow-sm"
                  initial={motionOK ? { scale: 0.8, opacity: 0 } : false}
                  animate={missed?.q === question.id && motionOK ? { x: [0, -6, 6, -3, 0], scale: 1, opacity: 1 } : { x: 0, scale: 1, opacity: 1 }}
                  transition={motionOK ? SPRING.enter : { duration: 0 }}
                  data-testid="sort-item"
                  data-item={q.item.id}
                >
                  <Pic id={q.item.pic} className="h-20 w-20" />
                  <span className="text-center text-base font-bold text-ink">{itemName(q)}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={`grid w-full gap-2.5 ${bank.bins.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {bank.bins.map((b) => {
              const inBin = sorted.filter((s) => s.item.bin === b.id);
              const isMiss = missed?.q === question.id && missed.bin === b.id && !justSorted;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => place(b.id)}
                  disabled={locked}
                  aria-label={tx("ui.sortInto", { bin: binName(q.set, b.id) })}
                  data-bin={b.id}
                  className={[
                    "flex min-h-44 flex-col items-center gap-2 rounded-3xl border-2 border-dashed bg-surface/60 p-2.5 text-ink transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-default",
                    isMiss ? "border-rose-400" : "border-line hover:border-violet-400",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-1.5">
                    {b.pic && <Pic id={b.pic} className="h-7 w-7" />}
                    <span className="text-sm font-black leading-tight">{binName(q.set, b.id)}</span>
                  </span>
                  <span className="flex flex-wrap justify-center gap-1" aria-label={tx("ui.sorted", { count: inBin.length })}>
                    {inBin.map((s) => (
                      <motion.span
                        key={s.item.id}
                        layoutId={motionOK ? `sort-${s.set}-${s.item.id}` : undefined}
                        transition={motionOK ? SPRING.settle : { duration: 0 }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface shadow-sm"
                      >
                        <Pic id={s.item.pic} className="h-8 w-8" />
                      </motion.span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </LayoutGroup>
    </SkillRound>
  );
};
