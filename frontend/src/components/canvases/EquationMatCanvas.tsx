/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Equation Mat — an equation with one quantity missing, solved by filling the gap.
 *
 * Every arithmetic canvas Koda had asks "what is 8 + 3?", because the graders derive the
 * answer *from* the operands. Nothing modelled `8 + ? = 11`, which is the whole of
 * 1.OA.D.8 and the doorway to every later grade's algebra — so this is that component.
 *
 * CPA, in one screen:
 *   Abstract   the equation itself, in the top banner, with the gap shown as a blank
 *   Pictorial  two framed groups whose sizes are the equation's terms; the unknown frame
 *              is dashed and empty, so the child can see what is missing
 *   Concrete   real counters inside the frames, countable one by one
 *
 * The unknown may be the result (8 + 3 = ?), the second term (8 + ? = 11), or the first
 * (? + 3 = 11). The last two are what make this an equation rather than a sum: the child
 * has to reason backwards, which is exactly the skill.
 *
 * `judge` hides nothing at all. Both sides are drawn in full and the child decides whether
 * the equation is true — including `5 + 2 = 3 + 4`, where the right-hand side is a sum too.
 * That is the other half of 1.OA.D.7 and the antidote to reading "=" as "and here comes the
 * answer": a child who only ever meets `a + b = ?` learns the equal sign as an instruction.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Equal } from "lucide-react";
import { CountingAsset } from "../Assets";
import { COUNT_OBJECTS } from "../../types";
import { sounds } from "../../sound";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, CanvasAccent } from "./canvasTheme";
import type { CanvasProps } from "./types";
import { balancedChoiceOrder } from "./choiceOrder";

type Operation = "add" | "subtract";
type Unknown = "result" | "first" | "second" | "judge";

export interface EquationMatConfig {
  operation: Operation;
  /** The true values. Whichever term is unknown is hidden from the child, never absent. */
  first: number;
  second: number;
  unknown: Unknown;
  /**
   * `judge` only: what the right-hand side claims. `claimSecond` of 0 means the
   * right side is a single number (`8 − 2 = 5`) rather than a sum (`5 + 2 = 3 + 4`).
   */
  claimFirst: number;
  claimSecond: number;
}

/** `judge` answers are a verdict, carried as a number so every grader stays numeric. */
export const JUDGE_TRUE = 1;
export const JUDGE_FALSE = 0;

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function normalizeEquationConfig(input: Partial<EquationMatConfig>): EquationMatConfig {
  const operation: Operation = input.operation === "subtract" ? "subtract" : "add";
  const first = clamp(input.first, 0, 20, 8);
  // Subtraction must not go below zero — a Grade 1 mat has no negative counters to show.
  const second = clamp(input.second, 0, operation === "subtract" ? first : 20 - first, Math.min(3, first));
  const unknown: Unknown =
    input.unknown === "first" || input.unknown === "second" || input.unknown === "judge"
      ? input.unknown
      : "result";
  // A claim is only meaningful for `judge`; anywhere else it would draw a fourth group
  // nobody asked for, so it is zeroed rather than carried around.
  const claimFirst = unknown === "judge" ? clamp(input.claimFirst, 0, 20, operation === "add" ? first + second : first - second) : 0;
  const claimSecond = unknown === "judge" ? clamp(input.claimSecond, 0, 20 - claimFirst, 0) : 0;
  return { operation, first, second, unknown, claimFirst, claimSecond };
}

/** What the right-hand side of a `judge` equation adds up to. */
export function equationClaim(config: EquationMatConfig): number {
  return config.claimFirst + config.claimSecond;
}

/** The number the child must supply. For `judge` that is the verdict, not a quantity. */
export function equationAnswer(config: EquationMatConfig): number {
  if (config.unknown === "judge") {
    return equationResult(config) === equationClaim(config) ? JUDGE_TRUE : JUDGE_FALSE;
  }
  if (config.unknown === "first") return config.first;
  if (config.unknown === "second") return config.second;
  return config.operation === "add" ? config.first + config.second : config.first - config.second;
}

