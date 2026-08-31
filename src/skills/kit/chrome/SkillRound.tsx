import React, { useEffect, useRef } from "react";
import type { ActivityLesson, KodaSDK } from "../../types";
import { UIKidMessage } from "../../../components/ui";
import { PracticeStepHeader, type StepTagLabels } from "./PracticeStepHeader";
import { SkillHint } from "./SkillHint";
import { PracticeRoundCompleteModal } from "./RoundCompleteModal";
import { SkillRoundTopBar, type SkillVoiceContext } from "./SkillRoundTopBar";
import type { RoundController } from "../round/useSkillRound";

/**
 * How long a correct answer's praise stays up before the round moves on.
 *
 * Matched to the recorded praise clips, which run 1.7–2.1 seconds: advancing
 * sooner cuts the voice off mid-sentence, which is the same mistake as
 * congratulating a child over the last number they counted.
 */
const PRAISE_MS = 2300;

/** One round is on screen at a time, so the panel can have a fixed name. */
const HINT_PANEL_ID = "skill-round-hint";

export interface SkillRoundProps {
  koda: KodaSDK;
  /** Which lesson is running, for the bar and the completion modal. */
  lesson?: ActivityLesson;
  /** Fallback name when a mount supplied no lesson. */
  fallbackTitle: string;
  round: RoundController;
  totalQuestions: number;
  /** The question, in words. Read aloud and shown in the step header. */
  prompt: string;
  onExit(): void;
  onReadAloud(): void;
  /**
   * This question's hint ladder, gentlest first — usually built with
   * `composeHints`. Empty (or omitted) takes the Hint button off the header.
   *
   * Rebuilt on every render on purpose: a hint that describes what the child
   * has already done — "you have filled four of the ten" — has to be read off
   * live state, not off the question. Which rung is showing lives on
   * `round.hint`, so a skill supplies the words and nothing else.
   */
  hints?: string[];
  /** What the child is answering. The only part a skill draws itself. */
  children: React.ReactNode;
  iconName?: string;
  iconTone?: string;
  voice?: SkillVoiceContext;
  tagLabels?: Partial<StepTagLabels>;
  contextTag?: React.ReactNode | null;
  /** Extra controls for the bar. Rarely needed. */
  extras?: React.ReactNode;
  /** What the log advises next, shown on the completion modal. */
  recommendation?: { kind: string; kidMessage: string };
  onNextLevel?(): void;
  onPracticeAgain?(): void;
}

/**
 * Everything around a question.
 *
 * The bar, the step header, the feedback message and the completion modal are
 * the same in every skill, so a skill should not be assembling them — it should
 * hand over what is being asked and draw the part a child touches. Before this,
 * each skill wired all four itself, which is how one ended up with a bespoke
 * top bar and a non-standard feedback message.
 */
