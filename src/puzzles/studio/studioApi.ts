/** The Puzzle Studio's calls to the server. Staff only, never cached, never quiet: a failed action must be seen. */

import { accessToken, request } from "../../lib/sync";
import type { PuzzleCategory, PuzzleLang, PuzzleStatus } from "../types";

export interface StudioWord {
  id: string;
  kind: "word-guess";
  lang: PuzzleLang;
  level: number;
  status: PuzzleStatus;
  owner: "koda" | "creator";
  seeded?: boolean;
  data: { word: string; tiles: string[]; category: PuzzleCategory; clue: { km: string; en: string } };
  issues: string[];
  createdByName?: string;
  updatedAt?: string;
}

export interface Line {
  slot: string;
  lang: PuzzleLang;
  level: number;
  byStatus: Partial<Record<PuzzleStatus, number>>;
  newDaysLeft: number;
}

export interface Overview {
  lines: Line[];
  today: string;
  canRun: boolean;
}

export interface CalendarDay {
  day: string;
  puzzleId: string;
  pinned: boolean;
  puzzle: StudioWord | null;
}

export interface WordIn {
  lang: PuzzleLang;
  word: string;
  category: PuzzleCategory;
  clue: { km: string; en: string };
}

const call = async <T>(path: string, options: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {}): Promise<T> =>
  request<T>(`/daily-puzzles/studio${path}`, { ...options, token: await accessToken(), timeoutMs: 20_000 });

const qs = (q: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const PuzzleStudioAPI = {
  overview: () => call<Overview>("/overview"),
  list: (q: { lang?: string; level?: number; status?: string; q?: string }) => call<{ puzzles: StudioWord[]; total: number }>(`/puzzles${qs({ ...q, limit: 200 })}`),
  create: (body: WordIn) => call<StudioWord>("/puzzles", { method: "POST", body }),
  edit: (id: string, body: Partial<Omit<WordIn, "lang">>) => call<StudioWord>(`/puzzles/${id}`, { method: "PATCH", body }),
  status: (id: string, status: PuzzleStatus) => call<StudioWord>(`/puzzles/${id}/status`, { method: "POST", body: { status } }),
  remove: (id: string) => call<void>(`/puzzles/${id}`, { method: "DELETE" }),
  calendar: (slot: string, days = 28) => call<{ days: CalendarDay[]; today: string; newDaysLeft: number }>(`/calendar${qs({ slot, days })}`),
  pin: (slot: string, day: string, puzzleId: string | null) => call<{ ok: boolean }>(`/calendar/${slot}/${day}`, { method: "PUT", body: { puzzleId } }),
};
