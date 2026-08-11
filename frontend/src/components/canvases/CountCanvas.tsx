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
import { findAsset } from "../../assets/assetCatalog";
import { CountingAsset, type AssetType } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, ArrowRightLeft, PartyPopper } from "lucide-react";
import { CanvasProps } from "./types";
import { Button } from "../ui";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { guidePropsFor } from "../../features/koda-mascot";
import {
  CanvasChip,
  CanvasAccent,
  surfaceClass,
  accentChipClass,
  emptySlotClass
} from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { CanvasAnswerPanel, useCanvasAnswer, type AnswerPanelDock } from "./CanvasAnswerPanel";
import { useCanvasAudience } from "./presentation";
import { objectStyle, REJECT_MS } from "./objectMotion";
import { contentZone, relativeRect, type Rect } from "./objectLayout";
import type { Point } from "./oneToOneLayout";
import { GhostGuideOverlay, useGhostGuide, useCPASwitcher } from "../../pedagogy";
import { allCounted, COUNTING_COPY, stagingFor, type CountItem, type ZoneId } from "./countStaging";

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
  /*
    What the objects on this board are *called*.

    `COUNT_OBJECTS` only knows the eleven built-in counting objects. A slide
    drawn with anything else — a Goods Sort sprite, a teacher's own SVG — has an
    `objectId` this list has never heard of, and the lookup used to fall through
    to `COUNT_OBJECTS[0]`. That is apple. So a board of bubble teas was labelled,
    tallied and *read aloud* as "Apple", because a missing name was replaced with
    a confident wrong one rather than with the artwork's own.

    The catalog knows every built-in asset's name, and a teacher's own artwork
    carries its label on the question. Neither needs the live asset library:
    reading it here would make the engine throw outside `SvgLibraryProvider`,
    and a canvas that cannot render standalone is a canvas no preview or test
    can mount. A genuinely unknown id falls back to a word true of anything
    countable, which is honest where "apple" was not.
  */
  const obj = useMemo(() => {
    const known = COUNT_OBJECTS.find(o => o.id === question.objectId);
    if (known) return known;
    const catalogued = findAsset(question.objectId);
    const label =
      catalogued?.label ?? (question.config.customSvgLabel as string | undefined) ?? "thing";
    return { ...COUNT_OBJECTS[0], id: question.objectId, label, emoji: catalogued?.emoji ?? "" };
  }, [question.objectId, question.config.customSvgLabel]);
  const config = question.config as Record<string, unknown>;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;
  const gridSize = question.config.layoutGridSize || 20;
  const staging = stagingFor(question.config.staging as string | undefined, question.technique);

  /*
    Usually the slide's `targetCount`, but a staging may derive it: Count On is
    authored as `baseCount` + `extraCount` and carries no target at all.
  */
  const count = staging.objectCount?.(config, question.targetCount) ?? question.targetCount;
  /** Objects that begin the board already counted — Count On's starting group. */
  const seeded = Math.min(count, Math.max(0, staging.seedCounted?.(config, count) ?? 0));

  const stageRef = useRef<HTMLDivElement>(null);
  const zoneRefs = useRef<Record<ZoneId, HTMLDivElement | null>>({});

  const [items, setItems] = useState<CountItem[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  /** Live position of the object under the pointer, in stage pixels. */
  const [dragPos, setDragPos] = useState<Point | null>(null);
  const [activeZone, setActiveZone] = useState<ZoneId | null>(null);
  /**
   * The object that was just refused, and the one that just landed.
   *
   * Both are transient feedback rather than board state, so they live here and
   * clear themselves — an object is not "rejected", it was rejected a moment ago.
   */
  const [rejectedId, setRejectedId] = useState<string | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);
  const feedbackTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /** A pending class change must not fire into an unmounted board. */
  useEffect(() => () => feedbackTimers.current.forEach(clearTimeout), []);

  /*
    Set now, clear when the animation is over.

    Deliberately synchronous. Deferring a frame would let the class come off and
    go back on so a repeat could restart the animation — but a second refusal
    inside 250ms lands while the first shake is still playing, so there is
    nothing to restart, and the deferral only made the feedback unobservable to
    anything that looks straight after the gesture.
  */
  const flash = (set: (id: string | null) => void, id: string, ms: number) => {
    set(id);
    feedbackTimers.current.push(setTimeout(() => set(null), ms));
  };

  /** Whoever asked the OS for less motion gets travel without overshoot. */
  const reducedMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

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

  /**
   * How much of the stage the answer panel is standing on.
   *
   * The panel floats over the board, so without this the objects the child is
   * being asked to total up sit underneath it — and with the number pad open by
   * default the panel is most of a short stage. Reserving the space as *padding*
   * rather than by shrinking the numbers we hand the staging means the bins
   * themselves give the room back: they are flex children, so they shrink, the
   * ResizeObserver re-measures, and every staging re-lays-out against real
   * rects. No staging has to know the panel exists.
   */
  const [panelHeight, setPanelHeight] = useState(0);

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

  /*
    Objects rebuild from scratch on a new question, never carrying progress over.
    The first `seeded` of them start counted and already numbered — the group
    Count On begins with, which the child counts on from rather than recounts.
  */
  useEffect(() => {
    setItems(
      Array.from({ length: count }, (_, index) => ({
        id: itemId(index),
        index,
        counted: index < seeded,
        order: index < seeded ? index + 1 : null
      }))
    );
  }, [question.id, question.objectId, count, seeded]);

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
  const { size: itemSize, positions: arranged, sizes } = useMemo(
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

  /**
   * A teacher's own placement, over the staging's arrangement.
   *
   * Design mode has always *written* `customPositions` — see the pointer-up
   * handler below — and since the nine-into-one merge nothing read them back, so
   * an authored layout was saved and silently discarded on the next open. The
   * staging is not the place to fix that: every staging would need the same
   * dozen lines, and a teacher moving an object is a fact about the slide rather
   * than about what counting physically is.
   *
   * `layoutReference` is the stage the coordinates were authored against, so
   * they scale rather than sit wherever they landed on someone else's monitor.
   * A stacked stage in play mode ignores them outright: a layout composed across
   * a wide board does not fold onto a phone, and the staging's own arrangement
   * is the better answer there than a squashed copy of the teacher's.
   */
  const positions = useMemo(() => {
    const authored = (config.customPositions as { id: string; x: number; y: number }[]) || [];
    if (!authored.length || (stacked && isPlayMode)) return arranged;

    const reference = config.layoutReference as { width: number; height: number } | undefined;
    const scaleX = reference?.width ? stageWidth / reference.width : 1;
    const scaleY = reference?.height ? stageHeight / reference.height : 1;
    const clamp = (value: number, limit: number) =>
      Math.round(Math.max(0, Math.min(limit - itemSize, value)));

    const next = { ...arranged };
    for (const saved of authored) {
      // Only for objects still on this board — a count that shrank leaves strays.
      if (!(saved.id in next)) continue;
      next[saved.id] = {
        x: clamp(saved.x * scaleX, stageWidth),
        y: clamp(saved.y * scaleY, stageHeight)
      };
    }
    return next;
  }, [arranged, config, stacked, isPlayMode, stageWidth, stageHeight, itemSize]);

  const hasFrame = question.config.showItemFrame ?? true;
  /** An object's edge length depends on which zone it is in. */
  const sizeOf = (id: string) => sizes?.[id] ?? itemSize;

  const counted = items.filter(item => item.counted).length;
  /*
    How many acts finish this, which is only the same as the object count while
    the activity counts the whole board. Count Back has eight objects and three
    crossings, and everything a child is told about progress is measured against
    the second number.
  */
  const goal = staging.goal?.(config, count) ?? count;
  const remaining = Math.max(0, goal - counted);
  const isComplete = (staging.isComplete ?? allCounted)(items, goal);
  const answerPanelOpen = isPlayMode && requireAnswerInput && isComplete;

  /*
    Docked over the zone the objects left when there is one, so the evidence the
    child is being asked about stays visible; on an open stage there is nowhere
    to hide, so it takes the bottom.
  */
  const dock: AnswerPanelDock = staging.movesOnCount ? "left" : "bottom";

  /**
   * Which edge of the stage has to give room back, and how much.
   *
   * A `left` dock only sits *beside* the board once the zones are side by side;
   * stacked, `DOCK_CLASS` puts it along the top instead — same 640px breakpoint
   * as `stacked`, so the two never disagree. Capped at 60% so a very short stage
   * keeps a board to look at rather than collapsing to nothing.
   */
  const reserve = answerPanelOpen ? Math.min(panelHeight + 8, stageHeight * 0.6) : 0;
  const stagePadding =
    dock === "left"
      ? stacked
        ? { paddingTop: reserve }
        : undefined
      : { paddingBottom: reserve };

  const labelCtx = { count, counted, remaining, objectLabel: obj.label, config };

  /*
    What the answer panel checks. Usually the object count — but Count Back asks
    for what is *left*, which is the one number never marked on the board.
  */
  const expected = staging.expectedAnswer?.(config, count) ?? count;

  /**
   * The staging's own words, over counting's.
   *
   * Spread rather than replaced, so a staging overrides only the lines that
   * would otherwise say something untrue about it and inherits the rest.
   */
  const copy = { ...COUNTING_COPY, ...staging.copy };
  const copyCtx = { ...labelCtx, goal, done: counted, expected };

  /*
    An act that takes an object *out* of the count strikes it through instead of
    badging it — a crossed-out object is not the seventh of anything.
  */
  const struck = staging.countedAppearance === "struck";
  /** What a counted object's badge reads — the ordinal, unless the staging says otherwise. */
  const badgeText = (order: number) => staging.badgeFor?.(order, config) ?? String(order);
  /*
    Ordinal activities name the object to act on next, and the engine rings it.
    Counting back is "the last one first, then the one before it"; a board that
    just refuses the wrong tap teaches nothing, and one that accepts any tap
    teaches the opposite of the skill.
  */
  const nextId = isPlayMode && !isComplete ? staging.emphasise?.(items, count, goal) ?? null : null;

  const answer = useCanvasAnswer({
    expected,
    resetKey: `${question.id}:${count}:${goal}`,
    wrongMessage: copy.wrong(copyCtx),
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
        stacked,
        config
      });
      /*
        A refusal is information. Line Up's taken slot, Count On's out-of-turn
        place and Count Back's wrong object all used to send the object home on
        exactly the curve an accepted one used, so "no" and "yes" were the same
        movement and only the missing badge said otherwise.

        A plain `null` is not that: it is "nothing happened", which is what a tap
        on an already-counted object is, and shaking at a child for it would be
        telling them off for checking their own work.
      */
      if (verdict === "refused") {
        flash(setRejectedId, id, REJECT_MS);
        sounds.playFailure();
        return prev;
      }
      if (!verdict) return prev;

      if (verdict.counted) {
        flash(setLandedId, id, 340);
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
      if (spec.role === "readout") continue;
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

  /*
    Back to the board's starting state, which is not always an empty one: Count
    On's seeded group is where the question begins, so resetting past it would
    hand the child a different question from the one they were asked.
  */
  const reset = () => {
    answer.reset();
    setItems(prev =>
      prev.map(item => ({
        ...item,
        counted: item.index < seeded,
        order: item.index < seeded ? item.index + 1 : null
      }))
    );
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
      showGrid={showGrid}
      isDark={isDark}
      gridSize={gridSize}
      showRulers={question.config.showLayoutRulers ?? true}
      accent={accent}
      headerIcon={<ArrowRightLeft size={16} />}
      headerTitle="Count"
      /*
        The question is the heading, and the running count is not.

        This canvas used to put `copy.status` — "4 of 13 counted" — on the
        prominent line, and in learner mode that line *replaces* the activity
        name, so a child arrived at a board whose largest words were a tally of
        work they had not done yet. What they were being asked sat in the fading
        grey hint at the bottom. The two have swapped: the instruction leads, and
        the tally is the chip it always should have been.

        `playHint` goes with it. It carried the same sentence, so leaving it on
        would print the question twice — once at 28px and once in 11px grey.
      */
      questionText={
        isComplete && requireAnswerInput
          ? "Counting complete! Enter the total answer below."
          : // A slide authored without an instruction still has to say something,
            // and the staging's own guidance is the sentence it would have said.
            question.instruction?.trim() || guidance
      }
      /*
        Which of Koda's four actors the board is asking for.

        The layout takes over with the talking actor whenever its own read-aloud
        button is running, so this is the moment *between* sentences: wincing at
        an answer that was just rejected, celebrating a finished board, waiting
        while a child works. Wrong beats solved because the two are never true
        at once, and reading them in the other order would let a stale error
        outlive the correct answer that cleared it.
      */
      guideRole={answer.status === "error" ? "oops" : solved ? "celebrating" : "waiting"}
      /*
        Who plays it: the per-moment cast the author set in the Studio, the
        component asking, and any slide-wide actor from before casting was
        per-moment. One call rather than three reads, so this canvas cannot
        drift from what `ActorCastField` writes — see `casting.ts`.
      */
      {...guidePropsFor(question)}
      readAloudText={guidance}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={solved ? "emerald" : accent} isDark={isDark}>
            {solved ? copy.finished(copyCtx) : copy.todo(copyCtx)}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset">
            <RotateCcw size={12} />
            Reset
          </Button>
        )
      }
      /*
        The running tally, which the footer is the right place for: it changes on
        every drop, and `AutoHint` shows a changed line for a few seconds and
        then gets out of the way. It used to carry the instruction instead —
        now that the instruction is the heading, this is free for the thing that
        genuinely updates.
      */
      footerStatus={
        solved
          ? copy.statusFinished(copyCtx)
          : isPlayMode
            ? copy.status(copyCtx)
            : "Design Mode · Drag objects to set their starting positions"
      }
      footerSolved={solved}
    >
      <div
        ref={stageRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={endDrag}
        /*
          Padding, not margin: absolutely-positioned objects and `relativeRect`
          both originate at this element's padding box, so they shift together
          and no coordinate has to be corrected anywhere else.
        */
        style={stagePadding}
        className={`relative flex-1 w-full flex items-stretch gap-3 sm:gap-4 my-2 min-h-[260px] sm:min-h-[300px] md:min-h-[340px] touch-none select-none overscroll-none transition-[padding] duration-300 ${
          staging.orientation === "column" ? "flex-col" : "flex-col sm:flex-row"
        }`}
      >
        {zoneSpecs.map(spec => {
          /*
            A readout is a band that reports the activity back — Count Back's
            countdown. It holds no objects, so the counts that describe a bin's
            stock would be nonsense on it, and it must never be a drop target.
          */
          const readout = spec.role === "readout";
          return (
          <CanvasBin
            key={spec.id}
            ref={el => {
              zoneRefs.current[spec.id] = el;
            }}
            label={learnerMode ? spec.learnerLabel : spec.label}
            tally={
              isPlayMode && !readout
                ? spec.role === "target"
                  ? `${counted} / ${goal}`
                  : remaining
                : undefined
            }
            accent={accent}
            isDark={isDark}
            style={spec.flex ? { flex: spec.flex } : undefined}
            className={readout ? "pointer-events-none" : undefined}
            active={!readout && activeZone === spec.id}
            complete={readout ? isComplete : spec.role === "target" ? isComplete : isPlayMode && remaining === 0}
            isEmpty={!readout && isPlayMode && (spec.role === "target" ? counted === 0 : remaining === 0)}
            emptyIcon={<PartyPopper size={22} />}
            // Suppressed where the answer panel docks, or the two stack up.
            emptyHint={
              isPlayMode && !readout && !(answerPanelOpen && spec.role === "home")
                ? spec.emptyHint?.(labelCtx)
                : undefined
            }
          >
            {spec.Content && (
              <spec.Content
                items={items}
                count={count}
                goal={goal}
                done={counted}
                config={config}
                isDark={isDark}
              />
            )}
            {spec.role === "target" && (
              <GhostGuideOverlay
                show={showGhostGuide && !solved}
                label={guidance}
                isDark={isDark}
                labelPlacement="top"
              />
            )}
            {isAbstract && !readout && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`px-4 py-2 rounded-2xl text-3xl font-black font-mono ${accentChipClass(accent, isDark)}`}
                >
                  {spec.role === "target" ? counted : remaining}
                </div>
              </div>
            )}
          </CanvasBin>
          );
        })}

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
            return rect ? (
              <staging.Decoration
                zone={rect}
                config={config}
                isDark={isDark}
                count={count}
                size={itemSize}
                stacked={stacked}
              />
            ) : null;
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
            /* The next place is solid and accented; the rest stay dashed and quiet. */
            className={`rounded-2xl border-2 flex items-center justify-center font-mono font-black pointer-events-none transition-colors ${
              marker.next
                ? `${accentChipClass(accent, isDark)} border-solid animate-pulse motion-reduce:animate-none`
                : `border-dashed ${emptySlotClass(isDark)}`
            }`}
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
              ? struck
                ? ` ${surfaceClass(isDark, "raised")} border-0`
                : ` ${accentChipClass(accent, isDark)} border-2`
              : ` ${surfaceClass(isDark, "raised")} border-0`;
            if (dragging) className += " scale-110 drop-shadow-xl z-50";
          } else {
            className += item.counted
              ? struck
                ? ""
                : " scale-105 drop-shadow-md"
              : " drop-shadow-sm hover:drop-shadow-md hover:scale-105";
            if (dragging) className += " scale-125 drop-shadow-2xl z-50";
          }
          /*
            Landing and refusal both animate `transform`, which is why position
            lives on `translate` — see `objectMotion.ts`. They can play over a
            drag's scale without either one cancelling the other.
          */
          if (item.id === landedId) className += " animate-drop-pop";
          if (item.id === rejectedId) className += " animate-shake";

          // The next one to act on, for an ordinal staging.
          if (item.id === nextId) {
            className += ` ring-4 ring-offset-2 animate-pulse motion-reduce:animate-none ${
              isDark ? "ring-white/40 ring-offset-transparent" : "ring-slate-900/25 ring-offset-transparent"
            }`;
          }

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={
                item.counted
                  ? copy.actedLabel(copyCtx, item.order)
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
              style={objectStyle({ x: at.x, y: at.y, size, dragging, reducedMotion })}
              className={className}
            >
              {/*
                Struck through rather than numbered — see `countedAppearance`.
                Drawn over the object so it reads as "this one is gone", which a
                dimmed object alone does not say clearly enough to a child.
              */}
              {item.counted && struck && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                >
                  <div
                    className={`w-[86%] rotate-[-20deg] rounded-full ${isDark ? "bg-rose-300" : "bg-rose-500"}`}
                    style={{ height: `${Math.max(3, Math.round(size * 0.07))}px` }}
                  />
                </div>
              )}

              {/* In abstract the object IS its number; a badge repeats it. */}
              {item.counted && !struck && item.order !== null && !isAbstract && (
                <div
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 font-bold font-mono flex items-center justify-center rounded-full z-10 animate-scale-in ${accentChipClass(accent, isDark)}`}
                  style={{
                    width: `${badgeSize}px`,
                    height: `${badgeSize}px`,
                    fontSize: `${Math.floor(badgeSize * 0.52)}px`
                  }}
                >
                  {badgeText(item.order)}
                </div>
              )}

              {/*
                The dimming belongs to the *artwork*, not the object.

                It was on the object's own box, so the strike-through — the thing
                that says this one is gone — was drawn at 40% along with the
                thing it was crossing out, and the clearest signal on the board
                was the faintest mark on it.
              */}
              <div
                className={`w-full h-full flex items-center justify-center transition-opacity duration-300 ${
                  struck && item.counted ? "opacity-40" : ""
                }`}
              >
              {representation === "concrete" ? (
                staging.ItemArt ? (
                  <staging.ItemArt
                    item={item}
                    size={size}
                    Art={({ size: artSize }) => (
                      <CountingAsset type={assetType} emoji={obj.emoji} size={artSize} />
                    )}
                    config={config}
                    isDark={isDark}
                  />
                ) : (
                  <CountingAsset type={assetType} emoji={obj.emoji} size={assetSize} />
                )
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
                  {item.counted && item.order !== null ? badgeText(item.order) : 1}
                </div>
              )}
              </div>
            </div>
          );
        })}

        <CanvasAnswerPanel
          answer={answer}
          open={answerPanelOpen}
          isDark={isDark}
          dock={dock}
          onHeightChange={setPanelHeight}
          prompt={copy.prompt(copyCtx)}
        />
      </div>
    </SharedCanvasLayout>
  );
};
