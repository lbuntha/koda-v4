/**
 * Talking to the server about books.
 *
 * Two different servers, deliberately: books live in the data API (`/v1/library`,
 * through `request`), and the AI drafter lives in the Node process that holds the
 * model keys (`/api/library/draft`). The browser never sees a key and never
 * decides who may publish — both servers check.
 */

import { request } from "../lib/sync";
import { accessToken } from "../lib/sync/session";
import { tutorHeaders } from "../lib/tutorApi";
import type { Band, Language, Passage, QuestionCounts } from "./data/passage";

/** How long a shelf refresh may take before the device plays what it already has. */
export const BOOKS_DEADLINE_MS = 4_000;

export type Provider = "gemini" | "chatgpt" | "claude";

export interface BookRow {
  id: string;
  rev: number;
  title: string;
  language: Language;
  band: Band;
  questionCounts: QuestionCounts;
  category?: string | null;
  status: "draft" | "published";
  draft: Omit<Passage, "rev"> | null;
  published: Passage | null;
  confirmedSplit: boolean;
  provider?: string | null;
}

const token = async () => (await accessToken()) ?? null;

export async function fetchPublished(): Promise<Passage[]> {
  const body = await request<{ books: Passage[] }>("/library/books", { token: await token(), timeoutMs: BOOKS_DEADLINE_MS });
  return body.books;
}

/** A row of the studio list: what an author scans for. The story itself loads with `fetchDraft`. */
export interface BookSummary {
  id: string;
  rev: number;
  title: string;
  language: Language;
  band: Band;
  category?: string | null;
  picture: string;
  status: "draft" | "published";
  /** Saved since it was published: children still read the older revision. */
  changed: boolean;
  reports: number;
  sentences: number;
  questions: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
}

export type StudioStatus = "draft" | "published" | "changed" | "reported";

export interface StudioQuery {
  q?: string;
  status?: StudioStatus | "";
  language?: string;
  band?: string;
  category?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface FacetOption { value: string; count: number }

export interface StudioPage {
  books: BookSummary[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  stats: Record<"all" | StudioStatus, number>;
  facets: { languages: FacetOption[]; bands: FacetOption[]; categories: FacetOption[] };
}

/** The choices the server accepts — categories, sorts, page sizes — so no screen keeps its own list. */
export interface StudioMeta {
  categories: string[];
  sorts: string[];
  statuses: StudioStatus[];
  pageSizeMin: number;
  pageSizeMax: number;
}

export async function fetchStudioBooks(query: StudioQuery, signal?: AbortSignal): Promise<StudioPage> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  return request<StudioPage>(`/library/drafts?${params}`, { token: await token(), signal });
}

export async function fetchDraft(id: string): Promise<BookRow> {
  return request<BookRow>(`/library/drafts/${encodeURIComponent(id)}`, { token: await token() });
}

export async function fetchStudioMeta(): Promise<StudioMeta> {
  return request<StudioMeta>("/library/studio/meta", { token: await token() });
}

/** Every spelling unit the books ask children to spell, across all of them. */
export async function fetchSpellingUnitsInUse(language: Language = "km"): Promise<string[]> {
  return (await request<{ units: string[] }>(`/library/studio/spelling-units?language=${language}`, { token: await token() })).units;
}

export async function saveDraft(id: string, passage: Omit<Passage, "id" | "rev">, confirmedSplit: boolean, provider?: string): Promise<BookRow> {
  return request<BookRow>(`/library/drafts/${encodeURIComponent(id)}`, {
    method: "PUT",
    token: await token(),
    body: { passage, confirmedSplit, provider },
  });
}

export async function publishBook(id: string): Promise<BookRow> {
  return request<BookRow>(`/library/drafts/${encodeURIComponent(id)}/publish`, { method: "POST", token: await token() });
}

export async function unpublishBook(id: string): Promise<BookRow> {
  return request<BookRow>(`/library/drafts/${encodeURIComponent(id)}/unpublish`, { method: "POST", token: await token() });
}

export async function deleteBook(id: string): Promise<void> {
  await request<void>(`/library/drafts/${encodeURIComponent(id)}`, { method: "DELETE", token: await token() });
}

/** What the model is asked to return. Untrusted until `fromModel` has been through it. */
export interface ModelDraft {
  understand?: unknown;
  words?: unknown;
  spell?: unknown;
}

export async function requestAiDraft(input: {
  provider?: Provider;
  language: Language;
  band: Band;
  questionCounts: QuestionCounts;
  sentences: string[];
  pictures: string[];
  easyWords?: string[];
}): Promise<{ draft: ModelDraft; provider: string }> {
  const res = await fetch("/api/library/draft", { method: "POST", headers: await tutorHeaders(), body: JSON.stringify(input) });
  const body = (await res.json().catch(() => null)) as { draft?: ModelDraft; provider?: string; error?: { message?: string } } | null;
  if (!res.ok || !body?.draft) throw new Error(body?.error?.message ?? "The drafter could not be reached.");
  return { draft: body.draft, provider: body.provider ?? input.provider ?? "gemini" };
}

export async function requestAiCorrection(input: {
  provider?: Provider;
  language: Language;
  band: Band;
  sentences: string[];
  question: unknown;
  checks: Array<{ message: string; status: string }>;
  easyWords?: string[];
}): Promise<{ question: unknown; explanation: string; provider: string }> {
  const res = await fetch("/api/library/correct-question", { method: "POST", headers: await tutorHeaders(), body: JSON.stringify(input) });
  const body = (await res.json().catch(() => null)) as { question?: unknown; explanation?: string; provider?: string; error?: { message?: string } } | null;
  if (!res.ok || !body?.question) throw new Error(body?.error?.message ?? "The question could not be corrected.");
  return { question: body.question, explanation: body.explanation ?? "The AI suggested a corrected question.", provider: body.provider ?? input.provider ?? "gemini" };
}

export type ReportReason = "wrong_in_story" | "wrong_question" | "not_for_children" | "other";
export interface BookReport { id: string; bookId: string; rev: number; reason: ReportReason; note: string }

/** A reader says a book is wrong. Any signed-in account; authors read it in the studio. */
export async function reportBook(bookId: string, rev: number, reason: ReportReason, note: string): Promise<void> {
  await request(`/library/books/${encodeURIComponent(bookId)}/reports`, { method: "POST", token: await token(), body: { rev, reason, note } });
}

export async function fetchReports(bookId?: string): Promise<BookReport[]> {
  const q = bookId ? `?bookId=${encodeURIComponent(bookId)}` : "";
  return (await request<{ reports: BookReport[] }>(`/library/reports${q}`, { token: await token() })).reports;
}

export async function resolveReport(id: string): Promise<void> {
  await request(`/library/reports/${encodeURIComponent(id)}/resolve`, { method: "POST", token: await token() });
}
