/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Column Addition — the standard vertical algorithm, practised column by
 * column, with a struggle-triggered animated guide.
 *
 * One problem per card (like Move & Count): the student fills one answer box
 * per column and, when the whole sum is right, the canvas fires `onSuccess()`
 * and the worksheet launcher moves on — there is no internal "finish" screen or
 * multi-problem sequence. A wrong Check flashes the cell and, after two failed
 * checks, offers an animated walkthrough (also always available via "Show me
 * how"). The walkthrough is the numerals themselves moving — a column lights
 * up, the answer digit drops in, and a carry "1" flies into the next column —
 * narrated aloud by Koda. All arithmetic comes from columnAdditionModel so the
 * canvas can never phrase a problem differently from how the panel authored it.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { CanvasProps } from "./types";
import { CountingTechnique } from "../../types";
import { sounds } from "../../sound";
import { RotateCcw, Check, ChevronLeft, ChevronRight, HelpCircle, Pause, Play, Sparkles } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  buildColumnAdditionModel,
  columnNarration,
  describeColumnMode,
  clampAddend,
  diagnoseColumnError,
  type ColumnErrorType,
} from "./columnAdditionModel";
import { KodaActor, useKodaVoice, KodaMood } from "./KodaActor";
import { NumberPad } from "./NumberPad";

// ── Accent theming ──────────────────────────────────────────────────────────
// Keyed off question.config.frameColor; indigo is the screenshot default.
interface Accent {
  badge: string;   // carry pill
  box: string;     // highlighted column cell
  answer: string;  // answer digit colour
  ring: string;    // focused input ring
  op: string;      // the "+" operator
}
const ACCENTS: Record<string, Accent> = {
  indigo: {
    badge: "bg-indigo-600 text-white",
    box: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 border border-indigo-300/50",
    answer: "text-indigo-600 dark:text-indigo-400",
    ring: "focus:ring-indigo-200 dark:focus:ring-indigo-900/40 focus:border-indigo-500",
    op: "text-indigo-500 dark:text-indigo-400",
  },
  emerald: {
    badge: "bg-emerald-600 text-white",
    box: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 border border-emerald-300/50",
    answer: "text-emerald-600 dark:text-emerald-400",
    ring: "focus:ring-emerald-200 dark:focus:ring-emerald-900/40 focus:border-emerald-500",
    op: "text-emerald-500 dark:text-emerald-400",
  },
  purple: {
    badge: "bg-purple-600 text-white",
    box: "bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 border border-purple-300/50",
    answer: "text-purple-600 dark:text-purple-400",
    ring: "focus:ring-purple-200 dark:focus:ring-purple-900/40 focus:border-purple-500",
    op: "text-purple-500 dark:text-purple-400",
  },
  rose: {
    badge: "bg-rose-600 text-white",
    box: "bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-300/50",
    answer: "text-rose-600 dark:text-rose-400",
    ring: "focus:ring-rose-200 dark:focus:ring-rose-900/40 focus:border-rose-500",
    op: "text-rose-500 dark:text-rose-400",
  },
};
const FRAME_TO_ACCENT: Record<string, keyof typeof ACCENTS> = {
  indigo: "indigo", slate: "indigo", emerald: "emerald", purple: "purple", pink: "rose", rose: "rose",
};

const CELL = "w-9 min-[380px]:w-10 sm:w-12 shrink-0 flex items-center justify-center font-mono font-black select-none";
const OP_CELL = "w-6 min-[380px]:w-7 sm:w-8 shrink-0 flex items-center justify-center";
const PLACE_ABBREVIATIONS = ["1s", "10s", "100s", "1K", "10K", "100K"];

// Signature phrases of the generic counting instructions cards inherit from
// other techniques. When an instruction matches, Koda ignores it and builds a
// relevant addition line from the numbers instead. An author who writes a real
// addition instruction (e.g. "Add 18 and 13 to fill Koda's basket") won't match.
const GENERIC_INSTRUCTION = /\b(count(?:ing)?|tap|drag|line up|ten[- ]?frame|sudoku|pattern|sort|magnet|arrange|subiti|how many|cross out|group)\b/i;

