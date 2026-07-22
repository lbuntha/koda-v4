import React, { useState, useEffect, useRef } from "react";
import { COUNT_OBJECTS, CountingQuestion } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Settings, 
  Gamepad2, 
  Check, 
  Type, 
  Layers, 
  Grid, 
  Move,
  RotateCcw,
  PlusCircle,
  FolderPlus
} from "lucide-react";
import { CanvasProps, Sparkle } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, surfaceClass, emptySlotClass, accentChipClass } from "./canvasTheme";
import { FlexibleItem, FlexibleTarget } from "./flexible/types";
import { FlexibleTargetBin } from "./flexible/FlexibleTargetBin";
import { FlexibleDraggableItem } from "./flexible/FlexibleDraggableItem";
import { FlexibleStudentControls } from "./flexible/FlexibleStudentControls";
import { STAGE_W, STAGE_H, ITEM_SIZE } from "./flexible/layout";

export const FlexibleCanvas: React.FC<CanvasProps> = ({ 
  question, 
  isPlayMode, 
  showGrid, 
  isDark = false,
  onSuccess, 
  onUpdateQuestionConfig 
}) => {
  // Config states with safe defaults
  const mode = question.config.flexibleMode || "multichoice";
  const bgStyle = question.config.flexibleBgStyle || "clean";
  
  const items: FlexibleItem[] = question.config.flexibleItems || [
    { id: "item-1", emoji: "🍎", x: 90, y: 65 },
    { id: "item-2", emoji: "🍎", x: 200, y: 55 },
    { id: "item-3", emoji: "🍎", x: 300, y: 80 },
    { id: "item-4", emoji: "🎈", x: 135, y: 135 },
    { id: "item-5", emoji: "🎈", x: 255, y: 125 }
  ];
  const targets: FlexibleTarget[] = question.config.flexibleTargets || [
    { id: "bin-apples", label: "🍎 Apples Bin", x: 50, y: 185, width: 175, height: 110 },
    { id: "bin-balloons", label: "🎈 Balloons Bin", x: 255, y: 185, width: 175, height: 110 }
  ];

  // Dynamic Correct Answer:
  // If not customized, compute dynamically based on item count!
  const correctAnswer = question.config.flexibleCorrectAnswer || items.length.toString();

  // Dynamic Options:
  // If not customized, compute surrounding numbers dynamically!
  const options = question.config.flexibleOptions || (() => {
    const count = items.length;
    return [
      Math.max(1, count - 2).toString(),
      Math.max(2, count - 1).toString(),
      count.toString(),
      (count + 1).toString()
    ].filter((v, i, self) => self.indexOf(v) === i);
  })();

  // Drag states (for student in dragmatch mode OR for teacher in designer mode to position items)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedTargetId, setDraggedTargetId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<FlexibleItem[]>(items);
  const [localTargets, setLocalTargets] = useState<FlexibleTarget[]>(targets);
  
  // Student interaction states
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [textValue, setTextValue] = useState<string>("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [guideSolved, setGuideSolved] = useState(false);
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: guideSolved,
    idleThresholdMs: 10000
  });
  const [errorFlash, setErrorFlash] = useState<boolean>(false);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  // Tap-to-count mode states
  const [tappedItemIds, setTappedItemIds] = useState<string[]>([]);

  // Designer panel states
  const [newItemEmoji, setNewItemEmoji] = useState<string>("🍎");
  const [newTargetLabel, setNewTargetLabel] = useState<string>("Bucket");
  const [selectedItemForBin, setSelectedItemForBin] = useState<string>("");

  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const w = dimensions.width || 800;
  const h = dimensions.height || 500;
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  /**
   * Items and bins are authored on a fixed STAGE_W x STAGE_H design grid. The
   * stage is scaled uniformly to fill the available area, so the same layout
   * fills a phone and a projector without re-authoring — and design mode shows
   * exactly what play mode shows.
   */
  const stageScale = Math.max(0.35, Math.min(w / STAGE_W, h / STAGE_H));
  const stageLeft = Math.max(0, (w - STAGE_W * stageScale) / 2);
  const stageTop = Math.max(0, (h - STAGE_H * stageScale) / 2);

  /** Pointer position (client px) → design-grid coordinates. */
  const toStageCoords = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left) / stageScale,
      y: (clientY - rect.top) / stageScale
    };
  };

  // Measure the exact container coordinates space
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 800,
          height: entry.contentRect.height || 500
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Sync with prop updates
  useEffect(() => {
    setLocalItems(items);
    setLocalTargets(targets);
    resetStudentState();
  }, [question, question.config]);

  const resetStudentState = () => {
    setGuideSolved(false);
    setSelectedChoice(null);
    setTextValue("");
    setFeedbackMsg(null);
    setErrorFlash(false);
    setTappedItemIds([]);
    // Restore items to positions if not in design mode (to reset sorting)
    if (isPlayMode) {
      setLocalItems(items);
    }
  };

  const handlePointerDownItem = (e: React.PointerEvent, id: string) => {
    reportActivity();
    // Both teacher (in design mode) and student (in dragmatch mode) can drag items!
    const isDraggable = !isPlayMode || mode === "dragmatch";
    if (!isDraggable) {
      if (mode === "tapcount" && isPlayMode) {
        // Handle student tapping items to count them!
        handleTapItem(id);
      }
      return;
    }

    sounds.playPop();
    setDraggedItemId(id);
    setDraggedTargetId(null);

    // Offset is kept in design units so it stays valid at any stage scale.
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: (e.clientX - rect.left) / stageScale,
      y: (e.clientY - rect.top) / stageScale
    };

    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerDownTarget = (e: React.PointerEvent, id: string) => {
    // Teacher repositions bins in design mode; students may also drag the
    // baskets around while sorting (dragmatch play mode).
    const isDraggable = !isPlayMode || mode === "dragmatch";
    if (!isDraggable) return;

    sounds.playPop();
    setDraggedTargetId(id);
    setDraggedItemId(null);

    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: (e.clientX - rect.left) / stageScale,
      y: (e.clientY - rect.top) / stageScale
    };

    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId && !draggedTargetId) return;

    const stagePoint = toStageCoords(e.clientX, e.clientY);
    if (!stagePoint) return;

    let x = Math.round(stagePoint.x - dragOffset.current.x);
    let y = Math.round(stagePoint.y - dragOffset.current.y);

    // Boundary constraints, in design units
    const itemWidth = draggedItemId ? ITEM_SIZE : (localTargets.find(t => t.id === draggedTargetId)?.width || 110);
    const itemHeight = draggedItemId ? ITEM_SIZE : (localTargets.find(t => t.id === draggedTargetId)?.height || 70);

    x = Math.max(5, Math.min(STAGE_W - itemWidth - 5, x));
    y = Math.max(5, Math.min(STAGE_H - itemHeight - 5, y));

    // Optional snapping to grid in design mode
    if (!isPlayMode && showGrid) {
      x = Math.round(x / 20) * 20;
      y = Math.round(y / 20) * 20;
    }

    if (draggedItemId) {
      setLocalItems(prev => prev.map(item => item.id === draggedItemId ? { ...item, x, y } : item));
    } else if (draggedTargetId) {
      setLocalTargets(prev => prev.map(t => t.id === draggedTargetId ? { ...t, x, y } : t));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId && !draggedTargetId) return;

    const stagePoint = toStageCoords(e.clientX, e.clientY);

    if (draggedItemId && stagePoint) {
      // In student dragmatch, check if dropped onto target
      if (isPlayMode && mode === "dragmatch") {
        const droppedItem = localItems.find(i => i.id === draggedItemId);
        if (droppedItem) {
          // Find matching target
          const targetBinId = droppedItem.targetBin;
          const target = localTargets.find(t => t.id === targetBinId);

          if (target) {
            // Compute synchronous cursor release position, in design units
            const itemCenterX = stagePoint.x - dragOffset.current.x + ITEM_SIZE / 2;
            const itemCenterY = stagePoint.y - dragOffset.current.y + ITEM_SIZE / 2;

            const isInside = 
              itemCenterX >= target.x && 
              itemCenterX <= target.x + target.width &&
              itemCenterY >= target.y && 
              itemCenterY <= target.y + target.height;

            if (isInside) {
              // Centered drop & lock (item size is 44x44)
              const snappedX = target.x + (target.width - 44) / 2;
              const snappedY = target.y + (target.height - 44) / 2;

              setLocalItems(prev => {
                const nextItems = prev.map(item => item.id === draggedItemId ? {
                  ...item,
                  x: snappedX,
                  y: snappedY
                } : item);

                // Instantly check sorting completion on the fresh array state
                let allCorrect = true;
                nextItems.forEach(it => {
                  if (it.targetBin) {
                    const bin = localTargets.find(t => t.id === it.targetBin);
                    if (bin) {
                      const itCenterX = it.x + 22;
                      const itCenterY = it.y + 22;
                      const isItInside = 
                        itCenterX >= bin.x && 
                        itCenterX <= bin.x + bin.width &&
                        itCenterY >= bin.y && 
                        itCenterY <= bin.y + bin.height;
                      if (!isItInside) {
                        allCorrect = false;
                      }
                    } else {
                      allCorrect = false;
                    }
                  }
                });

                if (allCorrect && nextItems.length > 0) {
                  sounds.playSuccess();
                  setGuideSolved(true);
                  if (onSuccess) onSuccess();
                }

                return nextItems;
              });

              sounds.playTick(localItems.filter(i => isItemInTarget(i, target)).length + 1);
              triggerSparkle(e.clientX, e.clientY);
            } else {
              // Pop back to design preset coordinate
              const original = items.find(i => i.id === draggedItemId);
              if (original) {
                setLocalItems(prev => prev.map(item => item.id === draggedItemId ? { ...item, x: original.x, y: original.y } : item));
                sounds.playSlide();
              }
            }
          } else {
            // No target bound to item? Drop anywhere inside
            sounds.playPop();
          }
        }
      } else if (!isPlayMode) {
        // Teacher is designing: update state upwards
        onUpdateQuestionConfig?.({ flexibleItems: localItems });
      }
    } else if (draggedTargetId && !isPlayMode) {
      onUpdateQuestionConfig?.({ flexibleTargets: localTargets });
    }

    setDraggedItemId(null);
    setDraggedTargetId(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const isItemInTarget = (item: FlexibleItem, target: FlexibleTarget) => {
    const itemCenterX = item.x + ITEM_SIZE / 2;
    const itemCenterY = item.y + ITEM_SIZE / 2;
    return itemCenterX >= target.x && 
           itemCenterX <= target.x + target.width &&
           itemCenterY >= target.y && 
           itemCenterY <= target.y + target.height;
  };

  /** The bin the item currently being dragged belongs to — highlighted as a live drop target. */
  const isActiveDropTarget = (target: FlexibleTarget) => {
    if (!draggedItemId) return false;
    return localItems.find(i => i.id === draggedItemId)?.targetBin === target.id;
  };

  const checkDragMatchCompletion = () => {
    // Check if every item that has a targetBin is correctly placed in it
    let allCorrect = true;
    localItems.forEach(item => {
      if (item.targetBin) {
        const target = localTargets.find(t => t.id === item.targetBin);
        if (target) {
          if (!isItemInTarget(item, target)) {
            allCorrect = false;
          }
        } else {
          allCorrect = false;
        }
      }
    });

    if (allCorrect && localItems.length > 0) {
      sounds.playSuccess();
      setGuideSolved(true); if (onSuccess) onSuccess();
    }
  };

  // Student Tap-to-Count handler
  const handleTapItem = (id: string) => {
    if (tappedItemIds.includes(id)) {
      // Toggle off / untap
      setTappedItemIds(prev => prev.filter(item => item !== id));
      sounds.playTock();
    } else {
      const updated = [...tappedItemIds, id];
      setTappedItemIds(updated);
      sounds.playTick(updated.length);

      // Check if student finished tapping all items
      if (updated.length === localItems.length) {
        setFeedbackMsg("Amazing! You counted all of them!");
        sounds.playSuccess();
        setGuideSolved(true); if (onSuccess) onSuccess();
      }
    }
  };

  const checkAnswerCorrectness = (inputVal: string) => {
    const cleanInput = inputVal.trim().toLowerCase();
    const answersList = correctAnswer
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    if (answersList.length === 0) {
      return cleanInput === correctAnswer.trim().toLowerCase();
    }
    return answersList.includes(cleanInput);
  };

  // Student Multiple Choice submission
  const handleChoiceClick = (choice: string) => {
    reportActivity();
    if (!isPlayMode) return;
    setSelectedChoice(choice);
    
    if (checkAnswerCorrectness(choice)) {
      setErrorFlash(false);
      setFeedbackMsg("Correct! Super job!");
      sounds.playSuccess();
      setGuideSolved(true); if (onSuccess) onSuccess();
    } else {
      sounds.playFailure();
      setErrorFlash(true);
      setFeedbackMsg("Try again! You can do it!");
      setTimeout(() => setErrorFlash(false), 800);
    }
  };

  // Student Text Input submission
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPlayMode) return;

    if (checkAnswerCorrectness(textValue)) {
      setErrorFlash(false);
      setFeedbackMsg("Wow! Perfect answer!");
      sounds.playSuccess();
      setGuideSolved(true); if (onSuccess) onSuccess();
    } else {
      sounds.playFailure();
      setErrorFlash(true);
      setFeedbackMsg("Not quite! Let's count them again.");
      setTimeout(() => setErrorFlash(false), 800);
    }
  };

  // Sparkles generator
  const triggerSparkle = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const colors = ["text-violet-500", "text-pink-400", "text-cyan-400", "text-emerald-400", "text-indigo-400"];
    const newSparkles = Array.from({ length: 8 }).map((_, i) => ({
      id: Date.now() + i,
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 40,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setSparkles(prev => [...prev, ...newSparkles]);
    setTimeout(() => {
      setSparkles(prev => prev.filter(s => !newSparkles.find(n => n.id === s.id)));
    }, 800);
  };

  // Designer: Add custom item
  const handleAddItem = () => {
    const id = `item-flex-${Date.now()}`;
    const newItem: FlexibleItem = {
      id,
      emoji: newItemEmoji,
      x: 100 + Math.random() * 150,
      y: 80 + Math.random() * 80
    };
    const updated = [...localItems, newItem];
    setLocalItems(updated);
    onUpdateQuestionConfig?.({ flexibleItems: updated });
    sounds.playPop();
  };

  // Designer: Remove item
  const handleRemoveItem = (id: string) => {
    const updated = localItems.filter(i => i.id !== id);
    setLocalItems(updated);
    onUpdateQuestionConfig?.({ flexibleItems: updated });
    sounds.playPop();
  };

  // Designer: Add custom target bin
  const handleAddTarget = () => {
    const id = `bin-${Date.now()}`;
    const newTarget: FlexibleTarget = {
      id,
      label: newTargetLabel,
      x: 120 + Math.random() * 100,
      y: 185,
      width: 175,
      height: 110
    };
    const updated = [...localTargets, newTarget];
    setLocalTargets(updated);
    onUpdateQuestionConfig?.({ flexibleTargets: updated });
    sounds.playPop();
  };

  // Designer: Remove target bin
  const handleRemoveTarget = (id: string) => {
    const updated = localTargets.filter(t => t.id !== id);
    setLocalTargets(updated);
    // Clean items target binding
    const cleanedItems = localItems.map(item => item.targetBin === id ? { ...item, targetBin: undefined } : item);
    setLocalItems(cleanedItems);
    onUpdateQuestionConfig?.({ 
      flexibleTargets: updated,
      flexibleItems: cleanedItems
    });
    sounds.playPop();
  };

  // Designer: Bind item to target bin
  const handleBindItemToBin = (itemId: string, binId: string) => {
    const updated = localItems.map(item => item.id === itemId ? {
      ...item,
      targetBin: binId || undefined
    } : item);
    setLocalItems(updated);
    onUpdateQuestionConfig?.({ flexibleItems: updated });
    sounds.playPop();
  };

  /**
   * Scene backdrops the teacher picks. These are illustration, not chrome, so
   * they keep their art — but the coloured frames are gone, and "clean" falls
   * through to the standard neutral surface.
   */
  const getBgClass = () => {
    switch (bgStyle) {
      case "board":
        return isDark ? "bg-slate-900/80 text-white" : "bg-slate-800 text-white";
      case "grid":
        return isDark ? "bg-slate-900/80 text-slate-100" : "bg-sky-50/70 text-slate-800";
      case "stars":
        return "bg-[#0b132b]/90 text-indigo-100";
      case "meadow":
        return isDark
          ? "bg-gradient-to-b from-emerald-950/90 to-teal-900/90 text-emerald-100"
          : "bg-gradient-to-b from-emerald-50/80 to-emerald-100/80 text-emerald-950";
      default:
        return surfaceClass(isDark);
    }
  };

  // Dynamic Default Instruction Text:
  const getInstructionText = () => {
    const defaultApplesBalloonsText = "Sort the items! Drag the Apples 🍎 to the Apples Bin, and Balloons 🎈 to the Balloons Bin!";
    const hasApplesBalloonsInInstruction = question.instruction?.includes("Apples") && question.instruction?.includes("Balloons");
    
    // Check if the current items are different from default
    const hasDefaultItems = localItems.length === 5 && localItems.filter(i => i.emoji === "🍎").length === 3 && localItems.filter(i => i.emoji === "🎈").length === 2;
    
    if (question.instruction && (!hasApplesBalloonsInInstruction || hasDefaultItems)) {
      return question.instruction;
    }

    if (mode === "dragmatch") {
      const binLabels = localTargets.map(t => t.label).filter(Boolean);
      if (binLabels.length > 0) {
        return `Sort the items! Drag each item to its correct container: ${binLabels.join(" or ")}!`;
      }
      return "Sort the items! Drag each item into its matching bin container.";
    } else if (mode === "tapcount") {
      return `Tap on every item to count them up to ${localItems.length}!`;
    } else {
      return "How many items are on the screen? Count them and select your answer!";
    }
  };

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      showGrid={showGrid}
      isDark={isDark}
      gridSize={20}
      showRulers={question.config.showLayoutRulers ?? true}
      accent="indigo"
      headerIcon={<Sparkles size={15} />}
      headerTitle="Classroom Sorting Detective"
      headerSubtitle={
        mode === "dragmatch" 
          ? "Sort items into bins" 
          : mode === "multichoice" 
            ? "Pick the correct answer" 
            : mode === "tapcount" 
              ? "Tap to count" 
              : "Solve the counting challenge"
      }
      readAloudText={getInstructionText()}
      headerActions={
        <CanvasChip accent="indigo" isDark={isDark}>
          {mode === "dragmatch" ? "Classroom Sorting" : mode === "multichoice" ? "Multiple Choice" : "Tap to Count"}
        </CanvasChip>
      }
      designerHint="Switch to Design Mode to add elements, bins, and edit properties."
    >
      <div 
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`flex-1 min-h-[280px] relative rounded-[2.4rem] transition-all overflow-hidden p-4 my-1 z-10 touch-none select-none overscroll-none ${getBgClass()} ${
          errorFlash ? "ring-4 ring-rose-500/50" : ""
        }`}
      >
        {/* Background Decorative Accents */}
        {bgStyle === "grid" && (
          <div className="absolute inset-0 pointer-events-none opacity-20" style={{
            backgroundImage: "linear-gradient(#0ea5e9 0.5px, transparent 0.5px), linear-gradient(90deg, #0ea5e9 0.5px, transparent 0.5px)",
            backgroundSize: "20px 20px"
          }} />
        )}
        {bgStyle === "stars" && (
          <div className="absolute inset-0 pointer-events-none opacity-20">
            {Array.from({ length: 15 }).map((_, i) => (
              <div 
                key={i} 
                className="absolute bg-white rounded-full animate-pulse"
                style={{
                  top: `${(i * 17) % 100}%`,
                  left: `${(i * 31) % 100}%`,
                  width: `${(i % 3) + 1.5}px`,
                  height: `${(i % 3) + 1.5}px`
                }}
              />
            ))}
          </div>
        )}
        {bgStyle === "meadow" && (
          <div className="absolute inset-0 pointer-events-none flex items-end justify-between opacity-15 px-8 pb-2">
            <span>🌸</span><span>🌱</span><span>🌼</span><span>☘️</span><span>🌺</span>
          </div>
        )}

        {/* Floating Sparkles effect */}
        {sparkles.map(s => (
          <Sparkles 
            key={s.id} 
            className={`absolute ${s.color} animate-ping pointer-events-none z-50`} 
            style={{ left: s.x, top: s.y, width: "16px", height: "16px" }}
          />
        ))}

        <GhostGuideOverlay
          show={showGhostGuide && !guideSolved && isPlayMode}
          // A short nudge, not the full instruction — that already shows in the
          // footer hint on arrival; the ghost is the "stuck?" prompt.
          label={
            mode === "dragmatch"
              ? "Drag each item to its bin!"
              : mode === "multichoice"
                ? "Tap the answer you think is right!"
                : "Tap each item to count it!"
          }
          isDark={isDark}
          labelPlacement="top"
        />

        {/* ── Scaled design stage: everything below is positioned in design units ── */}
        <div
          ref={stageRef}
          style={{
            position: "absolute",
            left: stageLeft,
            top: stageTop,
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${stageScale})`,
            transformOrigin: "top left"
          }}
        >

        {/* Display Targets/Bins (In dragmatch mode or designer mode) */}
        {(mode === "dragmatch" || !isPlayMode) && localTargets.map(t => (
          <FlexibleTargetBin
            key={t.id}
            target={t}
            isPlayMode={isPlayMode}
            isDark={isDark}
            bgStyle={bgStyle}
            localItems={localItems}
            draggedTargetId={draggedTargetId}
            isActiveDropTarget={isActiveDropTarget(t)}
            isItemInTarget={isItemInTarget}
            onPointerDown={(e) => handlePointerDownTarget(e, t.id)}
            onRemove={() => handleRemoveTarget(t.id)}
          />
        ))}

        {/* Draggable/Tappable Items */}
        {localItems.map((item, idx) => {
          const isTapped = tappedItemIds.includes(item.id);
          const tapIndex = tappedItemIds.indexOf(item.id) + 1;
          const isDragged = draggedItemId === item.id;

          return (
            <FlexibleDraggableItem
              key={item.id}
              item={item}
              isPlayMode={isPlayMode}
              mode={mode}
              isDragged={isDragged}
              isTapped={isTapped}
              tapIndex={tapIndex}
              assetType={question.config.assetType || "emoji"}
              onPointerDown={(e) => handlePointerDownItem(e, item.id)}
              onRemove={() => handleRemoveItem(item.id)}
            />
          );
        })}

        {/* Prompt Instruction overlay if empty */}
        {localItems.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-100/5 border-2 border-dashed border-slate-300/30 rounded-xl m-4 pointer-events-none">
            <HelpCircle className="text-slate-400 mb-2 animate-bounce" size={24} />
            <h4 className="text-sm font-bold text-slate-400">Empty Flexible Canvas</h4>
            <p className="text-xs text-slate-400 max-w-[240px]">Switch to <strong>Design Mode</strong> to add some interactive emojis or targets!</p>
          </div>
        )}
        </div>
      </div>

      {/* Student Interaction Controls below the canvas */}
      {isPlayMode && (
        <FlexibleStudentControls
          mode={mode}
          isDark={isDark}
          options={options}
          selectedChoice={selectedChoice}
          textValue={textValue}
          feedbackMsg={feedbackMsg}
          tappedCount={tappedItemIds.length}
          totalItemsCount={localItems.length}
          onChoiceClick={handleChoiceClick}
          onTextChange={setTextValue}
          onTextSubmit={handleTextSubmit}
        />
      )}

    </SharedCanvasLayout>
  );
};
