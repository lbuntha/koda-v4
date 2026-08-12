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
 * (digits, then Backspace / Clear), and it is **open by default**: on the tablets
 * this runs on it is the primary way in, not an accessory, and a child who has
 * to find a calculator button first is a child typing on the OS keyboard over
 * the top of the activity. `NumberPad.tsx` is a different pad for a different
 * job: entering digits into a column-arithmetic grid.
 *
 * ## Theming
 *
 * Every colour here is driven by the `isDark` prop, never by Tailwind's `dark:`
 * variant. `index.css` scopes that variant to an explicit `.dark` ancestor, and
 * GameLauncher — the only host that renders a canvas in play mode — themes
 * itself with `isDark` and never mounts one. `dark:` classes inside a canvas are
 * therefore dead, which is exactly how this panel stayed light-on-light in dark
 * mode. The root still carries `dark` when dark so anything nested that does
 * reach for the variant resolves correctly.
 *
 * The surface comes from `theme/surfaces.ts`, shared with the success card, the
 * saving curtain and the placement finish screen, so every card that floats over
 * an activity is the same card. The panel briefly took a per-canvas accent; it
 * now wears the brand primary like the rest of them. An accent that changed with
 * the activity meant the Check button changed colour between two slides of one
 * lesson, and it competed with the primary button waiting underneath. Colour
 * that varies here should mean *state* — wrong, right — and nothing else.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, Calculator, Check, ChevronDown, Delete } from "lucide-react";
import { sounds } from "../../sound";
import { Button, Input } from "../ui";
import { hairlineClass } from "./canvasTheme";
import {
  overlayCardBaseClass,
  overlayCardBorderClass,
  primaryFocusClass,
  primaryToggleOnClass
} from "../../theme/surfaces";

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
  /**
   * Whether the pad starts open. Defaults to true — see the note above. A canvas
   * with no room for it (a short stage, a dock that would cover the objects) can
   * opt out, and the toggle still brings it back.
   */
  numberPadDefault?: boolean;
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
  open,
  numberPadDefault = true
}: UseCanvasAnswerOptions): CanvasAnswer {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<AnswerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showNumberPad, setShowNumberPad] = useState(numberPadDefault);
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  /* Read inside `reset`, which a new question calls — without the ref, changing
     the default would not survive to the next slide. */
  const padDefaultRef = useRef(numberPadDefault);
  padDefaultRef.current = numberPadDefault;

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
    setShowNumberPad(padDefaultRef.current);
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

/*
  Every dock spans the board and pins the panel to its own edge, rather than
  being a strip the height of whatever is in it.

  The difference only shows when the panel outgrows the space: `max-h-full` on
  the card resolves against this element, so a wrapper that is exactly as tall
  as its contents can never bound anything and the overflow goes over the edge
  to be clipped. Given the full box to measure against, the card stops at the
  board's edge and scrolls inside itself instead.

  `items-end` / `items-start` are what keep the panel where it was: the box grew,
  the panel did not move.
*/
const DOCK_CLASS: Record<AnswerPanelDock, string> = {
  bottom: "absolute z-50 inset-2 pointer-events-none flex justify-center items-end",
  top: "absolute z-50 inset-2 pointer-events-none flex justify-center items-start",
  left:
    "absolute z-50 pointer-events-none inset-2 flex justify-center items-start " +
    "sm:inset-x-auto sm:left-3 sm:top-0 sm:bottom-0 sm:w-[calc(50%-1.5rem)] sm:items-center"
};

/**
 * State lives on the border, and nothing else in the panel changes colour.
 *
 * Idle takes the brand primary, the same trim the success card and the placement
 * finish screen wear, so every card that floats over an activity is one family.
 * Wrong and right override it, because at that moment the border IS the feedback.
 */
const panelBorder = (status: AnswerStatus, isDark: boolean) => {
  if (status === "error") return isDark ? "border-rose-400" : "border-rose-500";
  if (status === "correct") return isDark ? "border-emerald-400" : "border-emerald-500";
  return overlayCardBorderClass(isDark, "primary");
};

const inputClass = (status: AnswerStatus, isDark: boolean) => {
  if (status === "error") {
    return isDark
      ? "border-rose-400 bg-rose-500/15 text-rose-200 placeholder:text-rose-300/50 animate-shake"
      : "border-rose-500 bg-rose-50 text-rose-700 placeholder:text-rose-400/60 animate-shake";
  }
  if (status === "correct") {
    return isDark
      ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
      : "border-emerald-500 bg-emerald-50 text-emerald-700";
  }
  return isDark
    ? `bg-white/[0.06] border-white/15 text-white placeholder:text-slate-500 ${primaryFocusClass}`
    : `bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 ${primaryFocusClass}`;
};

