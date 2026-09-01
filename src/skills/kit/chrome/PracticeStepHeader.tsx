import React from "react";
import { themeSystem } from "../../../lib/themeSystem";
import { Volume2, Lightbulb } from "lucide-react";

/**
 * The four rungs of the step ladder, named rather than positional so a skill can
 * reword one without knowing which step index it lands on.
 */
export interface StepTagLabels {
  warmup: string;
  activity: string;
  guided: string;
  milestone: string;
}

export const DEFAULT_STEP_TAGS: StepTagLabels = {
  warmup: "Warm-up Exercise 🌱",
  activity: "Interactive Activity 🚀",
  guided: "Guided Challenge 🌟",
  milestone: "Final Milestone 🏆",
};

interface PracticeStepHeaderProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  /** Whether the hint panel below is open. */
  showTip: boolean;
  onToggleTip: () => void;
  /**
   * How many rungs this question's hint ladder has.
   *
   * Zero hides the button entirely. A control that opens an empty panel is
   * worse than no control — which is what this was until the ladder existed:
   * the button toggled a boolean nothing rendered, so a child who asked for
   * help got a highlighted button and silence.
   */
  hintCount: number;
  /** The panel the button opens, named so a screen reader can follow it. */
  hintPanelId?: string;
  onReadAloud: () => void;
  levelNumber?: number;
  /**
   * The chip beside "Step n of m", owned by the skill rather than by this
   * header. Left undefined, the default ladder below applies; passed `null`,
   * the chip is dropped entirely — a skill (or a teacher, via a skill toggle)
   * can decide the framing is noise for its learners.
   */
  contextTag?: React.ReactNode | null;
  /**
   * Same ladder, the skill's own words. Partial on purpose: a skill that only
   * cares about the warm-up wording overrides that rung and inherits the rest.
   * Ignored when `contextTag` is given, which is the blunter instrument.
   */
  tagLabels?: Partial<StepTagLabels>;
}

export const PracticeStepHeader: React.FC<PracticeStepHeaderProps> = ({
  stepNumber,
  totalSteps,
  title,
  showTip,
  onToggleTip,
  hintCount,
  hintPanelId,
  onReadAloud,
  levelNumber,
  contextTag,
  tagLabels,
}) => {
  // Determine an inviting contextual tag instead of a dry "CHALLENGE"
  const getContextTag = () => {
    const t = { ...DEFAULT_STEP_TAGS, ...tagLabels };
    if (stepNumber === totalSteps) return t.milestone;
    if (stepNumber === 1) return t.warmup;
    if (stepNumber % 2 === 0) return t.activity;
    return t.guided;
  };

  // `undefined` means "no opinion, use the default"; `null` means "no chip".
  const tag = contextTag === undefined ? getContextTag() : contextTag;

  return (
    <div
      id="practice-step-header"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 py-2 sm:px-2"
    >
      <div className="space-y-1.5 min-w-0">
        {/*
          * No progress here.
          *
          * "STEP 1 OF 5" in 10px monospace was a developer's status bar above a
          * five-year-old's question, so it went — but replacing it with dots
          * only gave the screen two progress indicators arguing with the round
          * bar three inches above. The bar owns progress; this owns the question.
          */}
        {tag && <span className="sr-only">{tag}</span>}
        {/* The question itself is the thing to read, so it is sized like it. */}
        <h2 className="text-xl sm:text-2xl md:text-[1.75rem] font-extrabold text-ink leading-snug tracking-tight font-sans">
          {title}
        </h2>
      </div>

      {/*
        * The two helpers, drawn by the design system.
        *
        * Both were hand-rolled class strings that had drifted from it — one
        * `border-line` and amber text, the other an indigo tint with its own
        * hover, and both in monospace. `themeSystem.button` already describes
        * exactly these two roles, so a control that opts out of it is a control
        * nobody re-themes when the palette moves.
        *
        * `secondary` while the hint is closed and `primary` while it is open, so
        * the button shows its own state rather than relying on the label alone.
        */}
      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
        <button
          onClick={onReadAloud}
          className={themeSystem.button("secondary", "icon", "min-w-[44px] min-h-[44px]")}
          title="Read question aloud"
          aria-label="Read question aloud"
        >
          <Volume2 />
        </button>

        {hintCount > 0 && (
          <button
            onClick={onToggleTip}
            className={themeSystem.button(showTip ? "primary" : "secondary", "md", "min-h-[44px]")}
            aria-expanded={showTip}
            aria-controls={hintPanelId}
          >
            <Lightbulb />
            <span>{showTip ? "Hide hint" : "Hint"}</span>
          </button>
        )}
      </div>
    </div>
  );
};
