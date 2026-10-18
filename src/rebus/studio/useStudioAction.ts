/**
 * One place for "do this, and say so if it fails".
 *
 * A Studio action that fails must be seen, so every button goes through here:
 * it runs the call, keeps a busy flag so a double tap cannot send it twice,
 * and turns the server's refusal ("the answer is written in the puzzle") into
 * a message the person can act on.
 */

import { useCallback, useState } from "react";
import { ApiError } from "../../lib/sync";
import { translate } from "../../lib/i18n";

export const messageOf = (e: unknown): string => (e instanceof ApiError && e.message ? e.message : translate("rebus.studio.failed"));

export const useStudioAction = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /** Runs `fn`; resolves true when it worked. */
  const run = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError(messageOf(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, run, clear: () => setError("") };
};
