import React, { useEffect } from "react";
import { Star, RotateCcw, ArrowRight, Trophy, Sparkles, Flame, Zap, Target } from "lucide-react";
import { playSound } from "../../../utils/audio";
import { levelBar, roundPraise, type PraiseFacts } from "../round/roundPraise";

interface PracticeRoundCompleteModalProps {
  levelNumber: number;
  levelTitle: string;
  /** How many lessons the course has, so the position reads as "3 of 15". */
  totalLessons?: number;
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
  /**
   * Where this round left the learner: lifetime XP, streak, today's count.
   *
   * Optional, and everything below degrades to what it drew before when it is
   * absent — a preview, or a mount with telemetry off, still gets a complete
   * screen rather than a row of zeroes claiming a broken streak.
   */
  standing?: {
    xpAfter: number;
    streakDays: number;
    cadence?: "daily" | "weekly";
    dailySolved: number;
    dailyGoal: number;
  };
  /** Every question right first time. Earns its own headline. */
  perfect?: boolean;
}

export const PracticeRoundCompleteModal: React.FC<PracticeRoundCompleteModalProps> = ({
  levelNumber,
  levelTitle,
  totalLessons,
  stars,
  xpWon,
  nextLevelNumber,
  onNextLevel,
  onPracticeAgain,
  recommendation,
  standing,
  perfect = false,
}) => {
  /*
   * What this round is congratulated for.
   *
   * The rule lives in `roundPraise` rather than here: which achievement wins is
   * a decision about what a child is told, and it is worth being able to test
   * that "the round that made Level 5" beats "a perfect round" without mounting
   * a modal to find out.
   */
  const facts: PraiseFacts = {
    stars: (stars as 1 | 2 | 3) ?? 1,
    perfect,
    xpWon,
    xpAfter: standing?.xpAfter ?? 0,
    streakDays: standing?.streakDays ?? 0,
    cadence: standing?.cadence,
    dailySolved: standing?.dailySolved ?? 0,
    dailyGoal: standing?.dailyGoal ?? 0,
  };
  const praise = roundPraise(facts);
  const bar = standing ? levelBar(standing.xpAfter) : null;
  const streak = standing?.streakDays ?? 0;
  const unit = standing?.cadence === "weekly" ? "week" : "day";

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
        /*
         * Scrolls rather than clips.
         *
         * The card grew when the streak, the goal and the level bar joined
         * the XP, and on a short viewport — a laptop with the browser
         * chrome up, a phone in landscape — the trophy was cut off the top
         * and the buttons fell off the bottom. `items-center` centres a box
         * taller than its parent by hanging it off both ends, so the fix is
         * a ceiling and somewhere for the overflow to go, not a shorter
         * screen: every line here is something a child earned.
         */
        className="relative bg-slate-900 border-2 border-amber-500/30 rounded-[32px] max-w-md w-full p-6 sm:p-8 text-center shadow-2xl space-y-5 max-h-[92dvh] overflow-y-auto md:max-w-lg"
      >
        {/* Soft background ambient glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none -z-10" />

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
            {praise.tag}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {praise.headline}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">{praise.note}</p>
          {/* Which lesson this was, kept small: the child knows what they just
              played, and the headline is now the news.

              "Lesson", not "Level" — the level bar below is the learner's XP
              level, and one word cannot mean both on one card. */}
          <p className="text-[11px] text-slate-500 font-medium pt-1">
            Lesson {levelNumber}
            {totalLessons ? ` of ${totalLessons}` : ""} · {levelTitle}
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

        {/*
          4. What the round was worth.

          Three figures, because a round pays into three different things and a
          capsule showing only XP made the other two invisible: the flame a child
          is keeping alive, and the goal they were actually aiming at today.
          Each is drawn only when there is something true to say.
        */}
        <div className="space-y-3 max-w-xs mx-auto">
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl px-3 py-3 grid grid-cols-3 items-start divide-x divide-slate-800/80 text-center font-mono">
            <div className="px-1">
              <div className="flex items-center justify-center gap-1 text-cyan-400">
                <Zap className="w-3.5 h-3.5 fill-cyan-400" aria-hidden="true" />
                <span className="text-lg font-black leading-none">+{xpWon}</span>
              </div>
              <span className="mt-1 block text-[10px] font-bold uppercase leading-tight tracking-wider text-slate-500">
                XP won
              </span>
            </div>

            <div className="px-1">
              <div
                className={`flex items-center justify-center gap-1 ${
                  streak > 0 ? "text-orange-400" : "text-slate-600"
                }`}
              >
                <Flame
                  className={`w-3.5 h-3.5 ${streak > 0 ? "fill-orange-400" : ""}`}
                  aria-hidden="true"
                />
                <span className="text-lg font-black leading-none">{streak}</span>
              </div>
              <span className="mt-1 block text-[10px] font-bold uppercase leading-tight tracking-wider text-slate-500">
                {streak === 1 ? unit : `${unit}s`} in a row
              </span>
            </div>

            <div className="px-1">
              <div
                className={`flex items-center justify-center gap-1 ${
                  standing && standing.dailySolved >= standing.dailyGoal
                    ? "text-emerald-400"
                    : "text-slate-300"
                }`}
              >
                <Target className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-lg font-black leading-none">
                  {standing ? `${standing.dailySolved}/${standing.dailyGoal}` : "—"}
                </span>
              </div>
              <span className="mt-1 block text-[10px] font-bold uppercase leading-tight tracking-wider text-slate-500">
                today
              </span>
            </div>
          </div>

          {/*
            The level bar: where that XP actually went.

            "+40 XP" on its own is a number with no scale behind it. This is the
            answer to "how much more?" — and it is the reason XP still means
            something after the last badge has been won.
          */}
          {bar && (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Level {bar.level}</span>
                <span>{bar.toNext} XP to Level {bar.level + 1}</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={bar.per}
                aria-valuenow={bar.into}
                aria-label={`Level ${bar.level} progress`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.round((bar.into / bar.per) * 100)}%` }}
                />
              </div>
            </div>
          )}
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
              <span>NEXT LESSON ({nextLevelNumber})</span>
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
                ? `Skip to Lesson ${nextLevelNumber}`
                : "Practice Again"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
