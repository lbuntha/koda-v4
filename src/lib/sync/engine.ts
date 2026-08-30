/**
 * When the outbox drains, and what happens when it cannot.
 *
 * The rules are the offline ones, applied to sending rather than to sessions:
 * a failure that means "no connection" keeps the queue and backs off; a failure
 * that means "the server refused this" also keeps the queue, because dropping a
 * child's record on a 400 would be worse than sending it again later.
 *
 * Single-flight: a flush in progress swallows further triggers rather than
 * queueing three copies of the same batch behind a slow network.
 */

import { ApiError, request } from "./api";
import {
  applyChanges,
  cursor,
  lastSentBody,
  rememberBody,
  rememberRevision,
  revisionOf,
  type SyncDoc,
} from "./apply";
import { Outbox, type Mutation } from "./outbox";
import { SessionAPI, accessToken } from "./session";
import { SYNC_KINDS, type DocKind } from "./kinds";
import { refreshMaintenanceVersions } from "../maintenanceReset";

/** One request's worth. The server's own limit is 500. */
const BATCH_SIZE = 200;

/** While the queue is non-empty and the network is up. */
const IDLE_INTERVAL_MS = 30_000;

const BACKOFF_MIN_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;

export type SyncState = "idle" | "sending" | "offline" | "signed-out" | "refused";

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSentAt: number | null;
  lastError: string | null;
  /**
   * The server's code for a refusal, so a caller can tell a condition this
   * device can wait out from one it cannot. `null` whenever the state is not
   * `refused`.
   */
  reason: string | null;
}

interface PushOut {
  accepted: number;
  duplicates: number;
  cursor: number;
  conflicts: { opId: string; doc: SyncDoc }[];
}

interface ChangesOut {
  cursor: number;
  docs: SyncDoc[];
  hasMore: boolean;
}

let status: SyncStatus = {
  state: "idle",
  pending: Outbox.size(),
  lastSentAt: null,
  lastError: null,
  reason: null,
};

/**
 * Refusals that trying again cannot change.
 *
 * A staff account has no family to write into — that is what the account *is*,
 * not a passing condition, so every new event re-attempting it buys a 403 per
 * event and nothing else. Deployment switches (`sync_disabled`, `read_only`)
 * are the opposite: they end without anything happening on this device, so a
 * new event is exactly the right moment to look again. Signing in clears
 * either, because the next account may be a different answer.
 */
/*
 * Refusals that will not change by trying again.
 *
 * `forbidden` is the one this set was missing. A staff account has no
 * `learner_data:append` by policy — `GRANT_ONLY` in the server's policy module
 * says staff never hold it, whatever their platform role — so every push and
 * every pull came back 403 and, because the code was unrecognised, the engine
 * cleared the refusal and tried again on the next tick. Twenty-four requests in
 * three minutes, for a permission that cannot be granted by waiting.
 *
 * Signing in as a family member clears it: the standing refusal is keyed to the
 * account, not to the device.
 */
const PERMANENT_REFUSALS = new Set(["no_family", "not_your_learner", "forbidden"]);

/**
 * A refusal this account is already known to be owed, without asking.
 *
 * The engine used to learn that a staff account cannot write learner data by
 * *being told* — one POST, one 403, one red line in the console — and only then
 * set the standing refusal. But the session already carries the answer: an
 * account with no family has nowhere to write, and a token whose own permission
 * list omits `learner_data:append` will be refused by the route that requires
 * it. Asking anyway logs a failure that was certain before it was sent.
 *
 * **Positive evidence only.** An absent `permissions` array is *unknown*, not
 * "no": that is the ordinary shape of a family token, and treating unknown as a
 * refusal would silently stop syncing a child's record — a far worse failure
 * than a console line. Unknown still tries, and still learns from the 403.
 */
function refusalOwedTo(session: { familyId?: string | null; permissions?: string[] }): string | null {
  // The server refuses any family-less account outright: a support account that
  // could push would start owning a child's record.
  if (!session.familyId) return "no_family";
  if (session.permissions?.length && !session.permissions.includes("learner_data:append")) {
    return "forbidden";
  }
  return null;
}

