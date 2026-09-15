/**
 * Each child's day, week and gap, for the "Your children" section on a parent's
 * Home — and the last answer, kept on this device.
 *
 * Offline-first like everything a parent opens: the section draws the stored
 * answer straight away and says how old it is, and a refresh replaces it when
 * the network answers. `request()` puts a deadline on the call, so a bad
 * connection leaves the old answer standing rather than a spinner.
 */

import { request } from "./sync/api";
import { accessToken } from "./sync/session";

export interface ChildToday {
  rounds: number;
  minutes: number;
  goal: number;
  goalMet: boolean;
}

export interface ChildOverview {
  id: string;
  displayName: string;
  avatarSeed: string;
  today: ChildToday;
  streak: number;
  /** Whole days since the last round; `null` for a child who has not started. */
  daysAway: number | null;
  daysThisWeek: number;
}

/** The one thing worth a parent's eye, already worded by the absence message. */
export interface ChildAttention {
  learnerId: string;
  kind: string;
  title: string;
  body: string;
}

export interface ChildrenOverview {
  children: ChildOverview[];
  attention: ChildAttention | null;
  generatedAt: string;
  absenceDays: number;
}

export interface StoredOverview {
  overview: ChildrenOverview;
  /** Epoch ms this device last heard it. */
  savedAt: number;
}

const KEY = "koda_children_overview_v1";

/** The last answer this account received on this device, if any. */
export function cachedChildrenOverview(userId: string): StoredOverview | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredOverview & { userId?: string };
    // Per account: a shared family tablet must not show one parent's cache to
    // another, even though today it would be the same children.
    return stored.userId === userId ? { overview: stored.overview, savedAt: stored.savedAt } : null;
  } catch {
    return null;
  }
}

export async function refreshChildrenOverview(userId: string, now = Date.now()): Promise<StoredOverview> {
  const overview = await request<ChildrenOverview>("/learners/overview", { token: await accessToken() });
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId, savedAt: now, overview }));
  } catch {
    // Storage disabled: the section simply waits for the network next time.
  }
  return { overview, savedAt: now };
}
