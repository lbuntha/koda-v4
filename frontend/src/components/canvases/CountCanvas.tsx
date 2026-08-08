/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Count — one board for the whole counting family.
 *
 * This is the engine. It owns everything that was copied into nine canvases:
 * measuring the stage, holding the objects, ranking them, dragging them,
 * tapping them, the keyboard path, badges, sounds, CPA, the ghost guide, the
 * answer panel, and re-layout on resize. What it does *not* own is what
 * counting physically is — that comes from a staging (`countStaging/`), and the
 * engine never branches on which one it has.
 *
 * The rule that keeps it honest: if a change needs an `if (staging.id === …)`
 * in this file, it belongs in the staging instead.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset, type AssetType } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, ArrowRightLeft, PartyPopper } from "lucide-react";
import { CanvasProps } from "./types";
import { Button } from "../ui";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import {
  CanvasChip,
  CanvasAccent,
  surfaceClass,
  accentChipClass,
  emptySlotClass
} from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { CanvasAnswerPanel, useCanvasAnswer } from "./CanvasAnswerPanel";
import { useCanvasAudience } from "./presentation";
import { objectStyle } from "./objectMotion";
import { contentZone, relativeRect, type Rect } from "./objectLayout";
import type { Point } from "./oneToOneLayout";
import { GhostGuideOverlay, useGhostGuide, useCPASwitcher } from "../../pedagogy";
import { allCounted, stagingFor, type CountItem, type ZoneId } from "./countStaging";

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

/** Travel, in px, that separates a tap from a drag. */
const DRAG_THRESHOLD = 4;

const itemId = (index: number) => `count-item-${index}`;

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

interface DragState {
  id: string;
  /** Pointer offset within the object, so it does not jump to the cursor. */
  offset: Point;
  origin: Point;
  moved: boolean;
}

