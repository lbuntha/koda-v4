import { LearningLog, setActiveLearner, setLearningSink } from "../learning/learningLog";
import { SessionAPI } from "./session";
import { ArtStore } from "./artStore";
import { SyncEngine } from "./engine";
import { refreshPermissions } from "./permissions";

/**
 * A device that has been played on since before it had an account.
 *
 * Signing in must not start the record from zero: the local ring already holds
 * what this child did, and every event carries a stable id, so handing the whole
 * ring to the outbox once is safe — the server de-duplicates by `(family,
 * eventId)` and a second backfill would be a no-op anyway.
 *
 * What it cannot recover is anything already trimmed out of the ring. That
 * history survives only in the local rollup, which is a real limit rather than
 * an oversight: totals cannot be uploaded without double-counting the events
 * they were derived from.
 */
const BACKFILL_KEY = "koda_outbox_backfill_v1";

function backfillOnce(): void {
  if (localStorage.getItem(BACKFILL_KEY)) return;
  try {
    const existing = LearningLog.all();
    if (existing.length) SyncEngine.record(existing);
    localStorage.setItem(BACKFILL_KEY, new Date().toISOString());
  } catch {
    // Not worth failing a boot over; the next load tries again.
  }
}

/**
 * Point the learning log at the server.
 *
 * This is the seam the log was written around: the local ring stays the record,
 * and everything it records is also queued for upload. Nothing above this line
 * knows there is a backend, which is why a signed-out or offline app behaves
 * exactly as it did before there was one.
 */
export function installLearningSink(): () => void {
  setLearningSink(async (batch) => {
    SyncEngine.record(batch.events);
  });
  backfillOnce();
  // Read the family's artwork into memory before anything draws with it.
  void ArtStore.load();
  void refreshPermissions();

  /*
   * Whose practice this is.
   *
   * The log stamps every event with a learner id, and without this that id is
   * the device's — so on a tablet two children share, both of their records are
   * one record, and nothing downstream can tell them apart again. Following the
   * session is what makes "who is quickest?" a question with an answer.
   */
  const followSession = () => {
    const session = SessionAPI.current();
    setActiveLearner(
      session?.learnerId ? { id: session.learnerId, name: session.learnerName } : null,
    );
  };
  followSession();
  const unfollow = SessionAPI.subscribe(followSession);

  const stopSync = SyncEngine.start();
  return () => {
    unfollow();
    stopSync();
  };
}
