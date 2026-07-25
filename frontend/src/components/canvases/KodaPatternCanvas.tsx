/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { CanvasProps } from "./types";
import { sounds } from "../../sound";
import { Sparkles, HelpCircle, Package } from "lucide-react";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip } from "./canvasTheme";

// Default Pattern Sequence: 🎈, 🍪, 🎈, 🍪, 🎈, ?
const DEFAULT_SEQUENCE = ["🎈", "🍪", "🎈", "🍪", "🎈", ""];
const DEFAULT_ANSWER = "🍪";
const DEFAULT_OPTIONS = ["🎈", "🍪", "🚗", "🦆"];

// A slot counts as a fillable gap when it's empty or an explicit placeholder.
const isBlankSlot = (v: string) => {
  const t = (v ?? "").trim();
  return t === "" || t === "?" || t === "_";
};

export const KodaPatternCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  onSuccess,
  onAttempt
}) => {
  const sequence = question.config.patternSequence ?? DEFAULT_SEQUENCE;
  const options = question.config.sudokuOptions ?? DEFAULT_OPTIONS;

  // Every blank slot in the sequence is a fillable gap, filled left-to-right.
  const blankIndices = React.useMemo(
    () => sequence.reduce<number[]>((acc, v, i) => (isBlankSlot(v) ? [...acc, i] : acc), []),
    [sequence]
  );

  // One answer per blank, in order. patternAnswers wins; fall back to the
  // legacy single patternAnswer, then to the default so old content still runs.
  const answers = React.useMemo<string[]>(() => {
    const fromArray = question.config.patternAnswers;
    if (fromArray && fromArray.length > 0) return fromArray;
    if (question.config.patternAnswer != null) return [question.config.patternAnswer];
    return blankIndices.length > 0 ? [DEFAULT_ANSWER] : [];
  }, [question.config.patternAnswers, question.config.patternAnswer, blankIndices.length]);

  // placed[i] is the emoji dropped into blank i (null = still empty).
  const [placed, setPlaced] = useState<(string | null)[]>(() => blankIndices.map(() => null));
  const [errorFlash, setErrorFlash] = useState<boolean>(false);

  useEffect(() => {
    setPlaced(blankIndices.map(() => null));
    setErrorFlash(false);
  }, [blankIndices, answers]);

  const activeIdx = placed.findIndex(p => p === null);
  const isSolved = blankIndices.length > 0 && activeIdx === -1;
  const filledCount = placed.filter(p => p !== null).length;

  const { showGhostGuide, reportActivity, triggerError } = useGhostGuide({
    isPlayMode,
    isSolved,
    idleThresholdMs: 10000
  });

  const handleSelectOption = (emoji: string) => {
    if (!isPlayMode || isSolved) return;
    reportActivity();

    const expected = answers[activeIdx];
    if (emoji === expected) {
      const next = [...placed];
      next[activeIdx] = emoji;
      setPlaced(next);
      setErrorFlash(false);
      sounds.playSuccess();
      // Only signal the slide complete once every blank is filled.
      if (next.every(p => p !== null)) {
        onAttempt?.("correct", { selected: next });
        onSuccess?.();
      }
    } else {
      sounds.playFailure();
      setErrorFlash(true);
      triggerError();
      // The diagnostic detail onSuccess alone can't carry: exactly which
      // wrong option a child picked vs. the answer they needed, and where.
      onAttempt?.("incorrect", { expected, selected: emoji, blankIndex: activeIdx });
      setTimeout(() => setErrorFlash(false), 800);
    }
  };

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      accent="purple"
      headerIcon={<Sparkles size={16} />}
      headerTitle="Pattern Completion Detective"
      readAloudText={question.instruction || "Examine the pattern sequence and complete the empty box."}
      headerActions={
        <CanvasChip accent={isSolved ? "emerald" : "purple"} isDark={isDark}>
          {isSolved
            ? "Pattern found"
            : blankIndices.length > 1
              ? `${filledCount} / ${blankIndices.length} filled`
              : "What comes next?"}
        </CanvasChip>
      }
      footerStatus={
        isSolved
          ? "Spot on! You found the repeating pattern!"
          : errorFlash
            ? "Oops! That doesn't fit the pattern — try again!"
            : undefined
      }
      footerSolved={isSolved}
    >
      {/* Center Pattern Display Stage Area - completely borderless/transparent/shadowless */}
      <div className="flex-1 w-full flex flex-col items-center justify-center gap-6 my-1 p-2 z-10 bg-transparent border-0 shadow-none">
        
        {/* Horizontal Sequence */}
        <div className={`flex items-center gap-3 p-4 rounded-3xl border shadow-sm max-w-full justify-center flex-wrap transition-colors ${
          isDark ? "bg-slate-800/90 border-slate-700 shadow-black/30" : "bg-white border-purple-200 shadow-sm"
        }`}>
          {sequence.map((emoji, index) => {
            const blankPos = blankIndices.indexOf(index);

            if (blankPos !== -1) {
              const filledValue = placed[blankPos];
              const isFilled = filledValue !== null;
              const isActive = blankPos === activeIdx;

              return (
                <div
                  key={`pattern-${index}`}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-bold select-none border-2 transition-all relative
                    ${isFilled
                      ? `bg-emerald-500 text-white border-emerald-400 shadow-lg ${isSolved ? "scale-105 animate-bounce" : ""}`
                      : isActive && errorFlash
                        ? "bg-red-500/20 border-red-500 text-red-500 animate-shake"
                        : isActive
                          ? (isDark ? "bg-slate-900/80 border-dashed border-purple-400/60 text-purple-400 shadow-inner animate-pulse" : "bg-purple-100/60 border-dashed border-purple-400 text-purple-600 shadow-inner animate-pulse")
                          : (isDark ? "bg-slate-900/50 border-dashed border-slate-600 text-slate-500 shadow-inner" : "bg-slate-100/70 border-dashed border-slate-300 text-slate-400 shadow-inner")
                    }
                  `}
                >
                  {isFilled
                    ? filledValue
                    : isActive
                      ? <HelpCircle size={24} className="animate-pulse opacity-70" />
                      : null}
                </div>
              );
            }

            return (
              <div
                key={`pattern-${index}`}
                className={`w-13 h-13 rounded-2xl flex items-center justify-center text-3xl select-none border shadow-sm transition-transform hover:scale-105 ${
                  isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200/90 text-slate-800"
                }`}
              >
                {emoji}
              </div>
            );
          })}
        </div>

        {/* Options Selection Box */}
        <div className="relative flex flex-col items-center gap-2">
          <GhostGuideOverlay
            show={showGhostGuide && !isSolved}
            label={"Look at the pattern — tap what comes next!"}
            isDark={isDark}
            labelPlacement="top"
          />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            Pick the Missing Item
          </span>
          <div className={`flex gap-2.5 p-3 rounded-2xl border shadow-md transition-colors flex-wrap justify-center ${
            isDark ? "bg-slate-800 border-purple-500/40" : "bg-white border-purple-200"
          }`}>
            {options.filter(emoji => emoji.trim() !== "").map(emoji => (
              <button
                key={`opt-${emoji}`}
                onClick={() => handleSelectOption(emoji)}
                disabled={isSolved}
                className={`w-12 h-12 rounded-xl text-3xl flex items-center justify-center transition-all cursor-pointer border-2 hover:scale-110 active:scale-95
                  ${isSolved
                    ? "opacity-40 cursor-not-allowed border-transparent"
                    : (isDark ? "bg-slate-900 hover:bg-slate-700 border-slate-700 hover:border-purple-400 text-slate-100 shadow-sm" : "bg-purple-50 hover:bg-purple-100 border-purple-200 hover:border-purple-300 text-slate-800 shadow-sm")
                  }
                `}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

      </div>
    </SharedCanvasLayout>
  );
};
