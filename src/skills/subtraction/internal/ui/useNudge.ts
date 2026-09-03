import { useCallback, useEffect, useRef, useState } from "react";
import type { KodaSDK } from "../../../types";

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
    koda.haptics.pulse("error");
    timer.current = setTimeout(() => setMessage(undefined), 3500);
  }, [koda]);

  useEffect(() => clear, [clear]);
  return { message, refuse, clear };
}
