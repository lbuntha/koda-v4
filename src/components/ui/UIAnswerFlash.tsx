import React, { useEffect, useRef } from "react";
import { Check, RotateCcw } from "lucide-react";
import { themeSystem, type AnswerFlashTone } from "../../lib/themeSystem";
import { UIBurst } from "./UIBurst";

export interface UIAnswerFlashProps {
  tone: AnswerFlashTone;
  /** A few words. Read first, and often the only thing read. */
  title: string;
  /** One short sentence. */
  message?: string;
  /** Shown as a reward chip, e.g. 20 for "+20 XP". */
  xpEarned?: number;
  /** The single next action. */
  actionLabel: string;
  onAction: () => void;
}

/**
 * The verdict on an answer, flashed into the middle of the screen.
 *
 * A strip along the bottom was easy to miss on a big screen and crowded the
 * work on a phone. This pops up where the child is already looking: a big
 * medallion that says it before the words do (a tick that pops, or arrows
 * that give one gentle shake), a short title, and one button that already has
 * focus, so Enter or a tap moves on. A right answer also throws one burst of
 * confetti. Never colour alone — each tone has its own icon and words — and
 * every movement stops for a player who asked for less motion.
 *
 * Use it wisely — it is Koda's one way of giving a verdict, so it should mean
 * something every time it appears:
 *  - Once per answer the child has finished: right, or not yet. Not for a step
 *    inside an answer (a pair joined in a match, a letter traced): the board
 *    already shows that, and a pop-up on every step nags.
 *  - Never for hints, tips or "hold on" nudges — those are `UIKidMessage` or
 *    `UIGuideBubble`, said beside the work without stopping it.
 *  - Short words: a 2–4 word title and at most one short sentence. One button.
 *  - Right moves on by itself (keep "Next" for a child who wants to go now);
 *    "Try again" only closes the card, so the child is back on the question.
 */
export const UIAnswerFlash: React.FC<UIAnswerFlashProps> = ({
  tone,
  title,
  message,
  xpEarned,
  actionLabel,
  onAction,
}) => {
  const s = themeSystem.answerFlash;
  const button = useRef<HTMLButtonElement>(null);
  const Icon = tone === "correct" ? Check : RotateCcw;

  useEffect(() => {
    button.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={s.layer}>
      <div className={s.scrim} aria-hidden="true" />
      <div className={s.card(tone)} role="status" aria-live="polite">
        {tone === "correct" && <UIBurst className="left-1/2 top-16" />}
        <span className={s.medallion(tone)}>
          <Icon aria-hidden="true" strokeWidth={3} />
        </span>
        <p className={s.title}>{title}</p>
        {message && <p className={s.message}>{message}</p>}
        {tone === "correct" && typeof xpEarned === "number" && xpEarned > 0 && (
          <span className={s.xp}>+{xpEarned} XP</span>
        )}
        <button ref={button} type="button" onClick={onAction} className={s.action(tone)}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
};
