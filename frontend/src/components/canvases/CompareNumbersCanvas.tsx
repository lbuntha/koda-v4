/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Compare Numbers — two quantities side by side, and the symbol that relates them.
 *
 * 1.NBT.B.3 asks a child to compare two-digit numbers *using tens and ones*, not by reciting
 * which numeral looks bigger. So both numbers are drawn as base-ten rods and unit cubes: 42
 * is four rods and two cubes, 24 is two rods and four cubes, and the difference is visible
 * before it is symbolic. The child then taps >, < or =.
 *
 * CPA: concrete rods and cubes, pictorial columns of equal scale, abstract symbol.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { sounds } from "../../sound";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, CanvasAccent } from "./canvasTheme";
import type { CanvasProps } from "./types";

export type CompareSymbol = ">" | "<" | "=";

export interface CompareNumbersConfig {
  first: number;
  second: number;
}

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function normalizeCompareConfig(input: Partial<CompareNumbersConfig>): CompareNumbersConfig {
  return { first: clamp(input.first, 0, 99, 42), second: clamp(input.second, 0, 99, 24) };
}

export function compareAnswer(config: CompareNumbersConfig): CompareSymbol {
  if (config.first > config.second) return ">";
  if (config.first < config.second) return "<";
  return "=";
}

const SYMBOLS: CompareSymbol[] = ["<", "=", ">"];
const WORD: Record<CompareSymbol, string> = {
  ">": "is greater than",
  "<": "is less than",
  "=": "is equal to",
};

export const CompareNumbersCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  showGrid,
  onSuccess,
  onAttempt,
}) => {
  const config = useMemo(() => normalizeCompareConfig({
    first: question.config.compareFirst,
    second: question.config.compareSecond,
  }), [question.config.compareFirst, question.config.compareSecond]);

  const answer = compareAnswer(config);
  const [picked, setPicked] = useState<CompareSymbol | null>(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    setPicked(null);
    setSolved(false);
  }, [question.id, config.first, config.second]);

  const choose = (symbol: CompareSymbol) => {
    if (!isPlayMode || solved) return;
    setPicked(symbol);
    if (symbol !== answer) {
      sounds.playFail();
      onAttempt?.("incorrect", { expected: answer, selected: symbol, details: { ...config } });
      return;
    }
    sounds.playWin();
    setSolved(true);
    onAttempt?.("correct", { expected: answer, selected: symbol, details: { ...config } });
    onSuccess?.();
  };

  /** One number as base-ten rods and unit cubes, so the size is seen and not read. */
  const column = (value: number, label: string) => {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return (
      <div className="flex flex-col items-center gap-2">
        <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {label}
        </span>
        <div className="flex min-h-[132px] min-w-[116px] items-end justify-center gap-2 p-1">
          <div className="flex items-end gap-1" aria-label={`${tens} tens`}>
            {Array.from({ length: tens }).map((_, index) => (
              <span key={index} className={`h-24 w-3 rounded-sm ${isDark ? "bg-indigo-400/80" : "bg-indigo-500/80"}`} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-0.5" aria-label={`${ones} ones`}>
            {Array.from({ length: ones }).map((_, index) => (
              <span key={index} className={`h-2.5 w-2.5 rounded-[2px] ${isDark ? "bg-violet-300/90" : "bg-violet-500/90"}`} />
            ))}
          </div>
        </div>
        <span className={`font-mono text-2xl font-black ${isDark ? "text-slate-200" : "text-slate-800"}`}>{value}</span>
        <span className={`font-mono text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          {tens} ten{tens === 1 ? "" : "s"} \u00b7 {ones} one{ones === 1 ? "" : "s"}
        </span>
      </div>
    );
  };

  const accent: CanvasAccent = "indigo";

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={"Which sign belongs between them? Compare the tens first."}
      showGrid={showGrid}
      isDark={isDark}
      accent={accent}
      headerIcon={<Scale size={16} />}
      headerTitle="Compare Numbers"
      headerSubtitle={`${config.first} ? ${config.second}`}
      readAloudText={"Which sign belongs between them? Compare the tens first."}
      headerActions={
        <CanvasChip accent={solved ? "emerald" : accent} isDark={isDark}>
          {solved ? answer : "Pick one"}
        </CanvasChip>
      }
      footerStatus={solved ? `Spot on! ${config.first} ${WORD[answer]} ${config.second}.` : picked !== null ? "Not quite \u2014 count the tens first, then the ones." : undefined}
      footerSolved={solved}
    >
      {/* Open stage — each element brings its own outline, and a frame around a frame
          misrepresents what a child sees. */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-5 py-2">
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
          {column(config.first, "This one")}
          <span className={`font-mono text-4xl font-black ${
            solved ? "text-emerald-500" : isDark ? "text-slate-600" : "text-slate-300"
          }`}>
            {solved ? answer : "?"}
          </span>
          {column(config.second, "That one")}
        </div>

        <div className="flex items-center justify-center gap-3">
          {SYMBOLS.map(symbol => {
            const isPicked = picked === symbol;
            const isRight = solved && symbol === answer;
            return (
              <button
                key={symbol}
                type="button"
                disabled={!isPlayMode || solved}
                onClick={() => choose(symbol)}
                aria-label={`${config.first} ${WORD[symbol]} ${config.second}`}
                className={`h-14 w-16 rounded-2xl border font-mono text-2xl font-black transition-all duration-200 disabled:cursor-default ${
                  isRight
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    : isPicked
                      ? "border-rose-400 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                      : isDark
                        ? "border-white/10 bg-white/5 text-slate-200 hover:scale-105 hover:border-indigo-400/60"
                        : "border-slate-200/80 bg-white text-slate-700 shadow-sm hover:scale-105 hover:border-indigo-400/60"
                }`}
              >
                {symbol}
              </button>
            );
          })}
        </div>
      </div>
    </SharedCanvasLayout>
  );
};
