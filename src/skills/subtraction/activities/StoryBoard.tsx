import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, SPRING, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, guideSetup, useGuide, type PracticeSetup, type RoundQuestion,
  answerChoices,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { COMPARISON, DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { SCENE, TOUCH_TARGET } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import { fillTemplate, sceneAt, type StoryScene } from "../internal/data/storyCast";
import {
  drawSubtractionStory, type StoryKind, type StoryNumbers, type StorySpec,
} from "../internal/data/subtractionNumbers";
import { listAnd, ts } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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

/** Wording of last resort and the question asked, in the language on screen (`story.template.*`, `story.question.*`). */
const defaultTemplate = (mode: StoryMode): string => ts(`story.template.${mode}`);
const questionFor = (mode: StoryMode): string => ts(`story.question.${mode}`);

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
        { key: "whole", label: ts("story.bar.startedWith"), value: v0, role: "whole" },
        { key: "removed", label: ts("story.bar.givenAway"), value: v1, role: "removed" },
        { key: "left", label: ts("story.bar.left"), role: "remaining", unknown: true },
      ];
    case "remove_change":
      return [
        { key: "whole", label: ts("story.bar.startedWith"), value: v0, role: "whole" },
        { key: "removed", label: ts("story.bar.givenAway"), role: "removed", unknown: true },
        { key: "left", label: ts("story.bar.left"), value: v1, role: "remaining" },
      ];
    case "remove_start":
      return [
        { key: "whole", label: ts("story.bar.startedWith"), role: "whole", unknown: true },
        { key: "removed", label: ts("story.bar.givenAway"), value: v0, role: "removed" },
        { key: "left", label: ts("story.bar.left"), value: v1, role: "remaining" },
      ];
    case "compare_difference":
      return [
        { key: "smaller", label: ts("story.bar.firstGroup"), value: v0, role: "other" },
        { key: "bigger", label: ts("story.bar.secondGroup"), value: v1, role: "whole" },
        { key: "gap", label: ts("story.bar.difference"), role: "remaining", unknown: true },
      ];
    case "compare_bigger":
      return [
        { key: "smaller", label: ts("story.bar.firstGroup"), value: v0, role: "other" },
        { key: "gap", label: ts("story.bar.moreThanFirst"), value: v1, role: "remaining" },
        { key: "bigger", label: ts("story.bar.secondGroup"), role: "whole", unknown: true },
      ];
    case "compare_smaller":
      return [
        { key: "bigger", label: ts("story.bar.firstGroup"), value: v0, role: "whole" },
        { key: "gap", label: ts("story.bar.fewerThanFirst"), value: v1, role: "remaining" },
        { key: "smaller", label: ts("story.bar.secondGroup"), role: "other", unknown: true },
      ];
    default:
      return [
        { key: "start", label: ts("story.bar.startedWith"), value: numbers.values[0], role: "whole" },
        { key: "found", label: ts("story.bar.found"), value: numbers.values[1], role: "other" },
        { key: "gave", label: ts("story.bar.gaveAway"), value: numbers.values[2], role: "removed" },
        { key: "left", label: ts("story.bar.left"), role: "remaining", unknown: true },
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
  const template = setup.templates?.[index % (setup.templates.length || 1)] ?? defaultTemplate(mode);
  return {
    id: `q${index}-${Date.now().toString(36)}`, taskKind: `subtract_story_${mode}`,
    mode, ...numbers, scene,
    sentence: fillTemplate(template, scene, numbers.values),
    question: fillTemplate(questionFor(mode), scene, numbers.values),
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
  answer: q.mode === "multi_step" ? ts("story.thenAnswer", { first: q.intermediate ?? 0, answer: q.answer }) : String(q.answer),
});

export const methodFor = (q: StoryQuestion): string[] => q.comparison
  ? [ts("story.methodCompare1"), ts("story.methodCompare2"), ts("story.methodCompare3")]
  : q.mode === "multi_step"
    ? [ts("story.methodMulti1"), ts("story.methodMulti2"), ts("story.methodMulti3")]
    : [ts("story.method1"), ts("story.method2"), ts("story.method3")];

export function storyHints(
  q: StoryQuestion,
  state: { answered: number; kidTip?: string },
): string[] {
  const unknown = q.bars.find((bar) => bar.unknown)!;
  if (q.mode === "multi_step") return composeHints(
    state.kidTip ?? ts("story.hintMultiTip"),
    state.answered === 0
      ? ts("story.hintFirst", { a: q.values[0], b: q.values[1] })
      : ts("story.hintNowTake", { c: q.values[2], first: q.intermediate ?? 0 }),
    state.answered === 0
      ? ts("story.hintAfterFirst", { first: q.intermediate ?? 0 })
      : ts("story.hintThen", { answer: q.answer }),
  );
  if (q.comparison) return composeHints(
    state.kidTip ?? ts("story.hintCompareTip"),
    ts("story.hintKeep", { label: unknown.label }),
    /* Which bar is missing *is* the technique: one lesson grows the shorter
       bar by the gap, the other shortens the longer one by it. Both used to
       end on the same sentence. */
    q.mode === "compare_bigger"
      ? ts("story.hintShorter", { gap: q.values[1], answer: q.answer })
      : q.mode === "compare_smaller"
        ? ts("story.hintLonger", { gap: q.values[1], answer: q.answer })
        : ts("story.hintDiffer", { answer: q.answer, label: unknown.label }),
  );
  return composeHints(
    state.kidTip ?? ts("story.hintTip"),
    ts("story.hintStates", {
      known: listAnd(q.bars.filter((bar) => !bar.unknown).map((bar) => ts("story.barValue", { label: bar.label, value: bar.value ?? 0 }))),
      label: unknown.label,
    }),
    ts("story.hintMakes", { label: unknown.label, answer: q.answer }),
  );
}

