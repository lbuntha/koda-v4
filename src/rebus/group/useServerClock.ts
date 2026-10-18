/**
 * The server's clock, as this device can tell it.
 *
 * Everyone in a room counts down against the server's time, not their own, so a
 * phone whose clock is a minute out still starts the puzzle with everyone else.
 * `skewMs` is the server's time minus this device's, measured from each poll.
 */

import { useEffect, useState } from "react";

const TICK_MS = 200;

export const useServerClock = (skewMs: number): number => {
  const [now, setNow] = useState(() => Date.now() + skewMs);
  useEffect(() => {
    setNow(Date.now() + skewMs);
    const id = window.setInterval(() => setNow(Date.now() + skewMs), TICK_MS);
    return () => window.clearInterval(id);
  }, [skewMs]);
  return now;
};
