/**
 * Trace Studio drafts. A draft is an item, its writing-step plan, and the
 * author's test results — each tied to the exact strokes it tested, so
 * changing a stroke asks for a new test.
 *
 * Saved on this device first (so editing never waits for the network and
 * survives going offline), then sent to the server a moment later. Opening
 * the Studio pulls the server's copy: the server wins unless this device has
 * an edit it has not sent yet.
 */

import { deleteStudioItem, fetchStudioItems, saveStudioItem } from "../data/api";
import type { StepId, TraceItem } from "../geometry/types";
import type { StepPlan } from "../progress/ladder";
import { defaultPlan } from "../progress/ladder";

export interface TraceDraft {
  item: TraceItem;
  plan: StepPlan;
  /** Best admin test score per step, and the stroke fingerprint it was made on. */
  tests: Partial<Record<StepId, { score: number; accepted: boolean; strokes: string }>>;
  updatedAt: number;
  /** Changed here and not yet on the server. */
  dirty?: boolean;
}

export type SyncState = "saved" | "saving" | "offline";

const KEY = "koda_trace_drafts_v1";
const GONE_KEY = "koda_trace_drafts_deleted_v1";
const listeners = new Set<() => void>();
let version = 0;
let sync: SyncState = "saved";
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function setSync(next: SyncState) {
  if (sync === next) return;
  sync = next;
  version++;
  listeners.forEach((l) => l());
}

function readGone(): string[] {
  try {
    const raw = localStorage.getItem(GONE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGone(ids: string[]) {
  try {
    localStorage.setItem(GONE_KEY, JSON.stringify(ids));
  } catch {
    /* retried next time the Studio opens */
  }
}

/** Send one draft to the server, a moment after the last edit. */
function schedulePush(id: string) {
  const old = timers.get(id);
  if (old) clearTimeout(old);
  setSync("saving");
  timers.set(
    id,
    setTimeout(async () => {
      timers.delete(id);
      const d = read()[id];
      if (!d) return;
      try {
        await saveStudioItem(d);
        const now = read();
        // Only clear the flag if nothing changed while it was on its way.
        if (now[id] && now[id].updatedAt === d.updatedAt) {
          now[id] = { ...now[id], dirty: false };
          write(now);
        }
        if (timers.size === 0) setSync("saved");
      } catch {
        setSync("offline");
      }
    }, 800),
  );
}

function read(): Record<string, TraceDraft> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(all: Record<string, TraceDraft>): boolean {
  let ok = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    ok = false; // full (a large guide picture) or blocked
  }
  version++;
  listeners.forEach((l) => l());
  return ok;
}

/** A fingerprint of the strokes: a test is valid only for the strokes it was made on. */
export function strokesPrint(item: TraceItem): string {
  // Only what changes how a stroke is written: moving a number or editing an instruction needs no new test.
  const json = JSON.stringify(item.strokes.map(({ badge: _b, instruction: _i, ...rest }) => rest));
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** An empty item. Given `like`, it keeps that item's kind, script and settings — a new item in a set of line drawings starts as a line drawing. */
export function blankItem(id: string, like?: TraceItem): TraceItem {
  return {
    id,
    rev: 1,
    title: "",
    kind: like?.kind ?? "letter",
    script: like?.script ?? "khmer",
    ...(like?.numerals ? { numerals: like.numerals } : {}),
    grid: like?.grid ?? "4x3-moeys",
    strokes: [],
    sensitivity: like?.sensitivity ?? "balanced",
    guide: { glyph: { text: "", size: 720, x: 500, y: 780 } },
  };
}

export function newDraft(item: TraceItem): TraceDraft {
  return { item, plan: defaultPlan(item), tests: {}, updatedAt: Date.now() };
}

export const TraceDrafts = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  version: () => version,
  list(): TraceDraft[] {
    return Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string): TraceDraft | undefined {
    return read()[id];
  },
  /** Returns false when the device refused to store it (usually a picture too large). */
  save(draft: TraceDraft): boolean {
    const all = read();
    const prev = all[draft.item.id];
    // Unchanged content (the editor re-saving on open) is not an edit.
    if (prev && JSON.stringify({ ...prev, updatedAt: 0, dirty: false }) === JSON.stringify({ ...draft, updatedAt: 0, dirty: false })) return true;
    all[draft.item.id] = { ...draft, updatedAt: Date.now(), dirty: true };
    const ok = write(all);
    schedulePush(draft.item.id);
    return ok;
  },
  remove(id: string) {
    const all = read();
    delete all[id];
    write(all);
    writeGone([...new Set([...readGone(), id])]);
    deleteStudioItem(id)
      .then(() => writeGone(readGone().filter((x) => x !== id)))
      .catch(() => setSync("offline"));
  },
  syncState: () => sync,

  /** Send every unsent draft now (before publishing). Throws if the server can't be reached. */
  async flush(): Promise<void> {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    const all = read();
    setSync("saving");
    try {
      for (const d of Object.values(all)) {
        if (d.dirty === false) continue;
        await saveStudioItem(d);
        all[d.item.id] = { ...d, dirty: false };
      }
      write(all);
      setSync("saved");
    } catch (e) {
      setSync("offline");
      throw e;
    }
  },

  /**
   * Bring this device and the server together: take the server's copy of
   * every draft this device has not changed, send the ones it has, finish
   * deletes made offline, and drop drafts deleted elsewhere. Never throws.
   */
  async pull(): Promise<void> {
    let rows;
    try {
      rows = await fetchStudioItems();
    } catch {
      setSync("offline");
      return;
    }
    const gone = new Set(readGone());
    for (const id of gone) {
      try {
        await deleteStudioItem(id);
        gone.delete(id);
      } catch {
        /* still offline or already gone */
      }
    }
    writeGone([...gone]);
    const all = read();
    const onServer = new Set(rows.map((r) => r.id));
    for (const r of rows) {
      if (gone.has(r.id)) continue;
      const local = all[r.id];
      // A draft from before syncing existed has no flag: treat it as unsent, never as stale.
      if (!local || local.dirty === false) all[r.id] = { item: r.item, plan: r.plan, tests: r.tests ?? {}, updatedAt: Date.parse(r.updatedAt) || Date.now(), dirty: false };
    }
    for (const [id, d] of Object.entries(all)) {
      if (d.dirty !== false) schedulePush(id);
      else if (!onServer.has(id)) delete all[id];
    }
    write(all);
    if (timers.size === 0) setSync("saved");
  },
};
