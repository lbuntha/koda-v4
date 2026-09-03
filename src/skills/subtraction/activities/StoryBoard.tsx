import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, SPRING, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, type PracticeSetup, type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { COMPARISON, DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { SCENE, TOUCH_TARGET } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { fillTemplate, sceneAt, type StoryScene } from "../internal/data/storyCast";
import {
  drawSubtractionStory, type StoryKind, type StoryNumbers, type StorySpec,
} from "../internal/data/subtractionNumbers";

export type StoryMode = StoryKind;

export interface StorySetup extends PracticeSetup, StorySpec {
  mode?: StoryMode;
  /** Sentence templates, authored in lesson JSON over the fixed cast. */
  templates?: string[];
  questionsPerRound?: number;
}

export interface StoryBoardParams extends StorySetup { question?: StorySetup }

/** One labelled bar in the model. */
export interface StoryBar {
  key: string;
  label: string;
  value?: number;
  role: "whole" | "removed" | "remaining" | "other";
  unknown?: boolean;
}

export interface StoryQuestion extends RoundQuestion, StoryNumbers {
  mode: StoryMode;
  sentence: string;
  question: string;
  scene: StoryScene;
  comparison: boolean;
  bars: StoryBar[];
  /** `multi_step` asks twice, so it carries the first answer as well. */
  firstAnswer?: number;
}

const DEFAULT_TEMPLATE: Record<StoryMode, string> = {
  remove_result: "{who} had {v0} {item}. {who} gave {v1} away.",
  remove_change: "{who} had {v0} {item}. Now {who} has {v1}.",
  remove_start: "{who} gave away {v0} {item} and has {v1} left.",
  compare_difference: "{who} has {v0} {item}. {other} has {v1}.",
  compare_bigger: "{who} has {v0} {item}. {other} has {v1} more than {who}.",
  compare_smaller: "{who} has {v0} {item}. {other} has {v1} fewer than {who}.",
  multi_step: "{who} had {v0} {item}, then found {v1} more, then gave {v2} away.",
};

const QUESTION: Record<StoryMode, string> = {
  remove_result: "How many are left?",
  remove_change: "How many were given away?",
  remove_start: "How many were there to start with?",
  compare_difference: "How many more does one have than the other?",
  compare_bigger: "How many does {other} have?",
  compare_smaller: "How many does {other} have?",
  multi_step: "How many are left at the end?",
};

const COMPARISON_KINDS: StoryMode[] = ["compare_difference", "compare_bigger", "compare_smaller"];

/**
 * The bars a story is modelled with.
 *
 * Removal is one bar with a crossed segment: the quantity changed. Comparison
 * is two aligned bars and a measured gap, because nothing left either group —
 * calling that "taking away" is the misconception these lessons exist to stop.
 */
const barsFor = (kind: StoryMode, numbers: StoryNumbers): StoryBar[] => {
  const [v0, v1] = numbers.values;
  switch (kind) {
    case "remove_result":
      return [
        { key: "whole", label: "started with", value: v0, role: "whole" },
        { key: "removed", label: "given away", value: v1, role: "removed" },
        { key: "left", label: "left", role: "remaining", unknown: true },
      ];
    case "remove_change":
      return [
        { key: "whole", label: "started with", value: v0, role: "whole" },
        { key: "removed", label: "given away", role: "removed", unknown: true },
        { key: "left", label: "left", value: v1, role: "remaining" },
      ];
    case "remove_start":
      return [
        { key: "whole", label: "started with", role: "whole", unknown: true },
        { key: "removed", label: "given away", value: v0, role: "removed" },
        { key: "left", label: "left", value: v1, role: "remaining" },
      ];
    case "compare_difference":
      return [
        { key: "smaller", label: "first group", value: v0, role: "other" },
        { key: "bigger", label: "second group", value: v1, role: "whole" },
        { key: "gap", label: "difference", role: "remaining", unknown: true },
      ];
    case "compare_bigger":
      return [
        { key: "smaller", label: "first group", value: v0, role: "other" },
        { key: "gap", label: "more than the first", value: v1, role: "remaining" },
        { key: "bigger", label: "second group", role: "whole", unknown: true },
      ];
    case "compare_smaller":
      return [
        { key: "bigger", label: "first group", value: v0, role: "whole" },
        { key: "gap", label: "fewer than the first", value: v1, role: "remaining" },
        { key: "smaller", label: "second group", role: "other", unknown: true },
      ];
    default:
      return [
        { key: "start", label: "started with", value: numbers.values[0], role: "whole" },
        { key: "found", label: "found", value: numbers.values[1], role: "other" },
        { key: "gave", label: "gave away", value: numbers.values[2], role: "removed" },
        { key: "left", label: "left", role: "remaining", unknown: true },
      ];
  }
};

export const specFrom = (setup: StorySetup): StorySpec => ({
  startRange: setup.startRange, changeRange: setup.changeRange, resultRange: setup.resultRange,
  smallerRange: setup.smallerRange, differenceRange: setup.differenceRange,
});

export const buildQuestion = (setup: StorySetup, index: number, seen: Set<string>): StoryQuestion => {
  const mode = modeAt<StoryMode>(setup, index, "remove_result");
  const scene = sceneAt(index, seen.size);
  const numbers = drawSubtractionStory(mode, specFrom(setup));
  seen.add(`${mode}-${numbers.values.join("-")}`);
  const template = setup.templates?.[index % (setup.templates.length || 1)] ?? DEFAULT_TEMPLATE[mode];
  return {
    id: `q${index}-${Date.now().toString(36)}`, taskKind: `subtract_story_${mode}`,
    mode, ...numbers, scene,
    sentence: fillTemplate(template, scene, numbers.values),
    question: fillTemplate(QUESTION[mode], scene, numbers.values),
    comparison: COMPARISON_KINDS.includes(mode),
    bars: barsFor(mode, numbers),
    firstAnswer: numbers.intermediate,
    expected: mode === "multi_step" ? `${numbers.intermediate},${numbers.answer}` : String(numbers.answer),
    itemCount: numbers.values[0],
  };
};

export const promptFor = (q: StoryQuestion, template?: string): string => {
  const filled = template
    ? fillTemplate(template, q.scene, q.values)
    : undefined;
  return filled ?? `${q.sentence} ${q.question}`;
};

export const printedFor = (q: StoryQuestion): PrintedQuestion => ({
  text: `${q.sentence} ${q.question}`,
  answer: q.mode === "multi_step" ? `${q.intermediate}, then ${q.answer}` : String(q.answer),
});

export const methodFor = (q: StoryQuestion): string[] => q.comparison
  ? ["Draw one bar for each group, lined up at the left.", "The gap between their ends is the difference.", "Nothing is taken away — the bars are only compared."]
  : q.mode === "multi_step"
    ? ["Work out what happened after the first change.", "Apply the second change to that answer.", "Only the final amount answers the question."]
    : ["Draw one bar for the amount at the start.", "Mark the part that changed.", "The unknown is whichever part the story does not state."];

export function storyHints(
  q: StoryQuestion,
  state: { answered: number; kidTip?: string },
): string[] {
  const unknown = q.bars.find((bar) => bar.unknown)!;
  if (q.mode === "multi_step") return composeHints(
    state.kidTip ?? "Take the changes one at a time, in the order they happened.",
    state.answered === 0
      ? `First: ${q.values[0]} and ${q.values[1]} more.`
      : `Now take ${q.values[2]} away from ${q.intermediate}.`,
    state.answered === 0 ? `${q.values[0]} plus ${q.values[1]} is ${q.intermediate}.` : `${q.intermediate} minus ${q.values[2]} is ${q.answer}.`,
  );
  if (q.comparison) return composeHints(
    state.kidTip ?? "Line the two groups up and look at the gap.",
    `Both groups keep everything they have. The unknown is the ${unknown.label}.`,
    `The bars differ by ${q.mode === "compare_difference" ? q.answer : q.values[1]}, so the ${unknown.label} is ${q.answer}.`,
  );
  return composeHints(
    state.kidTip ?? "Find which part of the story is missing, then work out that part.",
    `The story states ${q.bars.filter((bar) => !bar.unknown).map((bar) => `${bar.label} ${bar.value}`).join(" and ")}. The ${unknown.label} is unknown.`,
    `That makes the ${unknown.label} ${q.answer}.`,
  );
}

const BAR_TONE = { whole: WHOLE, removed: REMOVED_PART, remaining: DIFFERENCE, other: COMPARISON };

export const figureFor = (q: StoryQuestion): React.ReactNode => {
  const widest = Math.max(...q.bars.map((bar) => bar.value ?? q.answer), 1);
  return <span className="inline-flex flex-col gap-1 text-slate-900" role="img"
    aria-label={`${q.comparison ? "Comparison" : "Removal"} bar model with the ${q.bars.find((bar) => bar.unknown)!.label} unknown`}>
    {q.bars.map((bar) => <span key={bar.key} className="inline-flex items-center gap-1.5 text-[9px]">
      <span className="inline-block w-20 text-right">{bar.label}</span>
      <span className="inline-block h-4 border-2 border-slate-900" style={{ width: `${Math.max(8, ((bar.value ?? q.answer) / widest) * 120)}px` }} />
      <span className="inline-block w-6">{bar.unknown ? "?" : bar.value}</span>
    </span>)}
  </span>;
};

const choicesFor = (answer: number) => Array.from({ length: 4 }, (_, i) => Math.max(0, answer - 2) + i);

export const StoryBoard: React.FC<ActivityProps<StoryBoardParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: StorySetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const practising = isPractice(setup);
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const [built, setBuilt] = useState(false);
  const [step, setStep] = useState(0);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const round = useSkillRound({
    koda, resumable: practising, totalQuestions, levelNumber: lesson?.levelNumber ?? 45,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => { void koda.progress.nextStep().then((value) => setNextStep(value)); onComplete(result); },
  });
  const q = round.question as StoryQuestion;

  useEffect(() => { setBuilt(false); setStep(0); nudge.clear(); }, [q.id, nudge.clear]);

  const chimes = koda.config.isEnabled("sound_chimes", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const prompt = promptFor(q, copy.prompts?.default);
  const multi = q.mode === "multi_step";
  const target = multi && step === 0 ? q.intermediate! : q.answer;

  const answer = (value: number) => {
    if (multi && step === 0) {
      if (value !== q.intermediate) {
        nudge.refuse(`Not yet — that is not what ${q.scene.who.name} had after the first change.`);
        return;
      }
      setStep(1);
      round.useSupport("walkthrough");
      if (chimes) koda.sound.play("clink");
      return;
    }
    const correct = value === q.answer;
    if (chimes) koda.sound.play(correct ? "success" : "error");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({
      correct, given: multi ? `${q.intermediate},${value}` : String(value), expected: q.expected,
      errorKind: correct ? undefined : value === q.values[0] - q.values[1] && q.mode === "remove_start" ? "reversed" : "off_by_more",
      title: correct ? "That is the story!" : "Read the story again",
      message: practising ? undefined : `${q.sentence} ${q.question} ${q.answer}.`,
    });
  };

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle="Subtraction Stories" round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="search" iconTone="cyan"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={practising ? [] : storyHints(q, { answered: step, kidTip: copy.kidTip })}
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(`${q.sentence} ${q.question}`, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-4 sm:p-6 space-y-4`}>
        <p className="text-center text-lg sm:text-xl font-bold text-ink">{q.sentence}</p>

        {built ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING.enter}
          className="space-y-2 mx-auto max-w-sm" role="group" aria-label={`${q.comparison ? "Comparison" : "Removal"} bar model`}>
          {q.bars.map((bar) => {
            const tone = BAR_TONE[bar.role];
            const value = bar.value ?? q.answer;
            const widest = Math.max(...q.bars.map((other) => other.value ?? q.answer), 1);
            return <div key={bar.key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink/55 text-right">{bar.label}</span>
              {/* The bar sizes itself inside a track of its own. As a direct
                  flex item its percentage width was shrunk back to the row, so
                  37 and 47 drew the same length — and a comparison model whose
                  bars match is showing the child the opposite of the point. */}
              <span className="flex-1 min-w-0">
                <span className={`block h-7 rounded-lg border-2 ${tone.border} ${bar.unknown ? "border-dashed bg-transparent" : tone.solid}`}
                  style={{ width: `${Math.max(8, (value / widest) * 100)}%` }} />
              </span>
              <span className={`w-8 shrink-0 text-lg font-black tabular-nums ${tone.text}`}>{bar.unknown ? "?" : bar.value}</span>
            </div>;
          })}
        </motion.div> : <div className="flex justify-center">
          <button type="button" onClick={() => { setBuilt(true); round.useSupport("walkthrough"); if (chimes) koda.sound.play("clink"); }}
            className={`${TOUCH_TARGET} ${themeSystem.button("secondary", "md")}`}>Draw the bars</button>
        </div>}

        <p className="text-center text-base font-black text-ink">{multi && step === 0 ? `First, how many did ${q.scene.who.name} have after finding more?` : q.question}</p>

        {scaffold && !practising && <div className="text-center text-sm font-bold text-ink/60">
          {q.comparison
            ? "Nobody gives anything away here — the bars are only compared."
            : multi ? "One change at a time, in the order they happened."
              : "The unknown is whichever part the story does not tell you."}
        </div>}
      </div>

      <div className="flex flex-wrap justify-center gap-2.5">
        {choicesFor(target).map((value) => <button key={value} type="button" onClick={() => answer(value)}
          disabled={Boolean(round.feedback)} className={themeSystem.button("secondary", "choice")}>{value}</button>)}
      </div>
    </div>
  </SkillRound>;
};