export function equationResult(config: EquationMatConfig): number {
  return config.operation === "add" ? config.first + config.second : config.first - config.second;
}

/** Four tiles: the answer plus near misses, ordered, never duplicated. */
export function answerChoices(answer: number): number[] {
  const options = new Set<number>([answer]);
  for (const delta of [1, -1, 2, -2, 3]) {
    if (options.size >= 4) break;
    const candidate = answer + delta;
    if (candidate >= 0 && candidate <= 20) options.add(candidate);
  }
  return [...options].sort((a, b) => a - b);
}

/** The equation as written on screen — the abstract line in the header. */
export function equationText(config: EquationMatConfig, reveal = false): string {
  const sign = config.operation === "add" ? "+" : "−";
  if (config.unknown === "judge") {
    const right = config.claimSecond > 0 ? `${config.claimFirst} + ${config.claimSecond}` : `${config.claimFirst}`;
    return `${config.first} ${sign} ${config.second} = ${right}`;
  }
  const shown = (term: Unknown, value: number) =>
    config.unknown === term && !reveal ? "?" : String(value);
  return [
    shown("first", config.first),
    sign,
    shown("second", config.second),
    "=",
    shown("result", equationResult(config)),
  ].join(" ");
}

export const EquationMatCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  showGrid,
  onSuccess,
  onAttempt,
}) => {
  const config = useMemo(() => normalizeEquationConfig({
    operation: question.config.equationOperation,
    first: question.config.equationFirst,
    second: question.config.equationSecond,
    unknown: question.config.equationUnknown,
    claimFirst: question.config.equationClaimFirst,
    claimSecond: question.config.equationClaimSecond,
  }), [
    question.config.equationOperation,
    question.config.equationFirst,
    question.config.equationSecond,
    question.config.equationUnknown,
    question.config.equationClaimFirst,
    question.config.equationClaimSecond,
  ]);

  const answer = equationAnswer(config);
  const result = equationResult(config);
  const isJudge = config.unknown === "judge";
  const choices = useMemo(
    () => balancedChoiceOrder(
      isJudge ? [JUDGE_TRUE, JUDGE_FALSE] : answerChoices(answer),
      answer,
      question.config.answerChoiceSlot,
    ),
    [answer, isJudge, question.config.answerChoiceSlot],
  );
  const object = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];

  const [picked, setPicked] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    setPicked(null);
    setSolved(false);
  }, [question.id, config.operation, config.first, config.second, config.unknown, config.claimFirst, config.claimSecond]);

  const choose = (value: number) => {
    if (!isPlayMode || solved) return;
    setPicked(value);
    if (value !== answer) {
      sounds.playFail();
      onAttempt?.("incorrect", {
        expected: answer, selected: value,
        details: { operation: config.operation, unknown: config.unknown },
      });
      return;
    }
    sounds.playWin();
    setSolved(true);
    onAttempt?.("correct", {
      expected: answer, selected: value,
      details: { operation: config.operation, unknown: config.unknown },
    });
    onSuccess?.();
  };

  // ── Abstract: the equation, with the gap shown rather than hidden ────────────
  const equation = equationText(config, solved);

  /** One framed group. The unknown group is dashed and empty — the missing thing, visible. */
  const group = (label: string, count: number, hidden: boolean) => (
    <div className="flex flex-col items-center gap-2">
      <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        {label}
      </span>
      <div
        className={`flex min-h-[92px] min-w-[92px] flex-wrap items-center justify-center gap-1.5 rounded-3xl border-2 p-3 transition-colors duration-300 ${
          hidden
            ? `border-dashed ${isDark ? "border-indigo-400/60 bg-indigo-500/5" : "border-indigo-400/70 bg-indigo-50/60"}`
            : `${isDark ? "border-indigo-500/40 bg-slate-900/50" : "border-indigo-300/70 bg-white/80"}`
        }`}
      >
        {hidden ? (
          <span className={`font-mono text-3xl font-black ${isDark ? "text-indigo-300" : "text-indigo-500"}`}>?</span>
        ) : (
          Array.from({ length: count }).map((_, index) => (
            <span key={index} className="transition-transform duration-200 hover:scale-105">
              <CountingAsset type={object.assetType as any} emoji={object.emoji} size={26} />
            </span>
          ))
        )}
      </div>
      <span className={`font-mono text-sm font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}>
        {hidden && !solved ? "?" : count}
      </span>
    </div>
  );

  const accent: CanvasAccent = "indigo";

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={isJudge
        ? "Count both sides. Do they match? Tap True or False."
        : config.unknown === "result"
          ? "How many altogether? Tap the number."
          : "One group is hidden. Tap the number that makes the equation true."}
      showGrid={showGrid}
      isDark={isDark}
      accent={accent}
      headerIcon={<Equal size={16} />}
      headerTitle="Equation Mat"
      headerSubtitle={equation}
      readAloudText={isJudge ? `${equation}. Is this true or false?` : `${equation}. Find the missing number.`}
      headerActions={
        <CanvasChip accent={solved ? "emerald" : accent} isDark={isDark}>
          {solved
            ? isJudge ? (answer === JUDGE_TRUE ? "True" : "False") : `${answer}`
            : isJudge ? "True or false?" : "Find ?"}
        </CanvasChip>
      }
      footerStatus={
        solved
          ? isJudge
            ? answer === JUDGE_TRUE
              ? `Spot on! Both sides make ${result}, so the equation is true.`
              : `Spot on! One side makes ${result} and the other makes ${equationClaim(config)}, so it is false.`
            : `Spot on! ${config.first} ${config.operation === "add" ? "+" : "\u2212"} ${config.second} = ${result}`
          : picked !== null
            ? isJudge
              ? "Not quite \u2014 count each side on its own, then compare."
              : "Not quite \u2014 count the groups again and try another number."
            : undefined
      }
      footerSolved={solved}
    >
      {/* Open stage: the frames belong to the groups, not to the activity. */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-5 py-2">
        <div className="flex flex-wrap items-end justify-center gap-3 md:gap-5">
          {group("First", config.first, config.unknown === "first" && !solved)}
          <span className={`pb-8 font-mono text-2xl font-black ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {config.operation === "add" ? "+" : "\u2212"}
          </span>
          {group(config.operation === "add" ? "And" : "Take away", config.second, config.unknown === "second" && !solved)}
          <span className={`pb-8 font-mono text-2xl font-black ${isDark ? "text-slate-400" : "text-slate-500"}`}>=</span>
          {/* `judge` draws what the equation *claims*, which may itself be a sum. Drawing the
              true result there instead would make every equation look true. */}
          {isJudge ? (
            <>
              {group("Claim", config.claimFirst, false)}
              {config.claimSecond > 0 && (
                <>
                  <span className={`pb-8 font-mono text-2xl font-black ${isDark ? "text-slate-400" : "text-slate-500"}`}>+</span>
                  {group("And", config.claimSecond, false)}
                </>
              )}
            </>
          ) : (
            group("Altogether", result, config.unknown === "result" && !solved)
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {choices.map(choice => {
            const isPicked = picked === choice;
            const isRight = solved && choice === answer;
            const label = isJudge ? (choice === JUDGE_TRUE ? "True" : "False") : choice;
            return (
              <button
                key={choice}
                type="button"
                disabled={!isPlayMode || solved}
                onClick={() => choose(choice)}
                aria-label={`Answer ${label}`}
                className={`h-12 rounded-2xl border font-mono text-lg font-black transition-all duration-200 disabled:cursor-default ${
                  isJudge ? "min-w-[96px] px-4" : "w-12"
                } ${
                  isRight
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    : isPicked
                      ? "border-rose-400 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                      : isDark
                        ? "border-white/10 bg-white/5 text-slate-200 hover:scale-105 hover:border-indigo-400/60"
                        : "border-slate-200/80 bg-white text-slate-700 shadow-sm hover:scale-105 hover:border-indigo-400/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </SharedCanvasLayout>
  );
};
