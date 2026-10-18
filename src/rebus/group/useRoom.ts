/**
 * Keeps one room up to date.
 *
 * Asks the server for the room about once a second. The answer also carries what
 * time has done (a puzzle running out, the next one starting), so there is
 * nothing else to subscribe to. A failed ask is "reconnecting", not an error: the
 * next one usually works, and a poll that takes too long is dropped so slow
 * answers never pile up.
 *
 * A dropped connection never ends a game. Only the server saying "you are not
 * in this room" (removed, or the room is closed) does. The seat is kept, the
 * asking carries on (slower the longer it fails, and at once when the device
 * comes back online or the page is shown again), and the player is back where
 * the room is now the moment one ask gets through. The server holds a room for
 * two hours, so a minute under a bridge costs nothing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../lib/sync";
import { GroupAPI } from "./groupApi";
import type { RoomView } from "./types";

export const POLL_MS = 1_000;
/** After this many failed asks in a row, ask less often: the network is bad, not busy. */
const SLOW_AFTER = 10;
const SLOW_POLL_MS = 3_000;

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

    let asking = false;
    const ask = async () => {
      if (asking) return;
      asking = true;
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
        setLink("reconnecting");
      } finally {
        asking = false;
      }
      if (live) timer = window.setTimeout(() => void ask(), misses.current >= SLOW_AFTER ? SLOW_POLL_MS : POLL_MS);
    };

    // Back online, or the page shown again: ask now rather than wait out the pause.
    const askNow = () => {
      if (!live || document.visibilityState === "hidden") return;
      if (timer) window.clearTimeout(timer);
      void ask();
    };
    window.addEventListener("online", askNow);
    document.addEventListener("visibilitychange", askNow);

    timer = window.setTimeout(() => void ask(), initial ? POLL_MS : 0);
    return () => {
      live = false;
      window.removeEventListener("online", askNow);
      document.removeEventListener("visibilitychange", askNow);
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
    // The seat and code define the room; a new `initial` must not restart the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, seat, apply]);

  return { room, link, goneBecause, apply, skewMs };
};