const BAR_TONE = { whole: WHOLE, removed: REMOVED_PART, remaining: DIFFERENCE, other: COMPARISON };

export const figureFor = (q: StoryQuestion): React.ReactNode => {
  const widest = Math.max(...q.bars.map((bar) => bar.value ?? q.answer), 1);
  return <span className="inline-flex flex-col gap-1 text-slate-900" role="img"
    aria-label={ts(q.comparison ? "story.figureCompare" : "story.figureRemove", { label: q.bars.find((bar) => bar.unknown)!.label })}>
    {q.bars.map((bar) => <span key={bar.key} className="inline-flex items-center gap-1.5 text-[9px]">
      <span className="inline-block w-20 text-right">{bar.label}</span>
      <span className="inline-block h-4 border-2 border-slate-900" style={{ width: `${Math.max(8, ((bar.value ?? q.answer) / widest) * 120)}px` }} />
      <span className="inline-block w-6">{bar.unknown ? "?" : bar.value}</span>
    </span>)}
  </span>;
};

/** Four near misses, ordered by the question so they cannot be learned by position. */
const choicesFor = (answer: number, seed: string): number[] => answerChoices(answer, seed);

export const StoryBoard: React.FC<ActivityProps<StoryBoardParams>> = ({ params, koda, onComplete, lesson }) => {
  // Re-render when the language changes: every line below reads the catalog.
  useT();
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

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    setBuilt(false);
    setStep(0);
    nudge.clear();
  };


  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const prompt = promptFor(q, copy.prompts?.default);
  const multi = q.mode === "multi_step";
  const target = multi && step === 0 ? q.intermediate! : q.answer;

  const answer = (value: number) => {
    if (multi && step === 0) {
      if (value !== q.intermediate) {
        nudge.refuse(ts("story.refuseFirst", { who: q.scene.who.name }));
        return;
      }
      setStep(1);
      round.useSupport("walkthrough");
      chime(koda, "changed");
      return;
    }
    const correct = value === q.answer;
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({
      correct, given: multi ? `${q.intermediate},${value}` : String(value), expected: q.expected,
      errorKind: correct ? undefined : value === q.values[0] - q.values[1] && q.mode === "remove_start" ? "reversed" : "off_by_more",
      title: correct ? ts("story.rightTitle") : ts("story.readAgain"),
      message: practising ? undefined : `${q.sentence} ${q.question} ${q.answer}.`,
    });
  };

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : storyHints(q, { answered: step, kidTip: copy.kidTip });
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: q.id,
    rungs: hints,
    target: -1,
    progress: step,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle={ts("story.title")} round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="search" iconTone="cyan"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={hints}
    guide={practising ? undefined : guide}
    guideMethod={copy.stepByStep}
    onStartOver={
      !round.feedback && (built || step > 0) ? restart : undefined
    }
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(`${q.sentence} ${q.question}`, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-4 sm:p-6 space-y-4`}>
        <p className="text-center text-lg sm:text-xl font-bold text-ink">{q.sentence}</p>

        {built ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING.enter}
          className="space-y-2 mx-auto max-w-sm" role="group" aria-label={ts(q.comparison ? "story.modelCompare" : "story.modelRemove")}>
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
          <button type="button" onClick={() => { setBuilt(true); round.useSupport("walkthrough"); chime(koda, "changed"); }}
            className={`${TOUCH_TARGET} ${themeSystem.button("secondary", "md")}`}>{ts("story.drawBars")}</button>
        </div>}

        <p className="text-center text-base font-black text-ink">{multi && step === 0 ? ts("story.firstQuestion", { who: q.scene.who.name }) : q.question}</p>

        {scaffold && !practising && <div className="text-center text-sm font-bold text-ink/60">
          {q.comparison
            ? ts("story.helpCompare")
            : multi ? ts("story.helpMulti")
              : ts("story.help")}
        </div>}
      </div>

      <div className="flex flex-wrap justify-center gap-2.5">
        {choicesFor(target, q.id).map((value) => <button key={value} type="button" onClick={() => answer(value)}
          disabled={Boolean(round.feedback)} className={themeSystem.button("secondary", "choice")}>{value}</button>)}
      </div>
    </div>
  </SkillRound>;
};
