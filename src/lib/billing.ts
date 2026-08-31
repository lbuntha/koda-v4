/**
 * What this family's plan covers.
 *
 * Read-only on the device, and never the thing that actually enforces anything.
 * The learner route refuses a fourth child and the tutor proxy refuses a call
 * whatever this says — a hidden button is a hint, the server is the rule. What
 * this is for is the *sentence*: telling a parent why the button is not there,
 * and what it would take to have it.
 *
 * Cached like the profile figures, and for the same reason. A tablet that
 * cannot reach the server should keep drawing the plan it last knew about
 * rather than silently demoting the family to free and hiding features they
 * have paid for.
 */

import { ApiError, SessionAPI, accessToken, request } from "./sync";

export interface Entitlements {
  planId: string;
  planName: string;
  description: string;
  priceCents: number;
  currency: string;
  /** Feature ids this plan includes — ask with `has`, never by name. */
  features: string[];
  learnerLimit: number;
  learnersUsed: number;
  canAddLearner: boolean;
  /** What the subscription row says: "none", "active", "cancelled"… */
  status: string;
  renewsAt: string | null;
  source: string | null;
}

/** Koda's AI help. The one feature that is sold today. */
export const AI_FEATURE = "ai.koda";

/** A plan as the catalogue describes it — what a family is choosing between. */
export interface Plan {
  planId: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  learnerLimit: number;
  features: string[];
  order: number;
}

/**
 * A plan this family has asked for and not yet been given.
 *
 * Not an entitlement, and deliberately kept apart from one: `Entitlements` is
 * what the app may *do*, and a want must never be mistaken for a grant. Nothing
 * unlocks because this is set.
 */
export interface UpgradeRequest {
  planId: string;
  planName: string;
  requestedAt: string;
}

/**
 * What a device shows before it has heard, and when it never will.
 *
 * Free rather than generous: a device that cannot reach the server should not
 * offer a paid feature it will then be refused, which reads as a broken app
 * rather than as an unpaid one.
 */
export const FREE_ENTITLEMENTS: Entitlements = {
  planId: "free",
  planName: "Free",
  description: "",
  priceCents: 0,
  currency: "USD",
  features: [],
  learnerLimit: 1,
  learnersUsed: 0,
  canAddLearner: true,
  status: "none",
  renewsAt: null,
  source: null,
};

const CACHE_KEY = "koda_entitlements_v1";

let current: Entitlements | null = null;
let version = 0;
const listeners = new Set<() => void>();

const notify = () => {
  version += 1;
  for (const cb of listeners) cb();
};

/** Whose plan this is — cached per family, since a tablet is shared. */
const subject = (): string | null => SessionAPI.current()?.familyId ?? null;

const readCache = (key: string): Entitlements | null => {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, Entitlements>;
    return all[key] ?? null;
  } catch {
    return null;
  }
};

const writeCache = (key: string, value: Entitlements): void => {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, Entitlements>;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...all, [key]: value }));
  } catch {
    /* A blocked store costs this device its offline copy and nothing else. */
  }
};

export const Billing = {
  version: () => version,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** The plan in force, as far as this device knows. */
  current(): Entitlements {
    if (current) return current;
    const key = subject();
    return (key && readCache(key)) || FREE_ENTITLEMENTS;
  },

  /** Whether the plan includes a feature. The question every gate asks. */
  has(feature: string): boolean {
    return Billing.current().features.includes(feature);
  },

  /** Re-read from the server. Never throws — offline keeps the last answer. */
  async refresh(): Promise<Entitlements> {
    try {
      const token = await accessToken();
      if (!token) return Billing.current();
      const row = await request<Entitlements>("/billing/me", { token });
      current = row;
      const key = subject();
      if (key) writeCache(key, row);
      notify();
      return row;
    } catch (error) {
      void (error as ApiError);
      return Billing.current();
    }
  },

  /** Adopt a row a screen already fetched — a grant, or a learner just added. */
  adopt(row: Entitlements): void {
    current = row;
    const key = subject();
    if (key) writeCache(key, row);
    notify();
  },

  /** Forget it on sign-out, so the next account never inherits this plan. */
  clear(): void {
    current = null;
    notify();
  },

  /** Every plan on offer, cheapest first. Not cached: read when a card opens. */
  async plans(): Promise<Plan[]> {
    const token = await accessToken();
    if (!token) return [];
    const body = await request<{ plans: Plan[] }>("/billing/plans", { token });
    return [...body.plans].sort((a, b) => a.order - b.order || a.priceCents - b.priceCents);
  },

  /** What this family has already asked for, if anything. */
  async upgradeRequest(): Promise<UpgradeRequest | null> {
    try {
      const token = await accessToken();
      if (!token) return null;
      const body = await request<{ request: UpgradeRequest | null }>("/billing/upgrade", { token });
      return body.request;
    } catch (error) {
      // A card that cannot read the ask should still draw the plan. Failing
      // quietly here shows an Upgrade button; failing loudly shows an error
      // where a parent expected their plan.
      void (error as ApiError);
      return null;
    }
  },

  /**
   * Ask to be moved onto a plan.
   *
   * Records the want — it does not move the plan, and the entitlement is
   * untouched until somebody grants it. Throws, unlike the read above: a
   * parent who pressed a button has to be told if it did not land.
   */
  async requestUpgrade(planId: string): Promise<UpgradeRequest | null> {
    const token = await accessToken();
    const body = await request<{ request: UpgradeRequest | null }>("/billing/upgrade", {
      method: "POST",
      token,
      body: { planId },
    });
    return body.request;
  },

  /** Withdraw the ask. */
  async cancelUpgrade(): Promise<void> {
    const token = await accessToken();
    await request("/billing/upgrade", { method: "DELETE", token });
  },
};

/** Money as a person writes it: 500 -> "$5". */
export const formatPrice = (cents: number, currency = "USD"): string => {
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return cents % 100 === 0 ? `${symbol}${cents / 100}` : `${symbol}${(cents / 100).toFixed(2)}`;
};
