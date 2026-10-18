/** The turns engine on a real clock: ticks while a puzzle is being played, and nothing while the device is handed over. */

import { useCallback, useEffect, useState } from "react";
import { reduceTurns, startTurns, type TurnsConfig, type TurnsEvent, type TurnsState } from "./engine";

const TICK_MS = 250;
const clock = (): number => performance.now() / 1000;

type Untimed<E> = E extends { now: number } ? Omit<E, "now"> : never;

export interface TurnsGame {
  state: TurnsState | null;
  now: number;
  start(config: TurnsConfig): void;
  send(event: Untimed<TurnsEvent>): void;
  reset(): void;
}

export const useTurns = (): TurnsGame => {
  const [state, setState] = useState<TurnsState | null>(null);
  const [now, setNow] = useState(clock);
  const playing = state?.phase === "playing";

  const send = useCallback((event: Untimed<TurnsEvent>) => {
    const at = clock();
    setNow(at);
    setState((s) => (s ? reduceTurns(s, { ...event, now: at } as TurnsEvent) : s));
  }, []);

  const start = useCallback((config: TurnsConfig) => {
    setNow(clock());
    setState(startTurns(config));
  }, []);

  const reset = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => send({ type: "tick" }), TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, send]);

  return { state, now, start, send, reset };
};
