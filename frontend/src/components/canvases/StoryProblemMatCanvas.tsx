import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, Check, RotateCcw, X } from "lucide-react";
import { COUNT_OBJECTS, CountingQuestion, CustomSvgAsset } from "../../types";
import { sounds } from "../../sound";
import { findAsset } from "../../assets/assetCatalog";
import { useAssetLibrary } from "../../assets/questionAsset";
import { AssetType, CountingAsset } from "../Assets";
import { Button } from "../ui";
import { CanvasProps } from "./types";
import { CanvasChip, CanvasAccent } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { bestGrid, fitObjectSize } from "./objectLayout";
import { balancedChoiceOrder } from "./choiceOrder";
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
  tone: CanvasAccent;
  assetType: AssetType;
  emoji: string;
  /** Counter edge length, decided by the mat from the room a group actually has. */
  size: number;
  isDark: boolean;
}

/**
 * What the story should call the things on the mat.
 *
 * The counters are drawn from `config.assetType` when it is set, but the story text was taken
 * from `objectId`'s label — so choosing a different asset in the Studio picker gave a mat full
 * of butterflies above a story about apples. The picture is what the child can see, so the
 * picture wins and the words follow it.
 */
export function storyObjectLabel(question: CountingQuestion, assets: CustomSvgAsset[] = []): string {
  const byId = COUNT_OBJECTS.find(item => item.id === question.objectId) || COUNT_OBJECTS[0];
  const assetType = question.config.assetType;
  if (!assetType || assetType === byId.assetType) return byId.label;
  // The catalog covers the Goods Sort sprites and the account's own artwork, neither of which
  // COUNT_OBJECTS knows about — without it a mat of donuts told a story about apples.
  const custom = question.config.customSvgAssetId
    ? findAsset(question.config.customSvgAssetId, assets)
    : undefined;
  return (custom ?? findAsset(assetType, assets))?.label
    ?? COUNT_OBJECTS.find(item => item.assetType === assetType)?.label
    ?? byId.label;
}

const ObjectGroup: React.FC<GroupProps> = ({ label, count, hidden, revealValue, crossed, tone, assetType, emoji, size, isDark }) => {
  const reduceMotion = useReducedMotion();
  const columns = Math.max(1, bestGrid(Math.max(1, count), 5, 3).columns);

  return (
    <CanvasBin
      label={label}
      tally={hidden ? undefined : count}
      accent={tone}
      isDark={isDark}
      complete={hidden && revealValue !== undefined}
      className="min-h-[96px]"
    >
      {hidden ? (
        <motion.div
          key={revealValue ?? "unknown"}
          initial={reduceMotion ? false : { scale: 0.72, rotate: -5, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 340, damping: 20 }}
          style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.5)}px` }}
          className={`absolute inset-0 m-auto flex items-center justify-center rounded-2xl border-2 font-semibold transition-colors ${revealValue !== undefined
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
        <div
          className={`absolute inset-0 m-auto grid place-content-center place-items-center gap-1 ${crossed ? "opacity-55" : ""}`}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: count }, (_, index) => (
            <motion.div
              key={index}
              initial={reduceMotion ? false : crossed ? { x: -12, opacity: 0 } : { y: 10, scale: 0.7, opacity: 0 }}
              animate={crossed ? { x: 5, opacity: 0.55 } : { y: 0, scale: 1, opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.045, type: "spring", stiffness: 280, damping: 20 }}
              className="relative"
            >
              <CountingAsset type={assetType} emoji={emoji} size={size} />
              {crossed && <X aria-hidden="true" className="absolute inset-0 m-auto text-rose-500" size={Math.round(size * 0.85)} strokeWidth={3} />}
            </motion.div>
          ))}
        </div>
      )}
    </CanvasBin>
  );
};

