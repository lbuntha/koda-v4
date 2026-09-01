import React, { useEffect, useRef } from "react";
import type { KodaSDK } from "../../types";
import { UIKidMessage } from "../../../components/ui";
import { hintAt } from "../round/hints";
import type { HintController } from "../round/useSkillRound";

/**
 * The hint itself.
 *
 * Read aloud as well as shown, and that is not a nicety: the children this
 * skill is written for cannot read the hint, so a hint they can only read is a
 * hint they do not get. The question already has a read-aloud button beside it
 * for the same reason — a hint that stayed silent would be the one piece of
 * copy on the screen a five-year-old could not reach.
 *
 * One rung at a time. Stacking the ladder would put three sentences in front of
 * a child who asked for one, and the rung showing is always the most specific
 * one they have earned.
 */

export interface SkillHintProps {
  koda: KodaSDK;
  /** The ladder, gentlest first. Built by the activity, from live state. */
  hints: string[];
  hint: HintController;
  /** Ties the panel to the header's Hint button for screen readers. */
  id: string;
}

export const SkillHint: React.FC<SkillHintProps> = ({ koda, hints, hint, id }) => {
  const text = hint.open ? hintAt(hints, hint.level) : undefined;
  const hasMore = hint.level < hints.length;

  /*
   * Said once per rung, not once per render.
   *
   * The wording of a rung changes as the child works — "you have filled four"
   * becomes "you have filled five" — and re-speaking on every one of those
   * would talk over the child while they are tapping. The rung number is what
   * marks a new hint; the text following the screen is what makes it accurate
   * when it is read.
   */
  const spokenRung = useRef(0);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (!hint.open) {
      spokenRung.current = 0;
      return;
    }
    if (spokenRung.current === hint.level) return;
    spokenRung.current = hint.level;
    const line = textRef.current;
    if (!line) return;
    if (!koda.config.isEnabled("audio_speech", true)) return;
    // A hint that cannot be spoken is still a hint: never let the panel's
    // rendering depend on a clip that failed to play.
    void koda.speech.say(line, { rate: koda.config.get("speechRate", 1.0) }).catch(() => {});
  }, [hint.open, hint.level, koda]);

  if (!text) return null;

  return (
    <div id={id}>
      <UIKidMessage
        tone="hint"
        title={hints.length > 1 ? `Hint ${hint.level} of ${hints.length}` : "Hint"}
        message={text}
        /*
         * Climbing is the panel's job, showing and hiding is the header's.
         *
         * Both on one button would mean a child who wanted to put the hint away
         * had to page through the rest of the ladder to reach "hide" — and a
         * child who wanted more had to hunt for a second control. So: the
         * header opens and closes, this asks for the next one, and it
         * disappears at the top of the ladder rather than going dead.
         */
        actionLabel={hasMore ? "More help" : undefined}
        onAction={hasMore ? hint.more : undefined}
      />
    </div>
  );
};
