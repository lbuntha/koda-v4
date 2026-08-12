import React, { useState, useEffect, useMemo, useRef } from "react";
import { COUNT_OBJECTS, CountingQuestion } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { Sparkles, HelpCircle, RotateCcw } from "lucide-react";
import { CanvasProps, Sparkle } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { guidePropsFor } from "../../features/koda-mascot";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { FlexibleItem, FlexibleTarget } from "./flexible/types";
import { FlexibleTargetBin } from "./flexible/FlexibleTargetBin";
import { FlexibleDraggableItem } from "./flexible/FlexibleDraggableItem";
import { FlexibleStudentControls } from "./flexible/FlexibleStudentControls";
import { STAGE_W, STAGE_H, ITEM_SIZE, autoArrangeLayout } from "./flexible/layout";
import { Button } from "../ui";

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  violet: "violet",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

export const FlexibleCanvas: React.FC<CanvasProps> = ({ 
  question, 
  isPlayMode, 
  showGrid, 
  isDark = false,
  onSuccess, 
  onAttempt,
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
  /** The bin's content area — what the authored layout is actually scaled into. */
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  /** The stage box, taken once per drag: measuring it every move forces a reflow. */
  const stageBox = useRef<DOMRect | null>(null);
  /** Where the pointer went down, and whether it has travelled far enough to be a drag. */
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const dragMoved = useRef(false);

  /**
   * Items and bins are authored on a fixed STAGE_W x STAGE_H design grid, which
   * is then scaled uniformly — the same layout fills a phone and a projector
   * without re-authoring.
   *
   * What is scaled differs by mode, and that is the whole difference between an
   * apple a child can see and the one they could not. Scaling the nominal 3:2
   * grid into a wide, short card letterboxes it to the height: a 480 × 320 grid
   * in a 930 × 210 box renders at 315 × 210, so five apples authored near the
   * middle came out tiny in a card that was two-thirds empty. In play the grid
   * is not the point — the authored *content* is, so the content's own bounding
   * box is what gets zoomed to fit, which keeps every relative position exactly
   * as authored and spends the whole card on it. Design mode still shows the
   * full grid, because a teacher has to be able to place things in it.
   */
  const contentBox = useMemo(() => {
    const boxes = [
      ...localItems.map(item => ({
        left: item.x, top: item.y, right: item.x + ITEM_SIZE, bottom: item.y + ITEM_SIZE
      })),
      ...((mode === "dragmatch" || !isPlayMode) ? localTargets.map(target => ({
        left: target.x, top: target.y, right: target.x + target.width, bottom: target.y + target.height
      })) : [])
    ];
    if (boxes.length === 0) return { left: 0, top: 0, width: STAGE_W, height: STAGE_H };

    const left = Math.min(...boxes.map(b => b.left));
    const top = Math.min(...boxes.map(b => b.top));
    return {
      left,
      top,
      width: Math.max(ITEM_SIZE, Math.max(...boxes.map(b => b.right)) - left),
      height: Math.max(ITEM_SIZE, Math.max(...boxes.map(b => b.bottom)) - top)
    };
  }, [localItems, localTargets, mode, isPlayMode]);

  const fitBox = isPlayMode ? contentBox : { left: 0, top: 0, width: STAGE_W, height: STAGE_H };
  /** Small inset only — the bin around the stage already provides the padding. */
  const STAGE_INSET = 4;
  const availableW = Math.max(ITEM_SIZE, w - STAGE_INSET * 2);
  const availableH = Math.max(ITEM_SIZE, h - STAGE_INSET * 2);
  /* Capped at 3: `ITEM_SIZE` × 3 is the same 132px ceiling every other canvas
     tops out at, so a slide holding one object does not fill the room with it. */
  const stageScale = Math.max(0.35, Math.min(3, Math.min(availableW / fitBox.width, availableH / fitBox.height)));
  const stageLeft = STAGE_INSET + (availableW - fitBox.width * stageScale) / 2 - fitBox.left * stageScale;
  const stageTop = STAGE_INSET + (availableH - fitBox.height * stageScale) / 2 - fitBox.top * stageScale;

  /** Pointer position (client px) → design-grid coordinates. */
  const toStageCoords = (clientX: number, clientY: number) => {
    const rect = stageBox.current || stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left) / stageScale,
      y: (clientY - rect.top) / stageScale
    };
  };

  // Measure the exact container coordinates space
  useEffect(() => {
    if (!hostRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 800,
          height: entry.contentRect.height || 500
        });
      }
    });
    ro.observe(hostRef.current);
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
    stageBox.current = stageRef.current?.getBoundingClientRect() || null;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;

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
    stageBox.current = stageRef.current?.getBoundingClientRect() || null;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;

    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId && !draggedTargetId) return;

    // A tap is not a drag: a child pressing an item to hear it should not have
    // it slide, and 4px of hand tremor is a press.
    if (!dragMoved.current && pressOrigin.current) {
      const travelled = Math.hypot(e.clientX - pressOrigin.current.x, e.clientY - pressOrigin.current.y);
      if (travelled > 4) dragMoved.current = true;
    }

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

              const nextItems = localItems.map(item => item.id === draggedItemId ? {
                ...item,
                x: snappedX,
                y: snappedY
              } : item);
              setLocalItems(nextItems);

              // Completion callbacks update GameLauncher. Keep them in the pointer event,
              // never inside a local-state updater (which React may execute during render).
              const allCorrect = nextItems.every(item => {
                if (!item.targetBin) return true;
                const bin = localTargets.find(candidate => candidate.id === item.targetBin);
                if (!bin) return false;
                const itemCenterX = item.x + ITEM_SIZE / 2;
                const itemCenterY = item.y + ITEM_SIZE / 2;
                return itemCenterX >= bin.x
                  && itemCenterX <= bin.x + bin.width
                  && itemCenterY >= bin.y
                  && itemCenterY <= bin.y + bin.height;
              });

              if (allCorrect && nextItems.length > 0) {
                sounds.playSuccess();
                setGuideSolved(true);
                onAttempt?.("correct", {
                  selected: Object.fromEntries(
                    nextItems
                      .filter(item => item.targetBin)
                      .map(item => [item.id, item.targetBin]),
                  ),
                });
                onSuccess?.();
              }

              sounds.playTick(localItems.filter(i => isItemInTarget(i, target)).length + 1);
              triggerSparkle(e.clientX, e.clientY);
            } else {
              // Pop back to where the slide put it.
              const original = items.find(i => i.id === draggedItemId);
              if (original) {
                setLocalItems(prev => prev.map(item => item.id === draggedItemId ? { ...item, x: original.x, y: original.y } : item));
                if (dragMoved.current) sounds.playSlide();
              }
              /*
                Landing in the wrong basket is a wrong answer and has to be
                reported as one — it used to pop back in silence, so a child
                could sort everything into the wrong bins and the attempt log
                would show nothing at all. Letting go over open space is not an
                answer, so it stays unreported.
              */
              const wrongBin = dragMoved.current
                ? localTargets.find(bin =>
                  bin.id !== targetBinId
                  && itemCenterX >= bin.x && itemCenterX <= bin.x + bin.width
                  && itemCenterY >= bin.y && itemCenterY <= bin.y + bin.height)
                : undefined;
              if (wrongBin) {
                sounds.playFailure();
                onAttempt?.("incorrect", { selected: { [droppedItem.id]: wrongBin.id } });
                /*
                  Sorting into the wrong bin is a wrong answer, and it used to be
                  the one wrong answer that only made a noise: the multichoice
                  and typed paths both flashed, and this one did not, so a child
                  sorting with the sound off got nothing back at all. Now it
                  reaches the same flag the others do, which is also what moves
                  Koda to the oops face.
                */
                setErrorFlash(true);
                setTimeout(() => setErrorFlash(false), 800);
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
    pressOrigin.current = null;
    dragMoved.current = false;
    stageBox.current = null;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  /*
    Without this a cancelled pointer — a touch interrupted by a call, a
    right-click mid-drag — left the item stuck to the finger for good.
  */
  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!draggedItemId && !draggedTargetId) return;
    setDraggedItemId(null);
    setDraggedTargetId(null);
    pressOrigin.current = null;
    dragMoved.current = false;
    stageBox.current = null;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
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
        setGuideSolved(true);
        onAttempt?.("correct", { selected: updated.length });
        onSuccess?.();
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
      setGuideSolved(true);
      onAttempt?.("correct", { selected: choice });
      onSuccess?.();
    } else {
      sounds.playFailure();
      setErrorFlash(true);
      setFeedbackMsg("Try again! You can do it!");
      onAttempt?.("incorrect", { selected: choice });
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
      setGuideSolved(true);
      onAttempt?.("correct", { selected: textValue });
      onSuccess?.();
    } else {
      sounds.playFailure();
      setErrorFlash(true);
      setFeedbackMsg("Not quite! Let's count them again.");
      onAttempt?.("incorrect", { selected: textValue });
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
  /** Put the authored layout back to the tidy default the studio also uses. */
  const handleAutoArrange = () => {
    sounds.playPop();
    const arranged = autoArrangeLayout(localItems, localTargets);
    setLocalItems(arranged.items);
    setLocalTargets(arranged.targets);
    onUpdateQuestionConfig?.({
      flexibleItems: arranged.items,
      flexibleTargets: arranged.targets
    });
  };

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";

  /** How much is left to do, in the mode's own terms. */
  const sortedCount = localItems.filter(item => {
    if (!item.targetBin) return false;
    const bin = localTargets.find(candidate => candidate.id === item.targetBin);
    return bin ? isItemInTarget(item, bin) : false;
  }).length;
  const toSort = localItems.filter(item => item.targetBin).length - sortedCount;

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
      accent={accent}
      // The activity name must follow the mode — a true/false question headed
      // "Classroom Sorting Detective" tells the child to do something else.
      headerTitle={
        mode === "dragmatch"
          ? "Classroom Sorting Detective"
          : mode === "multichoice"
            ? "Pick the Answer"
            : mode === "tapcount"
              ? "Tap to Count"
              : "Type the Answer"
      }
      /*
        The Count header — see `CountCanvas`. The question leads and does not
        change; the mode's own words are the fallback for a slide that was never
        given an instruction, and the running state is the chip beside it.
      */
      questionText={
        question.instruction?.trim() ||
        (mode === "dragmatch"
          ? "Sort each item into the bin it belongs in."
          : mode === "multichoice"
            ? "Pick the correct answer."
            : mode === "tapcount"
              ? "Tap each one to count it."
              : "Type the answer.")
      }
      readAloudText={getInstructionText()}
      /*
        The four moments, mapped the way Count maps them — read out, waited on,
        got wrong, got right. `errorFlash` is the wrong-answer signal this canvas
        already kept for its own shake, and the guide reads the same flag rather
        than a second copy of "was that wrong": one source, so the character and
        the board can never disagree about what just happened.

        `talking` is not passed on purpose: the layout owns the read-aloud button
        and knows when a sentence is actually running.
      */
      guideRole={errorFlash ? "oops" : guideSolved ? "celebrating" : "waiting"}
      {...guidePropsFor(question)}
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={guideSolved ? "emerald" : accent} isDark={isDark}>
            {guideSolved
              ? "All done"
              : mode === "dragmatch"
                ? `${Math.max(0, toSort)} to sort`
                : mode === "tapcount"
                  ? `${Math.max(0, localItems.length - tappedItemIds.length)} to tap`
                  : mode === "multichoice" ? "Multiple Choice" : "Type the Answer"}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={handleAutoArrange} title="Tidy the items and bins back to the default layout">
            <RotateCcw size={12} />
            Auto-arrange
          </Button>
        )
      }
      footerStatus={
        guideSolved
          ? feedbackMsg || "Nicely done!"
          : isPlayMode
            ? undefined
            : "Design Mode · Drag items and bins to place them"
      }
      footerSolved={guideSolved}
      designerHint="Switch to Design Mode to add elements, bins, and edit properties."
    >
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        /*
          Floor capped by the window's height, as on Count: a fixed pixel
          minimum on a wide, short screen pushes the stage past the bottom of a
          card that clips, and what gets clipped is the bins along its foot.
        */
        className="relative flex-1 min-h-[min(280px,38svh)] w-full flex my-1 z-10 touch-none select-none overscroll-none"
      >
      <CanvasBin
            surface={false}
        className={`w-full h-full ${errorFlash ? "ring-4 ring-rose-500/50" : ""}`}
        label={
          mode === "dragmatch" ? "Sort these" : mode === "tapcount" ? "Tap every one" : "How many?"
        }
        /* No tally in multiple-choice or type-the-answer: the count *is* the
           answer, and a bin that displays it hands the question away. */
        tally={
          !isPlayMode ? undefined
            : mode === "dragmatch" ? `${sortedCount} / ${localItems.filter(i => i.targetBin).length}`
              : mode === "tapcount" ? `${tappedItemIds.length} / ${localItems.length}`
                : undefined
        }
        accent={accent}
        isDark={isDark}
        complete={guideSolved}
      >
        <div ref={hostRef} className="absolute inset-0">
        {/* The scene the teacher picked — illustration, inside the bin's frame */}
        {bgStyle !== "clean" && (
          <div className={`absolute inset-0 rounded-2xl overflow-hidden pointer-events-none ${getBgClass()}`} />
        )}

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
            accent={accent}
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
              accent={accent}
              isDark={isDark}
              isDragged={isDragged}
              isTapped={isTapped}
              tapIndex={tapIndex}
              assetType={question.config.assetType || "emoji"}
              // Same switch and same default as Count's "Show card frame on
              // objects", so one setting means one thing across the product.
              hasFrame={question.config.showItemFrame ?? true}
              onPointerDown={(e) => handlePointerDownItem(e, item.id)}
              onRemove={() => handleRemoveItem(item.id)}
            />
          );
        })}

        {/* Authoring placeholder — design mode only. A child was being told to
            "switch to Design Mode" on any question authored without items. */}
        {localItems.length === 0 && !isPlayMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-100/5 border-2 border-dashed border-slate-300/30 rounded-xl m-4 pointer-events-none">
            <HelpCircle className="text-slate-400 mb-2 animate-bounce" size={24} />
            <h4 className="text-sm font-bold text-slate-400">Empty Flexible Canvas</h4>
            <p className="text-xs text-slate-400 max-w-[240px]">Switch to <strong>Design Mode</strong> to add some interactive emojis or targets!</p>
          </div>
        )}
        </div>
        </div>
      </CanvasBin>
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
