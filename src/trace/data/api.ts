/**
 * Koda Trace on the server: published collections for every device, and the
 * Studio's items and collections for people with the Trace Studio permission.
 */

import { request } from "../../lib/sync";
import { accessToken } from "../../lib/sync/session";
import type { TraceItem } from "../geometry/types";
import type { StepPlan } from "../progress/ladder";
import type { TraceDraft } from "../studio/drafts";

/** Shelves must appear even on a slow line: past this, the device plays what it has. */
export const SHELF_DEADLINE_MS = 4_000;

const token = async () => (await accessToken()) ?? null;
const enc = encodeURIComponent;

export interface CollectionSummary {
  id: string;
  rev: number;
  title: string;
  description: string;
  language: string;
  count: number;
  cover: TraceItem | null;
  /** A cover picture made for it (art-library name or photo key); the cover item draws it when absent. */
  picture?: string | null;
}

export interface CollectionBundle {
  id: string;
  rev: number;
  title: string;
  description: string;
  language: string;
  items: { item: TraceItem; plan: StepPlan }[];
  /** A cover picture made for it (art-library name or photo key); the cover item draws it when absent. */
  picture?: string | null;
  /** What passing one step pays at three stars; the app's XP per level when absent. */
  xpPerStep?: number | null;
  publishedAt: string;
}

export interface StudioCollection {
  id: string;
  title: string;
  description: string;
  language: string;
  itemIds: string[];
  order: number;
  cover: string | null;
  /** A cover picture made for it (art-library name or photo key); null draws the cover item. */
  picture?: string | null;
  /** What passing one step pays at three stars; null uses the app's XP per level. */
  xpPerStep?: number | null;
  rev: number;
  publishedRev: number | null;
  publishedAt: string | null;
  updatedAt: string;
  changed: boolean;
  ownerId?: string | null;
  /** A creator's publish waiting for an admin, or sent back with a note. */
  reviewState?: "pending" | "rejected" | null;
  reviewNote?: string;
}

export interface StudioItemRow extends Pick<TraceDraft, "item" | "plan" | "tests"> {
  id: string;
  updatedAt: string;
}

export interface Problem {
  item: string;
  title: string;
  problems: string[];
}

/* ---------------------------------------------------- learners */

export async function fetchShelf(): Promise<CollectionSummary[]> {
  return (await request<{ collections: CollectionSummary[] }>("/trace/collections", { token: await token(), timeoutMs: SHELF_DEADLINE_MS })).collections;
}

export async function fetchBundle(id: string): Promise<CollectionBundle> {
  return request<CollectionBundle>(`/trace/collections/${enc(id)}`, { token: await token(), timeoutMs: 10_000 });
}

/* ---------------------------------------------------- studio */

export async function fetchStudioItems(): Promise<StudioItemRow[]> {
  return (await request<{ items: StudioItemRow[] }>("/trace/studio/items", { token: await token() })).items;
}

export async function saveStudioItem(d: TraceDraft): Promise<StudioItemRow> {
  return request<StudioItemRow>(`/trace/studio/items/${enc(d.item.id)}`, {
    method: "PUT",
    token: await token(),
    body: { item: d.item, plan: d.plan, tests: d.tests },
  });
}

export async function deleteStudioItem(id: string): Promise<void> {
  await request<void>(`/trace/studio/items/${enc(id)}`, { method: "DELETE", token: await token() });
}

export async function fetchStudioCollections(): Promise<StudioCollection[]> {
  return (await request<{ collections: StudioCollection[] }>("/trace/studio/collections", { token: await token() })).collections;
}

export async function saveStudioCollection(
  c: Pick<StudioCollection, "id" | "title" | "description" | "language" | "itemIds" | "order"> & { cover?: string | null; picture?: string | null; xpPerStep?: number | null },
): Promise<StudioCollection> {
  return request<StudioCollection>(`/trace/studio/collections/${enc(c.id)}`, {
    method: "PUT",
    token: await token(),
    body: { title: c.title, description: c.description, language: c.language, itemIds: c.itemIds, order: c.order, cover: c.cover ?? null, picture: c.picture ?? null, xpPerStep: c.xpPerStep ?? null },
  });
}

export async function checkStudioCollection(id: string): Promise<Problem[]> {
  return (await request<{ problems: Problem[] }>(`/trace/studio/collections/${enc(id)}/check`, { method: "POST", token: await token() })).problems;
}

export async function publishStudioCollection(id: string): Promise<StudioCollection> {
  return request<StudioCollection>(`/trace/studio/collections/${enc(id)}/publish`, { method: "POST", token: await token() });
}

export async function unpublishStudioCollection(id: string): Promise<StudioCollection> {
  return request<StudioCollection>(`/trace/studio/collections/${enc(id)}/unpublish`, { method: "POST", token: await token() });
}

export async function deleteStudioCollection(id: string): Promise<void> {
  await request<void>(`/trace/studio/collections/${enc(id)}`, { method: "DELETE", token: await token() });
}

/* ---------------------------------------------------- reports */

export type ReportReason = "strokes_wrong" | "too_hard" | "not_for_children" | "other";

export interface ReportIn {
  itemId: string;
  collectionId?: string;
  rev?: number;
  reason: ReportReason;
  note: string;
}

export interface Report extends ReportIn {
  id: string;
  createdAt: string;
}

export async function sendReport(r: ReportIn): Promise<void> {
  await request<{ id: string }>("/trace/reports", { method: "POST", token: await token(), body: r, timeoutMs: SHELF_DEADLINE_MS });
}

export async function fetchReports(): Promise<Report[]> {
  return (await request<{ reports: Report[] }>("/trace/studio/reports", { token: await token() })).reports;
}

export async function resolveReport(id: string): Promise<void> {
  await request<void>(`/trace/studio/reports/${enc(id)}/resolve`, { method: "POST", token: await token() });
}

/* ---------------------------------------------------- parents */

export interface ChildTraceItem {
  itemId: string;
  title: string;
  collection: string;
  kind: string;
  status: "learning" | "canDo" | "learned" | "needsPractice";
  step: string;
  dueAt: number | null;
  attempts: number;
  topFault: string | null;
  updatedAt: number;
}

export async function fetchChildTrace(learnerId: string, signal?: AbortSignal): Promise<ChildTraceItem[]> {
  return (await request<{ items: ChildTraceItem[] }>(`/trace/learners/${enc(learnerId)}`, { token: await token(), signal })).items;
}

export interface ItemStats {
  learners: number;
  canDo: number;
  attempts: number;
  topFault: string | null;
}

export async function fetchItemStats(): Promise<Record<string, ItemStats>> {
  return request<Record<string, ItemStats>>("/trace/studio/stats", { token: await token() });
}

/* ---------------------------------------------------- review (admins) */

export interface PendingCollection extends StudioCollection {
  pending: { title: string; items: { item: TraceItem; plan: StepPlan }[] };
}

export async function fetchReviewQueue(): Promise<PendingCollection[]> {
  return (await request<{ collections: PendingCollection[] }>("/trace/studio/review", { token: await token() })).collections;
}

export async function approveCollection(id: string): Promise<StudioCollection> {
  return request<StudioCollection>(`/trace/studio/review/${enc(id)}/approve`, { method: "POST", token: await token() });
}

export async function rejectCollection(id: string, note: string): Promise<StudioCollection> {
  return request<StudioCollection>(`/trace/studio/review/${enc(id)}/reject`, { method: "POST", token: await token(), body: { note } });
}
