/**
 * Partial quotients — division you can do without knowing how to do division.
 *
 * Take away lots of the divisor you are sure about, keep a tally of how many
 * lots you took, and stop when there is not enough left for another one. The
 * tally is the answer and what is left is the remainder. It is the number line
 * of level 12 with bigger hops, and it is the honest bridge to long division:
 * every step of the algorithm is a chunk, chosen for you and written in a
 * particular place.
 *
 * Level 31 accepts any valid chunking, because a child who reaches 176 ÷ 8 in
 * twenty-two steps of one has still divided. Level 32 caps the steps, because
 * the skill worth having is *choosing a big chunk you are sure of*.
 */

import { drawQuotient, quotientKey, withoutRepeat, type QuotientSpec } from "./divisionNumbers";

export type ChunkMode =
  /** Any chunking that gets there. */
  | "chunks"
  /** Get there in a few big steps. */
  | "big_chunks";

export interface ChunkSetup {
  mode?: ChunkMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  divisorRange?: [number, number];
  quotientRange?: [number, number];
  totalMax?: number;
  /** The cap on steps, for the mode that caps them. */
  maxChunks?: number;
}

interface ModeDefaults {
  divisorRange: [number, number];
  quotientRange: [number, number];
  totalMax: number;
  maxChunks?: number;
}

const DEFAULTS: Record<ChunkMode, ModeDefaults> = {
  chunks: { divisorRange: [3, 12], quotientRange: [12, 99], totalMax: 999 },
  big_chunks: { divisorRange: [4, 25], quotientRange: [12, 140], totalMax: 3500, maxChunks: 3 },
};

/**
 * The multipliers offered as buttons.
 *
 * Powers of ten and their halves, because those are the multiplications a child
 * can do without thinking — ten lots and five lots of anything. Offering every
 * number from 1 to 50 would make choosing a chunk the hard part, and choosing is
 * supposed to be the easy part.
 */
export const CHUNK_STEPS: readonly number[] = [100, 50, 20, 10, 5, 2, 1] as const;

/** Which of them still fit into what is left. */
export const stepsThatFit = (remaining: number, divisor: number): number[] =>
  CHUNK_STEPS.filter((step) => step * divisor <= remaining);

export interface ChunkQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: ChunkMode;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  /** How many steps this lesson allows, if it caps them. */
  maxChunks?: number;
}

export function buildChunkQuestion(
  setup: ChunkSetup,
  mode: ChunkMode,
  index: number,
  seen?: Set<string>,
): ChunkQuestion {
  const fallback = DEFAULTS[mode];
  const spec: QuotientSpec = {
    divisorRange: setup.divisorRange ?? fallback.divisorRange,
    quotientRange: setup.quotientRange ?? fallback.quotientRange,
    dividendRange: [20, setup.totalMax ?? fallback.totalMax],
    remainder: "any",
  };

  const draw = () => drawQuotient(spec);
  const value = seen ? withoutRepeat(draw, quotientKey, seen) : draw();

  return {
    id: `division-${mode}-${index}-${value.dividend}-${value.divisor}`,
    taskKind: `division_${mode}`,
    prompt: `${value.dividend} ÷ ${value.divisor}`,
    expected: value.remainder === 0 ? String(value.quotient) : `${value.quotient} r ${value.remainder}`,
    itemCount: value.quotient,
    mode,
    dividend: value.dividend,
    divisor: value.divisor,
    quotient: value.quotient,
    remainder: value.remainder,
    maxChunks: setup.maxChunks ?? fallback.maxChunks,
  };
}

/** Why the chunking is not finished. */
export type ChunkBlock = "more-fits" | "too-many-steps" | "overshot" | null;

/**
 * Whether the child can stop.
 *
 * Stopping early is the error this engine exists to catch: a tally of 10 when 20
 * lots would have fitted is not a wrong answer to a different question, it is an
 * unfinished one, and the screen still holds the evidence.
 */
export function chunkBlockedBecause(
  question: ChunkQuestion,
  taken: readonly number[],
): ChunkBlock {
  const used = taken.reduce((a, b) => a + b, 0);
  const remaining = question.dividend - used * question.divisor;
  if (remaining < 0) return "overshot";
  if (remaining >= question.divisor) return "more-fits";
  if (question.maxChunks !== undefined && taken.length > question.maxChunks) return "too-many-steps";
  return null;
}

export const CHUNK_REFUSALS: Record<Exclude<ChunkBlock, null>, string> = {
  "more-fits": "Another whole one still fits. Keep taking them away.",
  "too-many-steps": "That works, but it took too many goes. Undo some and take bigger chunks.",
  overshot: "You have taken away more than there was. Undo the last one.",
};
