import React, { useState, useEffect, useRef } from "react";
import { CanvasProps } from "./types";
import { sounds } from "../../sound";
import { Sparkles, Trash2, Edit, Hash, Smile } from "lucide-react";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { guidePropsFor } from "../../features/koda-mascot";
import { CanvasChip, surfaceClass, captionClass, accentChipClass, emptySlotClass } from "./canvasTheme";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";

// Standard valid 4x4 starting and solution boards
const SUDOKU_SOLUTION = [
  ["🍎", "🧁", "🦆", "⭐"],
  ["🦆", "⭐", "🍎", "🧁"],
  ["⭐", "🍎", "🧁", "🦆"],
  ["🧁", "🦆", "⭐", "🍎"]
];

const SUDOKU_START = [
  ["🍎", "", "🦆", ""],
  ["", "⭐", "", "🧁"],
  ["⭐", "", "", "🦆"],
  ["", "🦆", "⭐", ""]
];

export const KodaSudokuCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid,
  isDark = false,
  onSuccess,
  onAttempt,
  onUpdateQuestionConfig
}) => {
  const rows = question.config.rows ?? 4;
  const cols = question.config.cols ?? 4;
  const maxOptionSize = Math.max(rows, cols);
  const defaultEmojis = ["🍎", "🧁", "🦆", "⭐", "🎈", "🚗", "🐱", "🐶", "🍕"];
  const rawEmojis = question.config.sudokuOptions ?? ["🍎", "🧁", "🦆", "⭐"];
  const emojiOptions = Array.from({ length: maxOptionSize }, (_, i) => rawEmojis[i] || defaultEmojis[i] || "🌸");

  const [symbolType, setSymbolType] = useState<'numbers' | 'emojis'>(() => question.config.sudokuSymbolType || 'numbers');

  useEffect(() => {
    if (question.config.sudokuSymbolType) {
      setSymbolType(question.config.sudokuSymbolType);
    }
  }, [question.config.sudokuSymbolType]);

  const activeOptions = symbolType === 'numbers' 
    ? Array.from({ length: Math.max(rows, cols) }, (_, i) => (i + 1).toString())
    : emojiOptions;

  const getSanitizedGrid = (rawGrid: any, rCount: number, cCount: number) => {
    const next: string[][] = [];
    for (let r = 0; r < rCount; r++) {
      const rowArr: string[] = [];
      for (let c = 0; c < cCount; c++) {
        rowArr.push(rawGrid?.[r]?.[c] || "");
      }
      next.push(rowArr);
    }
    return next;
  };

  const startGrid = getSanitizedGrid(question.config.sudokuStartingGrid || SUDOKU_START, rows, cols);
  const solutionGrid = getSanitizedGrid(question.config.sudokuSolution || SUDOKU_SOLUTION, rows, cols);

  // Helper function to map cell values dynamically between emojis and numbers
  const mapGridSymbol = (gridData: string[][], toNumbers: boolean) => {
    return gridData.map(rowArr =>
      rowArr.map(val => {
        if (!val || val === "") return "";
        if (toNumbers) {
          const idx = emojiOptions.indexOf(val);
          if (idx !== -1) return (idx + 1).toString();
          if (["1", "2", "3", "4", "5", "6"].includes(val)) return val;
          return "1";
        } else {
          const idx = parseInt(val, 10) - 1;
          if (!isNaN(idx) && idx >= 0 && idx < emojiOptions.length) return emojiOptions[idx];
          if (emojiOptions.includes(val)) return val;
          return emojiOptions[0] || "🍎";
        }
      })
    );
  };

  const activeStartGrid = mapGridSymbol(startGrid, symbolType === 'numbers');
  const activeSolutionGrid = mapGridSymbol(solutionGrid, symbolType === 'numbers');

  const [grid, setGrid] = useState<string[][]>(() =>
    JSON.parse(JSON.stringify(activeStartGrid))
  );
  const [selectedItem, setSelectedItem] = useState<string | null>(activeOptions[0] || null);
  const [editTab, setEditTab] = useState<'start' | 'solution'>('start');

  useEffect(() => {
    setGrid(JSON.parse(JSON.stringify(activeStartGrid)));
  }, [symbolType, question.config.sudokuStartingGrid]);

  useEffect(() => {
    if (activeOptions.length > 0 && !activeOptions.includes(selectedItem || "")) {
      setSelectedItem(activeOptions[0]);
    }
  }, [symbolType, activeOptions]);

  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);

  // Measure center available area dimensions
  useEffect(() => {
    if (!centerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 440,
          height: entry.contentRect.height || 220
        });
      }
    });
    ro.observe(centerRef.current);
    return () => ro.disconnect();
  }, []);

  const w = dimensions.width || 440;
  const h = dimensions.height || 220;

  const isMobileStack = w <= 560;
  const cellSize = Math.max(34, Math.min(isMobileStack ? 48 : 58, Math.floor((h - (isMobileStack ? 100 : 24)) / rows), Math.floor((w - (isMobileStack ? 48 : 120)) / cols)));

  // Universal mathematical Sudoku rule validator (Rows, Cols, and 2x2 Boxes without repeats)
  const isSudokuRuleValid = (currentGrid: string[][]) => {
    if (!currentGrid || currentGrid.length !== rows) return false;

    // 1. Check if every cell is filled and matches preseeded clues
    for (let r = 0; r < rows; r++) {
      if (!currentGrid[r] || currentGrid[r].length !== cols) return false;
      for (let c = 0; c < cols; c++) {
        const val = currentGrid[r][c];
        if (!val || val === "") return false;
        if (activeStartGrid[r][c] !== "" && val !== activeStartGrid[r][c]) return false;
        if (!activeOptions.includes(val)) return false;
      }
    }

    // 2. Check every row for uniqueness
    for (let r = 0; r < rows; r++) {
      const rowSet = new Set(currentGrid[r]);
      if (rowSet.size !== cols) return false;
    }

    // 3. Check every column for uniqueness
    for (let c = 0; c < cols; c++) {
      const colSet = new Set<string>();
      for (let r = 0; r < rows; r++) {
        colSet.add(currentGrid[r][c]);
      }
      if (colSet.size !== rows) return false;
    }

    // 4. If 4x4, check all four 2x2 quadrants
    // 4. Check subgrid boxes (blocks/quadrants) if applicable
    let boxRows = 0;
    let boxCols = 0;
    if (rows === 4 && cols === 4) {
      boxRows = 2;
      boxCols = 2;
    } else if (rows === 6 && cols === 6) {
      boxRows = 2;
      boxCols = 3;
    } else if (rows === 9 && cols === 9) {
      boxRows = 3;
      boxCols = 3;
    }

    if (boxRows > 0 && boxCols > 0) {
      for (let r = 0; r < rows; r += boxRows) {
        for (let c = 0; c < cols; c += boxCols) {
          const boxSet = new Set<string>();
          for (let dr = 0; dr < boxRows; dr++) {
            for (let dc = 0; dc < boxCols; dc++) {
              const val = currentGrid[r + dr]?.[c + dc];
              if (val) boxSet.add(val);
            }
          }
          if (boxSet.size !== (boxRows * boxCols)) return false;
        }
      }
    }

    return true;
  };

  // Check if grid is correct either by exact match to solution sheet OR by universal Sudoku rules
  const checkSolved = (updated: string[][]) => {
    const isExactMatch = updated.every((rowArr, rIdx) =>
      rowArr.every((cellVal, cIdx) => cellVal === activeSolutionGrid[rIdx]?.[cIdx])
    );
    const isRuleValid = isSudokuRuleValid(updated);

    if (isExactMatch || isRuleValid) {
      sounds.playSuccess();
      onAttempt?.("correct", { selected: updated });
      onSuccess?.();
    }
  };

  const handleCellClick = (r: number, c: number) => {
    reportActivity();
    if (isPlayMode) {
      const isPreseeded = activeStartGrid[r][c] !== "";
      if (isPreseeded) {
        sounds.playSlide();
        return;
      }

      let nextValue = "";
      if (selectedItem) {
        if (grid[r][c] === selectedItem) {
          nextValue = "";
          sounds.playSlide();
        } else {
          nextValue = selectedItem;
          sounds.playTick();
        }
      } else {
        nextValue = "";
        sounds.playSlide();
      }

      const updated = grid.map((rowArr, rIdx) =>
        rowArr.map((cellVal, cIdx) => (rIdx === r && cIdx === c ? nextValue : cellVal))
      );
      setGrid(updated);
      checkSolved(updated);
    } else {
      const targetGrid = editTab === 'start' ? activeStartGrid : activeSolutionGrid;
      let nextValue = "";
      if (selectedItem) {
        if (targetGrid[r][c] === selectedItem) {
          nextValue = "";
          sounds.playSlide();
        } else {
          nextValue = selectedItem;
          sounds.playTick();
        }
      } else {
        nextValue = "";
        sounds.playSlide();
      }

      const updated = targetGrid.map((rowArr, rIdx) =>
        rowArr.map((cellVal, cIdx) => (rIdx === r && cIdx === c ? nextValue : cellVal))
      );

      // Map back to emojis/base format if stored
      const mappedBack = mapGridSymbol(updated, false);
      if (onUpdateQuestionConfig) {
        onUpdateQuestionConfig(
          editTab === 'start' ? { sudokuStartingGrid: mappedBack } : { sudokuSolution: mappedBack }
        );
      }
    }
  };

  const handleClearCell = (r: number, c: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeStartGrid[r][c] !== "") return;

    sounds.playSlide();
    
    if (isPlayMode) {
      const updated = grid.map((rowArr, rIdx) =>
        rowArr.map((cellVal, cIdx) => (rIdx === r && cIdx === c ? "" : cellVal))
      );
      setGrid(updated);
    } else {
      const targetGrid = editTab === 'start' ? activeStartGrid : activeSolutionGrid;
      const updated = targetGrid.map((rowArr, rIdx) =>
        rowArr.map((cellVal, cIdx) => (rIdx === r && cIdx === c ? "" : cellVal))
      );
      const mappedBack = mapGridSymbol(updated, false);
      if (onUpdateQuestionConfig) {
        onUpdateQuestionConfig(
          editTab === 'start' ? { sudokuStartingGrid: mappedBack } : { sudokuSolution: mappedBack }
        );
      }
    }
  };

  // Robust bounding box collision finder for drag-and-drop into black boxes
  const getTargetCellFromPoint = (x: number, y: number) => {
    const cellEls = document.querySelectorAll("[data-cell-idx]");
    for (let i = 0; i < cellEls.length; i++) {
      const rect = cellEls[i].getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const [rStr, cStr] = cellEls[i].getAttribute("data-cell-idx")!.split("-");
        return { r: parseInt(rStr, 10), c: parseInt(cStr, 10) };
      }
    }
    const el = document.elementFromPoint(x, y);
    const cell = el?.closest("[data-cell-idx]");
    if (cell) {
      const [rStr, cStr] = cell.getAttribute("data-cell-idx")!.split("-");
      return { r: parseInt(rStr, 10), c: parseInt(cStr, 10) };
    }
    return null;
  };

  // Drag-and-drop handlers
  const handleItemPointerDown = (e: React.PointerEvent, item: string) => {
    e.preventDefault();
    sounds.playPop();
    setDraggedItem(item);
    setDragPos({ x: e.clientX, y: e.clientY });
    if (containerRef.current && e.pointerId) {
      try { containerRef.current.setPointerCapture(e.pointerId); } catch (err) {}
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!draggedItem) return;
    setDragPos({ x: e.clientX, y: e.clientY });

    const target = getTargetCellFromPoint(e.clientX, e.clientY);
    if (target) {
      const isPreseeded = activeStartGrid[target.r][target.c] !== "";
      if (isPlayMode && isPreseeded) {
        setHoveredCell(null);
      } else {
        setHoveredCell(target);
      }
    } else {
      setHoveredCell(null);
    }
  };

  const applyDropAtCell = (r: number, c: number, itemVal: string) => {
    const val = itemVal === "eraser" ? "" : itemVal;
    if (isPlayMode) {
      const isPreseeded = activeStartGrid[r][c] !== "";
      if (!isPreseeded) {
        if (val === "") {
          sounds.playSlide();
        } else {
          sounds.playTick();
        }
        const updated = grid.map((rowArr, rIdx) =>
          rowArr.map((cellVal, cIdx) => (rIdx === r && cIdx === c ? val : cellVal))
        );
        setGrid(updated);
        checkSolved(updated);
      }
    } else {
      const targetGrid = editTab === 'start' ? activeStartGrid : activeSolutionGrid;
      const updated = targetGrid.map((rowArr, rIdx) =>
        rowArr.map((cellVal, cIdx) => (rIdx === r && cIdx === c ? val : cellVal))
      );
      const mappedBack = mapGridSymbol(updated, false);
      if (onUpdateQuestionConfig) {
        onUpdateQuestionConfig(
          editTab === 'start' ? { sudokuStartingGrid: mappedBack } : { sudokuSolution: mappedBack }
        );
      }
      if (val === "") {
        sounds.playSlide();
      } else {
        sounds.playTick();
      }
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItem) return;

    const target = getTargetCellFromPoint(e.clientX, e.clientY) || hoveredCell;
    if (target) {
      applyDropAtCell(target.r, target.c, draggedItem);
    }

    setDraggedItem(null);
    setHoveredCell(null);
    if (containerRef.current && e.pointerId) {
      try { containerRef.current.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    setDraggedItem(null);
    setHoveredCell(null);
    if (containerRef.current && e.pointerId) {
      try { containerRef.current.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  };

  const isExactSolved = grid.every((rowArr, rIdx) =>
    rowArr.every((cellVal, cIdx) => cellVal === activeSolutionGrid[rIdx]?.[cIdx])
  );
  const isCorrect = isExactSolved || isSudokuRuleValid(grid);
  const totalCells = rows * cols;
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: isCorrect,
    idleThresholdMs: 10000
  });
  const filledCount = grid.reduce((sum, rowArr) => sum + rowArr.filter(v => v !== "").length, 0);

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      accent="indigo"
      /*
        The question leads — see `CountCanvas` for the standard. The activity's
        own name and its meta line move out of the prominent slot; what a child
        has to do takes it, and does not change while they work.
      */
      questionText={question.instruction?.trim() || "Fill the grid — no repeats in any row, column or box."}
      /* The four moments, cast from Mascot Studio — see `casting.ts`. */
      guideRole={isCorrect ? "celebrating" : "waiting"}
      {...guidePropsFor(question)}
      readAloudText={question.instruction || "Drag numbers or emojis from the tray to complete the grid. No repeats in any row, column, or 2x2 box!"}
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isCorrect ? "emerald" : "indigo"} isDark={isDark}>
            {isCorrect ? "Solved" : `${filledCount} / ${totalCells} placed`}
          </CanvasChip>
        ) : (
          <div className={`flex items-center gap-1 p-1 rounded-2xl ${surfaceClass(isDark)}`}>
            <button
              onClick={() => {
                setSymbolType('numbers');
                if (onUpdateQuestionConfig) onUpdateQuestionConfig({ sudokuSymbolType: 'numbers' });
                sounds.playPop();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                symbolType === 'numbers' ? accentChipClass("indigo", isDark) : captionClass(isDark)
              }`}
            >
              <Hash size={12} />
              <span>Numbers</span>
            </button>
            <button
              onClick={() => {
                setSymbolType('emojis');
                if (onUpdateQuestionConfig) onUpdateQuestionConfig({ sudokuSymbolType: 'emojis' });
                sounds.playPop();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                symbolType === 'emojis' ? accentChipClass("indigo", isDark) : captionClass(isDark)
              }`}
            >
              <Smile size={12} />
              <span>Emojis</span>
            </button>
          </div>
        )
      }
      footerStatus={
        isCorrect
          ? "Spot on! No repeats in any row, column or box"
          : isPlayMode
            ? undefined
            : `Design Mode · Editing ${editTab === 'start' ? 'starting pieces' : 'the solution sheet'}`
      }
      footerSolved={isCorrect}
      designerHint="Switch starter pieces and solution cells to configure your Sudoku challenge."
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        className="relative flex-1 w-full h-full bg-transparent border-0 rounded-3xl p-1 flex flex-col justify-between overflow-hidden touch-none select-none overscroll-none gap-2"
      >
      {/* Design Mode Segment Tabs */}
      {!isPlayMode && (
        <div className={`w-full flex justify-center gap-2 mt-1 p-1.5 rounded-2xl border z-20 ${
          isDark ? "bg-slate-800/80 border-indigo-500/40" : "bg-indigo-50/70 border-indigo-200"
        }`}>
          <button
            onClick={() => setEditTab('start')}
            className={`flex-1 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              editTab === 'start' ? 'bg-indigo-600 text-white shadow-sm' : (isDark ? 'text-indigo-300 hover:bg-slate-700' : 'text-indigo-650 hover:bg-indigo-100/40')
            }`}
          >
            <Edit size={12} />
            Set Starting Pieces
          </button>
          <button
            onClick={() => setEditTab('solution')}
            className={`flex-1 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              editTab === 'solution' ? 'bg-indigo-600 text-white shadow-sm' : (isDark ? 'text-indigo-300 hover:bg-slate-700' : 'text-indigo-650 hover:bg-indigo-100/40')
            }`}
          >
            <Sparkles size={12} />
            Set Solution Sheet
          </button>
        </div>
      )}

      {/* Center 4x4 Grid Board & Selector Tray Workspace Container (Stage Arena) */}
      <div ref={centerRef} className="flex-1 w-full flex items-center justify-center my-1 relative z-0">
        {w > 0 && h > 0 && (
          <div className={`w-full flex items-center justify-center gap-6 transition-all duration-300 p-2 bg-transparent border-0 shadow-none ${w > 560 ? "flex-row" : "flex-col"}`}>
            
            {/* Visual Sudoku Board */}
            <div 
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gap: "6px"
              }}
              className="p-3 rounded-3xl relative bg-transparent border-0 shadow-none"
            >
              <GhostGuideOverlay
                show={showGhostGuide && !isCorrect && isPlayMode}
                label={"Drag a piece from the tray into an empty cell!"}
                isDark={isDark}
                labelPlacement="top"
              />
              {(isPlayMode ? grid : (editTab === 'start' ? activeStartGrid : activeSolutionGrid)).map((rowArr, r) =>
                rowArr.map((cellVal, c) => {
                  const isPreseeded = isPlayMode && activeStartGrid[r][c] !== "";
                  const isHighlighted = hoveredCell?.r === r && hoveredCell?.c === c;

                  return (
                    <button
                      key={`${r}-${c}`}
                      data-cell-idx={`${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      onPointerEnter={() => { if (draggedItem) setHoveredCell({ r, c }); }}
                      onPointerUp={(e) => {
                        if (draggedItem) {
                          e.stopPropagation();
                          applyDropAtCell(r, c, draggedItem);
                          setDraggedItem(null);
                          setHoveredCell(null);
                        }
                      }}
                      style={{
                        width: `${cellSize}px`,
                        height: `${cellSize}px`
                      }}
                      className={`rounded-2xl flex items-center justify-center font-bold select-none cursor-pointer transition-all relative group
                        ${symbolType === 'numbers' ? 'font-mono text-3xl font-black' : 'text-2xl'}
                        ${isPreseeded
                          ? `${surfaceClass(isDark, "raised")} ${isDark ? "text-slate-100" : "text-slate-800"} cursor-not-allowed`
                          : cellVal !== ""
                            ? `${accentChipClass("indigo", isDark)} border-2`
                            : `border-2 border-dashed ${emptySlotClass(isDark)} ${surfaceClass(isDark)} hover:border-indigo-400`
                        }
                        ${isHighlighted ? "ring-4 ring-indigo-400/60 scale-105 z-20" : ""}
                      `}
                    >
                      {cellVal !== "" && (
                        <span className="animate-scale-in">{cellVal}</span>
                      )}

                      {/* Clear trash icon on hover for user filled cells */}
                      {!isPreseeded && cellVal !== "" && (
                        <button
                          onClick={(e) => handleClearCell(r, c, e)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow cursor-pointer"
                        >
                          <Trash2 size={8} />
                        </button>
                      )}

                      {/* Mini Grid Line separation lines for dynamic quadrants */}
                      {cols % 2 === 0 && c === (cols / 2 - 1) && <div className={`absolute right-[-4px] top-0 bottom-0 w-[2px] pointer-events-none ${isDark ? "bg-white/25" : "bg-slate-900/20"}`} />}
                      {rows % 2 === 0 && r === (rows / 2 - 1) && <div className={`absolute bottom-[-4px] left-0 right-0 h-[2px] pointer-events-none ${isDark ? "bg-white/25" : "bg-slate-900/20"}`} />}
                    </button>
                  );
                })
              )}
            </div>

            <div className={`flex gap-2 p-3 rounded-3xl transition-colors ${surfaceClass(isDark)} ${w > 560 ? "flex-col" : "flex-row"}`}>
              <span className={`text-[9px] uppercase font-mono font-bold tracking-widest text-center ${captionClass(isDark)} ${w > 560 ? "block mb-1" : "hidden"}`}>
                {symbolType === 'numbers' ? 'Numbers' : 'Pieces'}
              </span>
              
              {activeOptions.map(item => (
                <button
                  key={item}
                  onPointerDown={e => handleItemPointerDown(e, item)}
                  onClick={() => {
                    setSelectedItem(item);
                    sounds.playPop();
                  }}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-grab active:cursor-grabbing border-2 select-none touch-none hover:scale-105 active:scale-95
                    ${symbolType === 'numbers' ? 'font-mono text-2xl font-black' : 'text-2xl'}
                    ${selectedItem === item
                      ? `${accentChipClass("indigo", isDark)} scale-105`
                      : `${surfaceClass(isDark, "raised")} border-transparent ${isDark ? "text-slate-200" : "text-slate-700"}`
                    }
                  `}
                >
                  {item}
                </button>
              ))}

              {/* Eraser Tool */}
              <button
                onPointerDown={e => handleItemPointerDown(e, "eraser")}
                onClick={() => {
                  setSelectedItem(null);
                  sounds.playPop();
                }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-grab active:cursor-grabbing border-2 select-none touch-none hover:scale-105 active:scale-95
                  ${selectedItem === null
                    ? `${accentChipClass("rose", isDark)} scale-105`
                    : `${surfaceClass(isDark, "raised")} border-transparent ${isDark ? "text-rose-400" : "text-rose-500"}`
                  }
                `}
                title="Eraser Tool"
              >
                <Trash2 size={18} />
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Floating Drag Preview item (bulletproof pointer-events-none + inline style) */}
      {draggedItem && (
        <div
          style={{
            position: "fixed",
            left: `${dragPos.x - 22}px`,
            top: `${dragPos.y - 22}px`,
            pointerEvents: "none",
          }}
          className="pointer-events-none z-50 select-none filter drop-shadow-lg animate-pulse opacity-90"
        >
          <div className={`w-12 h-12 rounded-2xl border-2 shadow-xl flex items-center justify-center ${accentChipClass("indigo", isDark)} ${symbolType === 'numbers' ? 'font-mono text-2xl font-black' : 'text-2xl'}`}>
            {draggedItem === "eraser" ? "🗑️" : draggedItem}
          </div>
        </div>
      )}
      </div>
    </SharedCanvasLayout>
  );
};
