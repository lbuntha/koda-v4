import React, { useEffect } from "react";
import { Star, RotateCcw, ArrowRight, Trophy, Sparkles, Flame, Zap, Target, Home } from "lucide-react";
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
  /** Undefined when the current skill path has no following lesson. */
  nextLevelNumber?: number;
  /**
   * What is on offer is an optional practice round, not the next lesson.
   *
   * True only at the end of the teaching path, where the honest thing to say is
   * "you have finished — here is practice if you want it", and calling that
   * "Next lesson" would take the ending away.
   */
  nextIsPractice?: boolean;
  /** The lesson just played was the last of its path. Changes the headline. */
  pathComplete?: boolean;
  /** This round was practice, so the position line counts practice rounds. */
  practiceRound?: boolean;
  onNextLevel: () => void;
  onPracticeAgain: () => void;
  /** Leave the round for the lesson list. Drawn whenever neither button above
   *  already does, so every round has a way out. */
  onBackToLessons?: () => void;
  /**
   * Leave for the home screen. A different door from the lesson list.
   *
   * Omitted where the host has no home — a teacher preview, the activity
   * harness — and then it is simply not drawn.
   */
  onGoHome?: () => void;
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

/** The one filled button. Shared so the three things it can say cannot drift. */
const PRIMARY =
  "w-full py-3 px-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-mono font-black text-sm tracking-wide shadow-lg hover:shadow-orange-500/20 active:scale-[0.98] transition-all transform flex items-center justify-center gap-2 cursor-pointer";

/** The two doors out. Quiet on purpose — see where they are drawn. */
const QUIET =
  "inline-flex items-center gap-1.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors cursor-pointer";

const SECONDARY =
  "w-full py-2.5 rounded-full bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white font-mono font-bold text-xs transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 border border-slate-700/50 cursor-pointer";

