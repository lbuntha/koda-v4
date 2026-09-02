import { useCallback, useState } from "react";
import { clipUrlsFor } from "./voiceClips";

/**
 * Making a skill playable with no network, as a step a child can see.
 *
 * Adding a skill used to download nothing, and that was *almost* true enough to
 * leave alone: a skill's lessons, its course order and its artwork are compiled
 * into the app bundle, which the service worker precaches on install, so the
 * lesson itself already worked on a train. Its **voice** did not. Recorded
 * speech is deliberately left out of the precache — a skill's clips are several
 * megabytes, and making a tablet pull every one during install, before a child
 * has opened a single lesson, is a worse first run than a lesson that is
 * briefly silent — so clips cache on first play instead.
 *
 * The result was a promise nobody had made explicitly: a child who added a
 * skill on the sofa and opened it in the car got the browser's robot voice
 * instead of Koda's, with nothing having said that would happen. This turns
 * that into a step with a name, a count and an end.
 *
 * What it fetches is only the speech. Everything else is already there, which
 * is why a skill with nothing recorded is reported ready immediately rather
 * than being given a fake progress bar to walk through.
 */

/** Where a skill stands, from this device's point of view. */
export type OfflineState =
  /** Nothing has been downloaded, or nothing has checked. */
  | "unknown"
  /** Fetching. `done` of `total` clips so far. */
  | "preparing"
  /** Everything this skill says is on the device. */
  | "ready"
  /** Some clips did not arrive — the network went, or the server refused. */
  | "incomplete";

export interface OfflineProgress {
  state: OfflineState;
  done: number;
  total: number;
}

export interface OfflineRecord {
  /** When the last complete download finished. */
  at: number;
  /** How many clips it held then. A later recording session raises this. */
  clips: number;
}

const KEY = "koda_offline_skills_v1";

const readAll = (): Record<string, OfflineRecord> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, OfflineRecord>;
  } catch {
    return {};
  }
};

/** What this device has already pulled down for a skill, if anything. */
export const offlineRecord = (skillId: string): OfflineRecord | null =>
  readAll()[skillId] ?? null;

const remember = (skillId: string, clips: number) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [skillId]: { at: Date.now(), clips } }));
  } catch {
    /* A device that cannot remember still downloaded the clips; the cache holds
       them either way. Only the "ready" label is lost. */
  }
};

/**
 * Whether the skill is known to be complete on this device.
 *
 * Compares against what the build actually ships rather than a stored boolean,
 * so recording a skill's voice after a child downloaded it correctly reports
 * the skill as no longer complete instead of claiming a stale yes.
 */
export const isSkillOffline = (skillId: string): boolean => {
  const record = offlineRecord(skillId);
  return record !== null && record.clips >= clipUrlsFor(skillId).length;
};

/** Four at a time: enough to use the connection, few enough to stay polite. */
const LANES = 4;

/**
 * Pull down everything the skill needs to speak offline.
 *
 * A plain `fetch` on purpose, rather than writing to the Cache API by name: the
 * service worker's `CacheFirst` route already claims these URLs, so a request
 * through it lands in the same cache a later play would read, under whatever
 * name the build gave it. In development, with no worker registered, the same
 * call simply warms the HTTP cache and the flow still behaves.
 *
 * Safe to call again. Clips already cached come back instantly, so a retry
 * after a dropped connection costs only what is missing.
 */
export async function prepareSkillOffline(
  skillId: string,
  onProgress?: (progress: OfflineProgress) => void,
): Promise<OfflineProgress> {
  const urls = clipUrlsFor(skillId);
  const total = urls.length;
  let done = 0;
  let failed = 0;

  const report = (state: OfflineState) => {
    const progress = { state, done, total };
    onProgress?.(progress);
    return progress;
  };

  // Nothing to fetch is the normal state for a skill nobody has recorded, and
  // it is genuinely ready: the lesson and its artwork shipped with the app.
  if (total === 0) {
    remember(skillId, 0);
    return report("ready");
  }

  report("preparing");

  const queue = [...urls];
  await Promise.all(
    Array.from({ length: Math.min(LANES, queue.length) }, async () => {
      for (let url = queue.pop(); url; url = queue.pop()) {
        try {
          const response = await fetch(url, { credentials: "same-origin" });
          if (!response.ok) throw new Error(String(response.status));
          done += 1;
        } catch {
          // One clip that will not come is a line spoken by the browser, not a
          // broken skill. Counted so the caller can offer the download again.
          failed += 1;
        }
        report("preparing");
      }
    }),
  );

  if (failed > 0) return report("incomplete");
  remember(skillId, total);
  return report("ready");
}

/**
 * The same download, as something a component can render.
 *
 * Holds the progress rather than the promise, because what a child is owed on
 * screen is "31 of 70", not a spinner that ends without saying what happened.
 */
export function useOfflineDownload() {
  const [progress, setProgress] = useState<OfflineProgress>({
    state: "unknown",
    done: 0,
    total: 0,
  });

  const prepare = useCallback(async (skillId: string) => {
    setProgress({ state: "preparing", done: 0, total: 0 });
    return prepareSkillOffline(skillId, setProgress);
  }, []);

  return { progress, prepare };
}

/** What to say about a download, in the words a parent or child would use. */
export const offlineMessage = ({ state, done, total }: OfflineProgress): string | null => {
  if (state === "preparing") return `Saving for offline… ${done} of ${total}`;
  if (state === "incomplete") {
    return `Saved ${done} of ${total}. The rest needs a connection — it will finish next time you open this skill.`;
  }
  if (state === "ready") {
    return total === 0
      ? "Ready to play offline. Spoken lines use your device's voice until this skill is recorded."
      : "Ready to play offline.";
  }
  return null;
};
