import { useEffect, useMemo, useState } from "react";
import { accessToken, request } from "./sync";
import { LearningLog } from "./learning/learningLog";
import { JOURNAL_DAYS, buildJournal, mergeJournalEvents, type Journal, type JournalEvent } from "./learning/journal";

/**
 * "My learning" for one child: the device's own events at once, the server's
 * when they arrive.
 *
 * Offline first: on the child's own tablet the page draws from what the tablet
 * holds before any request is made, and a failed or slow request leaves it as
 * it is. A parent's phone holds none of the child's events, so it waits for
 * the server — and says so if it cannot reach it.
 */

interface JournalResponse {
  learnerId: string;
  days: number;
  events: JournalEvent[];
  titles: Record<string, string>;
}

/** Deadline for the server's rows: past this, the device's own answer stands. */
const JOURNAL_TIMEOUT_MS = 8_000;

export async function fetchJournal(learnerId: string, signal?: AbortSignal): Promise<JournalResponse> {
  const token = await accessToken();
  return request<JournalResponse>(`/sync/journal/${encodeURIComponent(learnerId)}?days=${JOURNAL_DAYS}`, {
    token,
    signal,
    timeoutMs: JOURNAL_TIMEOUT_MS,
  });
}

export interface JournalState {
  journal: Journal;
  /** Book titles by `book@rev`, from the server. */
  titles: Record<string, string>;
  /** The server has answered (or failed): nothing more is coming. */
  settled: boolean;
  /** The server could not be reached. */
  offline: boolean;
}

export function useLearningJournal(learnerId: string | null): JournalState {
  const [server, setServer] = useState<JournalResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [localVersion, setLocalVersion] = useState(0);

  useEffect(() => LearningLog.subscribe(() => setLocalVersion((v) => v + 1)), []);

  useEffect(() => {
    if (!learnerId) return;
    const controller = new AbortController();
    setServer(null);
    setFailed(false);
    fetchJournal(learnerId, controller.signal)
      .then(setServer)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [learnerId]);

  const local = useMemo(
    () => (learnerId ? (LearningLog.all() as unknown as JournalEvent[]).filter((e) => (e as { learnerId?: string }).learnerId === learnerId) : []),
    [learnerId, localVersion],
  );

  const journal = useMemo(() => buildJournal(mergeJournalEvents(local, server?.events ?? [])), [local, server]);
  return { journal, titles: server?.titles ?? {}, settled: Boolean(server) || failed, offline: failed };
}
