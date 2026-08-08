/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CanvasAnswerPanel — the "how many in total?" panel every counting canvas shows
 * once the child has finished moving objects around.
 *
 * This was copy-pasted into ten canvases, drifting a little each time: three of
 * them put the docking classes on the element motion animates, which the layout
 * pattern forbids because `mx-auto` and a spring transform fight over the same
 * property. Two grew a `panelRef` + ResizeObserver to measure their own copy.
 * The check logic was byte-identical in all ten apart from the expected number
 * and the wording of the "not quite" line.
 *
 * Split in two on purpose:
 *   - `useCanvasAnswer` owns the state machine (typing, checking, the success
 *     hand-off, reset on a new question) and nothing visual.
 *   - `CanvasAnswerPanel` owns the chrome and knows nothing about the activity.
 *
 * It takes plain props rather than reading `question.config`: where the settings
 * come from — a teacher's panel today, a prebuilt template later — is the host's
 * business, not the panel's.
 *
 * The pad here is the 5-column one the pattern doc specifies for counting
 * (digits, then Backspace / Clear). `NumberPad.tsx` is a different pad for a
 * different job: entering digits into a column-arithmetic grid.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, Calculator, Check, Delete } from "lucide-react";
import { sounds } from "../../sound";
import { Button } from "../ui";

export type AnswerStatus = "idle" | "error" | "correct";

export interface UseCanvasAnswerOptions {
  /** The number the child has to enter. */
  expected: number;
  /**
   * Cleared whenever this changes — pass the question's identity. A slide that
   * swaps the object or the count is a new question, and a stale "correct" on
   * it would skip the child straight past the next one.
   */
  resetKey: unknown;
  /** Body of the "Not quite!" banner. Static per canvas. */
  wrongMessage: string;
  /** Fired 500ms after a correct answer, so the success sound is heard first. */
  onSuccess?: () => void;
  /** True once the activity is complete and the panel is on screen. */
  open: boolean;
}

export interface CanvasAnswer {
  value: string;
  status: AnswerStatus;
  errorMessage: string;
  showNumberPad: boolean;
  solved: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setValue: (next: string) => void;
  check: (override?: string) => void;
  pressDigit: (digit: string) => void;
  pressBackspace: () => void;
  clear: () => void;
  toggleNumberPad: () => void;
  reset: () => void;
}

/** Longest answer a counting activity ever asks for is three digits. */
const MAX_DIGITS = 3;

