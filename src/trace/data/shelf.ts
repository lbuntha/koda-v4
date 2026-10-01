/**
 * The learner's Trace shelves, kept on the device — offline first.
 *
 * The list of published collections and every collection's bundle (all its
 * items) are stored locally. Opening the page shows what is stored at once,
 * then refreshes in the background with a deadline: a new revision replaces
 * the old one, a collection taken down disappears, and with no network the
 * child keeps playing what they have.
 */

import { useEffect, useSyncExternalStore } from "react";
import type { CollectionBundle, CollectionSummary, ReportIn } from "./api";
import { fetchBundle, fetchShelf, sendReport } from "./api";

interface Stored {
  collections: CollectionSummary[];
  bundles: Record<string, CollectionBundle>;
  checkedAt: number;
}

const KEY = "koda_trace_shelf_v1";
const listeners = new Set<() => void>();
let version = 0;
let refreshing: Promise<void> | null = null;

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.collections)) return parsed as Stored;
  } catch {
    /* fall through */
  }
  return { collections: [], bundles: {}, checkedAt: 0 };
}

function write(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* full: the shelf still shows what is in memory this session */
  }
  version++;
  listeners.forEach((l) => l());
}

/* A report made offline waits here and goes with the next refresh. */
const OUTBOX = "koda_trace_report_outbox_v1";

function readOutbox(): ReportIn[] {
  try {
    const raw = localStorage.getItem(OUTBOX);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(list: ReportIn[]) {
  try {
    localStorage.setItem(OUTBOX, JSON.stringify(list.slice(-50)));
  } catch {
    /* a lost report is a shame, not a failure */
  }
}

/** Send a report now, or keep it to send later. Resolves either way — the child is thanked regardless. */
export async function reportProblem(r: ReportIn): Promise<"sent" | "queued"> {
  try {
    await sendReport(r);
    return "sent";
  } catch {
    writeOutbox([...readOutbox(), r]);
    return "queued";
  }
}

async function flushOutbox() {
  const waiting = readOutbox();
  const left: ReportIn[] = [];
  for (const r of waiting) {
    try {
      await sendReport(r);
    } catch {
      left.push(r);
    }
  }
  writeOutbox(left);
}

export const TraceShelf = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  version: () => version,
  read,

  /** Fetch the list and any bundle whose revision changed. Never throws. */
  refresh(): Promise<void> {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const list = await fetchShelf();
        const prev = read();
        const bundles: Record<string, CollectionBundle> = {};
        for (const c of list) {
          const have = prev.bundles[c.id];
          if (have && have.rev === c.rev) bundles[c.id] = have;
          else {
            try {
              bundles[c.id] = await fetchBundle(c.id);
            } catch {
              if (have) bundles[c.id] = have; // keep the older revision until the new one arrives
            }
          }
        }
        write({ collections: list, bundles, checkedAt: Date.now() });
        await flushOutbox();
      } catch {
        /* offline or slow: keep what is stored */
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  },
};

/** The stored shelves, refreshed once when the page opens. */
export function useTraceShelf(): Stored {
  useSyncExternalStore(TraceShelf.subscribe, TraceShelf.version);
  useEffect(() => {
    void TraceShelf.refresh();
  }, []);
  return read();
}
