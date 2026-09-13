/**
 * Estimating a quotient, judging one, and checking one.
 *
 * Division does not round the way the other operations do. Addition rounds both
 * numbers to the nearest ten and adds; division has to round to numbers that
 * *divide* — `347 ÷ 6` estimates well as `360 ÷ 6 = 60` and badly as
 * `350 ÷ 6 = 58.3`, and 350 is the nearer number. So the divisor is left alone
 * and the dividend is moved to the closest multiple of it. That is a different
 * skill from `rounding-estimator`, which is why it gets its own concept key.
 */

import { digitsOf, pick, shuffle, type Quotient } from "./divisionNumbers";

export type EstimateMode =
  /** Move the total to a number the divisor goes into. */
  | "compatible"
  /** Is this claimed answer sensible? */
  | "reasonable"
  /** Multiply back and see if you get the total. */
  | "check_back";

export interface EstimateSetup {
  mode?: EstimateMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  divisorRange?: [number, number];
  totalMax?: number;
}

interface ModeDefaults {
  divisorRange: [number, number];
  totalMin: number;
  totalMax: number;
}

const DEFAULTS: Record<EstimateMode, ModeDefaults> = {
  compatible: { divisorRange: [3, 9], totalMin: 120, totalMax: 4000 },
  reasonable: { divisorRange: [3, 12], totalMin: 120, totalMax: 4000 },
  check_back: { divisorRange: [3, 12], totalMin: 60, totalMax: 900 },
};

/**
 * The nearest number below and above that the divisor goes into exactly.
 *
 * Both are offered, because "round to the nearest" is the wrong instinct here
 * and the right one is "pick whichever is easier to divide" — which is a
 * judgement, not a rule.
 */
export function compatibleNeighbours(dividend: number, divisor: number): [number, number] {
  const below = Math.floor(dividend / divisor) * divisor;
  const above = below + divisor;
  return [below, above];
}

/** The friendliest nearby total: a multiple of the divisor that is also round. */
export function friendliestTotal(dividend: number, divisor: number): number {
  const [below, above] = compatibleNeighbours(dividend, divisor);
  const roundness = (n: number): number => (n % 100 === 0 ? 2 : n % 10 === 0 ? 1 : 0);
  if (roundness(above) !== roundness(below)) return roundness(above) > roundness(below) ? above : below;
  return dividend - below <= above - dividend ? below : above;
}

/** How wrong a claim is, in the ways a child actually goes wrong. */
export type ClaimFault = "right" | "ten-times-too-big" | "ten-times-too-small" | "lost-a-zero";

export interface EstimateQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: EstimateMode;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  /** The two totals offered, for `compatible`. */
  neighbours?: [number, number];
  /** The estimate each neighbour gives. */
  estimates?: number[];
  /** The claim being judged, for `reasonable`. */
  claim?: number;
  fault?: ClaimFault;
  /** The rebuild offered, for `check_back`. */
  rebuilds?: string[];
}

/**
 * A claim that is wrong by a place, never by one.
 *
 * `736 ÷ 8 = 92` against `= 91` is a question about arithmetic. Against `= 920`
 * it is a question about size, which is what an estimate is for, and it is the
 * mistake that actually happens — a dropped zero in a written division, or a
 * digit written one column out.
 */
export function faultyClaim(value: Quotient): { claim: number; fault: ClaimFault } {
  const faults: ClaimFault[] = ["ten-times-too-big", "ten-times-too-small", "lost-a-zero"];
  const fault = pick(faults.filter((f) => f !== "lost-a-zero" || digitsOf(value.quotient).includes(0)));
  switch (fault) {
    case "ten-times-too-big":
      return { claim: value.quotient * 10, fault };
    case "ten-times-too-small":
      return { claim: Math.max(1, Math.floor(value.quotient / 10)), fault };
    default:
      return { claim: Number(String(value.quotient).replace("0", "")), fault };
  }
}

export function buildEstimateQuestion(
  setup: EstimateSetup,
  mode: EstimateMode,
  index: number,
): EstimateQuestion {
  const fallback = DEFAULTS[mode];
  const [lo, hi] = setup.divisorRange ?? fallback.divisorRange;
  const divisor = lo + Math.floor(Math.random() * (hi - lo + 1));
  const totalMax = setup.totalMax ?? fallback.totalMax;

  if (mode === "compatible") {
    /*
     * A total that is deliberately NOT already a multiple.
     *
     * A question whose dividend already divides has nothing to estimate — the
     * exact answer is right there — and a round of those teaches a child that
     * estimating is a thing you do to numbers that do not need it.
     */
    let dividend = fallback.totalMin;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      dividend = fallback.totalMin + Math.floor(Math.random() * (totalMax - fallback.totalMin));
      if (dividend % divisor !== 0) break;
    }
    const neighbours = compatibleNeighbours(dividend, divisor);
    return {
      id: `division-compatible-${index}-${dividend}-${divisor}`,
      taskKind: "division_compatible",
      prompt: `About how much is ${dividend} ÷ ${divisor}?`,
      expected: String(friendliestTotal(dividend, divisor) / divisor),
      itemCount: 2,
      mode,
      dividend,
      divisor,
      quotient: Math.floor(dividend / divisor),
      remainder: dividend % divisor,
      neighbours,
      estimates: neighbours.map((n) => n / divisor),
    };
  }

  if (mode === "reasonable") {
    const quotient = 12 + Math.floor(Math.random() * 90);
    const dividend = quotient * divisor;
    const honest = Math.random() < 0.4;
    const value: Quotient = { dividend, divisor, quotient, remainder: 0, meaning: "group" };
    const { claim, fault } = honest ? { claim: quotient, fault: "right" as ClaimFault } : faultyClaim(value);
    return {
      id: `division-reasonable-${index}-${dividend}-${divisor}`,
      taskKind: "division_reasonable",
      prompt: `Somebody says ${dividend} ÷ ${divisor} = ${claim}. Could that be right?`,
      expected: fault === "right" ? "yes" : "no",
      itemCount: 1,
      mode,
      dividend,
      divisor,
      quotient,
      remainder: 0,
      claim,
      fault,
    };
  }

  // check_back
  const quotient = 5 + Math.floor(Math.random() * 40);
  const remainder = Math.random() < 0.5 ? 0 : 1 + Math.floor(Math.random() * (divisor - 1));
  const dividend = quotient * divisor + remainder;
  const truth = remainder === 0
    ? `${quotient} × ${divisor} = ${dividend}`
    : `${quotient} × ${divisor} + ${remainder} = ${dividend}`;
  const wrong = [
    `${quotient} × ${divisor} = ${quotient * divisor + divisor}`,
    remainder === 0
      ? `${quotient} + ${divisor} = ${quotient + divisor}`
      : `${quotient} × ${divisor} = ${dividend}`,
    `${dividend} × ${divisor} = ${dividend * divisor}`,
  ];
  return {
    id: `division-check_back-${index}-${dividend}-${divisor}`,
    taskKind: "division_check_back",
    prompt:
      remainder === 0
        ? `${dividend} ÷ ${divisor} = ${quotient}. Which sum checks it?`
        : `${dividend} ÷ ${divisor} = ${quotient} r ${remainder}. Which sum checks it?`,
    expected: truth,
    itemCount: 1,
    mode,
    dividend,
    divisor,
    quotient,
    remainder,
    rebuilds: shuffle([truth, ...wrong]),
  };
}
