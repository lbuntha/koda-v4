/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, Lightbulb, User, XCircle, Zap } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { sounds } from "../../sound";
import { Button } from "../ui";
import { SvgLibraryAsset } from "../../assets/SvgLibraryAsset";
import { useOptionalSvgLibrary } from "../../assets/SvgLibraryContext";
import { XTRAMATH_OWL_ASSET, XTRAMATH_OWL_ASSET_ID } from "../../assets/xtraMathOwlAsset";
import { CanvasAccent, CanvasChip, accentTextClass, surfaceClass } from "./canvasTheme";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasProps } from "./types";
import {
  DynamicMathFact,
  generateDynamicMathFact,
  getXtraMathLevel,
  getXtraMathTheme,
  XtraMathLevel,
  XtraMathTheme,
} from "./xtraMathLevels";

const botStatusLabels = {
  idle: "Ready",
  thinking: "Thinking",
  answering: "Answering",
  correct: "Correct",
  wrong: "Missed it",
} as const;

const themeAccents: Record<string, CanvasAccent> = {
  classic: "indigo",
  cyber: "violet",
  candy: "rose",
  galaxy: "purple",
  forest: "emerald",
};

const DotGroup: React.FC<{
  count: number;
  crossedOut?: number;
  isDark: boolean;
  order?: number;
  reduceMotion?: boolean | null;
}> = ({ count, crossedOut = 0, isDark, order = 0, reduceMotion = false }) => (
  <motion.div
    initial={reduceMotion ? false : { opacity: 0, y: -12, scale: 0.92 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: "spring", stiffness: 340, damping: 24, delay: order * 0.045 }}
    className={`flex max-w-32 flex-wrap justify-center gap-1 rounded-xl px-2 py-1.5 ${surfaceClass(isDark)}`}
  >
    {Array.from({ length: count }, (_, index) => {
      const removed = index >= count - crossedOut;
      return (
        <span
          key={index}
          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] font-black ${
            removed
              ? isDark
                ? "bg-rose-400/20 text-rose-300 ring-1 ring-rose-400/70"
                : "bg-rose-100 text-rose-700 ring-1 ring-rose-400"
              : isDark
                ? "bg-indigo-300 text-transparent"
                : "bg-indigo-600 text-transparent"
          }`}
        >
          {removed ? "×" : "•"}
        </span>
      );
    })}
  </motion.div>
);

const ConcreteFactModel = React.memo(function ConcreteFactModel({
  problem,
  isDark,
}: {
  problem: DynamicMathFact;
  isDark: boolean;
}) {
  const reduceMotion = useReducedMotion();

  if (problem.operator === "+") {
    return (
      <div role="img" aria-label={`${problem.num1} dots and ${problem.num2} more dots make ${problem.answer}`} className="mb-5">
        <div aria-hidden="true" className="flex items-center justify-center gap-2">
          <DotGroup count={problem.num1} isDark={isDark} reduceMotion={reduceMotion} />
          <span className="font-black text-indigo-500">+</span>
          <DotGroup count={problem.num2} isDark={isDark} order={1} reduceMotion={reduceMotion} />
        </div>
      </div>
    );
  }

  if (problem.operator === "-") {
    return (
      <div role="img" aria-label={`${problem.num1} dots with ${problem.num2} crossed out leaves ${problem.answer}`} className="mb-5">
        <div aria-hidden="true" className="flex justify-center">
          <DotGroup count={problem.num1} crossedOut={problem.num2} isDark={isDark} reduceMotion={reduceMotion} />
        </div>
      </div>
    );
  }

  const groupCount = problem.operator === "×" ? problem.num1 : problem.answer;
  const amountPerGroup = problem.num2;
  const visibleGroupCount = Math.min(groupCount, 12);
  const label = problem.operator === "×"
    ? `${groupCount} groups with ${amountPerGroup} dots in each group make ${problem.answer}`
    : `${problem.num1} dots split into ${groupCount} equal groups of ${amountPerGroup}`;

  return (
    <div role="img" aria-label={label} className="mb-5">
      <div aria-hidden="true" className="mx-auto flex max-w-sm flex-wrap items-center justify-center gap-1.5">
        {Array.from({ length: visibleGroupCount }, (_, index) => (
          <DotGroup
            key={index}
            count={amountPerGroup}
            isDark={isDark}
            order={index}
            reduceMotion={reduceMotion}
          />
        ))}
        {groupCount > visibleGroupCount && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            isDark ? "bg-white/10 text-slate-200" : "bg-slate-200 text-slate-700"
          }`}>
            + {groupCount - visibleGroupCount} more groups
          </span>
        )}
      </div>
    </div>
  );
});

