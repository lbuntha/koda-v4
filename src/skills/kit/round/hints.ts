/**
 * Hints, as a ladder rather than a single tip.
 *
 * The Hint button existed in every activity long before this file did, and it
 * showed nothing: each skill kept a `showTip` boolean, toggled it, logged
 * `supportUsed("hint", 1)` and rendered no hint. The copy was not missing —
 * every lesson in `lessons.json` authors a `kidTip` — it was simply never read.
 *
 * A hint is laddered because one hint cannot serve both the child who has lost
 * the thread and the child who is one step from the answer. Three rungs, in a
 * fixed order:
 *
 *  1. **The nudge.** The lesson's own `kidTip` — the strategy, in the lesson's
 *     words, with no reference to the question on screen.
 *  2. **This question.** What the child should do next *here*, read off the
 *     state they have actually built: which cells are lit, how many are tagged,
 *     what the frog is standing on.
 *  3. **The worked step.** The method spelled out with this question's numbers,
 *     stopping one step short of saying the answer wherever the child is
 *     choosing between answers, and going all the way when the answer is
 *     produced by doing rather than by choosing.
 *
 * The rung number is what `supportUsed("hint", level)` reports, so the learning
 * log can tell "needed a nudge" from "needed it worked through" — a distinction
 * `events.ts` has always documented and nothing has ever been able to supply.
 */

/** The most rungs a ladder may have. Three is what a child will climb. */
export const MAX_HINTS = 3;

/**
 * The child-facing copy a lesson authors on its `params.play` block.
 *
 * Read through here rather than cast at each call site: every activity had its
 * own `(params as { play?: { audioPrompt?: string } })`, which is how four of
 * the five ended up reading exactly one of the six fields the lessons author.
 */
export interface LessonPlayCopy {
  /** Said once as the round opens. */
  audioPrompt?: string;
  /** The strategy, in a child's words. Rung 1 of the ladder. */
  kidTip?: string;
  /** How the activity is played, for the adult-facing surfaces. */
  stepByStep?: string[];
  targetObjective?: string;
  shortDesc?: string;
  prompts?: Record<string, string>;
}

/** The `play` block of whatever params an activity was mounted with. */
export function playCopy(params: unknown): LessonPlayCopy {
  const play = (params as { play?: unknown } | null | undefined)?.play;
  return play && typeof play === "object" ? (play as LessonPlayCopy) : {};
}

/**
 * Build a ladder out of candidate rungs.
 *
 * Blanks are dropped rather than shown, so an activity can write a rung that
 * only applies sometimes — "you have ten ones, bundle them" — as an expression
 * that evaluates to `undefined` the rest of the time, without leaving a gap in
 * the ladder or an empty panel on screen.
 *
 * Duplicates are dropped too: a lesson whose `kidTip` says what the activity's
 * own first rung says should cost the child one tap, not two.
 */
export function composeHints(...rungs: (string | false | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rung of rungs) {
    if (typeof rung !== "string") continue;
    const text = rung.trim().replace(/\s+/g, " ");
    if (!text) continue;
    const key = text.toLowerCase().replace(/[.!?]+$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === MAX_HINTS) break;
  }
  return out;
}

/** Which rung is actually showing, clamped to the ladder that exists now. */
export function hintAt(hints: string[], level: number): string | undefined {
  if (level < 1 || hints.length === 0) return undefined;
  return hints[Math.min(level, hints.length) - 1];
}
