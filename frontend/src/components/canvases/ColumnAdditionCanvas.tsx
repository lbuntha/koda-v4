/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Column Addition — the standard vertical algorithm, practised column by
 * column, with a struggle-triggered animated guide.
 *
 * The board is a monospace place-value grid (carry row · addend · addend · rule
 * · answer), rendered highest-place→ones. In play mode the student fills one
 * answer box per column; a wrong Check flashes the cell and, after two failed
 * checks, offers an animated walkthrough (also always available via "Show me
 * how"). The walkthrough is the numerals themselves moving — a column lights
 * up, the answer digit drops in, and a carry "1" flies into the next column —
 * narrated by a silent caption strip (no character). All arithmetic comes from
 * columnAdditionModel so the canvas can never phrase a problem differently from
 * how the panel authored it.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { CanvasProps } from "./types";
import { sounds } from "../../sound";
import { RotateCcw, Check, ChevronRight, HelpCircle, Sparkles, PartyPopper } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  buildColumnAdditionModel,
  columnCaption,
  describeColumnMode,
  normaliseChallenges,
  clampAddend,
  ColumnChallenge,
} from "./columnAdditionModel";

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

const CELL = "w-10 sm:w-12 flex items-center justify-center font-mono font-black select-none";
const OP_CELL = "w-7 sm:w-8 shrink-0 flex items-center justify-center";