export const CountCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid,
  isDark = false,
  onSuccess,
  onUpdateQuestionConfig
}) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;
  const config = question.config as Record<string, unknown>;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;
  const gridSize = question.config.layoutGridSize || 20;
  const staging = stagingFor(question.config.staging as string | undefined, question.technique);

  const stageRef = useRef<HTMLDivElement>(null);
  const zoneRefs = useRef<Record<ZoneId, HTMLDivElement | null>>({});

  const [items, setItems] = useState<CountItem[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  /** Live position of the object under the pointer, in stage pixels. */
  const [dragPos, setDragPos] = useState<Point | null>(null);
  const [activeZone, setActiveZone] = useState<ZoneId | null>(null);

  const { learnerMode } = useCanvasAudience();
  const { representation, setRepresentation } = useCPASwitcher(
    (question.config.defaultRepresentation as "concrete" | "pictorial" | "abstract") || "concrete"
  );

  useEffect(() => {
    if (question.config.defaultRepresentation) {
      setRepresentation(question.config.defaultRepresentation);
    }
  }, [question.config.defaultRepresentation, setRepresentation]);

  /**
   * `null` until the stage has actually been measured.
   *
   * Objects are positioned in stage pixels, so laying them out against a guessed
   * size and correcting later throws them into the wrong zone.
   */
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = dimensions?.width ?? 480;
  const stageHeight = dimensions?.height ?? 320;
  const stacked = stageWidth < 640;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Measure before paint so the first layout is the real one.
    const seed = stage.getBoundingClientRect();
    setDimensions({ width: seed.width || 480, height: seed.height || 320 });
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 480,
          height: entry.contentRect.height || 320
        });
      }
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const zoneSpecs = useMemo(() => staging.zones(config), [staging, config]);

  /** Measured content rects, kept in state so overlays can be drawn against them. */
  const [zoneRects, setZoneRects] = useState<Partial<Record<ZoneId, Rect>>>({});

  // Objects rebuild from scratch on a new question, never carrying progress over.
  useEffect(() => {
    setItems(
      Array.from({ length: count }, (_, index) => ({
        id: itemId(index),
        index,
        counted: false,
        order: null
      }))
    );
  }, [question.id, question.objectId, count]);

  const measureZones = React.useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const next: Partial<Record<ZoneId, Rect>> = {};
    for (const spec of zoneSpecs) {
      const el = zoneRefs.current[spec.id];
      if (el) next[spec.id] = relativeRect(el, stageRect);
    }
    setZoneRects(prev => {
      const unchanged = zoneSpecs.every(spec =>
        sameRect(prev[spec.id] ?? null, next[spec.id] ?? null)
      );
      return unchanged ? prev : next;
    });
  }, [zoneSpecs]);

  useEffect(() => {
    if (!dimensions) return;
    measureZones();
  }, [dimensions, measureZones, items.length]);

  /**
   * Size and resting positions for every object — the staging's whole positional
   * job, recomputed whenever the board or the stage changes.
   */
  const { size: itemSize, positions, sizes } = useMemo(
    () =>
      staging.layout({
        count,
        stage: { width: stageWidth, height: stageHeight },
        stacked,
        zones: zoneRects,
        items,
        config
      }),
    [staging, count, stageWidth, stageHeight, stacked, zoneRects, items, config]
  );

  const hasFrame = question.config.showItemFrame ?? true;
  /** An object's edge length depends on which zone it is in. */
  const sizeOf = (id: string) => sizes?.[id] ?? itemSize;

  const counted = items.filter(item => item.counted).length;
  const remaining = count - counted;
  const isComplete = (staging.isComplete ?? allCounted)(items, count);
  const answerPanelOpen = isPlayMode && requireAnswerInput && isComplete;

  const labelCtx = { count, counted, remaining, objectLabel: obj.label };

  const answer = useCanvasAnswer({
    expected: count,
    resetKey: `${question.id}:${count}`,
    wrongMessage: `Not quite! There are ${count} ${obj.label}${count === 1 ? "" : "s"}. Enter ${count}!`,
    onSuccess,
    open: answerPanelOpen
  });

  const solved = isComplete && (requireAnswerInput ? answer.solved : true);

  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solved,
    idleThresholdMs: 10000
  });

  /*
    With no answer to type, finishing the counting IS finishing the activity. When
    an answer is required the panel owns the hand-off.
  */
  const firedSuccess = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!isComplete) {
      firedSuccess.current = false;
      return;
    }
    if (requireAnswerInput || firedSuccess.current) return;
    firedSuccess.current = true;
    sounds.playSuccess();
    onSuccessRef.current?.();
  }, [isComplete, requireAnswerInput]);

  useEffect(() => {
    firedSuccess.current = false;
  }, [question.id, question.objectId, count]);

  /**
   * Re-rank the counted set 1..n and hand back a fresh board.
   *
   * The engine does this for every staging, on every change, because the
   * alternative — numbering an arrival `counted.length + 1` — assumes the orders
   * already there are contiguous. Pull the 2nd of three out and the next arrival
   * computes 3, colliding with the object already wearing 3.
   */
  const rerank = (next: CountItem[]): CountItem[] => {
    const ranked = new Map<string, number>();
    next
      .filter(item => item.counted)
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      .forEach((item, index) => ranked.set(item.id, index + 1));
    return next.map(item =>
      item.counted
        ? { ...item, order: ranked.get(item.id) ?? null }
        : item.order === null
          ? item
          : { ...item, order: null }
    );
  };

  /** Apply the staging's verdict for one object. Shared by drag, tap and keyboard. */
  const act = (id: string, zone: ZoneId | null, tapped: boolean, point: Point | null = null) => {
    if (!isPlayMode) return;
    reportActivity();
    setItems(prev => {
      const item = prev.find(candidate => candidate.id === id);
      if (!item) return prev;

      const verdict = staging.resolve({
        item,
        zone,
        point,
        tapped,
        items: prev,
        count,
        size: sizeOf(id),
        zones: zoneRects,
        stage: { width: stageWidth, height: stageHeight },
        config
      });
      if (!verdict) return prev;

      if (verdict.counted) {
        sounds.playTick(prev.filter(candidate => candidate.counted).length + 1);
      } else {
        sounds.playPop();
      }

      /*
        Where the staging owns the ordinal — Line Up, where the slot a child
        chose IS the number — take it and leave every other object alone.
        Otherwise a null order sorts this one to the end of the counted set and
        `rerank` assigns the real number, so 1..n stays contiguous.
      */
      const next = prev.map(candidate =>
        candidate.id === id
          ? {
              ...candidate,
              counted: verdict.counted,
              order: verdict.counted ? (verdict.at ?? null) : null
            }
          : candidate
      );
      return staging.ordersByPlacement ? next : rerank(next);
    });
  };

  /** Which declared zone contains this stage point. */
  const zoneAt = (point: Point): ZoneId | null => {
    for (const spec of zoneSpecs) {
      const rect = zoneRects[spec.id];
      if (!rect) continue;
      if (
        point.x >= rect.left &&
        point.x <= rect.left + rect.width &&
        point.y >= rect.top &&
        point.y <= rect.top + rect.height
      ) {
        return spec.id;
      }
    }
    return null;
  };

  const stagePoint = (e: React.PointerEvent): Point | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    reportActivity();
    const point = stagePoint(e);
    const home = positions[id];
    if (!point || !home) return;

    // No sound and no movement yet — this may still turn out to be a tap.
    setDrag({
      id,
      offset: { x: point.x - home.x, y: point.y - home.y },
      origin: { x: e.clientX, y: e.clientY },
      moved: false
    });
    setDragPos(home);
    stageRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const current = dragRef.current;
    if (!current || !stageRef.current) return;
    const point = stagePoint(e);
    if (!point) return;

    /*
      A tap is not a drag. Children tap objects constantly — to hear them, to
      point at them, to count them out loud — and until the pointer has actually
      travelled, the board must not move and nothing must make a sound.
    */
    if (!current.moved) {
      const travelled = Math.hypot(e.clientX - current.origin.x, e.clientY - current.origin.y);
      if (travelled <= DRAG_THRESHOLD) return;
      sounds.playPop();
      setDrag({ ...current, moved: true });
    }

    const size = sizeOf(current.id);
    const next = {
      x: Math.max(0, Math.min(stageWidth - size, point.x - current.offset.x)),
      y: Math.max(0, Math.min(stageHeight - size, point.y - current.offset.y))
    };
    setDragPos(next);
    if (isPlayMode) {
      setActiveZone(zoneAt({ x: next.x + size / 2, y: next.y + size / 2 }));
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (stageRef.current?.hasPointerCapture(e.pointerId)) {
      stageRef.current.releasePointerCapture(e.pointerId);
    }
    setDrag(null);
    setDragPos(null);
    setActiveZone(null);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const current = dragRef.current;
    if (!current) return;

    if (!current.moved) {
      // A press that never travelled is a tap.
      act(current.id, null, true);
    } else if (isPlayMode) {
      const centre = dragPos
        ? { x: dragPos.x + sizeOf(current.id) / 2, y: dragPos.y + sizeOf(current.id) / 2 }
        : null;
      act(current.id, centre ? zoneAt(centre) : null, false, centre);
    } else if (onUpdateQuestionConfig && dragPos) {
      // Design mode: persist where the teacher put it, snapped to the grid.
      const snap = (value: number) => (showGrid ? Math.round(value / gridSize) * gridSize : value);
      onUpdateQuestionConfig({
        customPositions: items.map(item =>
          item.id === current.id
            ? { id: item.id, x: snap(dragPos.x), y: snap(dragPos.y) }
            : { id: item.id, ...(positions[item.id] ?? { x: 0, y: 0 }) }
        ),
        layoutReference: { width: stageWidth, height: stageHeight }
      });
    }

    endDrag(e);
  };

  const reset = () => {
    answer.reset();
    setItems(prev => prev.map(item => ({ ...item, counted: false, order: null })));
  };

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";

  /* ── CPA ──────────────────────────────────────────────────────────────────
     Concrete → Pictorial → Abstract: the same object seen three ways as a class
     outgrows counting pictures. Matches Addition and Subtraction deliberately —
     a counter has to look like the same counter wherever a child meets it. */
  const isPictorial = representation === "pictorial";
  const isAbstract = representation === "abstract";
  const tenFrameFits = count <= 10;

  const TenFrame: React.FC<{ zone: Rect }> = ({ zone }) => {
    const cell = Math.min((zone.width - 16) / 5, (zone.height - 8) / 2, itemSize * 1.16);
    return (
      <div
        style={{
          position: "absolute",
          left: `${zone.left + (zone.width - cell * 5) / 2}px`,
          top: `${zone.top + (zone.height - cell * 2) / 2}px`,
          width: `${cell * 5}px`,
          height: `${cell * 2}px`,
          zIndex: 5
        }}
        className="grid grid-cols-5 grid-rows-2 gap-0.5 pointer-events-none"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`border-2 border-dashed rounded-lg ${emptySlotClass(isDark)}`} />
        ))}
      </div>
    );
  };

  const slotMarkers = useMemo(
    () =>
      staging.slots?.({
        count,
        stage: { width: stageWidth, height: stageHeight },
        stacked,
        zones: zoneRects,
        items,
        config,
        size: itemSize
      }) ?? [],
    [staging, count, stageWidth, stageHeight, stacked, zoneRects, items, config, itemSize]
  );

  const guidance = staging.guidance(labelCtx);

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      showGrid={showGrid}
      isDark={isDark}
      gridSize={gridSize}
      showRulers={question.config.showLayoutRulers ?? true}
      accent={accent}
      headerIcon={<ArrowRightLeft size={16} />}
      headerTitle="Count"
      headerSubtitle={
        isComplete && requireAnswerInput
          ? "Counting complete! Enter the total answer below."
          : `${counted} of ${count} counted`
      }
      readAloudText={guidance}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={solved ? "emerald" : accent} isDark={isDark}>
            {solved ? "All counted" : `${remaining} to count`}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset">
            <RotateCcw size={12} />
            Reset
          </Button>
        )
      }
      footerStatus={
        solved
          ? `All ${count} counted!`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag objects to set their starting positions"
      }
      footerSolved={solved}
    >
      <div
        ref={stageRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={endDrag}
        className={`relative flex-1 w-full flex items-stretch gap-3 sm:gap-4 my-2 min-h-[260px] sm:min-h-[300px] md:min-h-[340px] touch-none select-none overscroll-none ${
          staging.orientation === "column" ? "flex-col" : "flex-col sm:flex-row"
        }`}
      >
        {zoneSpecs.map(spec => (
          <CanvasBin
            key={spec.id}
            ref={el => {
              zoneRefs.current[spec.id] = el;
            }}
            label={learnerMode ? spec.learnerLabel : spec.label}
            tally={
              isPlayMode
                ? spec.role === "target"
                  ? `${counted} / ${count}`
                  : remaining
                : undefined
            }
            accent={accent}
            isDark={isDark}
            active={activeZone === spec.id}
            complete={spec.role === "target" ? isComplete : isPlayMode && remaining === 0}
            isEmpty={isPlayMode && (spec.role === "target" ? counted === 0 : remaining === 0)}
            emptyIcon={<PartyPopper size={22} />}
            // Suppressed where the answer panel docks, or the two stack up.
            emptyHint={
              isPlayMode && !(answerPanelOpen && spec.role === "home")
                ? spec.emptyHint?.(labelCtx)
                : undefined
            }
          >
            {spec.role === "target" && (
              <GhostGuideOverlay
                show={showGhostGuide && !solved}
                label={guidance}
                isDark={isDark}
                labelPlacement="top"
              />
            )}
            {isAbstract && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`px-4 py-2 rounded-2xl text-3xl font-black font-mono ${accentChipClass(accent, isDark)}`}
                >
                  {spec.role === "target" ? counted : remaining}
                </div>
              </div>
            )}
          </CanvasBin>
        ))}

        {/* With no bins to guide the child, the hint has to live on the stage. */}
        {zoneSpecs.length === 0 && (
          <GhostGuideOverlay
            show={showGhostGuide && !solved}
            label={guidance}
            isDark={isDark}
            labelPlacement="top"
          />
        )}

        {/*
          Staging artwork — a jar, a basket. Drawn inside the target zone and
          never itself a drop target; the zone is what a release is tested
          against, which is what keeps a basket from catching by magic radius.
        */}
        {staging.Decoration &&
          (() => {
            const target = zoneSpecs.find(spec => spec.role === "target");
            const rect = target ? zoneRects[target.id] : undefined;
            return rect ? <staging.Decoration zone={rect} config={config} isDark={isDark} /> : null;
          })()}

        {/* Dashed targets a child aims at — Line Up's numbered slots. */}
        {slotMarkers.map(marker => (
          <div
            key={`slot-${marker.index}`}
            style={{
              position: "absolute",
              left: `${marker.x}px`,
              top: `${marker.y}px`,
              width: `${itemSize}px`,
              height: `${itemSize}px`,
              zIndex: 4
            }}
            className={`rounded-2xl border-2 border-dashed flex items-center justify-center font-mono font-black pointer-events-none ${emptySlotClass(isDark)}`}
          >
            <span style={{ fontSize: `${Math.floor(itemSize * 0.3)}px` }} className="opacity-60">
              {marker.label}
            </span>
          </div>
        ))}

        {isPictorial &&
          tenFrameFits &&
          zoneSpecs.map(spec => {
            const rect = zoneRects[spec.id];
            return rect ? <TenFrame key={`frame-${spec.id}`} zone={contentZone(rect, itemSize)} /> : null;
          })}

        {items.map(item => {
          const home = positions[item.id];
          if (!home) return null;
          const dragging = drag?.id === item.id && drag.moved;
          const at = dragging && dragPos ? dragPos : home;
          const assetType = (question.config?.assetType || "emoji") as AssetType;
          const size = sizeOf(item.id);
          const assetSize = Math.floor(size * (hasFrame ? 0.7 : 0.92));
          const badgeSize = Math.floor(Math.max(18, Math.min(32, size * 0.3)));

          let className = `flex flex-col items-center justify-center select-none touch-none outline-none ${
            size > 88 ? "rounded-2xl" : "rounded-xl"
          } cursor-grab active:cursor-grabbing transition-[box-shadow,transform,border-color] focus-visible:ring-4 focus-visible:ring-indigo-400/40`;

          // A counter and a numeral are already round and carry their own fill;
          // putting them on a card as well reads as an object on a tile.
          if (hasFrame && representation === "concrete") {
            className += item.counted
              ? ` ${accentChipClass(accent, isDark)} border-2`
              : ` ${surfaceClass(isDark, "raised")} border-0`;
            if (dragging) className += " scale-110 drop-shadow-xl z-50";
          } else {
            className += item.counted
              ? " scale-105 drop-shadow-md"
              : " drop-shadow-sm hover:drop-shadow-md hover:scale-105";
            if (dragging) className += " scale-125 drop-shadow-2xl z-50";
          }

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={
                item.counted
                  ? `Counted ${obj.label}, number ${item.order} of ${count}.`
                  : `Uncounted ${obj.label} ${item.index + 1} of ${count}.` +
                    (isPlayMode ? " Press Enter to count it." : "")
              }
              onKeyDown={e => {
                if (e.key !== "Enter" && e.key !== " ") return;
                // Space scrolls the page otherwise, moving the board underneath.
                e.preventDefault();
                /*
                  The keyboard has no zones to aim at, so it means "the obvious
                  thing": send it to the target zone if there is one, else count
                  it where it lies.
                */
                const target = zoneSpecs.find(spec => spec.role === "target");
                act(item.id, item.counted ? null : (target?.id ?? null), !target);
              }}
              onPointerDown={e => handlePointerDown(e, item.id)}
              style={objectStyle({ x: at.x, y: at.y, size, dragging })}
              className={className}
            >
              {/* In abstract the object IS its number; a badge repeats it. */}
              {item.counted && item.order !== null && !isAbstract && (
                <div
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 font-bold font-mono flex items-center justify-center rounded-full z-10 animate-scale-in ${accentChipClass(accent, isDark)}`}
                  style={{
                    width: `${badgeSize}px`,
                    height: `${badgeSize}px`,
                    fontSize: `${Math.floor(badgeSize * 0.52)}px`
                  }}
                >
                  {item.order}
                </div>
              )}

              {representation === "concrete" ? (
                <CountingAsset type={assetType} emoji={obj.emoji} size={assetSize} />
              ) : isPictorial ? (
                <div
                  className={`w-full h-full rounded-full border-2 flex items-center justify-center ${accentChipClass(accent, isDark)}`}
                >
                  <div className="w-2/5 h-2/5 rounded-full bg-current opacity-30" />
                </div>
              ) : (
                <div
                  className={`w-full h-full rounded-full border-2 font-mono font-black flex items-center justify-center ${accentChipClass(accent, isDark)}`}
                  style={{ fontSize: `${Math.floor(size * 0.34)}px` }}
                >
                  {item.counted ? item.order : 1}
                </div>
              )}
            </div>
          );
        })}

        <CanvasAnswerPanel
          answer={answer}
          open={answerPanelOpen}
          isDark={isDark}
          /*
            Docked over the zone the objects left when there is one, so the
            evidence the child is being asked about stays visible; on an open
            stage there is nowhere to hide, so it takes the bottom.
          */
          dock={staging.movesOnCount ? "left" : "bottom"}
          prompt={`How many ${obj.label}${count === 1 ? "" : "s"} in total?`}
        />
      </div>
    </SharedCanvasLayout>
  );
};