export const PracticeRoundCompleteModal: React.FC<PracticeRoundCompleteModalProps> = ({
  levelNumber,
  levelTitle,
  totalLessons,
  stars,
  xpWon,
  nextLevelNumber,
  nextIsPractice = false,
  pathComplete = false,
  practiceRound = false,
  onNextLevel,
  onPracticeAgain,
  onBackToLessons,
  onGoHome,
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
    finale: pathComplete,
    practiceRound,
  };
  const praise = roundPraise(facts);

  /*
   * What "forward" is, and whether the log would rather the child stayed.
   *
   * `primary` says the repeat button wins the filled slot: the measurement
   * changed what happens, which is the point of measuring. Everything else is
   * the wording of the move on, in both the sizes it is drawn at.
   */
  const advance = {
    primary: recommendation?.kind === "practise" || recommendation?.kind === "review",
    label: !nextLevelNumber
      ? "BACK TO LESSONS"
      : nextIsPractice
        ? "TRY A PRACTICE ROUND"
        : `NEXT LESSON (${nextLevelNumber})`,
    short: !nextLevelNumber
      ? "Back to lessons"
      : nextIsPractice
        ? "Try a practice round"
        : `Skip to Lesson ${nextLevelNumber}`,
  };
  /*
   * The way out, which used to be drawn almost never.
   *
   * The condition was "practice is on offer", on the reasoning that only then
   * do both buttons above keep the child in the round. That was true of the end
   * of a path and false everywhere else: mid-course the pair reads "Next lesson"
   * and "Practice Again", which are also both ways of *staying*, and the modal
   * covers the screen — so the round's own exit sits behind it, unreachable. A
   * child who had simply finished for the day had to play another round or
   * close the tab.
   *
   * So: whenever the primary is not already the way out. It says "BACK TO
   * LESSONS" itself when there is no next lesson, and offering that twice is
   * the only case worth suppressing.
   */
  const showExit = Boolean(onBackToLessons) && Boolean(nextLevelNumber);
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
        className="relative bg-slate-900 border-2 border-amber-500/30 rounded-[32px] max-w-md w-full p-5 sm:p-6 text-center shadow-2xl space-y-3.5 max-h-[92dvh] overflow-y-auto md:max-w-lg"
      >
        {/* Soft background ambient glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none -z-10" />

        {/* 1. Golden Trophy Badge with Soft Glow */}
        <div className="relative mx-auto flex items-center justify-center w-16 h-16">
          {/* Pulsing Outer Glow Ring */}
          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-pulse scale-110 filter blur-md" />
          
          {/* Main Gold Trophy Circle Backdrop */}
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-b from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_8px_30px_rgba(245,158,11,0.5)] border-2 border-amber-300">
            <Trophy className="w-7 h-7 text-slate-950 stroke-[2.5]" />
          </div>
        </div>

        {/* 2. Headline Information */}
        <div className="space-y-1">
          <span className="text-[11px] font-mono font-black text-amber-400 uppercase tracking-widest block">
            {praise.tag}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {praise.headline}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">{praise.note}</p>
          {/* Which lesson this was, kept small: the child knows what they just
              played, and the headline is now the news.

              "Lesson", not "Level" — the level bar below is the learner's XP
              level, and one word cannot mean both on one card. */}
          <p className="text-[11px] text-slate-500 font-medium pt-1">
            {practiceRound ? "Practice" : "Lesson"} {levelNumber}
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
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((n) => {
            const earned = n <= stars;
            const big = n === 2;
            return (
              <Star
                key={n}
                aria-hidden="true"
                className={[
                  big ? "w-9 h-9" : "w-7 h-7",
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
        <div className="space-y-2 max-w-xs mx-auto">
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl px-3 py-2.5 grid grid-cols-3 items-start divide-x divide-slate-800/80 text-center font-mono">
            <div className="px-1">
              <div className="flex items-center justify-center gap-1 text-cyan-400">
                <Zap className="w-3.5 h-3.5 fill-cyan-400" aria-hidden="true" />
                <span className="text-base font-black leading-none">+{xpWon}</span>
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
                <span className="text-base font-black leading-none">{streak}</span>
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
                <span className="text-base font-black leading-none">
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
                <span>XP Level {bar.level}</span>
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
              {/* "{bar.per} XP earns a level" stood here as a third line, to
                  stop "Level 4" reading as "lesson 4". It has gone for height:
                  Home's rail states the same rule under the same bar
                  ("100 XP earns a level. Every finished round pays XP."), which
                  is a screen every learner passes through, and the two labels
                  either side of this bar already carry the scale. */}
            </div>
          )}
        </div>

        {/*
          5. What the log says to do next — when that is news.

          "Nice work! Ready for the next one?" sat directly above a button
          reading NEXT LESSON (2): one sentence, said twice, costing a whole
          card of height on the commonest screen in the app. The message earns
          its place when it *disagrees* with the obvious move — a concept that
          has not landed turns the primary into another round, and then the line
          is the reason why.
        */}
        {recommendation && advance.primary && (
          <div className="flex items-start gap-2.5 text-left bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-3 max-w-xs mx-auto">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-200 font-medium leading-snug">
              {recommendation.kidMessage}
            </p>
          </div>
        )}

        {/*
          6. Where to go from here.

          Three shapes, and the wording of each is decided above rather than
          inline, because the same button means three different things: the next
          lesson mid-path, an *offer* of practice once the path is finished, and
          the way out when there is nothing after it at all. Calling the third
          "Next lesson" is what left a child on the last lesson tapping a button
          that took them nowhere.
        */}
        <div className="space-y-2.5">
          {advance.primary ? (
            <button
              onClick={onPracticeAgain}
              className={PRIMARY}
            >
              <RotateCcw className="w-4 h-4 stroke-[3]" />
              <span>ONE MORE ROUND</span>
            </button>
          ) : (
            <button onClick={onNextLevel} className={PRIMARY}>
              <span>{advance.label}</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          )}

          {/* Secondary option: whichever action is not primary */}
          <button
            onClick={advance.primary ? onNextLevel : onPracticeAgain}
            className={SECONDARY}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {/* "Practice Again" would be the word twice with two meanings on the
                screen that offers a practice round: this button replays the
                lesson just finished, and the one above opens a different kind
                of round. */}
            <span>
              {advance.primary
                ? advance.short
                : nextIsPractice
                  ? "Play this lesson again"
                  : "Practice Again"}
            </span>
          </button>

          {/*
            The quiet row: two doors out, neither of them loud.

            Deliberately smaller and greyer than the pair above — finishing a
            lesson should still feel like it points forward, and a child who
            wants to carry on must not have to pick their way past two exits to
            do it. But they are always there, and they are two rather than one
            because they go to different places: the lesson list is "show me
            what else there is", home is "I am done for today".
          */}
          {(showExit || onGoHome) && (
            <div className="flex items-center justify-center gap-4">
              {showExit && (
                <button onClick={onBackToLessons} className={QUIET}>
                  Back to lessons
                </button>
              )}
              {showExit && onGoHome && (
                <span className="text-slate-700" aria-hidden="true">
                  ·
                </span>
              )}
              {onGoHome && (
                <button onClick={onGoHome} className={QUIET}>
                  <Home className="w-3 h-3" aria-hidden="true" />
                  Home
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