/**
 * Which account earned the standing refusal.
 *
 * A refusal is a fact about an account, not about this device: the family
 * member who signs in next may be allowed exactly what the staff account was
 * not. Keyed rather than subscribed so a token refresh — same account, new
 * token — does not read as a fresh chance and buy another 403.
 */
let refusedFor: string | null = null;

const accountKey = (session: { deviceId: string; familyId?: string | null }): string =>
  `${session.deviceId}:${session.familyId ?? "none"}`;

/**
 * Let a new attempt through, unless the refusal was about the account itself.
 */
function allowRetryAfterRefusal(): void {
  if (status.state !== "refused") return;
  if (PERMANENT_REFUSALS.has(status.reason ?? "")) return;
  setStatus({ state: "idle", lastError: null, reason: null });
}
let inFlight = false;
let backoffMs = BACKOFF_MIN_MS;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch, pending: Outbox.size() };
  listeners.forEach((fn) => fn());
}

function scheduleRetry(): void {
  if (timer) clearTimeout(timer);
  // Full jitter: twenty tablets in one classroom coming back at once should not
  // arrive as one spike.
  const wait = Math.random() * backoffMs;
  timer = setTimeout(() => void flush(), wait);
  backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
}

/**
 * Send what is queued, oldest first.
 *
 * Returns quietly rather than throwing: nothing in the app is waiting on this,
 * and a failed upload is not something a child should ever be told about.
 */
export async function flush(): Promise<void> {
  if (inFlight) return;
  if (!Outbox.size()) {
    setStatus({ state: "idle", lastError: null });
    return;
  }

  const session = SessionAPI.current();
  if (!session) {
    // Signed out with work still queued. Keep it: signing back in on this
    // device should send it, not discard it.
    setStatus({ state: "signed-out" });
    return;
  }

  // Still the account that was refused, so the answer is still no.
  if (status.state === "refused" && refusedFor === accountKey(session)) return;

  // Refused before asking, where the session already says so. The queue is kept
  // exactly as it is for a 403 — signing in as a family member sends it.
  const owed = refusalOwedTo(session);
  if (owed) {
    refusedFor = accountKey(session);
    setStatus({
      state: "refused",
      reason: owed,
      lastError:
        owed === "no_family"
          ? "This account is not part of a family, so there is nothing to sync into."
          : "This account may not write learner data.",
    });
    return;
  }

  inFlight = true;
  setStatus({ state: "sending" });

  try {
    // A global erase must invalidate this device's offline queue before it can
    // recreate the records the operator removed.
    await refreshMaintenanceVersions();
    while (Outbox.size()) {
      const events = Outbox.peek(BATCH_SIZE);
      const mutations = Outbox.peekMutations(BATCH_SIZE);
      const token = await accessToken();
      if (!token) {
        setStatus({ state: "signed-out" });
        return;
      }

      const result = await request<PushOut>("/sync/push", {
        method: "POST",
        token,
        body: {
          schemaVersion: 1,
          deviceId: session.deviceId,
          sentAt: new Date().toISOString(),
          events,
          mutations,
        },
      });

      // A conflict is not a failure to retry: the server's copy is the answer,
      // so it is applied here and the losing edit is dropped rather than sent
      // again in a loop it cannot win.
      for (const conflict of result.conflicts ?? []) {
        applyChanges([conflict.doc], conflict.doc.serverSeq);
      }

      // Accepted *and* duplicate both mean the server has them — a replayed
      // batch is a no-op there, so anything else would strand the queue.
      Outbox.ack([...events.map((event) => event.id), ...mutations.map((m) => m.opId)]);

      // Remember what revision the server now holds, so the next edit from this
      // device is made against it rather than against a stale number.
      for (const mutation of mutations) {
        if (!(result.conflicts ?? []).some((c) => c.opId === mutation.opId)) {
          rememberRevision(mutation.kind, mutation.key, mutation.baseRev + 1);
        }
      }
    }

    await pull();

    backoffMs = BACKOFF_MIN_MS;
    refusedFor = null;
    setStatus({ state: "idle", lastSentAt: Date.now(), lastError: null, reason: null });
  } catch (error) {
    const problem = error as ApiError;
    if (problem.isOffline) {
      setStatus({ state: "offline", lastError: null });
      scheduleRetry();
    } else if (problem.status === 403) {
      // This account may not write this record — a staff device, say, which has
      // no family to write into. Retrying cannot change that, so the queue is
      // *kept* and the loop stops until something changes: signing in as
      // somebody else, or recording something new. A 403 every thirty seconds
      // for the rest of the session helps nobody.
      refusedFor = accountKey(session);
      setStatus({ state: "refused", lastError: problem.message, reason: problem.code });
    } else {
      // Anything else is worth another go: better a stuck queue somebody can
      // see than a silently discarded record.
      setStatus({ state: "idle", lastError: problem.message });
      scheduleRetry();
    }
  } finally {
    inFlight = false;
  }
}

