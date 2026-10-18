/**
 * Which puzzles a child has met lately.
 *
 * An ordered list, oldest first, kept on the device (Phase 4a stores it). It is
 * capped, so it forgets the oldest and a puzzle can come round again once the
 * bank has been worked through. Pure functions here; storage is not this file's job.
 */

export const SEEN_CAP = 2000;

/** Add ids to the log, moving any already there to the newest end, and drop the oldest past the cap. */
export const recordSeen = (log: readonly string[], ids: readonly string[], cap: number = SEEN_CAP): string[] => {
  const fresh = new Set(ids);
  const kept = log.filter((id) => !fresh.has(id));
  const next = [...kept, ...ids.filter((id, i) => ids.indexOf(id) === i)];
  return next.length > cap ? next.slice(next.length - cap) : next;
};

export const seenSet = (log: readonly string[]): ReadonlySet<string> => new Set(log);
