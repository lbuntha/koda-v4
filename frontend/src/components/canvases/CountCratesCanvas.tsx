/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Counting Crates — the board. Rules, ladder and solver live in `countCratesModel.ts`;
 * this file is presentation and input only, so the logic stays testable without a DOM.
 *
 * Three ways in, deliberately: tap, drag, and the keyboard. Drag is the one interaction
 * neither the test suite nor a screenshot can verify, so it is the *enhancement* here
 * rather than the mechanism — everything is reachable by tapping, and everything is
 * reachable by keyboard.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Lightbulb, PackageOpen, RotateCcw, RotateCw, Sparkles } from "lucide-react";
import { CanvasProps } from "./types";
import { CrateFace } from "./CrateFace";
import { CountingStrip } from "./CountingStrip";
import { sounds } from "../../sound";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { guidePropsFor } from "../../features/koda-mascot";
import { Celebration } from "./Celebration";
import {
  CRATE_UNITS,
  OPENS_INTO,
  canLoad,
  canOpen,
  isPerfectlyPacked,
  openingSuggestion,
  reachStatus,
  packingGoal,
  getCratesLevel,
  hintCountCrates,
  isOrderFilled,
  load,
  open as openCrate,
  startingBoard,
  stockCount,
  trayTotal,
  unload,
  type CrateHint,
  type CratesBoard,
  type CrateUnit,
} from "./countCratesModel";

/** Crate colours by size, so a 10 is recognisable before the number is read. The number is
 *  always printed on the crate too — colour never carries meaning on its own. */
const CRATE_STYLE: Record<CrateUnit, { light: string; dark: string; ring: string }> = {
  1: { light: "bg-amber-200 text-amber-900", dark: "bg-amber-300/90 text-amber-950", ring: "ring-amber-400" },
  5: { light: "bg-sky-200 text-sky-900", dark: "bg-sky-300/90 text-sky-950", ring: "ring-sky-400" },
  10: { light: "bg-emerald-200 text-emerald-900", dark: "bg-emerald-300/90 text-emerald-950", ring: "ring-emerald-400" },
  100: { light: "bg-violet-200 text-violet-900", dark: "bg-violet-300/90 text-violet-950", ring: "ring-violet-400" },
};

/**
 * Slats across the box, so a crate looks like a crate.
 *
 * Two repeating gradients over whatever the crate's colour is: fine vertical lines for the
 * planks and one heavier horizontal band for the batten. Cheap, scales to any size, and it
 * keeps the tint carrying the crate's value rather than replacing it with a texture image.
 */
const SLATS: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(90deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 10px),"
    + "linear-gradient(180deg, rgba(255,255,255,0.22) 0 14%, transparent 14% 86%, rgba(0,0,0,0.07) 86% 100%)",
};

/** Bar-model fills, keyed to the crate colours so the strip reads as the same objects. */
const STRIP_FILL: Record<number, string> = {
  1: "bg-amber-300",
  5: "bg-sky-300",
  10: "bg-emerald-300",
  100: "bg-violet-300",
};

const crateLabel = (unit: CrateUnit, goods: string) =>
  unit === 1 ? `1 ${goods.replace(/s$/, "")}` : `${unit} ${goods}`;

