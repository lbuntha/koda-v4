import React, { useCallback } from "react";
import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, playCopy, useSkillRound, type RoundQuestion } from "..";

/**
 * The whole activity contract, and nothing else.
 *
 * Read this instead of a production engine. `CountTray` is 1,017 lines and
 * `TouchOrbit` is 862 — most of it animation, layout and five modes' worth of
 * specifics, none of which is the contract. Everything an activity *must* do is
 * below, in about a hundred lines. Open a real engine afterwards, for the one
 * behaviour this does not show.
 *
 * It is not registered anywhere and teaches nothing. It exists to be read.
 */

interface ExampleParams {
  /** Lessons nest their generator options under `question`. */
  question?: { max?: number; questionsPerRound?: number; practice?: boolean };
  max?: number;
  questionsPerRound?: number;
}

interface ExampleQuestion extends RoundQuestion {
  /** Whatever the activity needs to draw itself. The skill owns this shape. */
  choices: number[];
  answer: number;
}

/**
 * Pure, seeded, and exported so tests can assert on questions without React.
 *
 * `index` is the question number, so the same params and index always give the
 * same question — which is what makes StrictMode's double render, a resumed
 * practice round, and a failing test all agree about what was asked.
 */
export function buildQuestion(params: ExampleParams, index: number): ExampleQuestion {
  const max = params.max ?? 5;
  const answer = ((index * 7) % max) + 1;
  const choices = Array.from({ length: max }, (_, i) => i + 1);
  return {
    id: `example-${index}`,
    taskKind: "pick_the_number",
    prompt: `Tap ${answer}.`,
    // `expected` is the answer key the round records. Always supply it: without
    // it the log cannot say what the child was asked, only what they did.
    expected: String(answer),
    itemCount: choices.length,
    choices,
    answer,
  };
}

/** Hints run from a nudge to real help, and never name the answer outright. */
export function exampleHints(question: ExampleQuestion): string[] {
  return composeHints(
    "Look at each number in turn.",
    `The number you want is ${question.answer > 3 ? "near the end" : "near the start"}.`,
  );
}

export const promptFor = (question: ExampleQuestion): string => question.prompt ?? "";

export const ExampleActivity: React.FC<ActivityProps<ExampleParams>> = ({ params, koda, onComplete, lesson }) => {
  // Lessons pass options under `question`; flatten once, and never mutate params.
  const setup = { ...params, ...params.question };
  const copy = playCopy(params);
  // Practice is a flag in params, never the lesson title. It suppresses the
  // opening line and hints, and resumes where the child stopped.
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  // Every switch declared in manifest.json must change something here, and have
  // a test proving it. A declared feature nothing reads is a dead control.
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    // The kit speaks this, gated on `audio_speech`. Practice opens silently.
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    nextQuestion: useCallback((index: number) => buildQuestion(setup, index), [setup]),
    onComplete,
  });
  const question = round.question as ExampleQuestion;

  const choose = (value: number) => {
    // One verdict per attempt. A wrong answer keeps the same question, so the
    // child answers it rather than being marched past it.
    const correct = value === question.answer;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success(); else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: String(value),
      expected: question.expected,
      title: correct ? "Yes!" : "Not that one",
      message: correct ? "That is the number." : "Have another look.",
    });
    // No XP, no learning calls, no completion handling — the hook owns all three.
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Example"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : exampleHints(question)}
      iconName="Sparkles"
      iconTone="indigo"
      /* The kit gates its own speech, but not this. An activity that calls
         `speech.say` itself must check `audio_speech`, or the switch does
         nothing — the failure is silent, and the skill looks finished. */
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), { rate: koda.config.get("speechRate", 1) });
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-wrap justify-center gap-3">
        {question.choices.map((value) => (
          // Real buttons, distinct accessible names, and a 44px floor.
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            disabled={!!round.feedback}
            className="min-h-11 min-w-11 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {value}
          </button>
        ))}
      </div>
    </SkillRound>
  );
};
