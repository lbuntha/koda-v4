import React, { useEffect, useState } from "react";
import { RotateCcw, ArrowRight } from "lucide-react";
import { SvgAsset } from "../../../assets/svg";
import { playSound } from "../../../utils/audio";
import { levelBar, roundPraise, type PraiseFacts } from "../round/roundPraise";
import { levelFromXp, xpIntoLevel } from "../../../lib/level";
import { useT } from "../../../lib/i18n";
import { UIRewardProgress } from "../../../components/ui/UIRewardProgress";

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
  "w-full py-3 px-6 rounded-full bg-gradient-to-r from-violet-500 to-rose-500 hover:from-violet-400 hover:to-rose-400 text-white font-mono font-black text-sm tracking-wide shadow-lg hover:shadow-orange-500/20 active:scale-[0.98] transition-all transform flex items-center justify-center gap-2 cursor-pointer";

/** The two doors out. Quiet on purpose — see where they are drawn. */
const QUIET =
  "inline-flex items-center gap-1.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-muted hover:text-ink transition-colors cursor-pointer";

const SECONDARY =
  "w-full py-2.5 rounded-full bg-surface-muted hover:bg-violet-50 dark:hover:bg-slate-800 text-body hover:text-ink font-mono font-bold text-xs transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 border border-line cursor-pointer";

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
  const { t } = useT();
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
    // Upper case by style, not by spelling: `toLocaleUpperCase` leaves a
    // script without case (Khmer) exactly as it is.
    label: (!nextLevelNumber
      ? t("round.backToLessons")
      : nextIsPractice
        ? t("round.tryPractice")
        : t("round.nextLessonN", { n: nextLevelNumber })
    ).toLocaleUpperCase(),
    short: !nextLevelNumber
      ? t("round.backToLessons")
      : nextIsPractice
        ? t("round.tryPractice")
        : t("round.skipToLesson", { n: nextLevelNumber }),
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
  /*
   * The bar starts where the learner stood before this round and fills to
   * where they stand now, so a child watches their XP go in rather than being
   * told a number. A round that crossed a level starts from empty: the old
   * level's bar is gone, and the level-up moment has already said why.
   */
  const xpBefore = Math.max(0, (standing?.xpAfter ?? 0) - Math.max(0, xpWon));
  const startAt = bar ? (levelFromXp(xpBefore) < bar.level ? 0 : xpIntoLevel(xpBefore)) : 0;
  const [barValue, setBarValue] = useState(startAt);
  const target = bar?.into ?? 0;
  useEffect(() => {
    const id = window.setTimeout(() => setBarValue(target), 350);
    return () => window.clearTimeout(id);
  }, [target]);
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
      className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
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
        className="relative bg-surface border-2 border-violet-200 dark:border-violet-500/30 rounded-[32px] max-w-md w-full p-5 sm:p-6 text-center shadow-2xl space-y-3.5 max-h-[92dvh] overflow-y-auto md:max-w-lg"
      >
        {/* Soft background ambient glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-violet-500/10 rounded-full filter blur-3xl pointer-events-none -z-10" />

        {/* 1. Golden Trophy Badge with Soft Glow */}
        <div className="relative mx-auto flex items-center justify-center w-20 h-20">
          {/* Pulsing Outer Glow Ring */}
          <div className="absolute inset-0 rounded-full bg-violet-500/20 animate-pulse scale-110 filter blur-md" />
          
          {/* Main Gold Trophy Circle Backdrop */}
          <div className="relative w-[4.5rem] h-[4.5rem] rounded-full bg-violet-50 dark:bg-violet-950/60 flex items-center justify-center shadow-[0_8px_30px_rgba(139,92,246,0.35)] border-2 border-violet-200 dark:border-violet-500/40">
            <SvgAsset untitled id="kit-trophy" size={44} />
          </div>
        </div>

        {/* 2. Headline Information */}
        <div className="space-y-1">
          <span className="text-[11px] font-mono font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest block">
            {praise.tag}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight">
            {praise.headline}
          </h2>
          <p className="text-xs sm:text-sm text-body font-medium">{praise.note}</p>
          {/* Which lesson this was, kept small: the child knows what they just
              played, and the headline is now the news.

              "Lesson", not "Level" — the level bar below is the learner's XP
              level, and one word cannot mean both on one card. */}
          <p className="text-[11px] text-muted font-medium pt-1">
            {totalLessons
              ? t(practiceRound ? "round.practiceNOf" : "round.lessonNOf", { n: levelNumber, total: totalLessons })
              : t(practiceRound ? "round.practiceN" : "round.lessonN", { n: levelNumber })}{" "}
            · {levelTitle}
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
              <span
                key={n}
                aria-hidden="true"
                data-earned={earned ? "true" : "false"}
                className={[
                  "inline-flex",
                  earned
                    ? `filter ${
                        big
                          ? "drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]"
                          : "drop-shadow-[0_0_8px_rgba(139,92,246,0.45)]"
                      } animate-bounce`
                    : "grayscale opacity-30",
                  earned && n === 1 ? "delay-75" : "",
                  earned && n === 3 ? "delay-150" : "",
                ].join(" ")}
              >
                <SvgAsset untitled id="kit-star" size={big ? 44 : 34} />
              </span>
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
          <div className="bg-surface-muted border border-line rounded-2xl px-3 py-2.5 grid grid-cols-3 items-start divide-x divide-line text-center font-mono">
            <div className="px-1">
              <div className="flex items-center justify-center gap-1 text-cyan-600 dark:text-cyan-400">
                <SvgAsset untitled id="kit-bolt" size={18} />
                <span className="text-base font-black leading-none">+{xpWon}</span>
              </div>
              <span className="mt-1 block text-[10px] font-bold uppercase leading-tight tracking-wider text-muted">
                {t("round.xpWonLabel")}
              </span>
            </div>

            <div className="px-1">
              <div
                className={`flex items-center justify-center gap-1 ${
                  streak > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted"
                }`}
              >
                <span className={`inline-flex ${streak > 0 ? "" : "grayscale opacity-40"}`}>
                  <SvgAsset untitled id="kit-flame" size={18} />
                </span>
                <span className="text-base font-black leading-none">{streak}</span>
              </div>
              <span className="mt-1 block text-[10px] font-bold uppercase leading-tight tracking-wider text-muted">
                {t(unit === "week" ? "round.inARowWeeks" : "round.inARowDays", { count: streak })}
              </span>
            </div>

            <div className="px-1">
              <div
                className={`flex items-center justify-center gap-1 ${
                  standing && standing.dailySolved >= standing.dailyGoal
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-ink"
                }`}
              >
                <SvgAsset untitled id="kit-target" size={18} />
                <span className="text-base font-black leading-none">
                  {standing ? `${standing.dailySolved}/${standing.dailyGoal}` : "—"}
                </span>
              </div>
              <span className="mt-1 block text-[10px] font-bold uppercase leading-tight tracking-wider text-muted">
                {t("round.todayLabel")}
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
              <div className="flex items-baseline justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                <span>{t("home.xpLevel", { level: bar.level })}</span>
                <span>{t("round.xpToLevel", { xp: bar.toNext, level: bar.level + 1 })}</span>
              </div>
              <UIRewardProgress
                value={barValue}
                max={bar.per}
                label={t("round.levelProgress", { level: bar.level })}
              />
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
          <div className="flex items-start gap-2.5 text-left bg-surface-muted border border-line rounded-2xl px-4 py-3 max-w-xs mx-auto">
            <span className="shrink-0 mt-0.5 inline-flex">
              <SvgAsset untitled id="kit-sparkle" size={18} />
            </span>
            <p className="text-xs text-ink font-medium leading-snug">
              {t(`today.${recommendation.kind}`)}
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
              <span>{t("round.oneMore").toLocaleUpperCase()}</span>
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
            <SvgAsset untitled id={advance.primary ? "menu-learn" : "kit-repeat"} size={18} />
            {/* "Practice Again" would be the word twice with two meanings on the
                screen that offers a practice round: this button replays the
                lesson just finished, and the one above opens a different kind
                of round. */}
            <span>
              {advance.primary
                ? advance.short
                : nextIsPractice
                  ? t("round.playAgain")
                  : t("round.practiceAgain")}
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
                  <SvgAsset untitled id="menu-learn" size={16} />
                  {t("round.backToLessons")}
                </button>
              )}
              {showExit && onGoHome && (
                <span className="text-line" aria-hidden="true">
                  ·
                </span>
              )}
              {onGoHome && (
                <button onClick={onGoHome} className={QUIET}>
                  <SvgAsset untitled id="menu-home" size={16} />
                  {t("nav.home")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
