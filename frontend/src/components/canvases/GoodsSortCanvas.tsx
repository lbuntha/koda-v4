/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CanvasProps } from "./types";
import { sounds } from "../../sound";
import {
  RotateCcw,
  RotateCw,
  Plus,
  Lightbulb,
  Sparkles,
  Timer,
  Check,
  PackageCheck,
  Shuffle,
  Layers,
} from "lucide-react";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { Celebration } from "./Celebration";
import { surfaceClass } from "./canvasTheme";
import {
  GOODS_SORT_LEVELS,
  getGoodsLevel,
  GoodsLevel,
  ShelfCompartment,
  GoodsItem,
} from "./goodsSortLevels";

/** 5-Tier Smart Solver for Goods Sort Puzzle */
export function solveGoodsSort(
  shelves: ShelfCompartment[]
): { from: string; to: string } | null {
  const isSolved = (state: { items: string[] }[]) =>
    state.every((s) => s.items.length === 0);

  const initial = shelves.map((s) => ({
    id: s.id,
    items: s.items.map((i) => i.typeKey),
    capacity: s.capacity,
  }));

  if (isSolved(initial)) return null;

  // Tier 1: Look for immediate 1-step Match-3 completion move
  for (let i = 0; i < shelves.length; i++) {
    const src = shelves[i];
    if (src.items.length === 0) continue;
    const itemToMove = src.items[src.items.length - 1];

    for (let j = 0; j < shelves.length; j++) {
      if (i === j) continue;
      const tgt = shelves[j];
      if (tgt.items.length >= tgt.capacity) continue;

      const simItems = [...tgt.items.map((it) => it.typeKey), itemToMove.typeKey];
      if (
        simItems.length === tgt.capacity &&
        simItems.every((k) => k === simItems[0])
      ) {
        return { from: src.id, to: tgt.id };
      }
    }
  }

  // Tier 2: BFS Solver for multi-step complete solution path
  const stateKey = (state: { items: string[] }[]) =>
    state
      .map((s) => s.items.join(","))
      .sort()
      .join("|");

  const visited = new Set<string>();
  visited.add(stateKey(initial));

  interface Node {
    shelves: { id: string; items: string[]; capacity: number }[];
    firstMove?: { from: string; to: string };
  }

  const queue: Node[] = [{ shelves: initial }];
  let iterations = 0;

  while (queue.length > 0 && iterations < 2000) {
    iterations++;
    const current = queue.shift()!;

    for (let i = 0; i < current.shelves.length; i++) {
      const src = current.shelves[i];
      if (src.items.length === 0) continue;

      for (let j = 0; j < current.shelves.length; j++) {
        if (i === j) continue;
        const tgt = current.shelves[j];
        if (tgt.items.length >= tgt.capacity) continue;

        const nextShelves = current.shelves.map((s) => ({
          ...s,
          items: [...s.items],
        }));

        const nSrc = nextShelves[i];
        const nTgt = nextShelves[j];

        const movedType = nSrc.items.pop()!;
        nTgt.items.push(movedType);

        if (
          nTgt.items.length === nTgt.capacity &&
          nTgt.items.every((t) => t === nTgt.items[0])
        ) {
          nTgt.items = []; // Cleared
        }

        const key = stateKey(nextShelves);
        if (!visited.has(key)) {
          visited.add(key);
          const firstMove = current.firstMove || { from: src.id, to: tgt.id };
          if (isSolved(nextShelves)) {
            return firstMove;
          }
          queue.push({ shelves: nextShelves, firstMove });
        }
      }
    }
  }

  // Tier 3: Heuristic Fallback - Move item to shelf with matching goods
  for (let i = 0; i < shelves.length; i++) {
    const src = shelves[i];
    if (src.items.length === 0) continue;
    const topItem = src.items[src.items.length - 1];

    for (let j = 0; j < shelves.length; j++) {
      if (i === j) continue;
      const tgt = shelves[j];
      if (tgt.items.length >= tgt.capacity) continue;

      if (tgt.items.length > 0 && tgt.items.some((it) => it.typeKey === topItem.typeKey)) {
        return { from: src.id, to: tgt.id };
      }
    }
  }

  // Tier 4: Move to any empty shelf to uncover deeper items
  for (let i = 0; i < shelves.length; i++) {
    const src = shelves[i];
    if (src.items.length === 0) continue;
    for (let j = 0; j < shelves.length; j++) {
      if (i === j) continue;
      const tgt = shelves[j];
      if (tgt.items.length === 0) {
        return { from: src.id, to: tgt.id };
      }
    }
  }

  // Tier 5: Any valid transfer
  for (let i = 0; i < shelves.length; i++) {
    const src = shelves[i];
    if (src.items.length === 0) continue;
    for (let j = 0; j < shelves.length; j++) {
      if (i === j) continue;
      const tgt = shelves[j];
      if (tgt.items.length < tgt.capacity) {
        return { from: src.id, to: tgt.id };
      }
    }
  }

  return null;
}

