import { useEffect, useRef } from "react";

/**
 * Give up the seat when this room screen closes before the game starts.
 *
 * A host who walks away from the lobby leaves friends knocking on a door nobody
 * will open, and a friend who walks away holds a seat. Leaving tells the server
 * at once: hosting passes on, or the room closes and the door says the host
 * left. Once the game is playing the seat is kept, so a child who looks away
 * mid-race can come back to it.
 *
 * Only an in-app close: a page refresh never runs this, so a refresh still comes
 * back to the same seat. A closed tab is the server's to notice (the host stops
 * asking, see `HOST_AWAY_MS`).
 *
 * Deferred one tick, because StrictMode unmounts and remounts every component
 * once in development: the remount cancels the pending leave.
 */
export function useLeaveOnClose(leave: () => void, inLobby: boolean): void {
  const latest = useRef({ leave, inLobby });
  latest.current = { leave, inLobby };
  const pending = useRef<number | null>(null);

  useEffect(() => {
    if (pending.current !== null) {
      window.clearTimeout(pending.current);
      pending.current = null;
    }
    return () => {
      pending.current = window.setTimeout(() => {
        if (latest.current.inLobby) latest.current.leave();
      }, 0);
    };
  }, []);
}
