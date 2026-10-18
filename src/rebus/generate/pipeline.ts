/**
 * From a brief to checked candidates.
 *
 * Five stages, each of which can only remove or flag, never improve: draft
 * (the model), shape (the same rules as a puzzle a person typed), blind solve
 * (a second call sees only the pictures and must name the answer), duplicates
 * (against everything already in the bank and the rest of this batch), and a
 * short list of words that never belong in a children's puzzle. The model is
 * handed a closed list of drawings and cannot add one.
 *
 * `ask` is the model, passed in, so the whole pipeline runs in a test with a
 * fake and in the server with a real one.
 */

import { matchAnswer } from "../answer";
import { ICON_ART, ICON_IDS } from "../icons/library";
import { answerKey, validatePuzzle } from "../puzzle";
import type { Puzzle } from "../types";
import { buildBrief, buildSolverQuestion, DEFAULT_SYSTEM_PROMPT, extractJson, parseCandidates, SOLVER_SYSTEM, type Brief, type Candidate } from "./prompt";

export type Ask = (system: string, user: string) => Promise<string>;

export interface GeneratedPuzzle {
  /** The puzzle, ready to save as a draft. */
  draft: {
    category: Brief["category"];
    ages: Brief["ages"];
    difficulty: number;
    trick: Candidate["trick"];
    pieces: Candidate["pieces"];
    answer: string;
    accepts: string[];
    explanation: string;
  };
  /** The model's own words for a drawing it wanted and does not exist. */
  missingIcons: string[];
  checks: {
    /** The codes from `validatePuzzle`, plus "duplicate". Empty means it can be approved. */
    issues: string[];
    /** What a solver who saw only the pictures said, and whether that is the answer. */
    blind: { ok: boolean; said: string } | null;
    safe: boolean;
  };
}

export interface GenerationResult {
  puzzles: GeneratedPuzzle[];
  stats: { drafted: number; valid: number; solved: number; duplicates: number; needIcons: number; unsafe: number };
}

/** Words that never belong in a puzzle for children. Deliberately short: the model is told too, this is the net. */
const NEVER = ["sex", "porn", "nude", "naked", "kill", "murder", "suicide", "drug", "cocaine", "heroin", "alcohol", "beer", "wine", "vodka", "gun", "rape", "damn", "hell", "shit", "fuck", "bitch", "bastard", "cock", "dick", "pussy"];

const isSafe = (c: Candidate): boolean => {
  const words = [c.answer, ...c.accepts, c.explanation, ...c.pieces.flatMap((p) => (p.kind === "icon" ? [p.name] : p.kind === "word" ? [p.text] : p.kind === "stack" ? [p.top, p.bottom] : []))]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z]+/);
  return !words.some((w) => NEVER.includes(w));
};

export interface GenerateOptions {
  brief: Brief;
  /** The Studio's current system prompt; the default when none has been saved. */
  systemPrompt?: string;
  /** Every answer already in the bank, so none is written twice. */
  existingAnswers: readonly string[];
}

export const generate = async (ask: Ask, { brief, systemPrompt, existingAnswers }: GenerateOptions): Promise<GenerationResult> => {
  const iconNames = Object.keys(ICON_ART).sort();

  // 1. Draft.
  const candidates = parseCandidates(await ask(systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT, buildBrief(brief, iconNames, existingAnswers)));

  // 2–5 need only the candidates; the blind solve is one call for the whole batch.
  const taken = new Set(existingAnswers.map((a) => answerKey({ answer: a })));
  const solved = await blindSolve(ask, candidates);

  const puzzles: GeneratedPuzzle[] = candidates.map((c, i) => {
    const draft = { category: brief.category, ages: brief.ages, difficulty: brief.difficulty, trick: c.trick, pieces: c.pieces, answer: c.answer, accepts: c.accepts, explanation: c.explanation };
    const issues = validatePuzzle({ ...draft, id: "candidate", difficulty: brief.difficulty as Puzzle["difficulty"], source: "ai" }, { iconIds: ICON_IDS }).map((x) => x.code) as string[];
    const key = answerKey(draft);
    if (taken.has(key)) issues.push("duplicate");
    taken.add(key);
    const said = solved[i];
    return {
      draft,
      missingIcons: c.missingIcons,
      checks: { issues, blind: said === undefined ? null : { ok: matchAnswer(draft, said).ok, said }, safe: isSafe(c) },
    };
  });

  return {
    puzzles,
    stats: {
      drafted: puzzles.length,
      valid: puzzles.filter((p) => p.checks.issues.filter((c) => c !== "duplicate" && c !== "unknown-icon").length === 0).length,
      solved: puzzles.filter((p) => p.checks.blind?.ok).length,
      duplicates: puzzles.filter((p) => p.checks.issues.includes("duplicate")).length,
      needIcons: puzzles.filter((p) => p.checks.issues.includes("unknown-icon")).length,
      unsafe: puzzles.filter((p) => !p.checks.safe).length,
    },
  };
};

/** One call: the solver sees only the pictures, never the intended answers. Returns what it said, by position. */
export const blindSolve = async (ask: Ask, candidates: readonly Candidate[]): Promise<Record<number, string>> => {
  if (candidates.length === 0) return {};
  try {
    const raw = extractJson(await ask(SOLVER_SYSTEM, buildSolverQuestion(candidates)));
    const out: Record<number, string> = {};
    if (typeof raw === "object" && raw !== null) {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const i = Number(k) - 1;
        if (Number.isInteger(i) && i >= 0 && i < candidates.length && typeof v === "string") out[i] = v;
      }
    }
    return out;
  } catch {
    // A solver that failed is no proof either way: the puzzle goes to a person unchecked.
    return {};
  }
};
