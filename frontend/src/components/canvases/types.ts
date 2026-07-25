import { CountingQuestion } from "../../types";

export interface CanvasProps {
  question: CountingQuestion;
  isPlayMode: boolean; // false means design/editor mode, true means play/test mode
  showGrid?: boolean; // toggle to show grid overlay and optionally snap
  isDark?: boolean; // true = dark mode styling
  onCountUpdate?: (count: number) => void;
  onSuccess?: () => void;
  onUpdateQuestionConfig?: (config: Partial<CountingQuestion["config"]>) => void;
  /**
   * Report a single attempt for the standardized learning log — see
   * services/logSchema.ts. Optional and additive: `onSuccess` still fires on
   * solve and is automatically logged as a "correct" attempt by GameLauncher,
   * so no canvas needs to change to get baseline logging. Call `onAttempt`
   * directly (in addition to onSuccess) when the canvas can distinguish a
   * *wrong* attempt — e.g. a multiple-choice tap, a mismatched drop — since
   * that detail can't be inferred from onSuccess alone.
   */
  onAttempt?: (
    outcome: "correct" | "incorrect" | "partial",
    detail?: {
      expected?: unknown;
      selected?: unknown;
      blankIndex?: number;
      details?: Record<string, any>;
    },
  ) => void;
  /** Report an optional student-requested hint with component-specific detail. */
  onHint?: (details?: Record<string, any>) => void;
}

export interface Sparkle {
  id: number;
  x: number;
  y: number;
  color: string;
}
