import { useCallback, useEffect, useRef, useState } from "react";
import type { KodaSDK } from "../../../types";
import { chime } from "../data/multiplicationSound";

/**
 * A word about a move that was not allowed.
 *
 * A refusal is not a wrong answer: nothing is submitted, nothing is scored, and
 * no hint is recorded. It is heard and felt as well as read, because every
 * other move in the skill sounds and a silent refusal reads as a dead control.
 */
export function useNudge(koda: KodaSDK) {
  const [message, setMessage] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(undefined);
  }, []);

  const refuse = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    chime(koda, "refused");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("error");
    timer.current = setTimeout(() => setMessage(undefined), 3500);
  }, [koda]);

  useEffect(() => clear, [clear]);
  return { message, refuse, clear };
}
