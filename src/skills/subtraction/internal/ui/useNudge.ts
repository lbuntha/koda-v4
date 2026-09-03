import { useCallback, useEffect, useRef, useState } from "react";
import type { KodaSDK } from "../../../types";
import { chime } from "../data/subtractionSound";

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
    // A refusal was felt but never heard: the message appeared, the phone
    // buzzed, and a child playing with the sound on got nothing. Every other
    // move in the skill sounds, so the one that says "not that" has to as well.
    chime(koda, "refused");
    koda.haptics.pulse("error");
    timer.current = setTimeout(() => setMessage(undefined), 3500);
  }, [koda]);

  useEffect(() => clear, [clear]);
  return { message, refuse, clear };
}