/** Keypad keys and the Backspace / Clear row — elevation, not colour. */
const keyClass = (isDark: boolean) =>
  isDark
    ? "bg-white/[0.08] border-white/10 text-white hover:bg-white/[0.16] active:bg-white/20"
    : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 active:bg-slate-100";

const utilityKeyClass = (isDark: boolean) =>
  isDark
    ? "bg-white/[0.05] border-white/10 text-slate-300 hover:bg-white/[0.12]"
    : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200";

export interface CanvasAnswerPanelProps {
  answer: CanvasAnswer;
  /** Render the panel. Wrap in nothing — the component brings its own AnimatePresence. */
  open: boolean;
  /** The question, e.g. "How many apples did you move in total?" */
  prompt: React.ReactNode;
  isDark?: boolean;
  dock?: AnswerPanelDock;
  /** What the empty input reads. "Total…" unless the activity asks for something else. */
  placeholder?: string;
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
  placeholder = "Total…",
  onHeightChange
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const { status, errorMessage, showNumberPad, value, inputRef } = answer;

  const heightCallback = useRef(onHeightChange);
  heightCallback.current = onHeightChange;

  /*
    ── Fitting the panel to the board ──────────────────────────────────────

    The panel's height is set by its contents and the board's is set by the
    window, and neither knows about the other. Trimming padding narrows the gap
    and never closes it: with the pad open this card wants around 270px, and a
    board on a short window can offer 200. What the child saw was the Backspace
    and Clear keys sliced off by the card's own bottom edge — the two keys they
    need *after* mistyping, gone precisely when they are needed.

    `overflow-y-auto` catches it, but a keypad you have to scroll to reach Clear
    on is a keypad that failed. So the panel measures both boxes and scales
    itself down to fit, which keeps every key on screen and in proportion.

    Three things this deliberately does:

    - **Measures `scrollHeight`, not the painted box.** A transform changes what
      `getBoundingClientRect` reports, so measuring that and then scaling by it
      is a loop that settles wherever it likes. Layout height is what the scale
      is derived from, and layout height does not move when the panel scales.
    - **Stops at 0.72.** Past that the digits stop being comfortable targets, and
      a board that short is better served by the scroll fallback than by a
      keypad rendered too small to hit.
    - **Never scales up.** A panel with room to spare is already the right size.
  */
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const panel = panelRef.current;
    const box = dockRef.current;
    if (!open || !panel || !box || typeof ResizeObserver === "undefined") {
      heightCallback.current?.(0);
      setFitScale(1);
      return;
    }

    const measure = () => {
      const natural = panel.scrollHeight;
      const available = box.clientHeight;
      const next = natural > 0 && available > 0 ? Math.min(1, available / natural) : 1;
      setFitScale(Math.max(0.72, next));
      // The visual height, which is what a canvas reserves space against.
      heightCallback.current?.(panel.getBoundingClientRect().height);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(box);
    measure();
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
        <div ref={dockRef} className={DOCK_CLASS[dock]}>
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: fitScale }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            // Scaled about the edge it is docked to, so shrinking pulls the panel
            // away from the board's edge rather than off it.
            style={{ transformOrigin: dock === "top" ? "center top" : dock === "bottom" ? "center bottom" : "center" }}
            /*
              Never taller than the board it floats over.

              The card is sized by its contents, and its contents grow: opening
              the number pad adds a 5×2 grid plus a Backspace/Clear row, which on
              a short canvas made the panel taller than the stage it is docked
              into. The canvas clips — it has to, or a dragged object would
              escape the card — so the bottom of the pad was simply cut off, and
              the two keys that got cut are the ones a child needs after typing
              the wrong digit.

              `max-h-full` bounds it to the dock box and `overflow-y-auto` gives
              the overflow somewhere to go, so a cramped board scrolls the pad
              instead of hiding it. `justify-start` because a scrolling column
              centred on its own overflow starts halfway down itself.
            */
            className={`w-full pointer-events-auto flex flex-col items-center justify-start max-h-full overflow-y-auto p-3 md:p-4
              rounded-2xl md:rounded-3xl border-2 sm:max-w-md md:max-w-lg
              ${overlayCardBaseClass(isDark, "primary")} ${panelBorder(status, isDark)}
              ${isDark ? "dark" : ""}`}
          >
            {/*
              The prompt, kept to one line's worth of height.

              It ran to `lg:text-lg` beside a `text-2xl` emoji, which on a wide
              screen made the panel's first row taller than the input under it —
              a caption outgrowing the control it captions. The question is
              already the heading of the whole board; down here it is a reminder,
              so it stops at `text-base`.
            */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg md:text-xl">🎉</span>
              <span
                className={`text-xs sm:text-sm md:text-base font-extrabold tracking-tight ${
                  isDark ? "text-slate-100" : "text-slate-800"
                }`}
              >
                {prompt}
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-3 w-full justify-center max-w-xs md:max-w-sm">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  /*
                    With the pad up, the OS keyboard would slide over the very
                    keys it duplicates. `none` suppresses it on touch devices and
                    has no effect on a physical keyboard, so typing still works.
                  */
                  inputMode={showNumberPad ? "none" : "numeric"}
                  pattern="[0-9]*"
                  value={value}
                  onChange={e => answer.setValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") answer.check();
                  }}
                  placeholder={placeholder}
                  disabled={status === "correct"}
                  aria-label="Your answer"
                  aria-invalid={status === "error"}
                  /*
                    No caret while the pad is up. It is not the input method — the
                    keys are — so a blinking bar is noise, and it is the artefact
                    iOS Safari misplaces when this card animates in on a transform.
                    (The `backdrop-filter` that caused the worst of it is gone; see
                    `overlayCardBaseClass`.) Focus is still shown by the ring.
                  */
                  className={`h-11 md:h-12 px-3 text-center text-lg sm:text-xl md:text-2xl font-bold font-mono
                    ${showNumberPad ? "caret-transparent" : ""} ${inputClass(status, isDark)}`}
                />
              </div>