export const SkillRound: React.FC<SkillRoundProps> = ({
  koda,
  lesson,
  fallbackTitle,
  round,
  totalQuestions,
  prompt,
  onExit,
  onReadAloud,
  hints = [],
  children,
  iconName,
  iconTone,
  voice,
  tagLabels,
  contextTag,
  extras,
  recommendation,
  onNextLevel,
  onPracticeAgain,
}) => {
  const title = lesson?.title ?? fallbackTitle;
  const levelNumber = lesson?.levelNumber ?? 1;

  /*
   * What Koda is told about the question on screen.
   *
   * Built here rather than asked of the skill, because everything it needs is
   * already on this component — the lesson, the question in words, where the
   * child is in the round — and a skill that forgot to pass it left a child
   * with no help exactly where they were stuck. A skill that wants to hand over
   * more, including the two things only the voice coach can do, still can.
   */
  const help: SkillVoiceContext = {
    topic: lesson?.concept ?? title,
    questionText: prompt,
    problemContext: `Question ${round.index} of ${totalQuestions} in "${title}"${
      lesson?.concept ? `, which teaches ${lesson.concept}` : ""
    }.`,
    ...voice,
  };

  /*
   * Move on by itself after a right answer.
   *
   * Read from `round.feedback` rather than fired at the call site so every skill
   * behaves the same way — an activity that forgot to schedule it would strand
   * the child on a feedback panel with no button, since the button is now shown
   * only for a wrong answer.
   */
  const advanceRef = useRef(round.advance);
  advanceRef.current = round.advance;
  const correctFeedback = round.feedback?.status === "correct";

  useEffect(() => {
    if (!correctFeedback) return;
    // Tunable through the SDK, like every other timing a lesson may want to
    // adjust — and so a test can set it to 0 rather than spending two real
    // seconds per question watching an animation it does not assert on.
    const wait = koda.config.get("praiseMs", PRAISE_MS);
    if (wait <= 0) {
      advanceRef.current();
      return;
    }
    const timer = window.setTimeout(() => advanceRef.current(), wait);
    return () => window.clearTimeout(timer);
  }, [correctFeedback, round.index, koda]);

  /*
   * Where this round left the learner — XP, streak, today's count.
   *
   * Read once the round is scored rather than on mount, because the round is
   * what changes it: the host records the practice and the XP as it hears the
   * result, so a snapshot taken at the start would show the streak the child had
   * *before* the round that extended it, and congratulate them on yesterday.
   *
   * Undefined until it arrives, and the modal draws a complete screen without
   * it — a preview with telemetry off is not shown a broken streak.
   */
  const [standing, setStanding] = React.useState<
    | {
        xpAfter: number;
        streakDays: number;
        cadence?: "daily" | "weekly";
        dailySolved: number;
        dailyGoal: number;
      }
    | undefined
  >();

  const scored = Boolean(round.score);
  useEffect(() => {
    if (!scored) {
      setStanding(undefined);
      return;
    }
    let live = true;
    void koda.progress
      .snapshot()
      .then((snap) => {
        if (!live) return;
        setStanding({
          xpAfter: snap.xp,
          streakDays: snap.streakDays,
          cadence: snap.streakCadence,
          dailySolved: snap.dailySolved,
          dailyGoal: snap.dailyGoal,
        });
      })
      // A host that cannot answer leaves the screen as it was before this
      // existed. Nothing a child sees may depend on a figure arriving.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [scored, koda]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SkillRoundTopBar
        koda={koda}
        title={title}
        subtitle={lesson?.concept}
        levelNumber={lesson?.levelNumber}
        iconName={iconName}
        iconTone={iconTone}
        questionIndex={round.index}
        totalQuestions={totalQuestions}
        onExit={onExit}
        voice={help}
        extras={extras}
      />

      <main className="flex-1 p-3 sm:p-6 pb-32 flex flex-col justify-center max-w-4xl mx-auto w-full">
        {/*
          * No card around the question.
          *
          * The round already sits on its own full-bleed screen, so wrapping it
          * in a translucent panel drew a box whose only content was another box
          * — the play scene — and boxes inside boxes is most of what makes a
          * screen feel busy. The activity is the page; it does not need framing.
          */}
        <div className="space-y-5">
          <PracticeStepHeader
            stepNumber={round.index}
            totalSteps={totalQuestions}
            title={prompt}
            showTip={round.hint.open}
            onToggleTip={round.hint.toggle}
            hintCount={hints.length}
            hintPanelId={HINT_PANEL_ID}
            onReadAloud={onReadAloud}
            levelNumber={levelNumber}
            contextTag={contextTag}
            tagLabels={tagLabels}
          />
          {/* Above the play area, under the question it is a hint about. A
              child looking for help looks where the question is, and a panel
              below the scene would be off-screen on a phone exactly when it is
              wanted. */}
          <SkillHint koda={koda} hints={hints} hint={round.hint} id={HINT_PANEL_ID} />
          {children}
        </div>
      </main>

      {/* `bg-surface` on the strip below, which is what `MainLayout`'s column
          paints the page — not `bg-canvas`. The two differ by a shade (#FFFFFF
          against #F8FAFC), so the sticky strip drew a second, greyer background
          in a band around the message card and the feedback read as two stacked
          panels rather than one. Opaque, so the blur it carried has nothing left
          to do. */}
      {round.feedback && (
        <div className="sticky bottom-0 left-0 right-0 z-30 p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(1rem+env(safe-area-inset-bottom))] bg-surface">
          <UIKidMessage
            tone={round.feedback.status === "correct" ? "correct" : "tryAgain"}
            title={round.feedback.title}
            message={round.feedback.message}
            /*
             * A right answer moves on by itself — and still offers the button.
             *
             * Auto-advance keeps the rhythm of a round: a child who has just
             * been told they were right should not have to hunt for "Next".
             * Removing the button entirely was worse, though, because it leaves
             * a child who wants to go *now* with nothing to tap and no way to
             * skip the praise. Both, so neither impatience nor inaction stalls.
             */
            actionLabel={round.feedback.status === "correct" ? "Next" : "Try again"}
            onAction={round.advance}
          />
        </div>
      )}

      {round.score && (
        <PracticeRoundCompleteModal
          levelNumber={levelNumber}
          levelTitle={title}
          totalLessons={lesson?.totalLessons}
          stars={round.score.stars}
          xpWon={round.score.xp}
          perfect={round.score.perfect}
          standing={standing}
          nextLevelNumber={levelNumber + 1}
          recommendation={recommendation}
          onNextLevel={onNextLevel ?? onExit}
          onPracticeAgain={onPracticeAgain ?? round.restart}
        />
      )}
    </div>
  );
};