export const CountCratesCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode = true,
  isDark = false,
  onSuccess,
  onAttempt,
  onHint,
}) => {
  const configKey = JSON.stringify(question.config ?? {});
  const level = useMemo(
    () => getCratesLevel((question.config as any)?.levelId, question.config),
    [configKey, question.id],
  );
  const reduceMotion = useReducedMotion();

  /**
   * Board, undo stack and move count in one piece of state, updated functionally.
   *
   * They were three, and each handler read `board` from its closure — so two taps landing
   * in the same tick both computed from the *same* board and the second was thrown away.
   * Six quick taps registered as one. A child tapping fast is not an edge case, it is how
   * children tap, so every move now applies to whatever the latest board is rather than to
   * whatever it was when the handler was created.
   */
  const [play, setPlay] = useState(() => ({
    board: startingBoard(level),
    history: [] as CratesBoard[],
    moves: 0,
  }));
  const { board, history, moves: moveCount } = play;
  const [isWon, setIsWon] = useState(false);
  const [hint, setHint] = useState<CrateHint>(null);
  const [held, setHeld] = useState<CrateUnit | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  /** Over-fills and refused moves. Play, not wrong answers — see `report` below. */
  const overfills = useRef(0);
  const startedAt = useRef(Date.now());
  const elapsedSeconds = () => Math.floor((Date.now() - startedAt.current) / 1000);

  const total = trayTotal(board);
  const short = level.orderTotal - total;
  const filled = isOrderFilled(board, level);
  /** The crate count the level invites — a bonus to aim at, never a gate. Exhaustive, memoised. */
  const crateTarget = useMemo(() => packingGoal(level), [level]);
  const perfect = isPerfectlyPacked(board, level);
  /**
   * Opening is the *mechanism* on some levels, not a trick — 47 cannot be made from tens
   * and fives at all. The board used to leave a child staring at a shelf that could not
   * pay the order, with the explanation buried behind a Hint button and a 15-second timer.
   * Now it says so the moment it becomes true.
   */
  const status = useMemo(() => reachStatus(board, level), [board, level]);
  const openTip = useMemo(
    () => (status === "needs-opening" ? openingSuggestion(board, level) : null),
    [status, board, level],
  );
  /** Unfinishable from here, and no opening will save it — the child needs to step back. */
  const isStuck = !isWon && status === "stuck";
  const units = useMemo(() => CRATE_UNITS.filter((unit) => (level.stock[unit] ?? 0) > 0), [level]);

  useEffect(() => {
    setPlay({ board: startingBoard(level), history: [], moves: 0 });
    setIsWon(false);
    setHint(null);
    setHeld(null);
    setFocusIndex(0);
    overfills.current = 0;
    startedAt.current = Date.now();
  }, [level, question.id]);

  // ── Reporting ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isWon || !isOrderFilled(board, level)) return;
    setIsWon(true);
    sounds.playWin();
    onSuccess?.();
    // The tray itself, never "I filled it": the server re-adds the crates and re-checks
    // the constraint. A claim of success proves nothing on its own.
    onAttempt?.("correct", {
      selected: [...board.tray],
      details: {
        levelId: level.id,
        orderTotal: level.orderTotal,
        crates: board.tray.length,
        packingGoal: crateTarget,
        perfectPacking: perfect,
        moveCount,
        opensUsed: board.opensUsed,
        seconds: elapsedSeconds(),
        overfills: overfills.current,
      },
    });
  }, [board, isWon, level, moveCount, onAttempt, onSuccess]);

  const wasOver = useRef(false);
  useEffect(() => {
    const over = total > level.orderTotal;
    if (over && !wasOver.current) overfills.current += 1;
    wasOver.current = over;
  }, [total, level.orderTotal]);

  // ── Nudge a child who has stalled ─────────────────────────────────────────────
  useEffect(() => {
    if (isWon || !isPlayMode || hint) return;
    const timer = setTimeout(() => setHint(hintCountCrates(board, level)), 15000);
    return () => clearTimeout(timer);
  }, [board, isWon, isPlayMode, hint, level]);

  /** Apply a move to the *current* board, whatever it is by the time this runs. */
  const apply = useCallback((move: (current: CratesBoard) => CratesBoard) => {
    setPlay((prev) => {
      const next = move(prev.board);
      if (next === prev.board) return prev;   // the move was refused
      return { board: next, history: prev.history.concat([prev.board]), moves: prev.moves + 1 };
    });
    setHint(null);
  }, []);

  const handleLoad = useCallback((unit: CrateUnit) => {
    if (isWon) return;
    sounds.playPop();
    apply((current) => load(current, unit));
  }, [apply, isWon]);

  const handleUnload = useCallback((index: number) => {
    if (isWon) return;
    sounds.playPop();
    apply((current) => unload(current, index));
  }, [apply, isWon]);

  const handleOpen = useCallback((unit: CrateUnit) => {
    if (isWon) return;
    sounds.playSparkle();
    apply((current) => openCrate(current, unit, level));
  }, [apply, isWon, level]);

  const handleUndo = () => {
    if (!history.length || isWon) return;
    setPlay((prev) => prev.history.length
      ? {
          board: prev.history[prev.history.length - 1],
          history: prev.history.slice(0, -1),
          // The counter describes the board, so undoing a move takes it back too.
          moves: Math.max(0, prev.moves - 1),
        }
      : prev);
    setHint(null);
    sounds.playPop();
  };

  const handleReset = () => {
    setPlay({ board: startingBoard(level), history: [], moves: 0 });
    setIsWon(false);
    setHint(null);
    startedAt.current = Date.now();
    overfills.current = 0;
    sounds.playPop();
  };

  const handleHint = () => {
    if (isWon) return;
    // A second tap plays the move, the way both sorting canvases behave.
    if (hint) {
      if (hint.kind === "load") handleLoad(hint.unit);
      else if (hint.kind === "unload") handleUnload(hint.index);
      else handleOpen(hint.unit);
      return;
    }
    const next = hintCountCrates(board, level);
    setHint(next);
    if (next) {
      sounds.playPop();
      onHint?.({ levelId: level.id, hint: next.kind, reason: next.reason });
    }
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────────
  //
  // Drag is the one interaction that cannot be automatically verified, so the board is
  // fully operable without it: arrows choose a crate, Enter loads it, Backspace takes the
  // last one back out, and "o" opens the chosen crate.
  const onStockKeyDown = (event: React.KeyboardEvent) => {
    if (!units.length) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setFocusIndex((index) => (index + 1) % units.length);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setFocusIndex((index) => (index - 1 + units.length) % units.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleLoad(units[focusIndex]);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      handleUnload(board.tray.length - 1);
    } else if (event.key.toLowerCase() === "o") {
      event.preventDefault();
      handleOpen(units[focusIndex]);
    }
  };

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 30 };

  const pill = (variant: "neutral" | "indigo" = "neutral") =>
    `flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-40 ${
      isDark
        ? variant === "indigo"
          ? "border-indigo-500/40 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
          : "border-white/10 bg-white/[0.08] text-slate-300 hover:bg-white/[0.16]"
        : variant === "indigo"
        ? "border-indigo-200 bg-indigo-50/90 text-indigo-700 hover:bg-indigo-100 shadow-sm"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-sm"
    }`;

  const headerControls = (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
      <div className={pill()}>
        <span className={isDark ? "text-slate-400" : "text-slate-500"}>Moves:</span>
        <span className={isDark ? "font-extrabold text-indigo-400" : "font-extrabold text-indigo-600"}>
          {moveCount}
        </span>
      </div>
      {level.opensAllowed > 0 && (
        <div className={pill()} data-testid="opens-left">
          <PackageOpen size={14} />
          <span>{level.opensAllowed - board.opensUsed} left</span>
        </div>
      )}
      <button type="button" onClick={handleHint} disabled={isWon} className={pill("indigo")}>
        <Lightbulb size={14} /> Hint
      </button>
      <button type="button" onClick={handleUndo} disabled={!history.length || isWon} className={pill()}>
        <RotateCcw size={14} /> Undo
      </button>
      <button type="button" onClick={handleReset} className={pill()}>
        <RotateCw size={14} /> Reset
      </button>
    </div>
  );

  const statusLine = isWon
    ? perfect
      ? `⭐ Perfect! ${level.orderTotal} ${level.goodsLabel} in ${board.tray.length} crates — the tightest packing there is.`
      : `Order filled — ${level.orderTotal} ${level.goodsLabel} in ${board.tray.length} crates.`
          + (crateTarget !== null ? ` It can be done in ${crateTarget} — try again for the star.` : "")
    : hint
    ? `💡 ${hint.reason}`
    : openTip
    ? `${short} more to go. You need ${openTip.needed} ${openTip.into}${openTip.needed === 1 ? "" : "s"} — open a ${openTip.unit} to make ${openTip.count}.`
    : short > 0
    ? `${short} more to go.`
    : short < 0
    ? `${-short} too many — take one back out.`
    : "Keep going.";

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      headerTitle={question.title || "Counting Crates"}
      /*
        The question leads — see `CountCanvas` for the standard.
      */
      questionText={question.instruction?.trim() || "Load the crates in the right order."}
      /* The four moments, cast from Mascot Studio — see `casting.ts`. */
      guideRole={isWon ? "celebrating" : "waiting"}
      {...guidePropsFor(question)}
      readAloudText={question.instruction?.trim() || "Load the crates in the right order."}
      playHint={level.teaches}
      designerHint="Tap a crate to load it into the tray. The order must match exactly."
      headerActions={headerControls}
      footerStatus={statusLine}
      footerSolved={isWon}
      isDark={isDark}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 p-1 sm:gap-3 sm:p-2">
        {/* ── The order, and the running total ── */}
        <div
          // An order ticket off a spike, not a status bar: the child is filling somebody's
          // order, and the paper is what makes that read at a glance.
          className={`flex w-full max-w-2xl shrink-0 flex-wrap items-center justify-center gap-2 rounded-lg border-l-4 px-3 py-2 shadow-sm ${
            isDark
              ? "border-amber-400/70 bg-[#1c1830]"
              : "border-amber-400 bg-[linear-gradient(180deg,#fffdf5,#fff8e6)]"
          }`}
        >
          <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Order
          </span>
          <span className="text-2xl font-black tabular-nums sm:text-3xl" data-testid="order-total">
            {level.orderTotal}
          </span>
          <span className="text-lg">{level.goodsEmoji}</span>
          <span className={`mx-1 h-6 w-px ${isDark ? "bg-white/15" : "bg-slate-300"}`} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Tray
          </span>
          {/* The running total is the whole feedback loop, so it is announced too — a
              child using a screen reader hears the count change as they load. */}
          <span
            aria-live="polite"
            data-testid="tray-total"
            className={`text-2xl font-black tabular-nums sm:text-3xl ${
              filled
                ? "text-emerald-500"
                : total > level.orderTotal
                ? "text-rose-500"
                : isDark
                ? "text-slate-200"
                : "text-slate-800"
            }`}
          >
            {total}
          </span>
          {/*
            A constrained order has *two* numbers, and only one of them was on screen. A
            child could hit 26 exactly, see the tray turn green, and have no way to learn
            that the board also wanted five crates — so the crate count is shown while they
            build, next to the total, not revealed once they are already stuck.
          */}
          {level.constraint !== "none" && crateTarget !== null && (
            <>
              <span className={`mx-1 h-6 w-px ${isDark ? "bg-white/15" : "bg-slate-300"}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Crates
              </span>
              <span
                data-testid="crate-count"
                className={`text-2xl font-black tabular-nums sm:text-3xl ${
                  perfect
                    ? "text-emerald-500"
                    : isDark
                    ? "text-slate-200"
                    : "text-slate-800"
                }`}
              >
                {board.tray.length}
                <span className="text-base opacity-50">/{crateTarget}</span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                perfect
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                  : isDark ? "bg-amber-400/20 text-amber-300" : "bg-amber-100 text-amber-800"
              }`}>
                {perfect ? "⭐ perfect packing" : level.constraint === "fewest" ? "try for fewest" : "try for exactly"}
              </span>
            </>
          )}
        </div>

        <CountingStrip
          tray={board.tray}
          orderTotal={level.orderTotal}
          isDark={isDark}
          fill={STRIP_FILL}
          reduceMotion={!!reduceMotion}
        />

        {/* ── The tray ── */}
        <div
          data-testid="tray"
          className={`flex min-h-[76px] w-full max-w-2xl flex-1 flex-wrap content-center items-center justify-center gap-1.5 overflow-y-auto rounded-2xl border-2 border-dashed p-2 ${
            filled
              ? "border-emerald-400 bg-emerald-400/10"
              : isDark
              ? "border-white/15 bg-white/[0.03]"
              : "border-amber-800/25 bg-[linear-gradient(180deg,#fdf6ea,#f6e9d5)]"
          }`}
        >
          <AnimatePresence>
            {board.tray.map((unit, index) => (
              <motion.button
                key={index}
                type="button"
                layout={!reduceMotion}
                initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={reduceMotion ? undefined : { scale: 0.6, opacity: 0 }}
                transition={spring}
                onClick={() => handleUnload(index)}
                style={SLATS}
                aria-label={`Take out ${crateLabel(unit, level.goodsLabel)}`}
                className={`flex min-h-[60px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 font-black shadow ${
                  isDark ? CRATE_STYLE[unit].dark : CRATE_STYLE[unit].light
                }`}
              >
                <CrateFace unit={unit} size={30} />
                <span className="text-xs leading-none">{unit}</span>
              </motion.button>
            ))}
          </AnimatePresence>
          {!board.tray.length && (
            <p className={`self-center text-xs font-semibold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Tap a crate below to start filling the order.
            </p>
          )}
        </div>

        {/*
          The count, written out.

          This is the clear guideline the game turns on, and it is the difference between a
          child guessing at a total and *counting*: the crates they have loaded are shown as
          the sum they make, with the running subtotal under each step. Reading
          "10 → 20 → 21 → 22 → 23" is counting on from a group, which is the whole skill.
          A bare total in a box would show the answer and hide the method.
        */}
        {board.tray.length > 0 && (
          <div
            data-testid="count-line"
            className={`flex max-h-16 w-full max-w-2xl shrink-0 flex-wrap items-end justify-center gap-x-1 gap-y-1 overflow-y-auto px-2 ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            {board.tray.map((unit, index) => {
              const runningTotal = board.tray
                .slice(0, index + 1)
                .reduce((sum, crate) => sum + crate, 0);
              return (
                <span key={index} className="flex flex-col items-center leading-none">
                  <span className="flex items-baseline gap-1">
                    {index > 0 && <span className="text-xs font-bold opacity-50">+</span>}
                    <span className="text-sm font-black tabular-nums sm:text-base">{unit}</span>
                  </span>
                  {/* The subtotal is the count itself — say it aloud and you are counting on. */}
                  <span className="text-[9px] font-bold tabular-nums opacity-55">{runningTotal}</span>
                </span>
              );
            })}
            <span className="flex items-baseline gap-1 pl-1">
              <span className="text-xs font-bold opacity-50">=</span>
              <span
                className={`text-sm font-black tabular-nums sm:text-base ${
                  filled ? "text-emerald-500" : total > level.orderTotal ? "text-rose-500" : ""
                }`}
              >
                {total}
              </span>
            </span>
          </div>
        )}

        {/* ── The shelf ── */}
        <div
          role="group"
          aria-label="Crates in stock"
          tabIndex={0}
          onKeyDown={onStockKeyDown}
          className="flex w-full max-w-2xl shrink-0 flex-wrap items-end justify-center gap-2 rounded-2xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {units.map((unit, index) => {
            const remaining = stockCount(board.stock, unit);
            const hinted = hint?.kind !== "unload" && hint?.unit === unit;
            const focused = index === focusIndex;
            return (
              <div key={unit} className="relative flex flex-col items-center gap-1">
                <motion.button
                  type="button"
                  disabled={!remaining || isWon}
                  onClick={() => handleLoad(unit)}
                  onPointerEnter={() => setHeld(unit)}
                  onPointerLeave={() => setHeld(null)}
                  onFocus={() => setFocusIndex(index)}
                  animate={{ scale: hinted && !reduceMotion ? 1.06 : 1 }}
                  transition={spring}
                  style={SLATS}
                  aria-label={`Load ${crateLabel(unit, level.goodsLabel)}. ${remaining} left.`}
                  className={`relative flex min-h-[72px] min-w-[72px] flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2.5 font-black shadow-md transition-opacity disabled:opacity-30 ${
                    isDark ? CRATE_STYLE[unit].dark : CRATE_STYLE[unit].light
                  } ${hinted || focused ? `ring-2 ${CRATE_STYLE[unit].ring}` : ""}`}
                >
                  <CrateFace unit={unit} size={46} />
                  <span className="text-base leading-none sm:text-lg">{unit}</span>
                  <span
                    className={`absolute -right-1 -top-1 rounded-full px-1.5 text-[10px] font-black ${
                      isDark ? "bg-slate-900 text-slate-200" : "bg-slate-800 text-white"
                    }`}
                  >
                    {remaining}
                  </span>
                </motion.button>

                {/* Naming the crate under the cursor: a "10" and a "100" are easy to confuse
                    at a glance, and the words are half the counting vocabulary.

                    Absolutely positioned and always mounted, opacity doing the showing. As a
                    normal child of the column it changed the row's height on hover, which
                    moved the crate out from under the pointer, which hid the label, which
                    moved it back — a flicker loop that read as the whole shelf flashing. */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -top-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/90 px-2 py-0.5 text-[9px] font-black uppercase text-white transition-opacity duration-150 ${
                    held === unit ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {crateLabel(unit, level.goodsLabel)}
                </span>

                {canOpen(board, unit, level) && (
                  <button
                    type="button"
                    onClick={() => handleOpen(unit)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                      isDark ? "bg-amber-400/20 text-amber-300" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    <PackageOpen size={10} /> Open → {OPENS_INTO[unit]!.count}×{OPENS_INTO[unit]!.unit}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {isStuck && (
          <motion.p
            data-testid="stuck"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`shrink-0 rounded-full px-3 py-1 text-center text-[11px] font-black ${
              isDark ? "bg-rose-400/20 text-rose-200" : "bg-rose-100 text-rose-900"
            }`}
          >
            <RotateCcw size={12} className="mb-0.5 mr-1 inline" />
            {total > level.orderTotal
              ? `${total - level.orderTotal} too many. Take a crate out.`
              : `You cannot make ${level.orderTotal} from here. Take a crate out and try again.`}
          </motion.p>
        )}
        {openTip && (
          <motion.p
            data-testid="must-open"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`shrink-0 rounded-full px-3 py-1 text-center text-[11px] font-black ${
              isDark ? "bg-amber-400/20 text-amber-200" : "bg-amber-100 text-amber-900"
            }`}
          >
            <PackageOpen size={12} className="mb-0.5 mr-1 inline" />
            {/* The number the child is reasoning about is what is *missing* — two ones —
                not the five you happen to get from opening a five. */}
            This order needs {openTip.needed} more {openTip.into}
            {openTip.needed === 1 ? "" : "s"}, and the shelf has none. Open a {openTip.unit} to
            make {openTip.count}.
          </motion.p>
        )}
        {level.opensAllowed > 0 && !isWon && !openTip && (
          <p className={`shrink-0 text-center text-[10px] font-semibold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            <Sparkles size={10} className="mb-0.5 mr-1 inline" />
            Opening a crate turns it into smaller ones. Undo puts it back.
          </p>
        )}
      </div>
      <Celebration show={isWon} />
    </SharedCanvasLayout>
  );
};