              {/*
                The default variant already IS the brand primary, so an idle Check
                restates nothing. Solved is the one state that overrides it — green
                is the answer, not the brand.
              */}
              <Button
                onClick={() => answer.check()}
                disabled={status === "correct" || !value.trim()}
                className={`h-11 md:h-12 px-4 md:px-6 text-sm md:text-base font-bold flex items-center gap-1.5
                  rounded-xl active:scale-95 ${
                    status === "correct"
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-[0_4px_0_#047857] hover:border-emerald-600 hover:bg-emerald-600"
                      : ""
                  }`}
              >
                {status === "correct" ? <Check size={18} /> : "Check"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={answer.toggleNumberPad}
                aria-pressed={showNumberPad}
                className={`h-11 w-11 md:h-14 md:w-14 flex-shrink-0 rounded-xl border ${
                  showNumberPad
                    ? primaryToggleOnClass(isDark)
                    : isDark
                      ? "bg-white/[0.06] border-white/10 text-slate-300 hover:bg-white/[0.12]"
                      : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                }`}
                title="Toggle Number Pad"
              >
                {showNumberPad ? <ChevronDown size={18} /> : <Calculator size={18} />}
              </Button>
            </div>

            {status === "error" && errorMessage && (
              <div
                role="alert"
                className={`flex items-center gap-1.5 text-xs font-bold mt-2 animate-fade-in text-center ${
                  isDark ? "text-rose-300" : "text-rose-600"
                }`}
              >
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/*
              On-screen keypad: children on a tablet shouldn't need the OS
              keyboard.

              Every measurement in here was cut once, because the panel it lives
              in is docked over a board and has to fit *inside* it. Scrolling was
              the safety net for when it does not — but a keypad you have to
              scroll to reach the Clear key on is a keypad that failed, so the
              net should almost never be needed. The keys stayed well over the
              24px touch floor; what came off was the air between them.
            */}
            <AnimatePresence>
              {showNumberPad && status !== "correct" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`w-full mt-2 pt-2 border-t flex flex-col items-center gap-1.5 overflow-hidden ${hairlineClass(
                    isDark
                  )}`}
                >
                  <div className="grid grid-cols-5 gap-1.5 md:gap-2 w-full max-w-xs md:max-w-sm">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
                      <Button
                        key={num}
                        type="button"
                        variant="ghost"
                        onClick={() => answer.pressDigit(String(num))}
                        aria-label={`Enter ${num}`}
                        className={`h-9 md:h-11 px-0 font-mono text-base md:text-xl font-extrabold tracking-normal
                          rounded-lg md:rounded-xl border shadow-sm active:scale-95 ${keyClass(isDark)}`}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 w-full max-w-xs md:max-w-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={answer.pressBackspace}
                      className={`flex-1 h-8 md:h-9 px-2 text-xs md:text-sm font-extrabold gap-1
                        rounded-lg border ${utilityKeyClass(isDark)}`}
                    >
                      <Delete size={14} /> Backspace
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={answer.clear}
                      className={`px-3 md:px-5 h-8 md:h-9 text-xs md:text-sm font-extrabold
                        rounded-lg border ${utilityKeyClass(isDark)}`}
                    >
                      Clear
                    </Button>
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
