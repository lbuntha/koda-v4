import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, Check, RotateCcw, X } from "lucide-react";
import { COUNT_OBJECTS } from "../../types";
import { sounds } from "../../sound";
import { AssetType, CountingAsset } from "../Assets";
import { Button } from "../ui";
import { CanvasProps } from "./types";
import { CanvasChip } from "./canvasTheme";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import {
  answerChoices,
  normalizeStoryProblemConfig,
  storyAnswer,
  storyEquation,
  storyText,
} from "./storyProblemModel";

const SCENE_META = {
  park: { emoji: "🌳", label: "At the park" },
  picnic: { emoji: "🧺", label: "At a picnic" },
  pond: { emoji: "🪷", label: "By the pond" },
  space: { emoji: "🪐", label: "In space" },
  classroom: { emoji: "✏️", label: "In class" },
} as const;

const TYPE_LABELS = {
  add_to: "Join",
  take_from: "Separate",
  put_together: "Part + part",
  take_apart: "Whole and parts",
  compare: "Compare",
  three_addends: "Three groups",
} as const;

interface GroupProps {
  label: string;
  count: number;
  hidden?: boolean;
  revealValue?: number;
  crossed?: boolean;
  tone: "violet" | "sky" | "amber";
  assetType: AssetType;
  emoji: string;
  customSvgMarkup?: string;
  compact: boolean;
  isDark: boolean;
}

