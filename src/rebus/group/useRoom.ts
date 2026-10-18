/**
 * Keeps one room up to date.
 *
 * Asks the server for the room about once a second. The answer also carries what
 * time has done (a puzzle running out, the next one starting), so there is
 * nothing else to subscribe to. A failed ask is "reconnecting", not an error: the
 * next one usually works, and a poll that takes too long is dropped so slow
 * answers never pile up.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../lib/sync";
import { GroupAPI } from "./groupApi";
import type { RoomView } from "./types";

export const POLL_MS = 1_000;
/** After this many failed asks in a row the room is called unreachable. */
const GIVE_UP_AFTER = 8;

export type Link = "connecting" | "live" | "reconnecting" | "gone";

export interface RoomFeed {
  room: RoomView | null;
  link: Link;
  /** Why the room is gone: removed by the host, closed, or never found. */
  goneBecause: "removed" | "closed" | null;
  /** Take a newer room the caller already has (the answer to an action), without waiting for the next ask. */
  apply(room: RoomView): void;
  /** The server clock minus this device's clock, in ms, for counting down in step with everyone. */
  skewMs: number;
}

export const useRoom = (code: string | null, seat: string | null, initial: RoomView | null = null): RoomFeed => {
  const [room, setRoom] = useState<RoomView | null>(initial);
  const [link, setLink] = useState<Link>(initial ? "live" : "connecting");
  const [goneBecause, setGone] = useState<RoomFeed["goneBecause"]>(null);
  const [skewMs, setSkew] = useState(initial ? initial.nowMs - Date.now() : 0);
  const misses = useRef(0);

  const apply = useCallback((next: RoomView) => {
    setRoom(next);
    setLink("live");
    setSkew(next.nowMs - Date.now());
    misses.current = 0;
  }, []);

  useEffect(() => {
    if (!code || !seat) return;
    let live = true;
    let timer: number | undefined;
    const controller = new AbortController();

    const ask = async () => {
      try {
        apply(await GroupAPI.poll(code, seat, controller.signal));
      } catch (e) {
        if (!live) return;
        const err = e instanceof ApiError ? e : null;
        if (err && (err.status === 403 || err.status === 404)) {
          // Not in the room any more: the host removed this seat, or the room closed.
          setGone(err.status === 403 ? "removed" : "closed");
          setLink("gone");
          return;
        }
        misses.current += 1;
        setLink(misses.current >= GIVE_UP_AFTER ? "gone" : "reconnecting");
        if (misses.current >= GIVE_UP_AFTER) {
          setGone("closed");
          return;
        }
      }
      if (live) timer = window.setTimeout(() => void ask(), POLL_MS);
    };

    timer = window.setTimeout(() => void ask(), initial ? POLL_MS : 0);
    return () => {
      live = false;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
    // The seat and code define the room; a new `initial` must not restart the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, seat, apply]);

  return { room, link, goneBecause, apply, skewMs };
};
