import React from "react";
import { CircleCheck, Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";

export type KidMessageTone = "correct" | "tryAgain" | "hint" | "celebrate";

export interface UIKidMessageProps {
  tone: KidMessageTone;
  /** A few words. Read first, and often the only thing read. */
  title: string;
  /** One short sentence. Optional — a correct answer rarely needs explaining twice. */
  message?: string;
  /** Shown as a reward chip, e.g. 20 for "+20 XP". */
  xpEarned?: number;
  /** The single next action. One button only. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * The standard message a learner sees after answering.
 *
 * Every skill uses this, so feedback looks and reads the same wherever a child
 * meets it. Three rules it enforces:
 *
 *  1. **State is never colour alone.** Each tone carries its own icon, so a
 *     colour-blind child — or one on a washed-out screen — still knows what
 *     happened. Green-vs-red is the classic failure here.
 *  2. **One action.** A child who has just got something wrong should not be
 *     choosing between buttons.
 *  3. **Short words.** Titles are 2–4 words; the body is one sentence. Copy is
 *     supplied by the skill, but the shape keeps it honest.
 */
export const UIKidMessage: React.FC<UIKidMessageProps> = ({
  tone,
  title,
  message,
  xpEarned,
  actionLabel,
  onAction,
}) => {
  const s = themeSystem.kidMessage;
  const Icon = { correct: CircleCheck, celebrate: Sparkles, tryAgain: RotateCcw, hint: Lightbulb }[
    tone
  ];

  return (
    <div className={s.wrap(tone)} role="status" aria-live="polite">
      <span className={s.icon(tone)}>
        <Icon />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={s.title}>{title}</span>
          {typeof xpEarned === "number" && xpEarned > 0 && (
            <span className={s.xp}>+{xpEarned} XP</span>
          )}
        </div>
        {message && <p className={s.message}>{message}</p>}
      </div>

      {actionLabel && onAction && (
        <button onClick={onAction} className={s.action(tone)}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};