export const ColumnAdditionCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  onSuccess,
  onAttempt,
  onHint,
}) => {
  const reduce = useReducedMotion();
  const accent = ACCENTS[FRAME_TO_ACCENT[question.config?.frameColor || "indigo"] || "indigo"];

  // Koda narrates the guidance aloud; the same mute switch gates sound effects.
  const voice = useKodaVoice("koda_column_muted");
  const mutedRef = useRef(voice.muted);
  useEffect(() => { mutedRef.current = voice.muted; }, [voice.muted]);
  const containerRef = useRef<HTMLDivElement>(null);

  // One authored problem per card — the worksheet's other cards are the practice.
  const num1 = clampAddend(question.config?.num1 ?? 18);
  const num2 = clampAddend(question.config?.num2 ?? 13);
  // A technique switch can render before Property Studio persists its defaults.
  // The component identity therefore guarantees row three immediately; saved
  // num3 still wins once present.
  const isMultiRow = question.technique === CountingTechnique.ADDITION_COLUMN_MULTI;
  const hasThirdAddend = isMultiRow
    || (question.config?.num3 !== undefined && question.config?.num3 !== null);
  const num3 = hasThirdAddend ? clampAddend(question.config?.num3 ?? 349) : null;
  const componentName = isMultiRow ? "multi_row_column_addition" : "column_addition";
  const model = useMemo(
    () => buildColumnAdditionModel(num1, num2, num3),
    [num1, num2, num3],
  );
  const { columns, sum } = model;

  const [answers, setAnswers] = useState<string[]>(() => columns.map(() => ""));
  const [carryMarks, setCarryMarks] = useState<boolean[]>(() => columns.map(() => false));
  const [wrongCells, setWrongCells] = useState<boolean[]>(() => columns.map(() => false));
  const [wrongCounts, setWrongCounts] = useState<number[]>(() => columns.map(() => 0));
  const [fails, setFails] = useState(0);
  const [phase, setPhase] = useState<"solve" | "guide" | "solved">("solve");
  const [offerGuide, setOfferGuide] = useState(false);
  const [beatIndex, setBeatIndex] = useState(-1);
  const [guideTrigger, setGuideTrigger] = useState(0);
  const [stuckCol, setStuckCol] = useState<number | null>(null);
  const [lastErrorType, setLastErrorType] = useState<ColumnErrorType | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [guideTarget, setGuideTarget] = useState<number | null>(null);
  const [guidePlaying, setGuidePlaying] = useState(false);
  const [guideUsed, setGuideUsed] = useState(false);
  // Which answer column the on-screen keypad types into (ones-first index).
  const [focusedPlace, setFocusedPlace] = useState(0);

  const answerCellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // A targeted guide has two beats for one problem column. The full guide
  // keeps the original ones-to-left sequence.
  const beats = useMemo(() => {
    const places = guideTarget === null ? columns.map((_, index) => index) : [guideTarget];
    return places.flatMap(col => [{ col, kind: "add" as const }, { col, kind: "write" as const }]);
  }, [columns, guideTarget]);
  const writeBeatOf = (place: number) =>
    beats.findIndex(beat => beat.col === place && beat.kind === "write");

  // Reset when the authored problem changes.
  useEffect(() => {
    setAnswers(columns.map(() => ""));
    setCarryMarks(columns.map(() => false));
    setWrongCells(columns.map(() => false));
    setWrongCounts(columns.map(() => 0));
    setFails(0);
    setPhase("solve");
    setOfferGuide(false);
    setBeatIndex(-1);
    setStuckCol(null);
    setLastErrorType(null);
    setHintLevel(0);
    setGuideTarget(null);
    setGuidePlaying(false);
    setGuideUsed(false);
    setFocusedPlace(0);
    if (isPlayMode) {
      const id = requestAnimationFrame(() => answerCellRefs.current[0]?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num1, num2, num3, isPlayMode]);

  // ── Guide timeline ──
  // Auto-advance one beat at a time. Because beatIndex is state, students can
  // pause, move backward/forward, or exit without fighting a hidden timer.
  useEffect(() => {
    if (phase !== "guide" || !guidePlaying || beatIndex < 0 || beatIndex >= beats.length) return;
    const dwell = beats[beatIndex]?.kind === "add" ? 2200 : 2000;
    const timer = window.setTimeout(() => setBeatIndex(index => index + 1), dwell);
    return () => window.clearTimeout(timer);
  }, [phase, guidePlaying, beatIndex, beats]);

  // Sound the write/re-group beat whether reached automatically or with Next.
  useEffect(() => {
    if (phase !== "guide") return;
    if (beatIndex === beats.length) {
      setGuidePlaying(false);
      if (!mutedRef.current) sounds.playSuccess();
      return;
    }
    const beat = beats[beatIndex];
    if (beat?.kind === "write" && !mutedRef.current) {
      const col = columns[beat.col];
      sounds.playTick(col.digitOut || 1);
      if (col.carryOut) sounds.playPop();
    }
  }, [phase, beatIndex, beats, columns]);

  const enterGuide = useCallback((target: number | null, source: "targeted" | "full" = "full") => {
    if (target !== null) setStuckCol(target);
    setGuideTarget(target);
    setOfferGuide(false);
    setGuideUsed(true);
    setGuidePlaying(true);
    setBeatIndex(0);
    setPhase("guide");
    setGuideTrigger(t => t + 1);
    onHint?.({
      component: componentName,
      hintLevel: target === null ? 4 : 3,
      scope: target === null ? "full_problem" : "single_column",
      source,
      place: target ?? undefined,
      placeLabel: target === null ? undefined : columns[target]?.placeLabel,
      errorType: target === null ? undefined : lastErrorType,
    });
  }, [columns, componentName, lastErrorType, onHint]);

  const replayGuide = useCallback(() => {
    setBeatIndex(0);
    setGuidePlaying(true);
    setGuideTrigger(t => t + 1);
  }, []);

  const tryItMyself = useCallback(() => {
    const firstEmpty = answers.findIndex(answer => !answer);
    const resumePlace = guideTarget ?? stuckCol ?? (firstEmpty >= 0 ? firstEmpty : 0);
    setPhase("solve");
    setBeatIndex(-1);
    setGuidePlaying(false);
    setGuideTarget(null);
    // Preserve every correct digit. Clear only the place that was explained so
    // the child performs that step rather than copying a completed solution.
    setAnswers(previous => previous.map((answer, index) => {
      if (index === resumePlace) return "";
      return parseInt(answer, 10) === columns[index].digitOut ? answer : "";
    }));
    setWrongCells(columns.map(() => false));
    setOfferGuide(false);
    setHintLevel(0);
    setFocusedPlace(resumePlace);
    requestAnimationFrame(() => answerCellRefs.current[resumePlace]?.focus({ preventScroll: true }));
  }, [answers, columns, guideTarget, stuckCol]);

  const requestProgressiveHint = () => {
    if (stuckCol === null) return;
    const nextLevel = Math.min(2, hintLevel + 1);
    setHintLevel(nextLevel);
    setFocusedPlace(stuckCol);
    requestAnimationFrame(() => answerCellRefs.current[stuckCol]?.focus({ preventScroll: true }));
    onHint?.({
      component: componentName,
      hintLevel: nextLevel,
      scope: "single_column",
      place: stuckCol,
      placeLabel: columns[stuckCol].placeLabel,
      errorType: lastErrorType,
    });
  };

  const allFilled = answers.length === columns.length && answers.every(a => a.trim() !== "");

  const setAnswerDigit = (place: number, raw: string) => {
    const digit = raw.replace(/[^0-9]/g, "").slice(-1);
    setAnswers(prev => prev.map((a, i) => (i === place ? digit : a)));
    setWrongCells(prev => (prev[place] ? prev.map((w, i) => (i === place ? false : w)) : prev));
    // Auto-advance leftward (ones → tens → …) so a child keeps a natural flow.
    if (digit && place < columns.length - 1) {
      const nextPlace = place + 1;
      setFocusedPlace(nextPlace);
      // Let the keypad's tap/click finish before restoring focus to the answer
      // row. Mobile browsers otherwise leave focus on the keypad button.
      requestAnimationFrame(() => answerCellRefs.current[nextPlace]?.focus({ preventScroll: true }));
    }
  };

  // Keypad backspace: clear the focused box, or step back to the previous one.
  const keypadBackspace = () => {
    if (answers[focusedPlace]) {
      setAnswers(prev => prev.map((a, i) => (i === focusedPlace ? "" : a)));
      requestAnimationFrame(() => answerCellRefs.current[focusedPlace]?.focus({ preventScroll: true }));
    } else if (focusedPlace > 0) {
      const p = focusedPlace - 1;
      setAnswers(prev => prev.map((a, i) => (i === p ? "" : a)));
      setFocusedPlace(p);
      requestAnimationFrame(() => answerCellRefs.current[p]?.focus({ preventScroll: true }));
    }
  };

  const checkAnswer = () => {
    if (!allFilled || phase !== "solve") return;
    const wrong = columns.map((c, i) => parseInt(answers[i], 10) !== c.digitOut);
    const selected = answers.slice().reverse().join("");

    if (!wrong.some(Boolean)) {
      setPhase("solved");
      if (!mutedRef.current) sounds.playSuccess();
      onAttempt?.("correct", {
        expected: String(sum),
        selected,
        details: {
          component: componentName,
          carryCount: model.carryCount,
          digitMode: model.digitMode,
          addendCount: model.addendCount,
          addends: [num1, num2, ...(num3 === null ? [] : [num3])],
          guideUsed,
        },
      });
      // Fire completion like Move & Count — the launcher advances the worksheet.
      window.setTimeout(() => onSuccess?.(), 550);
      return;
    }

    if (!mutedRef.current) sounds.playFailure();
    const nextFails = fails + 1;
    setFails(nextFails);
    setWrongCells(wrong);
    const nextCounts = wrongCounts.map((n, i) => (wrong[i] ? n + 1 : n));
    setWrongCounts(nextCounts);
    const firstWrong = wrong.findIndex(Boolean);
    const errorTypes = wrong.map((isWrong, index) =>
      isWrong ? diagnoseColumnError(columns[index], answers[index]) : null
    );
    const firstErrorType = firstWrong >= 0 ? errorTypes[firstWrong] : null;
    setStuckCol(firstWrong >= 0 ? firstWrong : null);
    setLastErrorType(firstErrorType);
    setHintLevel(0);
    onAttempt?.("incorrect", {
      expected: String(sum),
      selected,
      details: {
        component: componentName,
        digitMode: model.digitMode,
        addendCount: model.addendCount,
        addends: [num1, num2, ...(num3 === null ? [] : [num3])],
        wrongPlaces: wrong.flatMap((isWrong, index) => isWrong ? [index] : []),
        wrongPlaceLabels: wrong.flatMap((isWrong, index) => isWrong ? [columns[index].placeLabel] : []),
        errorTypes: errorTypes.filter(Boolean),
        expectedDigits: columns.map(column => column.digitOut),
        selectedDigits: answers,
        carryIns: columns.map(column => column.carryIn),
        carryMarks,
        guideUsed,
      },
    });

    if (nextFails >= 2 || nextCounts.some(n => n >= 2)) {
      setOfferGuide(true);
    }

    window.setTimeout(() => {
      setWrongCells(columns.map(() => false));
      setAnswers(prev => prev.map((a, i) => (wrong[i] ? "" : a)));
      if (firstWrong >= 0) {
        setFocusedPlace(firstWrong);
        answerCellRefs.current[firstWrong]?.focus({ preventScroll: true });
      }
    }, 750);
  };

  // ── What each part of the board should show, given the phase ──
  const showStatic = !isPlayMode; // design/preview: fully solved, no interaction
  const inGuide = phase === "guide";
  const solved = phase === "solved";
  const guideDone = inGuide && beatIndex >= beats.length;
  const currentBeat = beats[Math.min(Math.max(beatIndex, 0), beats.length - 1)] ?? { col: 0, kind: "add" as const };

  const columnActive = (place: number) =>
    inGuide && !guideDone && currentBeat.col === place;
  const answerRevealed = (place: number) => {
    if (showStatic || solved) return true;
    const writeBeat = writeBeatOf(place);
    return inGuide && writeBeat >= 0 && beatIndex >= writeBeat;
  };
  const carryRevealed = (k: number) => {
    if (k <= 0) return false;
    const feeder = columns[k - 1];
    if (!feeder || feeder.carryOut <= 0) return false;
    if (showStatic || solved) return true;
    if (inGuide && guideTarget === k) return true;
    const feederWriteBeat = writeBeatOf(k - 1);
    return inGuide && feederWriteBeat >= 0 && beatIndex >= feederWriteBeat;
  };

  // Visual order: highest place on the left, ones on the right.
  const order = useMemo(() => columns.map((_, i) => i).reverse(), [columns]);

  // ── Koda's line (spoken + shown in the bubble). Authored instruction is
  //    surfaced verbatim when the child is first getting started. ──
  // A card switched to Column Addition usually still carries a *counting*
  // instruction ("Tap each item to count them up!", "Count the ducks 1 to 10")
  // left over from its previous technique — those read wrong for addition. So
  // Koda only voices an authored instruction when it isn't one of those generic
  // leftovers; otherwise it speaks a line built from the real numbers, which
  // also keeps the opening flexible from one problem to the next.
  const instruction = question.instruction?.trim();
  const customInstruction = instruction && !GENERIC_INSTRUCTION.test(instruction) ? instruction : "";
  const ones1 = columns[0]?.digit1 ?? 0;
  const ones2 = columns[0]?.digit2 ?? 0;
  const ones3 = columns[0]?.digit3 ?? 0;
  const addendText = num3 === null
    ? `**${num1}** plus **${num2}**`
    : `**${num1}** plus **${num2}** plus **${num3}**`;
  const kodaText = (() => {
    if (solved) {
      return model.anyCarry
        ? `${addendText} makes **${sum}**! Carrying to the next column got us there. Nice work!`
        : `${addendText} makes **${sum}**! You added each column on its own. Nice work!`;
    }
    if (inGuide) {
      if (guideDone) {
        if (guideTarget !== null) {
          return `That **${columns[guideTarget].placeLabel}** step is complete. Your other correct work is still there—choose **I understand—let me try** when you're ready.`;
        }
        return model.anyCarry
          ? `All done — ${addendText} is **${sum}**! Each carry moved to the next place.`
          : `All done — ${addendText} is **${sum}**! No column reached ten, so nothing to carry.`;
      }
      const line = columnNarration(columns[currentBeat.col]);
      return currentBeat.kind === "add" ? line.add : line.write;
    }
    if (fails > 0 && stuckCol !== null) {
      const col = columns[stuckCol];
      if (hintLevel >= 2) {
        const parts = [
          col.carryIn ? `**${col.carryIn}** carried` : null,
          col.hasDigit1 ? `**${col.digit1}**` : null,
          col.hasDigit2 ? `**${col.digit2}**` : null,
          col.hasDigit3 ? `**${col.digit3}**` : null,
        ].filter(Boolean);
        return `In the **${col.placeLabel}** column, ${parts.join(" plus ")} makes **${col.columnSum}**. Which digit belongs in this box?`;
      }
      if (hintLevel === 1) {
        return lastErrorType === "missed_carry"
          ? `Look at the **${col.placeLabel}** column again. A carried **1** arrived from the right—include it before you write the answer digit.`
          : lastErrorType === "extra_carry"
            ? `Check the **${col.placeLabel}** column. Nothing carried in from the right, so add only the digits already in this column.`
            : `Focus only on the **${col.placeLabel}** column. Add its digits${col.carryIn ? " and the carried 1" : ""}, then write the ones digit of that total.`;
      }
      return `Check the **${col.placeLabel}** column. Your other correct columns can stay—only fix this place.`;
    }
    if (fails > 0) {
      const onesText = num3 === null
        ? `**${ones1}** plus **${ones2}**`
        : `**${ones1}** plus **${ones2}** plus **${ones3}**`;
      return `No rush — add just the **ones** first: ${onesText}. Then work left, one column at a time.`;
    }
    return customInstruction
      || `Let's add ${addendText}. Start with the **ones** on the right.`;
  })();
  const kodaMood: KodaMood = solved || guideDone ? "cheer" : inGuide ? "think" : fails > 0 ? "oops" : "idle";

  return (
    <BoardShell isDark={isDark} innerRef={containerRef}>
      {/* ── KODA, THE GUIDE ── */}
      {isPlayMode && (
        <KodaActor
          text={kodaText}
          mood={kodaMood}
          voice={voice}
          isDark={isDark}
          dragConstraints={containerRef}
        />
      )}

      {/* ── SHOW ME HOW — top-right, always reachable during solve ── */}
      {isPlayMode && phase === "solve" && (
        <button
          onClick={() => enterGuide(null, "full")}
          title="Show me how"
          aria-label="Show me how"
          className="absolute top-3 right-3 z-40 px-2.5 py-2 rounded-xl bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-sm"
        >
          <HelpCircle size={14} /> <span className="hidden sm:inline">Show me how</span>
        </button>
      )}

      {/* Header: what shape of problem this is */}
      <div className="shrink-0 px-4 pt-3 flex items-center justify-center gap-1.5 flex-wrap">
        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          {describeColumnMode(model.digitMode)}
        </span>
        {solved ? (
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 inline-flex items-center gap-1">
            <Check size={10} /> Solved
          </span>
        ) : (
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            model.anyCarry
              ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50"
              : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50"
          }`}>
            {model.anyCarry ? "Carries" : "No carrying"}
          </span>
        )}
        {showStatic && (
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-700">
            Preview
          </span>
        )}
        {inGuide && !guideDone && (
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50">
            {currentBeat.kind === "add" ? "Add" : "Write"}: {columns[currentBeat.col].placeLabel}
          </span>
        )}
      </div>
      <p className="shrink-0 px-4 pt-1 text-center text-[10px] font-medium text-slate-500 dark:text-slate-400">
        Start at the ones on the right, then move one place left.
      </p>

      {/* ── THE BOARD + KEYPAD ──
          Stack in compact canvases; use the desktop width beside the board so
          a laptop-height player never needs to scroll just to reach Check. */}
      <div className="flex-1 min-h-0 flex flex-col @7xl:flex-row items-center justify-center gap-7 @7xl:gap-10 px-3 sm:px-4 py-3 overflow-y-auto @7xl:overflow-hidden">
        <div className="max-w-full shrink-0 overflow-x-auto px-1 pb-1">
        <div className="mx-auto inline-flex min-w-max flex-col items-stretch">
          {/* Place-value labels keep longer problems easy to scan. */}
          <div className="flex items-center justify-end">
            <div className={OP_CELL} />
            {order.map(place => (
              <div
                key={`place-${place}`}
                title={columns[place].placeLabel}
                className={`${CELL} h-5 text-[8px] sm:text-[9px] font-semibold uppercase text-slate-400 dark:text-slate-500`}
              >
                {PLACE_ABBREVIATIONS[place] ?? `P${place}`}
              </div>
            ))}
          </div>

          {/* Carry row */}
          <div className="flex items-end justify-end">
            <div className={OP_CELL} />
            {order.map(place => (
              <div key={`carry-${place}`} className={`${CELL} h-7`}>
                {renderCarry(place)}
              </div>
            ))}
          </div>

          {/* Addend 1 */}
          <div className="flex items-center justify-end">
            <div className={OP_CELL} />
            {order.map(place => renderAddendCell(place, columns[place].digit1, columns[place].hasDigit1))}
          </div>

          {/* Addend 2 (with operator) */}
          <div className="flex items-center justify-end">
            <div className={`${OP_CELL} text-2xl sm:text-3xl font-bold ${accent.op}`}>{num3 === null ? "+" : ""}</div>
            {order.map(place => renderAddendCell(place, columns[place].digit2, columns[place].hasDigit2))}
          </div>

          {/* Optional third row — exposed as its own component in the picker. */}
          {num3 !== null && (
            <div className="flex items-center justify-end">
              <div className={`${OP_CELL} text-2xl sm:text-3xl font-bold ${accent.op}`}>+</div>
              {order.map(place => renderAddendCell(place, columns[place].digit3, columns[place].hasDigit3))}
            </div>
          )}

          {/* Rule */}
          <div className="h-1 my-2 rounded bg-slate-300 dark:bg-slate-600 w-full" />

          {/* Answer row */}
          <div className="flex items-center justify-end">
            <div className={OP_CELL} />
            {order.map(place => renderAnswerCell(place))}
          </div>
        </div>
        </div>

        {/* Keypad sits just below the board, as part of the same centred group */}
        {isPlayMode && phase === "solve" && (
          <NumberPad
            onDigit={d => setAnswerDigit(focusedPlace, d)}
            onBackspace={keypadBackspace}
            onEnter={checkAnswer}
            enterDisabled={!allFilled}
            accentText={accent.answer}
            accentSolid={accent.badge}
            className="@7xl:w-80 @7xl:shrink-0"
          />
        )}
      </div>

      {/* ── FOOTER CONTROLS ── */}
      {!showStatic && phase !== "solved" && (
        <div className="shrink-0 p-3 pt-2.5 flex flex-col items-center gap-2">
          {/* Optional hint ladder: nudge → calculation → targeted animation. */}
          <AnimatePresence>
            {phase === "solve" && stuckCol !== null && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex w-full max-w-lg flex-wrap items-center justify-center gap-2"
              >
                {hintLevel < 2 ? (
                  <button
                    onClick={requestProgressiveHint}
                    className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                  >
                    <Sparkles size={13} />
                    {hintLevel === 0 ? `Hint for ${columns[stuckCol].placeLabel}` : "Show the calculation"}
                  </button>
                ) : (
                  <button
                    onClick={() => enterGuide(stuckCol, "targeted")}
                    className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors"
                  >
                    <Play size={13} /> Show this column
                  </button>
                )}
                {offerGuide && (
                  <button
                    onClick={() => enterGuide(null, "full")}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Show full walkthrough
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {phase === "guide" ? (
            <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
              <button
                onClick={replayGuide}
                className="h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-200/60 dark:border-slate-700/60"
              >
                <RotateCcw size={12} /> Replay
              </button>
              <button
                onClick={() => { setGuidePlaying(false); setBeatIndex(index => Math.max(0, index - 1)); }}
                disabled={beatIndex <= 0}
                aria-label="Previous explanation step"
                className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 disabled:opacity-40 flex items-center justify-center"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setGuidePlaying(playing => !playing)}
                disabled={guideDone}
                className="h-9 min-w-20 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                {guidePlaying ? <Pause size={13} /> : <Play size={13} />}
                {guidePlaying ? "Pause" : "Play"}
              </button>
              <span className="min-w-12 text-center text-[10px] font-semibold text-slate-400" aria-live="polite">
                {Math.min(beatIndex + 1, beats.length)} / {beats.length}
              </span>
              <button
                onClick={() => { setGuidePlaying(false); setBeatIndex(index => Math.min(beats.length, index + 1)); }}
                disabled={guideDone}
                aria-label="Next explanation step"
                className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 disabled:opacity-40 flex items-center justify-center"
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={tryItMyself}
                className={`h-9 px-4 rounded-xl font-bold text-xs text-white cursor-pointer shadow flex items-center gap-1.5 ${accent.badge} hover:opacity-90`}
              >
                I understand — let me try
              </button>
            </div>
          ) : null}
        </div>
      )}
    </BoardShell>
  );

  // ── cell renderers (closures over state) ──

  function renderCarry(place: number) {
    const col = columns[place];
    if (showStatic || solved) {
      return col.carryIn > 0 ? <StaticCarry accent={accent}>{col.carryIn}</StaticCarry> : null;
    }
    if (inGuide) {
      return carryRevealed(place) ? (
        <motion.span
          key={`carry-${place}-${guideTrigger}`}
          initial={reduce ? false : { y: 34, x: 24, scale: 0.4, opacity: 0 }}
          animate={{ y: 0, x: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center border-2 border-white dark:border-slate-900 shadow ${accent.badge}`}
        >
          {col.carryIn}
        </motion.span>
      ) : null;
    }
    // solve mode — a tappable scratch mark the student can place to track carries
    if (place === 0) return null;
    const marked = carryMarks[place];
    return (
      <button
        onClick={() => setCarryMarks(prev => prev.map((m, i) => (i === place ? !m : m)))}
        aria-label={marked ? `Remove carry mark on the ${col.placeLabel}` : `Mark a carry on the ${col.placeLabel}`}
        className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center transition-colors cursor-pointer ${
          marked
            ? `${accent.badge} border-2 border-white dark:border-slate-900 shadow`
            : "border border-dashed border-slate-300 dark:border-slate-700 text-transparent hover:border-slate-400 dark:hover:border-slate-500"
        }`}
      >
        {marked ? "1" : "·"}
      </button>
    );
  }

  function renderAddendCell(place: number, digit: number, has: boolean) {
    const active = columnActive(place);
    return (
      <div key={`d-${place}`} className={`${CELL} h-12 sm:h-14 text-2xl min-[380px]:text-3xl sm:text-4xl text-slate-800 dark:text-slate-100`}>
        <div className={`w-8 min-[380px]:w-9 sm:w-10 h-10 min-[380px]:h-11 sm:h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${active ? `${accent.box} scale-105 shadow-sm` : ""}`}>
          {has ? digit : ""}
        </div>
      </div>
    );
  }

  function renderAnswerCell(place: number) {
    const wrong = wrongCells[place];

    // Interactive input (solve mode, play only)
    if (!showStatic && phase === "solve") {
      return (
        <div key={`a-${place}`} className={`${CELL} h-12 sm:h-14`}>
          <button
            ref={element => { answerCellRefs.current[place] = element; }}
            type="button"
            onClick={() => setFocusedPlace(place)}
            onFocus={() => setFocusedPlace(place)}
            aria-label={`Answer digit for the ${columns[place].placeLabel}${answers[place] ? `: ${answers[place]}` : ""}`}
            className={`w-8 min-[380px]:w-9 sm:w-10 h-10 min-[380px]:h-11 sm:h-12 text-center text-2xl min-[380px]:text-3xl sm:text-4xl font-mono font-black rounded-xl border-2 outline-none transition-colors focus:ring-4 ${
              wrong
                ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300"
                : `border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white ${accent.ring}`
            }`}
          >
            {answers[place]}
          </button>
        </div>
      );
    }

    // Revealed digit (guide / solved / design)
    const revealed = answerRevealed(place);
    const preservedCorrect =
      inGuide && answers[place] !== "" && parseInt(answers[place], 10) === columns[place].digitOut;
    return (
      <div key={`a-${place}`} className={`${CELL} h-12 sm:h-14 text-2xl min-[380px]:text-3xl sm:text-4xl`}>
        {revealed || preservedCorrect ? (
          <motion.span
            key={`ans-${place}-${guideTrigger}-${phase}`}
            initial={reduce ? false : { y: -16, scale: 0.6, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={solved || preservedCorrect ? "text-emerald-600 dark:text-emerald-400" : accent.answer}
          >
            {preservedCorrect && !revealed ? answers[place] : columns[place].digitOut}
          </motion.span>
        ) : (
          <span className="text-transparent">0</span>
        )}
      </div>
    );
  }
};

// ── Shared shell — matches the other canvases' rounded/bordered frame ──
const BoardShell: React.FC<{ isDark: boolean; innerRef?: React.Ref<HTMLDivElement>; children: React.ReactNode }> = ({ isDark, innerRef, children }) => (
  <div ref={innerRef} className={`@container relative w-full h-full flex flex-col overflow-hidden rounded-2xl border shadow-sm ${
    isDark ? "dark bg-slate-900 border-slate-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
  }`}>
    {children}
  </div>
);

const StaticCarry: React.FC<{ accent: Accent; children: React.ReactNode }> = ({ accent, children }) => (
  <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center border-2 border-white dark:border-slate-900 shadow ${accent.badge}`}>
    {children}
  </span>
);
