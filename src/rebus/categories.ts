/**
 * The categories a child picks from, and where each sits in Koda's shared topics.
 *
 * A category is data an owner manages in the Studio: an id (its address, never
 * changed), a name in each language, a colour, the Koda topic it files under, an
 * order and an on/off switch. The server sends the live list with the puzzles and
 * this device keeps it, so a category added today is on a child's tablet without
 * a release. Until the server has been heard from, the ones that shipped stand
 * in, so a fresh install offline still has topics to pick.
 *
 * Pure on purpose: the Node server bundles this file (to check a brief), and it
 * must not reach the browser-only code the language module sits on. The name a
 * viewer reads, which depends on their language, is in `categoryNames.ts`.
 */

export interface Category {
  id: string;
  /** The name in each language the owner has written; English is always there. */
  names: Readonly<Record<string, string>>;
  /** One of the six icon colours (`cyan`, `indigo`, `purple`, `pink`, `emerald`). */
  tone: string;
  /** Koda's shared topic (`lib/topics.ts`), so a Countries puzzle can sit beside a book about places. */
  topic: string;
  order: number;
  enabled: boolean;
}

export const BUILT_IN_CATEGORIES: readonly Category[] = [
  { id: "countries", names: { en: "Countries", km: "ប្រទេស" }, tone: "indigo", topic: "places", order: 0, enabled: true },
  { id: "food", names: { en: "Food", km: "អាហារ" }, tone: "pink", topic: "food", order: 1, enabled: true },
  { id: "sayings", names: { en: "Sayings", km: "ពាក្យពេចន៍" }, tone: "purple", topic: "words", order: 2, enabled: true },
  { id: "animals", names: { en: "Animals", km: "សត្វ" }, tone: "emerald", topic: "animals", order: 3, enabled: true },
  { id: "sports", names: { en: "Sports", km: "កីឡា" }, tone: "cyan", topic: "health", order: 4, enabled: true },
  { id: "school", names: { en: "School", km: "សាលា" }, tone: "indigo", topic: "school", order: 5, enabled: true },
  { id: "science", names: { en: "Science", km: "វិទ្យាសាស្ត្រ" }, tone: "cyan", topic: "nature", order: 6, enabled: true },
  { id: "khmer", names: { en: "Khmer words", km: "ពាក្យខ្មែរ" }, tone: "purple", topic: "words", order: 7, enabled: false },
  { id: "math", names: { en: "Math", km: "គណិតវិទ្យា" }, tone: "cyan", topic: "numbers", order: 8, enabled: true },
];

/** What this device currently knows. Replaced whenever the server's list arrives. */
let live: readonly Category[] = BUILT_IN_CATEGORIES;
const listeners = new Set<() => void>();

export const setCategories = (next: readonly Category[]): void => {
  live = next.length > 0 ? [...next].sort((a, b) => a.order - b.order) : BUILT_IN_CATEGORIES;
  listeners.forEach((fn) => fn());
};

/** The categories a child can pick, in the owner's order. Switched-off ones are never in it. */
export const categories = (): readonly Category[] => live.filter((c) => c.enabled);

export const subscribeCategories = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const categorySnapshot = (): readonly Category[] => live;

const ID = /^[a-z][a-z0-9-]{1,23}$/;
export const isCategoryId = (value: unknown): value is string => typeof value === "string" && ID.test(value);

/** Read the categories out of what came over the wire or out of storage; anything malformed is dropped. */
export const parseCategories = (raw: unknown): Category[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c): Category[] => {
    if (typeof c !== "object" || c === null) return [];
    const x = c as Record<string, unknown>;
    const names = typeof x.names === "object" && x.names !== null ? (x.names as Record<string, unknown>) : null;
    if (!isCategoryId(x.id) || !names || typeof names.en !== "string") return [];
    const clean = Object.fromEntries(Object.entries(names).filter(([, v]) => typeof v === "string" && v.trim() !== "")) as Record<string, string>;
    return [{ id: x.id, names: clean, tone: typeof x.tone === "string" ? x.tone : "indigo", topic: typeof x.topic === "string" ? x.topic : "logic", order: typeof x.order === "number" ? x.order : 0, enabled: x.enabled !== false }];
  });
};