const ObjectGroup: React.FC<GroupProps> = ({ label, count, hidden, revealValue, crossed, tone, assetType, emoji, customSvgMarkup, compact, isDark }) => {
  const reduceMotion = useReducedMotion();
  const toneClass = tone === "sky"
    ? isDark ? "bg-sky-400/10 ring-sky-300/20" : "bg-sky-50 ring-sky-100"
    : tone === "amber"
      ? isDark ? "bg-amber-400/10 ring-amber-300/20" : "bg-amber-50 ring-amber-100"
      : isDark ? "bg-violet-400/10 ring-violet-300/20" : "bg-violet-50 ring-violet-100";

  return (
    <div className={`relative flex min-h-[104px] min-w-0 flex-1 flex-col rounded-2xl p-2.5 ring-1 sm:min-h-[126px] sm:p-3 ${toneClass}`}>
      <div className={`mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <span>{label}</span>
        {!hidden && <span className={isDark ? "text-slate-200" : "text-slate-700"}>{count}</span>}
      </div>
      {hidden ? (
        <motion.div
          key={revealValue ?? "unknown"}
          initial={reduceMotion ? false : { scale: 0.72, rotate: -5, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 340, damping: 20 }}
          className={`m-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-3xl font-semibold transition-colors ${revealValue !== undefined
            ? "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
            : isDark
              ? "border-dashed border-violet-400/50 bg-violet-400/10 text-violet-200"
              : "border-dashed border-violet-300 bg-white text-violet-600"
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={revealValue ?? "question"}
              initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { scale: 1.35, opacity: 0 }}
            >
              {revealValue ?? "?"}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className={`m-auto grid max-w-[190px] grid-cols-5 place-items-center gap-1 ${crossed ? "opacity-55" : ""}`}>
          {Array.from({ length: count }, (_, index) => (
            <motion.div
              key={index}
              initial={reduceMotion ? false : crossed ? { x: -12, opacity: 0 } : { y: 10, scale: 0.7, opacity: 0 }}
              animate={crossed ? { x: 5, opacity: 0.55 } : { y: 0, scale: 1, opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.045, type: "spring", stiffness: 280, damping: 20 }}
              className="relative"
            >
              <CountingAsset type={assetType} emoji={emoji} customSvgMarkup={customSvgMarkup} size={compact ? 24 : 30} />
              {crossed && <X aria-hidden="true" className="absolute inset-0 m-auto text-rose-500" size={compact ? 21 : 26} strokeWidth={3} />}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export const StoryProblemMatCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid,
  isDark = false,
  compact = false,
  onSuccess,
  onAttempt,
}) => {
  const config = useMemo(() => normalizeStoryProblemConfig({
    type: question.config.storyProblemType,
    unknown: question.config.storyUnknown,
    first: question.config.storyStart,
    second: question.config.storyPart2 ?? question.config.storyChange,
    third: question.config.storyPart3,
    scene: question.config.storyScene,
    characterName: question.config.storyCharacterName,
  }), [
    question.config.storyProblemType,
    question.config.storyUnknown,
    question.config.storyStart,
    question.config.storyChange,
    question.config.storyPart2,
    question.config.storyPart3,
    question.config.storyScene,
    question.config.storyCharacterName,
  ]);
  const object = COUNT_OBJECTS.find(item => item.id === question.objectId) || COUNT_OBJECTS[0];
  const answer = storyAnswer(config);
  const choices = answerChoices(answer, question.config.storyChoices);
  const prompt = question.instruction || storyText(config, object.label);
  const [selected, setSelected] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setSelected(null);
    setSolved(false);
  }, [question.id, config.type, config.unknown, config.first, config.second, config.third]);

  const reset = () => {
    setSelected(null);
    setSolved(false);
  };

  const choose = (value: number) => {
    if (!isPlayMode || solved) return;
    setSelected(value);
    if (value !== answer) {
      sounds.playFail();
      onAttempt?.("incorrect", { expected: answer, selected: value, details: { storyType: config.type, unknown: config.unknown } });
      return;
    }
    sounds.playWin();
    setSolved(true);
    onAttempt?.("correct", { expected: answer, selected: value, details: { storyType: config.type, unknown: config.unknown } });
    onSuccess?.();
  };

  const assetType = (question.config.assetType || object.assetType || "emoji") as AssetType;
  const firstHidden = config.unknown === "start";
  const secondHidden = config.unknown === "change" || config.unknown === "part";
  const group = (label: string, count: number, tone: GroupProps["tone"], hidden = false, crossed = false) => (
    <ObjectGroup
      label={label}
      count={count}
      tone={tone}
      hidden={hidden}
      revealValue={hidden && solved ? count : undefined}
      crossed={crossed}
      assetType={assetType}
      emoji={object.emoji}
      customSvgMarkup={question.config.customSvgMarkup}
      compact={compact}
      isDark={isDark}
    />
  );

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      showGrid={showGrid}
      isDark={isDark}
      compact={compact}
      accent="purple"
      headerIcon={<BookOpen size={17} />}
      headerTitle="Story Problem Mat"
      headerSubtitle={storyEquation(config)}
      readAloudText={prompt}
      headerActions={(
        <>
          <CanvasChip accent="purple" isDark={isDark}>{SCENE_META[config.scene].emoji} {TYPE_LABELS[config.type]}</CanvasChip>
          <Button variant="ghost" size="icon" onClick={reset} className="h-8 w-8 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Reset story"><RotateCcw size={14} /></Button>
        </>
      )}
      designerHint="Choose the story structure, unknown, quantities, scene, and learning object in Studio."
      playHint={prompt}
      footerStatus={solved ? `Yes — the answer is ${answer}!` : selected !== null ? "Not yet. Use the groups to check your thinking." : undefined}
      footerSolved={solved}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent p-2.5 sm:p-4">
        <motion.div
          key={prompt}
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-3 flex items-start gap-2.5 px-1 py-2 sm:px-2 ${isDark ? "text-slate-100" : "text-slate-700"}`}
        >
          <motion.span
            initial={reduceMotion ? false : { scale: 0.65, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="text-xl"
            aria-hidden="true"
          >
            {SCENE_META[config.scene].emoji}
          </motion.span>
          <p className="text-sm font-medium leading-relaxed sm:text-base md:text-lg" aria-label={prompt}>
            {prompt.split(/\s+/).map((word, index) => (
              <motion.span
                key={`${word}-${index}`}
                aria-hidden="true"
                className="inline-block"
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.65) }}
              >
                {word}{index < prompt.split(/\s+/).length - 1 ? "\u00a0" : ""}
              </motion.span>
            ))}
          </p>
        </motion.div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full max-w-3xl">
            {config.type === "compare" ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group(config.characterName, config.first, "violet")}
                {group("Friend", config.second, "sky")}
              </div>
            ) : (
              <div className={`grid items-stretch gap-2 ${config.type === "three_addends" ? "grid-cols-3" : "grid-cols-[1fr_auto_1fr]"}`}>
                {group(config.type === "take_apart" ? "Whole" : "First", config.first, "violet", firstHidden)}
                {config.type !== "three_addends" && <div className={`flex items-center justify-center text-xl font-semibold ${isDark ? "text-slate-500" : "text-slate-300"}`}>{config.type === "take_from" || config.type === "take_apart" ? "−" : "+"}</div>}
                {group(config.type === "take_from" ? "Went away" : config.type === "take_apart" ? "Known part" : "Next", config.second, "sky", secondHidden, config.type === "take_from" && !secondHidden)}
                {config.type === "three_addends" && group("Last", config.third, "amber")}
              </div>
            )}

            <div className={`mx-auto mt-2 flex w-fit items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${isDark ? "bg-white/[0.07] text-slate-200" : "bg-slate-100 text-slate-600"}`}>
              <span>{config.type === "compare" ? "Difference" : config.type === "take_apart" ? "Missing part" : "Answer"}</span>
              <motion.span
                key={solved ? answer : "unknown"}
                initial={reduceMotion ? false : { scale: 0.7 }}
                animate={{ scale: 1 }}
                className={`flex h-8 min-w-8 items-center justify-center rounded-xl px-2 text-base font-bold ${solved ? "bg-emerald-500 text-white" : isDark ? "bg-violet-400/20 text-violet-200" : "bg-white text-violet-600 shadow-sm"}`}
              >
                {solved ? answer : "?"}
              </motion.span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Answer choices">
          {choices.map(value => {
            const wrong = selected === value && value !== answer;
            const correct = solved && value === answer;
            return (
              <Button
                key={value}
                type="button"
                variant="outline"
                size={compact ? "sm" : "md"}
                disabled={!isPlayMode || solved}
                onClick={() => choose(value)}
                aria-pressed={selected === value}
                className={`min-w-14 text-base font-semibold tabular-nums dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 ${wrong ? "border-rose-400 bg-rose-50 text-rose-700 animate-shake dark:bg-rose-400/15 dark:text-rose-200" : ""} ${correct ? "border-emerald-500 bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white" : ""}`}
              >
                <AnimatePresence mode="popLayout">
                  {correct && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={15} /></motion.span>}
                </AnimatePresence>
                {value}
              </Button>
            );
          })}
        </div>
      </div>
    </SharedCanvasLayout>
  );
};
