/**
 * The round engine on a real clock.
 *
 * The engine is a pure reducer; this is the only place it meets time. It keeps
 * the clock in seconds, ticks it while a puzzle is being played, and hands the
 * screen the state plus `now`, so every derived value (the hint countdown, the
 * Machine's bar) is computed from the same instant as the state it came from.
 */

import { useCallback, useEffect, useState } from "react";
import { reduceRound, startRound, type RoundConfig, type RoundEvent, type RoundState } from "../engine";

const TICK_MS = 200;
const clock = (): number => performance.now() / 1000;

type Untimed<E> = E extends { now: number } ? Omit<E, "now"> : never;

export interface RebusRound {
  state: RoundState | null;
  /** Seconds on the clock the engine uses, as of the last tick or event. */
  now: number;
  start(config: RoundConfig): void;
  send(event: Untimed<RoundEvent>): void;
  /** Leave the round, back to setup. */
  reset(): void;
}

export const useRebusRound = (): RebusRound => {
  const [state, setState] = useState<RoundState | null>(null);
  const [now, setNow] = useState(clock);
  const playing = state?.phase === "playing";

  const send = useCallback((event: Untimed<RoundEvent>) => {
    const at = clock();
    setNow(at);
    setState((s) => (s ? reduceRound(s, { ...event, now: at } as RoundEvent) : s));
  }, []);

  const start = useCallback((config: RoundConfig) => {
    const at = clock();
    setNow(at);
    setState(startRound(config, at));
  }, []);

  const reset = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => send({ type: "tick" }), TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, send]);

  return { state, now, start, send, reset };
};
