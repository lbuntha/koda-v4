import { useCallback, useEffect, useRef, useState } from "react";
import type { KodaSDK } from "../../../types";

/**
 * A word about a move that was not allowed, shown and then gone.
 *
 * Every engine in this skill refuses something: starting from the smaller
 * number, checking a frame nobody has touched, answering before taking the
 * jump, bundling that has not happened yet. All of those are the same event —
 * the child has not finished, rather than got it wrong — and all of them need
 * the same answer, which is a sentence saying why and nothing else.
 *
 * Not a `submit`: the child has not given an answer, so filing one would score
 * them for a question they have not answered. Not a hint either: they never
 * asked for help, and the ladder would open at its gentlest rung rather than at
 * the sentence that explains this particular no.
 *
 * Written seven times before this, identically, timer and cleanup and all.
 *
 * This owns *when* a refusal is showing. Where it is drawn belongs to
 * `SkillRound`, which puts it in the same sticky strip along the bottom as the
 * answer feedback — one place a child learns to look, and one that already
 * clears a phone's home indicator.
 */
export interface Nudge {
  /** The line to show, or null. */
  message: string | null;
  /** Say why a move did not happen. */
  refuse(why: string): void;
  /** Drop the line — a new question has arrived. */
  clear(): void;
}

/** How long a refusal stays up. Long enough to read twice at six years old. */
const NUDGE_MS = 4000;

export function useNudge(koda: KodaSDK, holdMs = NUDGE_MS): Nudge {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // A pending line must not outlive the activity.
  useEffect(() => stop, [stop]);

  const refuse = useCallback(
    (why: string) => {
      if (koda.config.isEnabled("sound_chimes", true)) koda.sound.play("hint");
      setMessage(why);
      stop();
      timer.current = window.setTimeout(() => setMessage(null), holdMs);
    },
    [koda, holdMs, stop],
  );

  const clear = useCallback(() => {
    setMessage(null);
    stop();
  }, [stop]);

  return { message, refuse, clear };
}