export const GoodsSortCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode = true,
  isDark = false,
  onSuccess,
  onAttempt,
  onHint,
}) => {
  const initialLevelId = (question.config as any)?.levelId || "level_1";
  const [selectedLevelId, setSelectedLevelId] = useState<string>(initialLevelId);
  const currentLevel = getGoodsLevel(selectedLevelId, question.config);

  const stageRef = useRef<HTMLDivElement>(null);
  const initialShelvesRef = useRef<ShelfCompartment[]>([]);

  // Deep clone level shelves
  const loadLevelShelves = (level: GoodsLevel): ShelfCompartment[] => {
    return level.shelves.map((s) => ({
      id: s.id,
      capacity: s.capacity,
      items: s.items.map((i) => ({ ...i })),
    }));
  };

  const [shelves, setShelves] = useState<ShelfCompartment[]>(() =>
    loadLevelShelves(currentLevel)
  );
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [history, setHistory] = useState<ShelfCompartment[][]>([]);
  const [isWon, setIsWon] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [clearedTripletsCount, setClearedTripletsCount] = useState(0);

  // Match explosion animation & drag feedback
  const [activeDraggingShelfId, setActiveDraggingShelfId] = useState<string | null>(null);
  const [matchingShelfId, setMatchingShelfId] = useState<string | null>(null);
  const [hintMove, setHintMove] = useState<{ from: string; to: string } | null>(null);

  // Sync level selection when question config changes
  useEffect(() => {
    const qLevelId = (question.config as any)?.levelId || "level_1";
    setSelectedLevelId(qLevelId);
  }, [(question.config as any)?.levelId, question.id]);

  // Load level shelves on level, config, or question change
  useEffect(() => {
    const lvl = getGoodsLevel(selectedLevelId, question.config);
    const initial = loadLevelShelves(lvl);
    initialShelvesRef.current = initial;
    setShelves(loadLevelShelves(lvl));
    setHistory([]);
    setSelectedShelfId(null);
    setIsWon(false);
    setMoveCount(0);
    setSeconds(0);
    setClearedTripletsCount(0);
    setHintMove(null);
    setMatchingShelfId(null);
  }, [selectedLevelId, JSON.stringify(question.config), question.id]);

  // Timer interval
  useEffect(() => {
    if (isWon) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isWon]);

  // Victory Check - All non-empty shelves have matching items
  useEffect(() => {
    if (isWon) return;
    const nonEmptyShelves = shelves.filter((s) => s.items.length > 0);
    const allFilledAreMatched =
      nonEmptyShelves.length > 0 &&
      nonEmptyShelves.every(
        (s) =>
          s.items.length === s.capacity &&
          s.items.every((i) => i.typeKey === s.items[0].typeKey)
      );

    if (allFilledAreMatched && moveCount > 0) {
      setIsWon(true);
      sounds.playWin();
      if (onSuccess) onSuccess();
      if (onAttempt) {
        onAttempt("correct", {
          expected: selectedLevelId,
          selected: selectedLevelId,
          details: {
            levelId: selectedLevelId,
            moveCount,
            seconds,
            clearedTriplets: clearedTripletsCount,
          },
        });
      }
    }
  }, [shelves, isWon, moveCount, selectedLevelId, seconds, clearedTripletsCount, onSuccess, onAttempt]);

  // Handle Transfer & Triple Match Check
  const executeTransfer = (fromId: string, toId: string) => {
    const srcShelf = shelves.find((s) => s.id === fromId);
    const tgtShelf = shelves.find((s) => s.id === toId);

    if (!srcShelf || !tgtShelf || srcShelf.items.length === 0) return;
    if (tgtShelf.items.length >= tgtShelf.capacity) {
      sounds.playFailure();
      if (onAttempt) {
        onAttempt("incorrect", {
          expected: "available_space",
          selected: "shelf_full",
          details: { levelId: selectedLevelId, reason: "shelf_full" },
        });
      }
      return;
    }

    // Save history for Undo
    setHistory((prev) =>
      prev.concat([
        shelves.map((s) => ({
          ...s,
          items: s.items.map((i) => ({ ...i })),
        })),
      ])
    );

    const itemToMove = srcShelf.items[srcShelf.items.length - 1];

    const nextShelves = shelves.map((s) => {
      if (s.id === fromId) {
        return { ...s, items: s.items.slice(0, s.items.length - 1) };
      }
      if (s.id === toId) {
        return { ...s, items: [...s.items, itemToMove] };
      }
      return s;
    });

    sounds.playPop();
    setShelves(nextShelves);
    setMoveCount((prev) => prev + 1);
    setSelectedShelfId(null);
    setHintMove(null);

    // Check if target shelf now has 3 or 4 identical items (Match Completed!)
    const updatedTarget = nextShelves.find((s) => s.id === toId)!;
    if (
      updatedTarget.items.length === updatedTarget.capacity &&
      updatedTarget.items.every((i) => i.typeKey === updatedTarget.items[0].typeKey)
    ) {
      setMatchingShelfId(toId);
      sounds.playSparkle();
      sounds.playSuccess();
      setClearedTripletsCount((prev) => prev + 1);

      setTimeout(() => {
        setMatchingShelfId(null);
      }, 800);
    }
  };

  const handleShelfClick = (clickedId: string) => {
    if (isWon || matchingShelfId) return;

    if (selectedShelfId === null) {
      const src = shelves.find((s) => s.id === clickedId);
      if (src && src.items.length > 0) {
        setSelectedShelfId(clickedId);
        sounds.playPop();
      }
    } else if (selectedShelfId === clickedId) {
      setSelectedShelfId(null);
    } else {
      executeTransfer(selectedShelfId, clickedId);
    }
  };

  const handleUndo = () => {
    if (history.length === 0 || isWon || matchingShelfId) return;
    const last = history[history.length - 1];
    setShelves(last);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setSelectedShelfId(null);
    setHintMove(null);
    sounds.playPop();
  };

  const handleReset = () => {
    if (matchingShelfId) return;
    const lvl = getGoodsLevel(selectedLevelId);
    const freshShelves =
      initialShelvesRef.current.length > 0
        ? initialShelvesRef.current.map((s) => ({
            id: s.id,
            capacity: s.capacity,
            items: s.items.map((i) => ({ ...i })),
          }))
        : loadLevelShelves(lvl);

    setShelves(freshShelves);
    setHistory([]);
    setSelectedShelfId(null);
    setIsWon(false);
    setMoveCount(0);
    setSeconds(0);
    setClearedTripletsCount(0);
    setHintMove(null);
    setMatchingShelfId(null);
    sounds.playPop();
  };

  const shelfRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleGetHint = () => {
    if (isWon || matchingShelfId) return;

    // Second tap on Hint auto-executes the recommended move!
    if (hintMove) {
      executeTransfer(hintMove.from, hintMove.to);
      setHintMove(null);
      return;
    }

    const move = solveGoodsSort(shelves);
    if (move) {
      setHintMove(move);
      setSelectedShelfId(move.from); // Auto-select source item!
      sounds.playPop();
      setTimeout(() => setHintMove(null), 8000); // Extended 8s guidance duration
      if (onHint) {
        onHint({
          levelId: selectedLevelId,
          hintFrom: move.from,
          hintTo: move.to,
        });
      }
    }
  };

  const handleShuffle = () => {
    if (isWon || matchingShelfId) return;
    // Flatten all items across shelves and redistribute
    const allItems = shelves.flatMap((s) => s.items);
    const shuffled = [...allItems].sort(() => Math.random() - 0.5);

    setShelves((prev) => {
      let idx = 0;
      return prev.map((s) => {
        const take = Math.min(s.items.length, shuffled.length - idx);
        const newItems = shuffled.slice(idx, idx + take);
        idx += take;
        return { ...s, items: newItems };
      });
    });

    sounds.playPop();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  const btnPill = (variant: "neutral" | "indigo" | "cyan" = "neutral") =>
    `flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-40 ${
      isDark
        ? variant === "indigo"
          ? "border-indigo-500/40 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
          : variant === "cyan"
          ? "border-cyan-500/30 bg-cyan-600/20 text-cyan-300"
          : "border-white/10 bg-white/[0.08] text-slate-300 hover:bg-white/[0.16]"
        : variant === "indigo"
        ? "border-indigo-200 bg-indigo-50/90 text-indigo-700 hover:bg-indigo-100 shadow-sm"
        : variant === "cyan"
        ? "border-slate-200 bg-slate-100/90 text-slate-700 shadow-sm"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-sm"
    }`;

  const headerControls = (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
      <div className={btnPill("neutral")}>
        <span className={isDark ? "text-slate-400" : "text-slate-500"}>Moves:</span>
        <span className={isDark ? "text-indigo-400 font-extrabold" : "text-indigo-600 font-extrabold"}>
          {moveCount}
        </span>
      </div>

      <div className={btnPill("cyan")}>
        <Timer size={14} className={isDark ? "text-cyan-400" : "text-slate-500"} />
        <span>{formatTime(seconds)}</span>
      </div>

      <button type="button" onClick={handleGetHint} disabled={isWon || !!matchingShelfId} className={btnPill("indigo")}>
        <Lightbulb size={14} className={isDark ? "text-indigo-300" : "text-indigo-600"} /> Hint
      </button>

      <button type="button" onClick={handleUndo} disabled={history.length === 0 || !!matchingShelfId} className={btnPill("neutral")}>
        <RotateCcw size={14} /> Undo
      </button>

      <button type="button" onClick={handleReset} disabled={!!matchingShelfId} className={btnPill("neutral")}>
        <RotateCw size={14} /> Reset
      </button>

      <button type="button" onClick={handleShuffle} disabled={isWon || !!matchingShelfId} className={btnPill("indigo")}>
        <Shuffle size={14} /> Shuffle
      </button>
    </div>
  );

  const getGridColsClass = (cols: number) => {
    if (cols <= 3) return "grid-cols-3 max-w-lg";
    if (cols <= 4) return "grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 max-w-2xl";
    return "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 max-w-4xl";
  };

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      headerTitle={question.title || "Goods Shelf Sort"}
      headerSubtitle={(question as any).subtitle || `${currentLevel.name}`}
      playHint="Sort 3 matching items into the same shelf compartment to clear them!"
      designerHint="Tap items or drag them between shelf compartments to group identical goods."
      headerActions={headerControls}
      footerStatus={
        isWon
          ? `Superb job! You organized all goods in ${moveCount} moves and ${formatTime(seconds)}!`
          : hintMove
          ? "💡 Tap highlighted target shelf (or tap Hint again to auto-move)"
          : selectedShelfId
          ? "Select a destination shelf to place the item"
          : undefined
      }
      footerSolved={isWon}
      isDark={isDark}
    >
      <div
        ref={stageRef}
        className={`flex min-h-0 w-full flex-col items-center justify-center p-1 sm:p-3 select-none rounded-3xl relative overflow-visible transition-colors duration-300 bg-transparent border-0 shadow-none ${
          isDark
            ? "text-stone-100"
            : "text-stone-900"
        }`}
      >
        {/* Soft Natural Ambient Light Drop */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-96 w-96 rounded-full bg-amber-400/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-orange-400/10 blur-[110px]" />

        {/* Interactive SVG Curved Trajectory Arrow for Hint Guide */}
        {hintMove && (() => {
          const srcEl = shelfRefs.current[hintMove.from];
          const tgtEl = shelfRefs.current[hintMove.to];
          const stageRect = stageRef.current?.getBoundingClientRect();

          if (srcEl && tgtEl && stageRect) {
            const sRect = srcEl.getBoundingClientRect();
            const tRect = tgtEl.getBoundingClientRect();

            const startX = sRect.left + sRect.width / 2 - stageRect.left;
            const startY = sRect.top + sRect.height / 2 - stageRect.top;
            const endX = tRect.left + tRect.width / 2 - stageRect.left;
            const endY = tRect.top + tRect.height / 2 - stageRect.top;

            const isRight = endX >= startX;
            const controlX = (startX + endX) / 2 + (isRight ? 20 : -20);
            const controlY = Math.min(startY, endY) - 50;
            const path = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;

            return (
              <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="goods-hint-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#34D399" />
                  </linearGradient>
                </defs>

                {/* Outer Glow Path */}
                <motion.path
                  d={path}
                  fill="none"
                  stroke="#818CF8"
                  strokeWidth="8"
                  strokeLinecap="round"
                  style={{ filter: "blur(4px)" }}
                  opacity="0.5"
                />

                {/* Animated Dashed Trajectory Line */}
                <motion.path
                  d={path}
                  fill="none"
                  stroke="url(#goods-hint-grad)"
                  strokeWidth="4"
                  strokeDasharray="8 6"
                  animate={{ strokeDashoffset: [-28, 0] }}
                  transition={{ repeat: Infinity, duration: 0.35, ease: "linear" }}
                />

                {/* Source Pointer Start Bulb */}
                <circle cx={startX} cy={startY} r="6" fill="#818CF8" className="animate-pulse" />

                {/* Destination Target Pulsing Ring & Badge */}
                <g transform={`translate(${endX}, ${endY})`}>
                  <motion.circle
                    r="20"
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="3.5"
                    initial={{ scale: 0.8, opacity: 0.9 }}
                    animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.9, 0.3, 0.9] }}
                    transition={{ repeat: Infinity, duration: 0.7 }}
                  />
                  <circle r="6" fill="#34D399" />
                </g>
              </svg>
            );
          }
          return null;
        })()}

        {/* Goods Shelf Grid Matrix - Compact 100% Fluid Responsive Warm Light Oak Bookcase Cabinet */}
        <div className="z-10 my-auto w-full max-w-[min(100%,50vh)] aspect-square p-1.5 sm:p-2.5 rounded-xl bg-[#D89454] border-4 sm:border-8 border-[#C48042] shadow-2xl flex flex-col justify-center items-center relative overflow-visible">
          
          {/* LAYER 1: Recessed Cubby Cavity Backboards & Wooden Floor Planks */}
          <div
            className={`grid w-full h-full gap-1.5 sm:gap-2 bg-[#D89454] p-0.5 justify-items-center items-center ${getGridColsClass(
              currentLevel.cols
            )}`}
          >
            {shelves.map((shelf) => {
              const isSelected = selectedShelfId === shelf.id;
              const isMatching = matchingShelfId === shelf.id;
              const isHintSrc = hintMove?.from === shelf.id;
              const isHintTgt = hintMove?.to === shelf.id;
              const isEmpty = shelf.items.length === 0;

              const activeSourceShelf = selectedShelfId ? shelves.find((s) => s.id === selectedShelfId) : null;
              const activeItem = activeSourceShelf?.items[activeSourceShelf.items.length - 1];
              
              const isOtherShelf = selectedShelfId !== null && selectedShelfId !== shelf.id;
              const hasSpace = shelf.items.length < shelf.capacity;
              const isMatchDropTarget = isOtherShelf && hasSpace && !isEmpty && shelf.items.some((it) => it.typeKey === activeItem?.typeKey);
              const isValidEmptyDropTarget = isOtherShelf && hasSpace && isEmpty;

              return (
                <motion.div
                  key={shelf.id}
                  data-shelf-id={shelf.id}
                  ref={(el) => {
                    shelfRefs.current[shelf.id] = el;
                  }}
                  onClick={() => handleShelfClick(shelf.id)}
                  animate={
                    isMatching
                      ? { scale: [1, 1.12, 0.88], rotate: [0, -3, 3, 0] }
                      : isSelected
                      ? { y: -4, scale: 1.02 }
                      : { y: 0, scale: 1 }
                  }
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className="relative flex aspect-square w-full max-w-[64px] xs:max-w-[76px] sm:max-w-[90px] md:max-w-[102px] flex-col justify-end items-center p-0.5 rounded-sm cursor-pointer transition-all z-0"
                >
                  {/* Recessed Dark Brown Cubby Cavity Backboard Background */}
                  <div
                    className={`absolute inset-0 rounded-sm overflow-hidden shadow-[inset_0_6px_14px_rgba(0,0,0,0.65)] pointer-events-none ${
                      isSelected
                        ? "border-2 border-amber-300 bg-[#5A381E] ring-2 ring-amber-300"
                        : isMatching
                        ? "border-2 border-emerald-400 bg-[#1C3D2B] ring-2 ring-emerald-400"
                        : isMatchDropTarget
                        ? "border-2 border-emerald-400/90 bg-[#224A33] ring-2 ring-emerald-400/50"
                        : isEmpty
                        ? isValidEmptyDropTarget
                          ? "border-2 border-dashed border-amber-400/80 bg-[#5A381E]/80"
                          : "bg-[#6B4323] hover:bg-[#784C28]"
                        : "bg-[#6B4323] hover:bg-[#784C28]"
                    }`}
                  />
                                      {/* Target Match Trace Floating Drop Badge */}
                  {isMatchDropTarget && (
                    <motion.div
                      initial={{ scale: 0, y: -4 }}
                      animate={{ scale: 1, y: 0 }}
                      className="absolute -top-3 z-30 bg-emerald-500 text-white font-black text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full shadow border border-emerald-300 flex items-center gap-0.5 pointer-events-none"
                    >
                      <Sparkles size={9} />
                      <span>MATCH HERE</span>
                    </motion.div>
                  )}

                  {/* Target Shelf 'TAP HERE 🎯' Hint Floating Badge */}
                  {isHintTgt && !isMatchDropTarget && (
                    <div className="absolute -top-3 z-30 bg-emerald-500 text-white font-extrabold text-[7.5px] sm:text-[8.5px] px-1.5 py-0.5 rounded-full shadow-lg border border-emerald-300 flex items-center gap-0.5 pointer-events-none">
                      <span>TAP HERE 🎯</span>
                    </div>
                  )}

                  {/* Triple Match Celebratory Floating Pill */}
                  {isMatching && (
                    <motion.div
                      initial={{ scale: 0, y: 0 }}
                      animate={{ scale: [0, 1.15, 1], y: -14 }}
                      className="absolute z-40 bg-gradient-to-r from-indigo-500 to-emerald-500 text-white font-black text-[8.5px] sm:text-[10px] px-2 py-0.5 rounded-full shadow-2xl border border-white flex items-center gap-1 pointer-events-none"
                    >
                      <Sparkles size={10} className="text-white" />
                      <span>TRIPLE MATCH!</span>
                    </motion.div>
                  )}

                  {/* Warm Light Oak Bottom Shelf Floor Plank */}
                  <div className="absolute bottom-0 inset-x-0 h-2.5 sm:h-3 rounded-b-[4px] bg-[#C88A4B] border-t border-[#A66C35] shadow-inner pointer-events-none" />

                  {/* Hint Guide Highlight */}
                  {(isHintSrc || isHintTgt) && (
                    <div
                      className={`absolute -inset-1 rounded-xl pointer-events-none ${
                        isHintSrc ? "bg-indigo-400/30 ring-2 ring-indigo-400" : "bg-emerald-400/30 ring-2 ring-emerald-400"
                      }`}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* LAYER 2: Foreground Items Grid Overlay (Unclipped Drag Layer Above All Backboards & Wooden Partitions) */}
          <div
            className={`absolute inset-0 p-1.5 sm:p-2.5 pointer-events-none z-50 grid w-full h-full gap-1.5 sm:gap-2 justify-items-center items-center overflow-visible ${getGridColsClass(
              currentLevel.cols
            )}`}
          >
            {shelves.map((shelf) => {
              const isSelected = selectedShelfId === shelf.id;
              const isDraggingThisShelf = activeDraggingShelfId === shelf.id;

              return (
                <div
                  key={`items-${shelf.id}`}
                  className="relative flex aspect-square w-full max-w-[64px] xs:max-w-[76px] sm:max-w-[90px] md:max-w-[102px] flex-col justify-end items-center p-0.5 rounded-sm overflow-visible"
                >
                  <div className="relative flex items-end justify-center w-full h-full pb-2 sm:pb-2.5 pointer-events-none overflow-visible">
                    <AnimatePresence>
                      {shelf.items.map((item, idx) => {
                        const isFront = idx === shelf.items.length - 1;

                        return (
                          <motion.div
                            key={item.id}
                            layout
                            drag={isFront && isPlayMode}
                            dragConstraints={stageRef}
                            dragElastic={0.2}
                            whileDrag={{
                              scale: 1.4,
                              rotate: 6,
                              zIndex: 999999,
                              filter: "drop-shadow(0 30px 30px rgba(0,0,0,0.6))",
                            }}
                            whileHover={isFront ? { scale: 1.06, y: -2 } : undefined}
                            onDragStart={() => {
                              setActiveDraggingShelfId(shelf.id);
                              if (isFront && selectedShelfId !== shelf.id) {
                                setSelectedShelfId(shelf.id);
                              }
                            }}
                            onDragEnd={(_, info) => {
                              setActiveDraggingShelfId(null);
                              if (!isFront) return;
                              const elements = document.elementsFromPoint(info.point.x, info.point.y);
                              const targetEl = elements.find(
                                (el) =>
                                  el.getAttribute("data-shelf-id") &&
                                  el.getAttribute("data-shelf-id") !== shelf.id
                              );
                              const targetId = targetEl?.getAttribute("data-shelf-id");
                              if (targetId) {
                                executeTransfer(shelf.id, targetId);
                              }
                            }}
                            data-shelf-id={shelf.id}
                            initial={{ scale: 0.5, opacity: 0, y: -20 }}
                            animate={{
                              scale: isFront ? 1 : 0.94,
                              opacity: 1,
                              x: (idx - (shelf.items.length - 1) / 2) * (shelf.items.length > 2 ? 10 : 12),
                              y: 0,
                              rotate: isSelected && isFront ? [0, -3, 3, 0] : 0,
                            }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 380, damping: 26 }}
                            className={`absolute bottom-2.5 sm:bottom-3 flex flex-col items-center justify-center p-0.5 rounded-xl select-none ${
                              isFront ? "cursor-grab active:cursor-grabbing z-20 pointer-events-auto" : "z-10 pointer-events-none"
                            }`}
                          >
                            {/* Clean Standalone Object (No Background Card Box) */}
                            <div className="flex items-center justify-center relative p-0.5 group">
                              {(() => {
                                switch (item.svgType) {
                                  case "chips":
                                    return (
                                      <svg viewBox="0 0 64 64" className="w-6 xs:w-7 sm:w-9 md:w-10 h-7 xs:h-8 sm:h-10 md:h-11 filter drop-shadow-md">
                                        <path d="M16 12 L48 8 L52 54 L12 56 Z" fill="#EF4444" />
                                        <path d="M16 12 L48 8 L46 22 L18 24 Z" fill="#F59E0B" opacity="0.9" />
                                        <polygon points="26,30 38,30 42,46 22,46" fill="#FBBF24" />
                                        <text x="32" y="42" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#78350F">CHIPS</text>
                                      </svg>
                                    );
                                  case "soda":
                                    return (
                                      <svg viewBox="0 0 64 64" className="w-6 xs:w-7 sm:w-9 md:w-10 h-7 xs:h-8 sm:h-10 md:h-11 filter drop-shadow-md">
                                        <rect x="20" y="10" width="24" height="46" rx="4" fill="#DC2626" />
                                        <rect x="22" y="12" width="20" height="6" fill="#9CA3AF" />
                                        <ellipse cx="32" cy="32" rx="9" ry="12" fill="#FBBF24" />
                                        <text x="32" y="30" textAnchor="middle" fontSize="6" fontWeight="extrabold" fill="#78350F">CHII</text>
                                        <text x="32" y="37" textAnchor="middle" fontSize="6" fontWeight="extrabold" fill="#78350F">COLA</text>
                                      </svg>
                                    );
                                  case "milk":
                                    return (
                                      <svg viewBox="0 0 64 64" className="w-6 xs:w-7 sm:w-9 md:w-10 h-7 xs:h-8 sm:h-10 md:h-11 filter drop-shadow-md">
                                        <path d="M22 20 L32 10 L42 20 L42 54 L22 54 Z" fill="#2563EB" />
                                        <path d="M24 22 L40 22 L40 52 L24 52 Z" fill="#FFFFFF" />
                                        <path d="M24 32 L40 32 L40 42 L24 42 Z" fill="#60A5FA" opacity="0.4" />
                                        <text x="32" y="48" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#1E3A8A">MILK</text>
                                      </svg>
                                    );
                                  case "jam":
                                    return (
                                      <svg viewBox="0 0 64 64" className="w-6 xs:w-7 sm:w-9 md:w-10 h-7 xs:h-8 sm:h-10 md:h-11 filter drop-shadow-md">
                                        <rect x="20" y="18" width="24" height="36" rx="6" fill="#EC4899" opacity="0.85" />
                                        <rect x="18" y="12" width="28" height="8" rx="2" fill="#BE185D" />
                                        <circle cx="32" cy="36" r="6" fill="#F472B6" />
                                      </svg>
                                    );
                                  default:
                                    return (
                                      <span className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl select-none filter drop-shadow-md transform hover:scale-110 transition-transform">
                                        {item.emoji}
                                      </span>
                                    );
                                }
                              })()}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Celebration show={isWon} />
    </SharedCanvasLayout>
  );
};