/**
 * Fetch what other devices changed.
 *
 * Documents only — a device that has none needs the rollup, not forty thousand
 * taps. Quiet on failure for the same reason as everything else here: a pull
 * that could not run is a pull that runs on the next trigger.
 */
export async function pull(): Promise<number> {
  const session = SessionAPI.current();
  /*
   * The same standing refusal that stops pushing stops pulling.
   *
   * This guard was only on `flush`, so a staff account — which policy refuses
   * `learner_data:read` as firmly as it refuses append — went on asking for
   * changes every few seconds for the life of the session. Thirty-three 403s in
   * a few minutes, none of which could ever have succeeded.
   */
  if (session && status.state === "refused" && refusedFor === accountKey(session)) return 0;
  // And the same standing refusal, before the first ask rather than after it.
  if (session && refusalOwedTo(session)) return 0;

  const token = await accessToken();
  if (!token) return 0;

  const since = cursor();
  const result = await request<ChangesOut>(`/sync/changes?since=${since}&limit=200`, { token });
  if (!result.docs.length) {
    if (result.cursor > since) applyChanges([], result.cursor);
    return 0;
  }
  return applyChanges(result.docs, result.cursor);
}

/** Queue events for upload. Called by the learning log's sink. */
export function record(events: readonly unknown[]): void {
  Outbox.add(events as never[]);
  allowRetryAfterRefusal();
  setStatus({});
  void flush();
}

/**
 * Queue a setting change for upload.
 *
 * Called by the stores from the function that already saves them, so a setting
 * reaches the server by the same path it reaches the disk.
 */
export function recordDoc(
  kind: DocKind,
  key: string,
  body: Record<string, unknown>,
  options: { learnerId?: string | null; deleted?: boolean } = {},
): void {
  if (!SYNC_KINDS[kind]) return;

  // A save that changes nothing is not an edit. Without this, every boot would
  // bump the revision and a stale device could overwrite a newer change with
  // the same old body.
  const serialised = JSON.stringify(body);
  if (!options.deleted && lastSentBody(kind, key) === serialised) return;

  const mutation: Mutation = {
    opId: `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    key,
    learnerId: options.learnerId ?? null,
    body,
    baseRev: revisionOf(kind, key),
    deleted: options.deleted ?? false,
  };
  Outbox.put(mutation);
  rememberBody(kind, key, body);
  allowRetryAfterRefusal();
  setStatus({});
  void flush();
}

/**
 * Start the loop. Idempotent, so a hot reload does not stack listeners.
 *
 * Five triggers, each for a real moment: the app opening, the network coming
 * back, a tablet being closed mid-round, a periodic sweep while work is
 * waiting, and anything newly recorded.
 */
export function start(): () => void {
  if (started) return () => undefined;
  started = true;

  const onOnline = () => {
    backoffMs = BACKOFF_MIN_MS;
    void flush();
  };
  const onHidden = () => {
    if (document.visibilityState === "hidden") void flush();
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onHidden);
  const interval = setInterval(() => {
    if (Outbox.size()) void flush();
  }, IDLE_INTERVAL_MS);

  const unsubscribe = Outbox.subscribe(() => setStatus({}));
  void flush();
  // A device that only ever *receives* changes has an empty outbox, and flush()
  // returns early on empty — so the first pull has to be asked for directly.
  void pull().catch(() => undefined);

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onHidden);
    clearInterval(interval);
    unsubscribe();
    started = false;
  };
}

export const SyncEngine = {
  status: (): SyncStatus => status,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  flush,
  pull,
  record,
  recordDoc,
  start,
};
