import { useCallback, useEffect, useRef, useState } from "react";
import type { KodaSDK } from "../../types";
import { chime } from "./sweeperChrome";

/**
 * A word about a move that was not allowed.
 *
 * A refusal is not a wrong answer: nothing is submitted, nothing is scored and
 * no hint is recorded. Checking a board before every tile has been decided is
 * the common one, and treating it as a wrong answer would cost a child a star
 * for not having finished yet.
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
