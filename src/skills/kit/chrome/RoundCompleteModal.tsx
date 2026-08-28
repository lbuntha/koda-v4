import React, { useEffect } from "react";
import { Star, RotateCcw, ArrowRight, Trophy, Sparkles } from "lucide-react";
import { playSound } from "../../../utils/audio";

interface PracticeRoundCompleteModalProps {
  levelNumber: number;
  levelTitle: string;
  /** Stars earned, 1–3. */
  stars: number;
  xpWon: number;
  nextLevelNumber: number;
  onNextLevel: () => void;
  onPracticeAgain: () => void;
  /**
   * What the log says to do next, if anything.
   *
   * Optional so the modal still works with telemetry off. When present it
   * relabels the primary action: a child who has not secured the concept is
   * offered more practice, not the next level — the point of measuring is that
   * the measurement changes what happens.
   */
  recommendation?: { kind: string; kidMessage: string };
}

export const PracticeRoundCompleteModal: React.FC<PracticeRoundCompleteModalProps> = ({
  levelNumber,
  levelTitle,
  stars,
  xpWon,
  nextLevelNumber,
  onNextLevel,
  onPracticeAgain,
  recommendation,
}) => {
  // Play dynamic complete/cheer audio when this modal renders
  useEffect(() => {
    try {
      playSound("levelup");
    } catch (e) {
      console.warn("Audio feedback error:", e);
    }
  }, []);

  return (
    <div
      id="practice-round-complete-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        id="practice-round-complete-container"
        className="relative bg-slate-900 border-2 border-amber-500/30 rounded-[32px] max-w-md w-full p-8 text-center shadow-2xl space-y-6 overflow-hidden md:max-w-lg"
      >
        {/* Soft background ambient glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none" />

        {/* 1. Golden Trophy Badge with Soft Glow */}
        <div className="relative mx-auto flex items-center justify-center w-24 h-24">
          {/* Pulsing Outer Glow Ring */}
          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-pulse scale-110 filter blur-md" />
          
          {/* Main Gold Trophy Circle Backdrop */}
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-b from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_8px_30px_rgba(245,158,11,0.5)] border-2 border-amber-300">
            <Trophy className="w-10 h-10 text-slate-950 stroke-[2.5]" />
          </div>
        </div>

        {/* 2. Headline Information */}
        <div className="space-y-1">
          <span className="text-[11px] font-mono font-black text-amber-400 uppercase tracking-widest block">
            Round Complete
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Level {levelNumber} Mastered!
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            {levelTitle}
          </p>
        </div>

        {/*
          Stars earned, out of three.

          These were three hardcoded gold stars — true while counting awarded a
          flat three for finishing, and a lie the moment stars came from
          accuracy: a two-star round showed three. An unearned star stays in
          place, hollow, so a child can see what is still there to win.
        */}
        <div className="flex items-center justify-center gap-3 py-1">
          {[1, 2, 3].map((n) => {
            const earned = n <= stars;
            const big = n === 2;
            return (
              <Star
                key={n}
                aria-hidden="true"
                className={[
                  big ? "w-10 h-10" : "w-8 h-8",
                  earned
                    ? `text-amber-400 fill-amber-400 filter ${
                        big
                          ? "drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]"
                          : "drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                      } animate-bounce`
                    : "text-slate-700 fill-slate-800/60",
                  earned && n === 1 ? "delay-75" : "",
                  earned && n === 3 ? "delay-150" : "",
                ].join(" ")}
              />
            );
          })}
        </div>
        <span className="sr-only">{stars} out of 3 stars</span>

        {/* 4. Rewards Capsule Box */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-full px-6 py-3.5 flex items-center justify-between gap-4 max-w-xs mx-auto text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400 font-black">+{xpWon}</span>
            <span className="text-slate-200">⚡</span>
            <span className="text-cyan-400 font-bold uppercase tracking-wider">XP</span>
          </div>
        </div>

        {/* 5. What the log says to do next */}
        {recommendation && (
          <div className="flex items-start gap-2.5 text-left bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-3 max-w-xs mx-auto">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-200 font-medium leading-snug">
              {recommendation.kidMessage}
            </p>
          </div>
        )}

        {/* 6. Primary action — practise again when the concept is not secure */}
        <div className="space-y-3 pt-2">
          {recommendation?.kind === "practise" || recommendation?.kind === "review" ? (
            <button
              onClick={onPracticeAgain}
              className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-mono font-black text-sm tracking-wide shadow-lg hover:shadow-orange-500/20 active:scale-[0.98] transition-all transform flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 stroke-[3]" />
              <span>ONE MORE ROUND</span>
            </button>
          ) : (
            <button
              onClick={onNextLevel}
              className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-mono font-black text-sm tracking-wide shadow-lg hover:shadow-orange-500/20 active:scale-[0.98] transition-all transform flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>NEXT LEVEL ({nextLevelNumber})</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          )}

          {/* Secondary option: whichever action is not primary */}
          <button
            onClick={
              recommendation?.kind === "practise" || recommendation?.kind === "review"
                ? onNextLevel
                : onPracticeAgain
            }
            className="w-full py-3 rounded-full bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white font-mono font-bold text-xs transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 border border-slate-700/50 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {recommendation?.kind === "practise" || recommendation?.kind === "review"
                ? `Skip to Level ${nextLevelNumber}`
                : "Practice Again"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
