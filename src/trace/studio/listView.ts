/**
 * One page of a studio list, searched and sorted — as plain data.
 *
 * Trace keeps every draft on the device (it must be editable offline), so the
 * list is filtered here rather than on the server. What has to stay cheap is
 * the *drawing*: only one page of cards is ever rendered, however many items an
 * author has.
 */

export interface PageOf<T> {
  rows: T[];
  total: number;
  page: number;
  pages: number;
}

/** `page` is clamped, so a page emptied by a delete shows the new last page. */
export function pageOf<T>(all: readonly T[], page: number, size: number): PageOf<T> {
  const pages = Math.max(1, Math.ceil(all.length / size));
  const at = Math.min(Math.max(1, page), pages);
  return { rows: all.slice((at - 1) * size, at * size), total: all.length, page: at, pages };
}

/** Case- and accent-insensitive, so "Ka" finds "ka" and a Khmer search matches Khmer. */
export const matches = (text: string, q: string): boolean =>
  !q.trim() || text.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase());

export type ListSort = "recent" | "title";

export function sortBy<T>(rows: readonly T[], sort: ListSort, title: (r: T) => string, updated: (r: T) => number): T[] {
  return [...rows].sort(sort === "title" ? (a, b) => title(a).localeCompare(title(b)) : (a, b) => updated(b) - updated(a));
}

/** Where a collection stands, in the order the list filters by. */
export type CollectionStatus = "pending" | "rejected" | "draft" | "changed" | "published";
export const COLLECTION_STATUSES: readonly CollectionStatus[] = ["draft", "changed", "published", "pending", "rejected"];

export function collectionStatus(c: { reviewState?: "pending" | "rejected" | null; publishedRev: number | null; changed: boolean }): CollectionStatus {
  if (c.reviewState === "pending" || c.reviewState === "rejected") return c.reviewState;
  if (c.publishedRev === null) return "draft";
  return c.changed ? "changed" : "published";
}

/** Item id → how many collections hold it. An item missing from the map is in none. */
export function usage(collections: readonly { itemIds: readonly string[] }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of collections) for (const id of new Set(c.itemIds)) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}
