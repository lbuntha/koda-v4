/**
 * Sends this player's progress to the room, and keeps trying on a bad connection.
 *
 * The server keeps only the highest counts, so sending the latest progress
 * again is always safe: a report lost to a dropped connection is simply
 * repeated by the next one, or by the retry two seconds later. The round never
 * waits for any of this — the child plays on whatever the network does.
 */

import { useEffect, useMemo, useRef } from "react";
import { createRaceTracker, type RaceProgress, type RaceTracker } from "../raceProgress";
import { SkillRoomsAPI } from "../skillRoomsApi";
import type { SkillRoomView } from "../types";

const RETRY_MS = 2_000;

export const useRaceReporter = (code: string, token: string, seed: string, apply: (view: SkillRoomView) => void): RaceTracker => {
  const latest = useRef<RaceProgress | null>(null);
  const sent = useRef<string>("");
  const timer = useRef<number | undefined>(undefined);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const tracker = useMemo(() => {
    const send = async (): Promise<void> => {
      window.clearTimeout(timer.current);
      const progress = latest.current;
      if (!progress) return;
      const key = JSON.stringify(progress);
      if (key === sent.current) return;
      try {
        applyRef.current(await SkillRoomsAPI.progress(code, token, progress));
        sent.current = key;
      } catch {
        timer.current = window.setTimeout(() => void send(), RETRY_MS);
      }
    };
    return createRaceTracker((progress) => {
      latest.current = progress;
      void send();
    });
    // A new seed is a new race (a rematch): start counting from nothing.
  }, [code, token, seed]);

  useEffect(() => () => window.clearTimeout(timer.current), [tracker]);
  return tracker;
};