export const ColumnAdditionCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  onSuccess,
  onAttempt,
}) => {
  const reduce = useReducedMotion();
  const accent = ACCENTS[FRAME_TO_ACCENT[question.config?.frameColor || "indigo"] || "indigo"];

  // ── Practice set: the authored problem, then any extra challenges ──
  const rawNum1 = question.config?.num1 ?? 18;
  const rawNum2 = question.config?.num2 ?? 13;
  const problems = useMemo<ColumnChallenge[]>(() => {
    const main = { num1: clampAddend(rawNum1), num2: clampAddend(rawNum2) };
    const seen = new Set<string>([`${main.num1}:${main.num2}`]);
    const list: ColumnChallenge[] = [main];
    for (const c of normaliseChallenges(question.config?.columnChallenges)) {
      const key = `${c.num1}:${c.num2}`;
      if (!seen.has(key)) { seen.add(key); list.push(c); }
    }
    return list;
  }, [rawNum1, rawNum2, question.config?.columnChallenges]);

  const [problemIndex, setProblemIndex] = useState(0);
  const safeIndex = Math.min(problemIndex, problems.length - 1);
  const current = problems[safeIndex];
  const model = useMemo(() => buildColumnAdditionModel(current.num1, current.num2), [current.num1, current.num2]);
  const { columns, num1, num2, sum } = model;

  // Guide is a flat beat list: each column gets an "add" beat then a "write" beat.
  const beats = useMemo(
    () => columns.flatMap((_, i) => [{ col: i, kind: "add" as const }, { col: i, kind: "write" as const }]),
    [columns],
  );
  const writeBeatOf = (i: number) => 2 * i + 1;

  // ── Per-problem state ──
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
  const [finished, setFinished] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset everything when the active problem changes.
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
    if (isPlayMode) {
      const id = requestAnimationFrame(() => inputRefs.current[0]?.focus());
      return () => cancelAnimationFrame(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.num1, current.num2, isPlayMode]);

  // ── Guide timeline ──
  useEffect(() => {
    if (phase !== "guide") return;
    setBeatIndex(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setBeatIndex(i);
      const beat = beats[i];
      if (beat?.kind === "write") {
        const col = columns[beat.col];
        sounds.playTick(col.digitOut || 1);
        if (col.carryOut) sounds.playPop();
      }
      if (i >= beats.length) {
        window.clearInterval(id);
        sounds.playSuccess();
      }
    }, 1250);
    return () => window.clearInterval(id);
  }, [phase, guideTrigger, beats, columns]);

  const enterGuide = useCallback((stuck: number | null) => {
    setStuckCol(stuck);
    setOfferGuide(false);
    setPhase("guide");
    setGuideTrigger(t => t + 1);
  }, []);

  const replayGuide = useCallback(() => setGuideTrigger(t => t + 1), []);

  const tryItMyself = useCallback(() => {
    setPhase("solve");
    setBeatIndex(-1);
    setAnswers(columns.map(() => ""));
    setWrongCells(columns.map(() => false));
    setOfferGuide(false);
    requestAnimationFrame(() => inputRefs.current[0]?.focus());
  }, [columns]);

  const allFilled = answers.length === columns.length && answers.every(a => a.trim() !== "");

  const setAnswerDigit = (place: number, raw: string) => {
    const digit = raw.replace(/[^0-9]/g, "").slice(-1);
    setAnswers(prev => prev.map((a, i) => (i === place ? digit : a)));
    setWrongCells(prev => (prev[place] ? prev.map((w, i) => (i === place ? false : w)) : prev));
    // Auto-advance leftward (ones → tens → …) so a child keeps a natural flow.
    if (digit && place < columns.length - 1) inputRefs.current[place + 1]?.focus();
  };

  const advanceProblem = useCallback(() => {
    if (safeIndex < problems.length - 1) {
      setProblemIndex(i => i + 1);
    } else {
      setFinished(true);
    }
  }, [safeIndex, problems.length]);

  const checkAnswer = () => {
    if (!allFilled || phase !== "solve") return;
    const wrong = columns.map((c, i) => parseInt(answers[i], 10) !== c.digitOut);
    const selected = answers.slice().reverse().join("");

    if (!wrong.some(Boolean)) {
      setPhase("solved");
      sounds.playSuccess();
      onAttempt?.("correct", { expected: String(sum), selected });
      window.setTimeout(advanceProblem, 1150);
      return;
    }

    sounds.playFailure();
    const nextFails = fails + 1;
    setFails(nextFails);
    setWrongCells(wrong);
    const nextCounts = wrongCounts.map((n, i) => (wrong[i] ? n + 1 : n));
    setWrongCounts(nextCounts);
    onAttempt?.("incorrect", { expected: String(sum), selected });

    const firstWrong = wrong.findIndex(Boolean);
    const struggling = nextFails >= 2 || nextCounts.some(n => n >= 2);
    if (struggling) {
      setStuckCol(firstWrong >= 0 ? firstWrong : null);
      setOfferGuide(true);
    }

    window.setTimeout(() => {
      setWrongCells(columns.map(() => false));
      setAnswers(prev => prev.map((a, i) => (wrong[i] ? "" : a)));
      if (firstWrong >= 0) inputRefs.current[firstWrong]?.focus();
    }, 750);
  };

  // ── What each part of the board should show, given the phase ──
  const showStatic = !isPlayMode; // design/preview: fully solved, no interaction
  const inGuide = phase === "guide";
  const guideDone = inGuide && beatIndex >= beats.length;
  const currentCol = beats[Math.min(Math.max(beatIndex, 0), beats.length - 1)]?.col ?? 0;

  const columnActive = (i: number) => inGuide && !guideDone && (beatIndex === 2 * i || beatIndex === 2 * i + 1);
  const answerRevealed = (i: number) =>
    showStatic || phase === "solved" || (inGuide && beatIndex >= writeBeatOf(i));
  const carryRevealed = (k: number) => {
    if (k <= 0) return false;
    const feeder = columns[k - 1];
    if (!feeder || feeder.carryOut <= 0) return false;
    if (showStatic || phase === "solved") return true;
    return inGuide && beatIndex >= writeBeatOf(k - 1);
  };

  // Visual order: highest place on the left, ones on the right.
  const order = useMemo(() => columns.map((_, i) => i).reverse(), [columns]);

  const caption = (() => {
    if (showStatic) return `${num1} + ${num2} = ${sum}`;
    if (finished) return "Every problem solved — brilliant work!";
    if (phase === "solved") return `${num1} + ${num2} = ${sum}!`;
    if (inGuide) return guideDone ? `${num1} + ${num2} = ${sum}!` : columnCaption(columns[currentCol]);
    if (fails > 0) return "Add one column at a time, starting from the ones on the right.";
    return "Fill in each column, starting from the ones →";
  })();

  // ── FINAL SCREEN ──
  if (finished) {
    return (
      <BoardShell isDark={isDark}>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 text-center">
          <motion.div
            initial={reduce ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center"
          >
            <PartyPopper size={34} />
          </motion.div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">All Done!</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold max-w-xs leading-relaxed">
            You added every column and carried when you needed to. Ready for bigger numbers?
          </p>
          <button
            onClick={() => { sounds.playSuccess(); onSuccess?.(); }}
            className={`px-8 py-3 rounded-full font-bold tracking-wide flex items-center gap-2 text-white cursor-pointer shadow-lg ${accent.badge} hover:opacity-90`}
          >
            Finish <ChevronRight size={16} />
          </button>
        </div>
      </BoardShell>
    );
  }

  return (
    <BoardShell isDark={isDark}>
      {/* Header: what shape of problem this is */}
      <div className="shrink-0 px-4 pt-3 flex items-center justify-center gap-1.5 flex-wrap">
        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          {describeColumnMode(model.digitMode)}
        </span>
        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
          model.anyCarry
            ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50"
            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50"
        }`}>
          {model.anyCarry ? "Carries" : "No carrying"}
        </span>
        {showStatic && (
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-700">
            Preview
          </span>
        )}
      </div>

      {/* Progress dots (multi-problem practice) */}
      {isPlayMode && problems.length > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-1.5 pt-2">
          {problems.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < safeIndex ? "w-6 bg-emerald-500" : i === safeIndex ? `w-6 ${accent.answer.replace("text-", "bg-")}` : "w-2.5 bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
      )}

      {/* ── THE BOARD ── */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4">
        <div className="inline-flex flex-col items-stretch">
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
            <div className={`${OP_CELL} text-2xl sm:text-3xl font-bold ${accent.op}`}>+</div>
            {order.map(place => renderAddendCell(place, columns[place].digit2, columns[place].hasDigit2))}
          </div>

          {/* Rule */}
          <div className="h-1 my-2 rounded bg-slate-300 dark:bg-slate-600 w-full" />

          {/* Answer row */}
          <div className="flex items-center justify-end">
            <div className={OP_CELL} />
            {order.map(place => renderAnswerCell(place))}
          </div>
        </div>
      </div>

      {/* ── CAPTION STRIP ── */}
      <div className="shrink-0 px-4">
        <div className={`mx-auto max-w-md text-center rounded-2xl border px-4 py-2.5 text-xs font-bold leading-snug transition-colors ${
          isDark ? "bg-slate-800/70 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-600"
        }`}>
          <AnimatePresence mode="wait">
            <motion.span
              key={caption}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="block"
            >
              {caption}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* ── FOOTER CONTROLS ── */}
      {!showStatic && (
        <div className="shrink-0 p-3 pt-2.5 flex flex-col items-center gap-2">
          {/* Struggle offer */}
          <AnimatePresence>
            {phase === "solve" && offerGuide && (
              <motion.button
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => enterGuide(stuckCol)}
                className="w-full max-w-xs rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
              >
                <Sparkles size={13} /> Stuck? Let me show you <ChevronRight size={13} />
              </motion.button>
            )}
          </AnimatePresence>

          {phase === "guide" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={replayGuide}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-200/60 dark:border-slate-700/60"
              >
                <RotateCcw size={12} /> Replay Animation
              </button>
              <button
                onClick={tryItMyself}
                className={`px-5 py-2 rounded-xl font-bold text-xs text-white cursor-pointer shadow flex items-center gap-1.5 ${accent.badge} hover:opacity-90`}
              >
                Try It Myself
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <button
                onClick={() => enterGuide(null)}
                title="Show me how"
                className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-200/60 dark:border-slate-700/60 shrink-0"
              >
                <HelpCircle size={13} /> Show me how
              </button>
              <button
                onClick={checkAnswer}
                disabled={!allFilled || phase === "solved"}
                className={`flex-1 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors ${
                  !allFilled || phase === "solved"
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    : `text-white cursor-pointer shadow ${accent.badge} hover:opacity-90`
                }`}
              >
                <Check size={16} /> Check
              </button>
            </div>
          )}
        </div>
      )}
    </BoardShell>
  );

  // ── cell renderers (closures over state) ──

  function renderCarry(place: number) {
    const col = columns[place];
    if (showStatic || phase === "solved") {
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
      <div key={`d-${place}`} className={`${CELL} h-12 sm:h-14 text-3xl sm:text-4xl text-slate-800 dark:text-slate-100`}>
        <div className={`w-9 sm:w-10 h-11 sm:h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${active ? `${accent.box} scale-105 shadow-sm` : ""}`}>
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
          <input
            ref={el => { inputRefs.current[place] = el; }}
            value={answers[place] ?? ""}
            onChange={e => setAnswerDigit(place, e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && allFilled) checkAnswer();
              if (e.key === "Backspace" && !answers[place] && place > 0) inputRefs.current[place - 1]?.focus();
            }}
            onFocus={e => e.target.select()}
            inputMode="numeric"
            maxLength={1}
            aria-label={`Answer digit for the ${columns[place].placeLabel}`}
            className={`w-9 sm:w-10 h-11 sm:h-12 text-center text-3xl sm:text-4xl font-mono font-black rounded-xl border-2 outline-none transition-colors focus:ring-4 ${
              wrong
                ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300"
                : `border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white ${accent.ring}`
            }`}
          />
        </div>
      );
    }

    // Revealed digit (guide / solved / design)
    const revealed = answerRevealed(place);
    const solvedOk = phase === "solved";
    return (
      <div key={`a-${place}`} className={`${CELL} h-12 sm:h-14 text-3xl sm:text-4xl`}>
        {revealed ? (
          <motion.span
            key={`ans-${place}-${guideTrigger}-${phase}`}
            initial={reduce ? false : { y: -16, scale: 0.6, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={solvedOk ? "text-emerald-600 dark:text-emerald-400" : accent.answer}
          >
            {columns[place].digitOut}
          </motion.span>
        ) : (
          <span className="text-transparent">0</span>
        )}
      </div>
    );
  }
};

// ── Shared shell — matches the other canvases' rounded/bordered frame ──
const BoardShell: React.FC<{ isDark: boolean; children: React.ReactNode }> = ({ isDark, children }) => (
  <div className={`w-full h-full flex flex-col overflow-hidden rounded-2xl border shadow-sm ${
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