export function useCanvasAnswer({
  expected,
  resetKey,
  wrongMessage,
  onSuccess,
  open
}: UseCanvasAnswerOptions): CanvasAnswer {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<AnswerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showNumberPad, setShowNumberPad] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const clearSuccessTimeout = () => {
    if (successTimeout.current) {
      clearTimeout(successTimeout.current);
      successTimeout.current = null;
    }
  };

  const reset = useCallback(() => {
    clearSuccessTimeout();
    setValue("");
    setStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);
  }, []);

  useEffect(() => {
    reset();
  }, [resetKey, reset]);

  // A pending success must not fire into an unmounted canvas.
  useEffect(() => clearSuccessTimeout, []);

  /*
    Autofocus once the panel is up, after its entrance spring has settled — a
    focus ring that arrives mid-flight lands somewhere the input no longer is.
    Cleaned up on close, which the ten hand-rolled copies never did.
  */
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [open]);

  const check = useCallback(
    (override?: string) => {
      const raw = override !== undefined ? override : value;
      const parsed = parseInt(raw.trim(), 10);

      if (raw.trim() === "" || isNaN(parsed)) {
        setStatus("error");
        setErrorMessage("Please enter a number!");
        sounds.playFailure();
        return;
      }

      if (parsed === expected) {
        setStatus("correct");
        setErrorMessage("");
        sounds.playSuccess();
        clearSuccessTimeout();
        successTimeout.current = setTimeout(() => {
          onSuccessRef.current?.();
          successTimeout.current = null;
        }, 500);
      } else {
        setStatus("error");
        setErrorMessage(wrongMessage);
        sounds.playFailure();
      }
    },
    [expected, value, wrongMessage]
  );

  /** Typing anything clears a wrong answer, so the banner tracks the attempt. */
  const clearError = useCallback(() => {
    setStatus(prev => (prev === "error" ? "idle" : prev));
    setErrorMessage("");
  }, []);

  /*
    A correct answer freezes the panel — the success hand-off is already pending,
    and letting a child keep typing would leave the input disagreeing with it.
  */
  const pressDigit = useCallback(
    (digit: string) => {
      if (status === "correct") return;
      clearError();
      setValue(current => (current.length < MAX_DIGITS ? current + digit : current));
    },
    [status, clearError]
  );

  const pressBackspace = useCallback(() => {
    if (status === "correct") return;
    clearError();
    setValue(current => current.slice(0, -1));
  }, [status, clearError]);

  const clear = useCallback(() => {
    if (status === "correct") return;
    clearError();
    setValue("");
  }, [status, clearError]);

  const toggleNumberPad = useCallback(() => setShowNumberPad(prev => !prev), []);

  const setValueChecked = useCallback(
    (next: string) => {
      if (status === "correct") return;
      setValue(next);
      clearError();
    },
    [status, clearError]
  );

  return {
    value,
    status,
    errorMessage,
    showNumberPad,
    solved: status === "correct",
    inputRef,
    setValue: setValueChecked,
    check,
    pressDigit,
    pressBackspace,
    clear,
    toggleNumberPad,
    reset
  };
}

/**
 * Where the panel sits over the stage.
 *
 * `left` is for canvases whose objects live on the right once the activity is
 * done (Move & Count, Magnets): the panel docks over the *emptied* bin, because
 * the question is "how many in total" and covering the evidence is the one
 * thing it must not do.
 */
export type AnswerPanelDock = "bottom" | "top" | "left";

const DOCK_CLASS: Record<AnswerPanelDock, string> = {
  bottom: "absolute z-50 inset-x-2 bottom-2 pointer-events-none flex justify-center",
  top: "absolute z-50 inset-x-2 top-2 pointer-events-none flex justify-center",
  left:
    "absolute z-50 pointer-events-none inset-x-2 top-2 sm:inset-x-auto sm:left-3 sm:top-0 " +
    "sm:bottom-0 sm:w-[calc(50%-1.5rem)] sm:flex sm:items-center"
};

export interface CanvasAnswerPanelProps {
  answer: CanvasAnswer;
  /** Render the panel. Wrap in nothing — the component brings its own AnimatePresence. */
  open: boolean;
  /** The question, e.g. "How many apples did you move in total?" */
  prompt: React.ReactNode;
  isDark?: boolean;
  dock?: AnswerPanelDock;
  /**
   * The panel's measured height, whenever it changes.
   *
   * Canvases that shrink their play area to make room (One-to-One, Line Up) need
   * the real number: the panel grows by about half again when the child opens
   * the number pad, and the objects above have to move by exactly that much.
   */
  onHeightChange?: (height: number) => void;
}

