import React, { useCallback, useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { ActivityProps } from "../../types";
import { SPRING, SkillRound, composeHints, isPractice, playCopy, stagger, useMotionOK, useSkillRound, type RoundQuestion } from "../../kit";
import { tx } from "../internal/i18n";
import { buildPick, type BankSetup, type PickQuestion } from "../internal/build";
import type { PickSetId } from "../internal/bank";
import { readsAloud } from "../internal/readsAloud";
import { Pic } from "./pics";
import { sayLines, useAnswerFeel } from "./feel";

/**
 * Pick One — a picture, a question, and two to four answers.
 *
 * The science is in the wrong answers. Each is either plainly wrong or a
 * misconception children really hold, and a misconception carries its own
 * explanation, so a wrong tap says what was wrong about *that* idea rather
 * than "try again". A right tap says why it is right: the fact, not praise.
 */

type PickParams = BankSetup<PickSetId> & { question?: BankSetup<PickSetId> };

export interface PickRoundQuestion extends RoundQuestion {
  q: PickQuestion;
}

const key = (q: PickQuestion, leaf: string) => `pick.${q.set}.${q.item.id}.${leaf}`;
export const choiceLabel = (q: PickQuestion, id: string) => tx(key(q, `c.${id}`));
export const pickPrompt = (q: PickQuestion) => tx(key(q, "ask"));

export function buildPickQuestion(params: PickParams, index: number): PickRoundQuestion {
  const q = buildPick({ ...params, ...params.question }, index);
  return {
    id: `pick-${index}-${q.set}-${q.item.id}`,
    taskKind: `pick_${q.set}`,
    prompt: pickPrompt(q),
    expected: choiceLabel(q, q.item.answer),
    itemCount: q.choices.length,
    q,
  };
}

/** The lesson's tip, then a clue that points at the idea without naming the answer. */
export function pickHints(q: PickQuestion, kidTip?: string): string[] {
  return composeHints(kidTip, tx(key(q, "clue")));
}

/** What a wrong tap says: the misconception's own correction, or a plain nudge. */
export function wrongMessage(q: PickQuestion, chosen: string): string {
  return q.item.explained?.includes(chosen) ? tx(key(q, `no.${chosen}`)) : tx("pick.wrong");
}

export const PickOne: React.FC<ActivityProps<PickParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = { ...params, ...params.question };
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;
  const motionOK = useMotionOK();
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const feel = useAnswerFeel(koda);
  const [missed, setMissed] = useState<{ q: string; id: string } | null>(null);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising || !readsAloud(lesson?.id) ? undefined : copy.audioPrompt,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildPickQuestion(params, i), [params]),
    onComplete,
  });
  const question = round.question as PickRoundQuestion;
  const q = question.q;
  const locked = Boolean(round.feedback);
  const rightShown = round.feedback?.status === "correct";
  const withPictures = q.choices.every((ch) => ch.pic);

  const choose = (id: string) => {
    if (locked) return;
    const correct = id === q.item.answer;
    feel(correct);
    setMissed(correct ? null : { q: question.id, id });
    round.submit({
      correct,
      given: choiceLabel(q, id),
      expected: question.expected,
      title: tx(correct ? "title.right" : "title.wrong"),
      message: correct ? tx(key(q, "why")) : wrongMessage(q, id),
    });
  };

  const readAloud = () => {
    round.useSupport("audio_replay");
    // Showing feedback: read the reason. Otherwise the question, then each answer.
    // One line per call, so every line can match its own recording.
    const lines = round.feedback?.message ? [round.feedback.message] : [pickPrompt(q), ...q.choices.map((ch) => choiceLabel(q, ch.id))];
    void sayLines(koda, lines);
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Pick One"
      round={round}
      totalQuestions={total}
      prompt={pickPrompt(q)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : pickHints(q, copy.kidTip)}
      iconName="search"
      iconTone="emerald"
      onReadAloud={practising || !speechEnabled ? undefined : readAloud}
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
        {q.item.pic && (
          <motion.div
            key={question.id}
            className="flex h-32 w-32 items-center justify-center rounded-3xl bg-surface p-3 shadow-sm"
            initial={motionOK ? { scale: 0.85, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={motionOK ? SPRING.enter : { duration: 0 }}
            role="img"
            aria-label={tx("ui.picture")}
            data-testid="pick-picture"
          >
            <Pic id={q.item.pic} className="h-full w-full" />
          </motion.div>
        )}
        <div
          role="group"
          aria-label={tx("ui.choices")}
          className={withPictures ? "grid w-full grid-cols-2 gap-3 min-[420px]:grid-cols-3" : "flex w-full flex-col gap-2.5"}
        >
          {q.choices.map((ch, i) => {
            const isAnswer = rightShown && ch.id === q.item.answer;
            const isMiss = missed?.q === question.id && missed.id === ch.id;
            return (
              <motion.button
                key={`${question.id}-${ch.id}`}
                type="button"
                onClick={() => choose(ch.id)}
                disabled={locked}
                aria-label={choiceLabel(q, ch.id)}
                data-choice={ch.id}
                initial={motionOK ? { y: 12, opacity: 0 } : false}
                animate={isMiss && motionOK ? { x: [0, -6, 6, -3, 0], y: 0, opacity: 1 } : { x: 0, y: 0, opacity: 1 }}
                transition={motionOK ? { ...SPRING.enter, delay: isMiss ? 0 : stagger(i) } : { duration: 0 }}
                whileTap={motionOK && !locked ? { scale: 0.96 } : undefined}
                className={[
                  "relative flex min-h-14 items-center gap-3 rounded-2xl border-2 bg-surface px-4 py-3 text-left font-bold text-ink shadow-sm transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-default",
                  withPictures ? "flex-col justify-center text-center text-base" : "text-lg",
                  isAnswer ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : isMiss ? "border-rose-400" : "border-line",
                ].join(" ")}
              >
                {ch.pic && <Pic id={ch.pic} className={withPictures ? "h-16 w-16" : "h-10 w-10 shrink-0"} />}
                <span>{choiceLabel(q, ch.id)}</span>
                {isAnswer && (
                  <motion.span
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white"
                    initial={motionOK ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    transition={motionOK ? SPRING.celebrate : { duration: 0 }}
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </SkillRound>
  );
};