export const XtraMathCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid = false,
  isDark = false,
  compact = false,
  onAttempt,
  onHint,
  onSuccess,
}) => {
  const config = question.config || {};
  const svgLibrary = useOptionalSvgLibrary();
  const currentLevelId = config.levelId || "xm_level_1";
  const selectedThemeId = config.themeId || "classic";

  const level: XtraMathLevel = useMemo(() => getXtraMathLevel(currentLevelId), [currentLevelId]);
  const theme: XtraMathTheme = useMemo(() => getXtraMathTheme(selectedThemeId), [selectedThemeId]);
  const targetCount = Math.max(1, question.targetCount || level.targetCount);
  const timeLimitSec = Math.max(1, config.timeLimitSec || level.timeLimitSec);

  const [vsComputer, setVsComputer] = useState(config.defaultVsComputer ?? false);
  const [learnerScore, setLearnerScore] = useState(100);
  const [botScore, setBotScore] = useState(80);
  const [learnerHearts, setLearnerHearts] = useState(3);
  const [botHearts, setBotHearts] = useState(3);
  const [botStatus, setBotStatus] = useState<keyof typeof botStatusLabels>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [autoGuideActive, setAutoGuideActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [shake, setShake] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimitSec);
  const reduceMotion = useReducedMotion();
  const advanceTimeoutRef = useRef<number | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);

  const problem: DynamicMathFact = useMemo(
    () => generateDynamicMathFact(level, currentIndex),
    [level, currentIndex],
  );

  useEffect(() => {
    if (!svgLibrary) return;
    if (svgLibrary.deletedSystemAssetIds.includes(XTRAMATH_OWL_ASSET_ID)) return;
    if (svgLibrary.assets.some(asset => asset.id === XTRAMATH_OWL_ASSET_ID)) return;
    svgLibrary.setAssets(current => [...current, XTRAMATH_OWL_ASSET]);
  }, [svgLibrary]);

  useEffect(() => {
    setVsComputer(config.defaultVsComputer ?? false);
  }, [config.defaultVsComputer]);

  useEffect(() => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsSolved(false);
    setIsAdvancing(false);
    setShowHint(false);
    setAutoGuideActive(false);
    setStatusMessage("");
    setLearnerScore(100);
    setBotScore(80);
    setLearnerHearts(3);
    setBotHearts(3);
  }, [question.id, currentLevelId, targetCount]);

  useEffect(() => {
    if (isSolved || isAdvancing || selectedOption !== null || autoGuideActive) return;

    const struggleTimeout = window.setTimeout(() => {
      setAutoGuideActive(true);
      setStatusMessage(`Hint: ${problem.autoGuideHint}`);
      sounds.playSparkle();
    }, 3500);

    return () => window.clearTimeout(struggleTimeout);
  }, [autoGuideActive, currentIndex, isAdvancing, isSolved, problem.autoGuideHint, selectedOption]);

  // A one-second clock keeps the timer understandable without repainting the entire
  // activity every 50ms. The timer is motivational and never blocks an answer.
  useEffect(() => {
    setRemainingSeconds(timeLimitSec);
    if (isSolved || isAdvancing) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentIndex, isAdvancing, isSolved, timeLimitSec]);

  useEffect(() => {
    if (!vsComputer || isSolved || isAdvancing) {
      setBotStatus("idle");
      return;
    }

    setBotStatus("thinking");
    const thinkingTime = Math.max(1200, timeLimitSec * 1000 - 800);
    const timer = window.setTimeout(() => {
      const botWasCorrect = Math.random() < 0.85;
      setBotStatus(botWasCorrect ? "correct" : "wrong");
      if (botWasCorrect) setBotScore((previous) => previous + 20);
      else setBotHearts((previous) => Math.max(0, previous - 1));
    }, thinkingTime);

    return () => window.clearTimeout(timer);
  }, [currentIndex, isAdvancing, isSolved, timeLimitSec, vsComputer]);

  useEffect(() => () => {
    if (advanceTimeoutRef.current !== null) window.clearTimeout(advanceTimeoutRef.current);
    if (shakeTimeoutRef.current !== null) window.clearTimeout(shakeTimeoutRef.current);
  }, []);

  const handleSelectOption = (option: number) => {
    if (isSolved || isAdvancing) return;

    setSelectedOption(option);
    sounds.playPop();

    if (option === problem.answer) {
      sounds.playSuccess();
      setLearnerScore((previous) => previous + 50);
      setStatusMessage(`Correct. ${problem.num1} ${problem.operator} ${problem.num2} equals ${problem.answer}.`);

      if (currentIndex + 1 >= targetCount) {
        setIsSolved(true);
        sounds.playWin();
        onSuccess?.();
        onAttempt?.("correct", {
          expected: problem.answer,
          selected: option,
          details: { levelId: level.id, factsCompleted: targetCount },
        });
        return;
      }

      setIsAdvancing(true);
      advanceTimeoutRef.current = window.setTimeout(() => {
        setSelectedOption(null);
        setAutoGuideActive(false);
        setStatusMessage("");
        setCurrentIndex((previous) => previous + 1);
        setIsAdvancing(false);
        advanceTimeoutRef.current = null;
      }, 450);
      return;
    }

    sounds.playFailure();
    setShake(true);
    setAutoGuideActive(true);
    setStatusMessage(`${option} is not correct. Use the quantity model, then try another answer.`);
    setLearnerHearts((previous) => Math.max(0, previous - 1));
    onAttempt?.("incorrect", { expected: problem.answer, selected: option, details: { levelId: level.id } });
    if (shakeTimeoutRef.current !== null) window.clearTimeout(shakeTimeoutRef.current);
    shakeTimeoutRef.current = window.setTimeout(() => {
      setShake(false);
      setSelectedOption((current) => current === option ? null : current);
      shakeTimeoutRef.current = null;
    }, 450);
  };

  const toggleHint = () => {
    if (showHint || autoGuideActive) {
      setShowHint(false);
      setAutoGuideActive(false);
      setStatusMessage("");
      return;
    }

    setShowHint(true);
    setStatusMessage(`Hint: ${problem.autoGuideHint}`);
    onHint?.({ levelId: level.id, factId: problem.id });
  };

  const progressValue = Math.min(currentIndex + (isSolved ? 1 : 0), targetCount);
  const hintVisible = showHint || autoGuideActive;
  const accent = themeAccents[theme.id] || "indigo";
  const showConcreteModel = level.difficultyTier === "beginner" || hintVisible;
  const footerStatus = statusMessage
    || (hintVisible ? problem.autoGuideHint : "Choose the correct answer.");

  return (
    <SharedCanvasLayout
      aria-label={`${theme.name} math fluency practice`}
      isPlayMode={isPlayMode}
      showGrid={showGrid}
      isDark={isDark}
      compact={compact}
      accent={accent}
      headerIcon={(
        <SvgLibraryAsset
          assetId={XTRAMATH_OWL_ASSET_ID}
          size={26}
          fallback={<Zap size={16} />}
        />
      )}
      headerTitle="XtraMath"
      headerSubtitle={`Fact ${Math.min(currentIndex + 1, targetCount)} of ${targetCount}`}
      readAloudText={`${problem.num1} ${problem.operator} ${problem.num2}. Choose the correct answer.`}
      footerStatus={footerStatus}
      footerSolved={isSolved}
      hintDurationMs={hintVisible ? 0 : 3000}
      headerActions={(
        <>
          {vsComputer && (
            <CanvasChip accent={accent} isDark={isDark} mono={false}>
              <User aria-hidden="true" size={12} /> {learnerScore}
              <span aria-hidden="true">·</span>
              <Bot aria-hidden="true" size={12} /> {botScore}
              <span className="sr-only">
                You have {learnerScore} points and {learnerHearts} hearts. Computer has {botScore} points,
                {botHearts} hearts, and is {botStatusLabels[botStatus].toLowerCase()}.
              </span>
            </CanvasChip>
          )}
          <Button
            type="button"
            variant="outline"
            size="xs"
            aria-label={`${vsComputer ? "Turn off" : "Turn on"} computer opponent`}
            aria-pressed={vsComputer}
            onClick={() => setVsComputer((active) => !active)}
            className={isDark
              ? "border-white/15 bg-white/10 text-slate-100 hover:bg-white/15 hover:text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}
          >
            <Bot aria-hidden="true" size={14} />
            Bot
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`${hintVisible ? "Hide" : "Show"} hint`}
            aria-pressed={hintVisible}
            onClick={toggleHint}
            className={`h-7 w-7 rounded-lg ${
              hintVisible
                ? isDark
                  ? "border-sky-400/50 bg-sky-500/20 text-sky-200"
                  : "border-sky-300 bg-sky-50 text-sky-700"
                : isDark
                  ? "border-white/15 bg-white/10 text-slate-100 hover:bg-white/15"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Lightbulb aria-hidden="true" size={15} />
          </Button>
        </>
      )}
    >
      <div className={`relative h-1.5 w-full overflow-hidden rounded-full ${surfaceClass(isDark)}`}>
        <progress
          aria-label={`${remainingSeconds} seconds remaining for this fact`}
          className="absolute inset-0 h-1.5 w-full accent-indigo-600"
          max={timeLimitSec}
          value={remainingSeconds}
        />
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      <div className="flex flex-1 items-center justify-center px-2 py-3 sm:px-4">
        <div className="w-full max-w-lg px-1 py-3 sm:px-4">
          <p
            aria-label={`${problem.num1} ${problem.operator} ${problem.num2} equals ${selectedOption ?? "unknown"}`}
            className="mb-7 flex items-center justify-center gap-3 text-5xl font-black tracking-tight sm:gap-4 sm:text-6xl"
          >
            <span>{problem.num1}</span>
            <span aria-hidden="true" className={accentTextClass(accent, isDark)}>{problem.operator}</span>
            <span>{problem.num2}</span>
            <span aria-hidden="true" className={isDark ? "text-slate-500" : "text-slate-400"}>=</span>
            <span aria-hidden="true" className={`font-mono ${accentTextClass(accent, isDark)}`}>
              {selectedOption ?? "?"}
            </span>
          </p>

          <AnimatePresence mode="wait">
            {showConcreteModel && (
              <motion.div
                key={problem.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <ConcreteFactModel problem={problem} isDark={isDark} />
              </motion.div>
            )}
          </AnimatePresence>

          <div aria-label="Answer choices" className="grid grid-cols-2 gap-3" role="group">
            {problem.options.map((option) => {
              const isSelected = selectedOption === option;
              const isCorrectOption = option === problem.answer;
              const isGuideTarget = autoGuideActive && isCorrectOption;

              return (
                <button
                  key={option}
                  type="button"
                  aria-label={`Answer ${option}`}
                  aria-pressed={isSelected}
                  disabled={isSolved || isAdvancing}
                  onClick={() => handleSelectOption(option)}
                  className={`relative min-h-16 rounded-xl border-2 font-mono text-2xl font-black transition-[background-color,border-color,color,transform] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed motion-reduce:transition-none ${
                    isSelected
                      ? isCorrectOption
                        ? "animate-scale-in border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-500/20 motion-reduce:animate-none"
                        : `${shake ? "animate-shake" : ""} border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-500/20 motion-reduce:animate-none`
                      : isGuideTarget
                        ? isDark
                          ? "border-sky-400 bg-sky-500/20 text-sky-100 ring-2 ring-sky-400"
                          : "border-sky-500 bg-sky-50 text-sky-950 ring-2 ring-sky-300"
                        : isDark
                          ? "border-white/20 bg-white/10 text-white hover:border-indigo-400 hover:bg-white/15"
                          : "border-slate-200 bg-white text-slate-950 shadow-sm hover:border-indigo-400 hover:bg-indigo-50"
                  }`}
                >
                  <span>{option}</span>
                  {isSelected && isCorrectOption && (
                    <CheckCircle2 aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2" size={19} />
                  )}
                  {isSelected && !isCorrectOption && (
                    <XCircle aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2" size={19} />
                  )}
                </button>
              );
            })}
          </div>

          <div className={`mt-5 flex items-center justify-between gap-3 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            <span>{remainingSeconds > 0 ? `${remainingSeconds}s remaining` : "Take your time"}</span>
            <span>{progressValue} of {targetCount} complete</span>
          </div>
        </div>
      </div>
    </SharedCanvasLayout>
  );
};
