/**
 * The Studio's calls to the server.
 *
 * Staff only (`content:write`), so unlike the learner's list these are not
 * cached and not quiet: a failure is an error the person must see, because
 * a Studio action that silently did nothing would look like it worked.
 */

import { accessToken, request } from "../../lib/sync";
import { tutorHeaders } from "../../lib/tutorApi";
import { translate } from "../../lib/i18n";
import type { GenerationResult } from "../generate/pipeline";
import type { Piece, Puzzle } from "../types";

export type PuzzleStatus = "draft" | "approved" | "published" | "retired" | "rejected";

/** A puzzle as the Studio sees it: the puzzle, where it stands, and what is wrong with it. */
export interface StudioPuzzle extends Puzzle {
  status: PuzzleStatus;
  /** Created from the seed file. Kept only so a seed puzzle is never offered for deletion: it would come back. */
  seeded: boolean;
  note: string;
  /** Codes from the server's checks; empty means it can be approved. */
  issues: string[];
  /** For a model's draft: what the batch's own checks found (a blind solver's reading, and safety). */
  checks?: { blind?: { ok: boolean; said: string } | null; safe?: boolean } | null;
  updatedAt?: string;
  /** The release this puzzle went live in, for a live one. */
  release?: number | null;
  /** Who authored it, as an account name. */
  createdByName?: string | null;
}

export interface Overview {
  byStatus: Record<PuzzleStatus, number>;
  byCategory: Record<string, Record<PuzzleStatus, number>>;
  version: number;
}

export interface Release {
  number: number;
  note: string;
  puzzleIds: string[];
  by: string;
  /** The publisher as a person reads it. */
  byName?: string | null;
  at: string;
  rolledBack: boolean;
}

export interface SavedPrompt {
  version: number;
  text: string;
  by: string;
  at: string;
}

export interface PuzzleDraft {
  category: string;
  ages: [number, number];
  difficulty: number;
  trick: Puzzle["trick"];
  pieces: Piece[];
  answer: string;
  accepts: string[];
  explanation: string;
  /** Set only when a model drafted it. */
  source?: "official" | "ai";
  checks?: GenerationResult["puzzles"][number]["checks"];
  runId?: string;
  promptVersion?: number;
  model?: string;
  /** Approve in the same step, if every check passes. */
  approve?: boolean;
}

export interface ListQuery {
  status?: PuzzleStatus;
  category?: string;
  source?: string;
  /** Only puzzles that use this drawing (`rebus-honey`). */
  icon?: string;
  q?: string;
  skip?: number;
  limit?: number;
}

const call = async <T>(path: string, options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<T> =>
  request<T>(`/rebus/studio${path}`, { ...options, token: await accessToken(), timeoutMs: 20_000 });

const qs = (query: ListQuery): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  const text = params.toString();
  return text ? `?${text}` : "";
};

export const StudioAPI = {
  overview: () => call<Overview>("/overview"),
  list: (query: ListQuery) => call<{ puzzles: StudioPuzzle[]; total: number }>(`/puzzles${qs(query)}`),
  create: (draft: PuzzleDraft) => call<StudioPuzzle>("/puzzles", { method: "POST", body: draft }),
  edit: (id: string, draft: Partial<PuzzleDraft>) => call<StudioPuzzle>(`/puzzles/${encodeURIComponent(id)}`, { method: "PATCH", body: draft }),
  setStatus: (id: string, status: PuzzleStatus, note = "") => call<StudioPuzzle>(`/puzzles/${encodeURIComponent(id)}/status`, { method: "POST", body: { status, note } }),
  approveAll: (category?: string) => call<{ approved: number; skipped: number }>("/approve-all", { method: "POST", body: category ? { category } : {} }),
  remove: (id: string) => call<void>(`/puzzles/${encodeURIComponent(id)}`, { method: "DELETE" }),
  publish: (note: string) => call<Release & { version: number }>("/publish", { method: "POST", body: { note } }),
  releases: () => call<{ releases: Release[] }>("/releases"),
  rollback: (number: number) => call<Release>(`/releases/${number}/rollback`, { method: "POST" }),
  iconUsage: () => call<{ usage: Record<string, { count: number; answers: string[] }> }>("/icon-usage"),
  prompts: () => call<{ versions: SavedPrompt[]; latest: SavedPrompt | null }>("/prompt"),
  savePrompt: (text: string) => call<SavedPrompt>("/prompt", { method: "POST", body: { text } }),
};

export interface GenerateRequest {
  brief: { category: string; ages: [number, number]; difficulty: number; count: number; tricks: string[]; notes: string };
  provider?: string;
  /** For Claude: "sonnet" for quality, "haiku" for cheap bulk drafts. */
  model?: "sonnet" | "haiku";
  systemPrompt?: string;
}

export interface GenerateResponse extends GenerationResult {
  provider: string;
  model: string;
}

/** Ask a model to draft a batch. Goes through the Node server, which checks the caller and holds the keys. */
export const generatePuzzles = async (input: GenerateRequest): Promise<GenerateResponse> => {
  // Two model calls, each with its own deadline on the server; this one covers the pair.
  const res = await fetch("/api/rebus/generate", { method: "POST", headers: await tutorHeaders(), body: JSON.stringify(input), signal: AbortSignal.timeout(200_000) }).catch(() => {
    throw new Error(translate("rebus.studio.failed"));
  });
  const body = (await res.json().catch(() => null)) as (GenerateResponse & { error?: { message?: string } }) | null;
  if (!res.ok || !body?.puzzles) throw new Error(body?.error?.message ?? translate("rebus.studio.failed"));
  return body;
};