export const CanvasAnswerPanel: React.FC<CanvasAnswerPanelProps> = ({
  answer,
  open,
  prompt,
  isDark = false,
  dock = "bottom",
  onHeightChange
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { status, errorMessage, showNumberPad, value, inputRef } = answer;

  const heightCallback = useRef(onHeightChange);
  heightCallback.current = onHeightChange;

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel || typeof ResizeObserver === "undefined") {
      heightCallback.current?.(0);
      return;
    }
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) heightCallback.current?.(entry.contentRect.height);
    });
    observer.observe(panel);
    heightCallback.current?.(panel.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [open, showNumberPad]);

  return (
    <AnimatePresence>
      {open && (
        /*
          Positioning lives on this wrapper, never on the panel itself: the panel
          animates with a spring transform, and a centring `mx-auto` on the same
          element fights it.
        */
        <div className={DOCK_CLASS[dock]}>
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="w-full pointer-events-auto flex flex-col items-center justify-center p-3 sm:p-4 md:p-5
              rounded-2xl md:rounded-3xl backdrop-blur-md border shadow-2xl sm:max-w-md md:max-w-lg"
            style={{
              backgroundColor: isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.96)",
              // The border carries the state; nothing else in the panel changes colour.
              borderColor:
                status === "error"
                  ? "#ef4444"
                  : status === "correct"
                    ? "#10b981"
                    : isDark
                      ? "#334155"
                      : "#cbd5e1"
            }}
          >
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <span className="text-xl md:text-2xl">🎉</span>
              <span
                className={`text-xs sm:text-sm md:text-base lg:text-lg font-extrabold tracking-tight ${
                  isDark ? "text-slate-100" : "text-slate-800"
                }`}
              >
                {prompt}
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-3 w-full justify-center max-w-xs md:max-w-sm">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={value}
                  onChange={e => answer.setValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") answer.check();
                  }}
                  placeholder="Total..."
                  disabled={status === "correct"}
                  aria-label="Your answer"
                  aria-invalid={status === "error"}
                  className={`w-full h-11 md:h-14 px-3 text-center text-lg sm:text-xl md:text-2xl font-bold font-mono rounded-xl border-2 transition-all outline-none ${
                    status === "error"
                      ? "border-red-500 bg-red-50/50 text-red-700 animate-shake dark:bg-red-950/40 dark:text-red-300"
                      : status === "correct"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : isDark
                          ? "bg-slate-900 border-slate-700 text-white focus:border-indigo-500"
                          : "bg-white border-slate-300 text-slate-900 focus:border-indigo-500"
                  }`}
                />
              </div>

              <Button
                onClick={() => answer.check()}
                disabled={status === "correct" || !value.trim()}
                className={`h-11 md:h-14 px-4 md:px-6 text-sm md:text-base font-bold flex items-center gap-1.5 rounded-xl shadow-md transition-all active:scale-95 ${
                  status === "correct"
                    ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {status === "correct" ? <Check size={18} /> : "Check"}
              </Button>

              <button
                type="button"
                onClick={answer.toggleNumberPad}
                aria-pressed={showNumberPad}
                className={`h-11 w-11 md:h-14 md:w-14 flex-shrink-0 flex items-center justify-center rounded-xl border transition-all ${
                  showNumberPad
                    ? "bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-600 dark:text-indigo-300"
                    : isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                }`}
                title="Toggle Number Pad"
              >
                <Calculator size={18} />
              </button>
            </div>

            {status === "error" && errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 font-bold mt-2 animate-fade-in text-center"
              >
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* On-screen keypad: children on a tablet shouldn't need the OS keyboard. */}
            <AnimatePresence>
              {showNumberPad && status !== "correct" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center gap-2 overflow-hidden"
                >
                  <div className="grid grid-cols-5 gap-1.5 md:gap-2 w-full max-w-xs md:max-w-sm">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => answer.pressDigit(String(num))}
                        aria-label={`Enter ${num}`}
                        className={`h-9 md:h-12 font-mono text-base md:text-xl font-extrabold rounded-lg md:rounded-xl border shadow-sm transition-all active:scale-95 ${
                          isDark
                            ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                            : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 w-full max-w-xs md:max-w-sm">
                    <button
                      type="button"
                      onClick={answer.pressBackspace}
                      className={`flex-1 h-8 md:h-10 text-xs md:text-sm font-extrabold rounded-lg border flex items-center justify-center gap-1 transition-all ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                          : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <Delete size={14} /> Backspace
                    </button>
                    <button
                      type="button"
                      onClick={answer.clear}
                      className={`px-3 md:px-5 h-8 md:h-10 text-xs md:text-sm font-extrabold rounded-lg border transition-all ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                          : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Clear
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