const Operator: React.FC<{ symbol: string; isDark: boolean }> = ({ symbol, isDark }) => (
  <div className={`flex items-center justify-center px-1 text-xl font-semibold sm:text-2xl ${isDark ? "text-slate-500" : "text-slate-300"}`}>
    {symbol}
  </div>
);

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
  const assetLibrary = useAssetLibrary();
  const answer = storyAnswer(config);
  const choices = balancedChoiceOrder(
    answerChoices(answer, question.config.storyChoices),
    answer,
    question.config.answerChoiceSlot,
  );
  /**
   * The story is the question, so it is always derived and always shown.
   *
   * This used to be `question.instruction || storyText(...)`, which let an authored
   * instruction *replace* the story — and the seeded questions all carry the generic
   * "Read the story, then choose the number that answers it." So the mat displayed an
   * instruction to read a story that was nowhere on screen, and the child was left doing
   * bare arithmetic on two groups of counters. That is the entire skill, missing.
   *
   * The instruction is now what it says it is: a hint about the task, shown as the hint.
   */
  const story = storyText(config, storyObjectLabel(question, assetLibrary));
  const hint = question.instruction || "Read the story, then choose the number that answers it.";
  const [selected, setSelected] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const reduceMotion = useReducedMotion();
  const { showGhostGuide, reportActivity } = useGhostGuide({ isPlayMode, isSolved: solved, idleThresholdMs: 10000 });

  /**
   * The row of groups, measured — counters are sized from the room a group
   * actually has, the way every other canvas sizes its objects. They used to be
   * a flat 24 or 30px in a box capped at 190px across, so a story about 18
   * apples drew four rows of tiny fruit that overflowed the group it was in,
   * and the same story on a projector left three quarters of the mat empty.
   */
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowSize, setRowSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const seed = row.getBoundingClientRect();
    setRowSize({ width: seed.width || 640, height: seed.height || 160 });
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setRowSize({
          width: entry.contentRect.width || 640,
          height: entry.contentRect.height || 160
        });
      }
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

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
  /*
    `take_apart` asks for the *missing* part, so the part the story tells the
    child — "3 are in one group" — is the one piece of evidence they have. It
    was being hidden behind a "?" on every take-apart question, under a label
    reading "Known part", contradicting both the story and the equation.
  */
  const secondHidden = config.unknown === "change"
    || (config.unknown === "part" && config.type === "put_together");

  const groupCount = config.type === "three_addends" ? 3 : 2;
  const biggestGroup = Math.max(config.first, config.second, config.type === "three_addends" ? config.third : 0);
  /** Counter size: the largest that still fits the fullest group on this mat. */
  const counterSize = useMemo(() => {
    const width = rowSize?.width ?? 640;
    const height = rowSize?.height ?? 160;
    const laneWidth = compact ? 22 : 34;
    const groupWidth = Math.max(72, (width - laneWidth * (groupCount - 1) - 8 * groupCount) / groupCount);
    return Math.max(
      16,
      Math.min(
        compact ? 34 : 56,
        fitObjectSize({
          width: groupWidth,
          height,
          count: Math.max(1, biggestGroup),
          padding: compact ? 8 : 12,
          captionInset: compact ? 22 : 28,
          min: 16
        })
      )
    );
  }, [rowSize?.width, rowSize?.height, groupCount, biggestGroup, compact]);

  const group = (label: string, count: number, tone: CanvasAccent, hidden = false, crossed = false) => (
    <ObjectGroup
      label={label}
      count={count}
      tone={tone}
      hidden={hidden}
      revealValue={hidden && solved ? count : undefined}
      crossed={crossed}
      assetType={assetType}
      emoji={object.emoji}
      size={counterSize}
      isDark={isDark}
    />
  );

  const accent: CanvasAccent = (["indigo", "violet", "emerald", "purple", "rose"] as CanvasAccent[])
    .includes(question.config.frameColor as CanvasAccent)
    ? (question.config.frameColor as CanvasAccent)
    : "purple";

  /**
   * The picture in front of the story.
   *
   * A teacher or the AI can override the scene's emoji, or point at any vector
   * asset or drawing in the account's library; unset, the scene still picks.
   */
  const sceneAssetType = question.config.storySceneAssetType;
  const sceneIcon = sceneAssetType && sceneAssetType !== "emoji"
    ? (
      <CountingAsset
        type={sceneAssetType as AssetType}
        assetId={question.config.storySceneAssetId}
        emoji={question.config.storySceneEmoji || SCENE_META[config.scene].emoji}
        size={compact ? 26 : 34}
      />
    )
    : question.config.storySceneEmoji || SCENE_META[config.scene].emoji;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      showGrid={showGrid}
      isDark={isDark}
      compact={compact}
      accent={accent}
      showRulers={question.config.showLayoutRulers ?? false}
      headerIcon={<BookOpen size={17} />}
      headerTitle="Story Problem Mat"
      headerSubtitle={storyEquation(config)}
      readAloudText={story}
      headerActions={(
        <>
          <CanvasChip accent={solved ? "emerald" : accent} isDark={isDark}>{TYPE_LABELS[config.type]}</CanvasChip>
          <Button variant="ghost" size="icon" onClick={reset} className="h-8 w-8 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Reset story"><RotateCcw size={14} /></Button>
        </>
      )}
      designerHint="Choose the story structure, unknown, quantities, scene, and learning object in Studio."
      playHint={hint}
      footerStatus={solved ? `Yes — the answer is ${answer}!` : selected !== null ? "Not yet. Use the groups to check your thinking." : undefined}
      footerSolved={solved}
    >
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent p-2.5 sm:p-4">
        <GhostGuideOverlay
          show={showGhostGuide && !solved && isPlayMode}
          label="Read the story, then tap the number that answers it!"
          isDark={isDark}
          labelPlacement="top"
        />
        <motion.div
          key={story}
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-3 flex items-start gap-2.5 px-1 py-2 sm:px-2 ${isDark ? "text-slate-100" : "text-slate-700"}`}
        >
          <motion.span
            initial={reduceMotion ? false : { scale: 0.65, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="flex-shrink-0 text-xl leading-none"
            aria-hidden="true"
          >
            {sceneIcon}
          </motion.span>
          <p className="text-sm font-medium leading-relaxed sm:text-base md:text-lg" aria-label={story}>
            {story.split(/\s+/).map((word, index) => (
              <motion.span
                key={`${word}-${index}`}
                aria-hidden="true"
                className="inline-block"
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.65) }}
              >
                {word}{index < story.split(/\s+/).length - 1 ? "\u00a0" : ""}
              </motion.span>
            ))}
          </p>
        </motion.div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full max-w-3xl">
            {config.type === "compare" ? (
              <div ref={rowRef} className="grid min-h-[110px] grid-cols-1 gap-2 sm:grid-cols-2">
                {group(config.characterName, config.first, "violet")}
                {group("Friend", config.second, "indigo")}
              </div>
            ) : (
              <div
                ref={rowRef}
                className={`grid min-h-[110px] items-stretch gap-2 ${config.type === "three_addends" ? "grid-cols-[1fr_auto_1fr_auto_1fr]" : "grid-cols-[1fr_auto_1fr]"}`}
              >
                {group(config.type === "take_apart" ? "Whole" : "First", config.first, "violet", firstHidden)}
                <Operator symbol={config.type === "take_from" || config.type === "take_apart" ? "−" : "+"} isDark={isDark} />
                {group(config.type === "take_from" ? "Went away" : config.type === "take_apart" ? "Known part" : "Next", config.second, "indigo", secondHidden, config.type === "take_from" && !secondHidden)}
                {/* Three groups need their operators too — they were simply missing. */}
                {config.type === "three_addends" && <Operator symbol="+" isDark={isDark} />}
                {config.type === "three_addends" && group("Last", config.third, "rose")}
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

        {/*
          The answer choices.

          They were default outline buttons at text size — the smallest thing on
          a mat built for six-year-olds, and the only thing they have to hit.
          These are proper targets: one row, mono digits at reading size, and a
          state a child can read from across a table.
        */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3" role="group" aria-label="Answer choices">
          {choices.map(value => {
            const wrong = selected === value && value !== answer;
            const correct = solved && value === answer;
            const dimmed = solved && value !== answer;

            return (
              <button
                key={value}
                type="button"
                disabled={!isPlayMode || solved}
                onClick={() => { reportActivity(); choose(value); }}
                aria-pressed={selected === value}
                aria-label={`Answer ${value}`}
                className={`flex items-center justify-center gap-1.5 rounded-2xl border-2 font-mono font-black tabular-nums
                  outline-none transition-[transform,background-color,border-color,opacity] duration-150
                  focus-visible:ring-4 focus-visible:ring-indigo-400/40
                  ${compact ? "h-11 min-w-[3rem] px-3 text-lg" : "h-14 min-w-[4rem] px-4 text-2xl sm:h-16 sm:min-w-[4.5rem] sm:text-3xl"}
                  ${isPlayMode && !solved ? "cursor-pointer hover:-translate-y-0.5 active:scale-95" : "cursor-default"}
                  ${correct
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                    : wrong
                      ? "animate-shake border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200"
                      : isDark
                        ? "border-white/10 bg-white/[0.08] text-slate-100 hover:border-white/25 hover:bg-white/[0.14]"
                        : "border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:shadow-md"}
                  ${dimmed ? "opacity-40" : ""}`}
              >
                <AnimatePresence mode="popLayout">
                  {correct && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Check size={compact ? 16 : 22} strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
                {value}
              </button>
            );
          })}
        </div>
      </div>
    </SharedCanvasLayout>
  );
};
