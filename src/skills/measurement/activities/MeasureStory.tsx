import React, { useCallback, useRef } from "react";
import { readsAloud } from "../internal/readsAloud";
import type { ActivityProps } from "../../types";
import {
  HowToPlay,
  HowToPlayButton,
  SkillRound,
  composeHints,
  isPractice,
  playCopy,
  useHowToPlay,
  useSkillRound,
  type DemoPhase,
  type DemoStep,
  type RoundQuestion,
} from "../../kit";
import { tx } from "../internal/i18n";
import { buildStory, storyChoices, type StoryQuestion, type StorySetup } from "../internal/story";
import { seededOrder } from "../internal/ruler";
import { symbolFor } from "../internal/units";
import type { Region } from "../../region";
import { BarModel } from "./dials";

/**
 * MeasureStory — word problems with measures, one unit at a time. The story
 * is the prompt; the bar model is the second hint, never the answer.
 */

interface StoryParams extends StorySetup {
  question?: StorySetup;
}
export interface StoryRoundQuestion extends RoundQuestion {
  q: StoryQuestion;
}

const sym = (q: StoryQuestion, region: Region) => symbolFor(q.unit, region);

export function storyPrompt(q: StoryQuestion, region: Region = "INTL"): string {
  return tx(`story.t.${q.template}`, { a: String(q.a), b: String(q.b), u: sym(q, region) });
}

export function buildStoryQuestion(params: StoryParams, index: number, seen: Set<string> = new Set(), region: Region = "INTL"): StoryRoundQuestion {
  const setup = { ...params, ...params.question };
  const q = buildStory(setup, seen);
  return {
    id: `story-${index}-${q.template}-${q.a}-${q.b}`,
    taskKind: `story_${q.kind}`,
    prompt: storyPrompt(q, region),
    expected: `${q.answer} ${sym(q, region)}`,
    q,
  };
}

export function storyHints(q: StoryQuestion, kidTip?: string): string[] {
  const vars = { a: String(q.a), b: String(q.b) };
  return composeHints(kidTip, tx(`story.hint.${q.kind}.look`, vars), tx(`story.hint.${q.kind}.worked`, vars));
}

const choiceClass =
  "min-h-11 min-w-24 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-lg font-black text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

export const MeasureStory: React.FC<ActivityProps<StoryParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = { ...params, ...params.question };
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;
  const region = koda.ui.region;
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const seen = useRef(new Set<string>());

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising || !readsAloud(lesson?.id) ? undefined : copy.audioPrompt,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildStoryQuestion(params, i, seen.current, region), [params, region]),
    onComplete,
  });
  const question = round.question as StoryRoundQuestion;
  const q = question.q;
  const locked = Boolean(round.feedback);
  const unit = sym(q, region);

  const demo = useHowToPlay(`${koda.skillId}/story`, !practising);
  const sayCaption = useCallback((line: string) => {
    if (speechEnabled) void koda.speech.say(line, { rate: koda.config.get("speechRate", 1) });
  }, [speechEnabled, koda]);

  const submit = (v: number) => {
    if (locked) return;
    const correct = v === q.answer;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success(); else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: `${v} ${unit}`,
      expected: `${q.answer} ${unit}`,
      title: tx(correct ? "title.right" : "title.wrong"),
      message: correct ? tx("story.right", { amount: `${q.answer} ${unit}` }) : tx(`story.wrong.${q.kind}`),
    });
  };

  const hints = practising ? [] : storyHints(q, copy.kidTip);
  const rung = round.hint.open ? round.hint.level : 0;

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={storyPrompt(q, region)}
      round={round}
      totalQuestions={total}
      prompt={question.prompt ?? ""}
      onExit={() => koda.ui.exit()}
      hints={hints}
      iconName="layers"
      iconTone="indigo"
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {rung >= 2 && <BarModel kind={q.kind} a={q.a} b={q.b} unit={unit} />}
        <div className="flex flex-wrap justify-center gap-2">
          {seededOrder(storyChoices(q), question.id).map((v) => (
            <button key={v} type="button" disabled={locked} className={choiceClass} onClick={() => submit(v)}>
              {v} {unit}
            </button>
          ))}
        </div>
        {!practising && <HowToPlayButton onClick={demo.show} />}
      </div>
      <HowToPlay
        open={demo.open}
        steps={storyDemoSteps()}
        scene={(step, phase) => <StoryDemoScene step={step} phase={phase} />}
        onClose={demo.close}
        speak={sayCaption}
      />
    </SkillRound>
  );
};

/* ------------------------------------------------------------ demo: 600 g − 250 g */

export const storyDemoFacts = () => ({ kind: "left" as const, a: 600, b: 250, answer: 350 });

export function storyDemoSteps(): DemoStep[] {
  return [
    { caption: tx("demo5.storyIntro"), holdMs: 2600 },
    { caption: tx("demo5.storyBar"), holdMs: 2600 },
    { caption: tx("demo5.storyAnswer"), hand: [[0.7, 0.62]], moveMs: 900, holdMs: 2400 },
  ];
}

const StoryDemoScene: React.FC<{ step: number; phase: DemoPhase }> = ({ step, phase }) => {
  const f = storyDemoFacts();
  const solved = step > 2 || (step === 2 && phase === "done");
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-3 overflow-hidden rounded-2xl border-[3px] border-ink/80 bg-surface p-3" data-testid="story-demo">
      {step >= 1 && <BarModel kind={f.kind} a={f.a} b={f.b} unit="g" />}
      {solved && <p className="text-center text-2xl font-black text-emerald-700 dark:text-emerald-300">{f.answer} g</p>}
    </div>
  );
};
