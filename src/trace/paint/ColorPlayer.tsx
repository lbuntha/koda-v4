/**
 * The colouring player — a child colours one picture's line art, step by step.
 *
 * Each step names some areas and a crayon. The slate blinks the part still to
 * colour; when a step is filled the child is told so and pointed at the next
 * step (the next unfinished one in the author's order), which they can take or
 * ignore. Nothing blocks: "I'm done" scores the painting whenever the child
 * says so, and the next picture is always one tap away.
 *
 * Paint lives on the same grid the areas do (see areas.ts), so what is shown,
 * checked and scored are the same cells.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Brush, Check, Download, Eraser, Images, Lightbulb, Maximize2, MoreHorizontal, PaintBucket, Palette, RotateCcw, ShieldCheck, Star, Undo2, Volume2 } from "lucide-react";
import { useT } from "../../lib/i18n";
import { UIButton, UIModal, UIProgressBar } from "../../components/ui";
import { ScoringAPI } from "../../lib/scoring";
import { say, stop as stopVoice } from "../../library/voice";
import { isVoiceEnabled, playSound } from "../../utils/audio";
import type { AgeRange } from "../../lib/ages";
import { strokePolyline } from "../geometry/bezier";
import type { PaintStep, Point, TraceItem } from "../geometry/types";
import { isDone } from "../home";
import type { TracePlace } from "../player/TracePlayer";
import { TraceProgress } from "../progress/store";
import { stepXp } from "../progress/reward";
import type { PaintScore } from "./areas";
import { fillLeftovers } from "./leftovers";
import { CELL, COVER, GRID, LINE, NEARLY, SPECK, areaAt, isComplete, maySayDone, seamSources, blankPaint, brush, labelAreas, scorePainting, stepAreas, stepState } from "./areas";
import { Gallery, sharePicture } from "./gallery";
import { PALETTE, colourName, crayonHex, crayonIndex, customColours, hexOfIndex, rgb } from "./palette";

interface Props {
  item: TraceItem;
  onExit(): void;
  onAwardXp?(xp: number): void;
  /** Studio test: save nothing. */
  sandbox?: boolean;
  source?: { collectionId: string; rev: number };
  place?: TracePlace;
  xpPerStep?: number | null;
  onGoHome?(): void;
  ages?: AgeRange | null;
}

const SIZES = { s: 16, m: 32, l: 56 } as const;
/** How far (cells) a line cell can show paint from beside it: the thickest lines, merged. Bounds a stroke's redraw. */
const SEAM_MARGIN = 40;
/** How far a child can zoom into the picture. */
const MAX_ZOOM = 5;
type Size = keyof typeof SIZES;
/** How long a flash stays: praise briefly, advice long enough to read. */
const FLASH_MS = { correct: 1800, hint: 4000, nudge: 4000 } as const;
const INK = "#1f2544";

type Message = { tone: "correct" | "hint" | "nudge"; title: string; text?: string; action?: { label: string; run(): void }; /** Stays this long (ms) instead of its tone's usual time. */ hold?: number };

export function ColorPlayer({ item, onExit, onAwardXp, sandbox = false, source, place, xpPerStep, onGoHome }: Props) {
  const { t } = useT();
  useSyncExternalStore(TraceProgress.subscribe, TraceProgress.version);
  const areas = useMemo(() => labelAreas(item), [item]);
  // Slivers no step owns join the step beside them, so a finished picture has no white bits.
  const steps = useMemo(() => fillLeftovers(areas, item.paint?.steps ?? []).steps, [areas, item.paint]);
  const sources = useMemo(() => seamSources(areas), [areas]);
  const stepSets = useMemo(() => steps.map((s) => stepAreas(areas, s)), [areas, steps]);
  const need = COVER[item.sensitivity] ?? COVER.balanced;

  const paintRef = useRef<Uint8Array>(blankPaint());
  const historyRef = useRef<Uint8Array[]>([]);
  const [ver, setVer] = useState(0);
  const [cur, setCur] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [crayon, setCrayon] = useState(() => steps[0]?.color ?? PALETTE[0].id);
  /** The author can take Fill away, so every part is painted with the brush. */
  const fillAllowed = item.paint?.allowFill !== false;
  // A phone starts on Fill: tapping a part is how a small screen is best coloured; the brush is one tap away.
  const [tool, setTool] = useState<"brush" | "fill" | "eraser">(() => (fillAllowed && isPhone() ? "fill" : "brush"));
  const [size, setSize] = useState<Size>("m");
  const [inside, setInside] = useState(true);
  /** My own colours: the child picks the colours; any colour completes a step and none is "wrong". */
  const [own, setOwn] = useState(false);
  const ownRef = useRef(own);
  ownRef.current = own;
  const [message, setMessage] = useState<Message | null>(null);
  const [result, setResult] = useState<(PaintScore & { xp: number }) | null>(null);
  /** The finished painting was kept in My pictures (null: not yet, or not kept — a Studio test). */
  const [kept, setKept] = useState<boolean | null>(null);
  /** More, on a phone or tablet: size, Start over, the switches, every step. */
  const [sheet, setSheet] = useState(false);
  /** The phone's crayon row: the chosen crayon slides into view when it changes (a step's colour, say). */
  const crayonRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = crayonRowRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-crayon="${CSS.escape(crayon)}"]`);
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    const left = chip.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollTo({ left: left - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: "smooth" });
  }, [crayon]);
  const keptRef = useRef<Blob | null>(null);

  const step: PaintStep | undefined = steps[cur];
  /** The step Koda suggests: the first unfinished one after this, else the first unfinished at all. */
  const recommend = useCallback(
    (from: number, finished: Set<number>) => {
      for (let k = 1; k <= steps.length; k++) {
        const j = (from + k) % steps.length;
        if (!finished.has(j)) return j;
      }
      return -1;
    },
    [steps.length],
  );
  const instruction = (s: PaintStep | undefined) => (s ? s.instruction?.trim() || t("paint.colourThis", { color: colourName(t, s.color) }) : "");
  /** The crayon box: every crayon, then the author's own colours for this picture. */
  const box = useMemo(() => [...PALETTE.map((c) => ({ id: c.id, hex: c.hex, label: t(`paint.color.${c.id}`) })), ...customColours(steps).map((hex, k) => ({ id: hex, hex, label: t("paint.customN", { n: k + 1 }) }))], [steps, t]);

  const goTo = (j: number) => {
    if (j < 0 || j >= steps.length) return;
    setCur(j);
    if (!ownRef.current) setCrayon(steps[j].color);
    // Keep the child's tool (Fill stays Fill); only the eraser gives way, since a new step means colour.
    setTool((tl) => (tl === "eraser" ? "brush" : tl));
    setMessage(null);
  };

  /* ------------------------------------------------------------ canvas */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * What the drawing loop needs between renders. `dirty` redraws every cell
   * (a step changed, an undo); `rect` only the cells a brush stroke touched —
   * a million cells a frame would stutter on a phone, a brush's square does not.
   */
  const live = useRef<{ cur: number; done: Set<number>; inside: boolean; own: boolean; finished: boolean; dirty: boolean; rect: { x0: number; y0: number; x1: number; y1: number } | null }>({ cur, done, inside, own: false, finished: false, dirty: true, rect: null });
  live.current.cur = cur;
  live.current.done = done;
  live.current.inside = inside;
  live.current.own = own;
  live.current.finished = Boolean(result);
  useEffect(() => {
    live.current.dirty = true;
  }, [ver, cur, done, result, own]);

  const lineArt = useMemo(() => {
    const path = new Path2D();
    const dots: { x: number; y: number; r: number }[] = [];
    for (const s of item.strokes) {
      if (s.shape === "dot" || s.nodes.length === 1) {
        if (s.nodes[0]) dots.push({ x: s.nodes[0].x, y: s.nodes[0].y, r: (s.radius ?? 20) + LINE / 2 });
        continue;
      }
      const pts = strokePolyline(s);
      pts.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
      if (s.closed) path.closePath();
    }
    return { path, dots };
  }, [item.strokes]);

  // A picture's line art, drawn over the paint like the strokes.
  const linesRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const src = item.paint?.picture?.lines;
    linesRef.current = null;
    if (!src) return;
    const img = new Image();
    img.onload = () => (linesRef.current = img);
    img.src = src;
  }, [item.paint?.picture?.lines]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const paintLayer = document.createElement("canvas");
    paintLayer.width = paintLayer.height = GRID;
    const hintLayer = document.createElement("canvas");
    hintLayer.width = hintLayer.height = GRID;
    const pctx = paintLayer.getContext("2d")!;
    const hctx = hintLayer.getContext("2d")!;
    const paintImg = pctx.createImageData(GRID, GRID);
    const hintImg = hctx.createImageData(GRID, GRID);
    // Grid numbers → colours, custom ones included (crayonIndex numbers them as they are first seen).
    steps.forEach((s) => crayonIndex(s.color));
    const colors = Array.from({ length: 256 }, (_, i) => (i ? rgb(hexOfIndex(i)) : ([255, 255, 255] as [number, number, number])));

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.height = Math.round(canvas.clientWidth * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const rebuild = (rect: { x0: number; y0: number; x1: number; y1: number } | null) => {
      const paint = paintRef.current;
      const { cur: c, done: d, finished } = live.current;
      const want = steps[c] ? crayonIndex(steps[c].color) : 0;
      const target = !finished && steps[c] && !d.has(c) ? stepSets[c] : null;
      const [hr, hg, hb] = steps[c] ? rgb(crayonHex(steps[c].color)) : [0, 0, 0];
      const x0 = rect ? Math.max(0, rect.x0) : 0;
      const y0 = rect ? Math.max(0, rect.y0) : 0;
      const x1 = rect ? Math.min(GRID - 1, rect.x1) : GRID - 1;
      const y1 = rect ? Math.min(GRID - 1, rect.y1) : GRID - 1;
      for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * GRID + x;
        const o = i * 4;
        let v = paint[i];
        // A line cell (or speck) shows its own side's paint: no white seam inside, no colour outside the border.
        if (!v && sources[i] !== i && sources[i] >= 0) v = paint[sources[i]];
        if (v) {
          const [r, g, b] = colors[v];
          paintImg.data[o] = r;
          paintImg.data[o + 1] = g;
          paintImg.data[o + 2] = b;
          paintImg.data[o + 3] = 255;
        } else paintImg.data[o + 3] = 0;
        const blink = target && (live.current.own ? !v : v !== want) && target.has(areas.labels[i]);
        hintImg.data[o] = hr;
        hintImg.data[o + 1] = hg;
        hintImg.data[o + 2] = hb;
        hintImg.data[o + 3] = blink ? 255 : 0;
      }
      pctx.putImageData(paintImg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
      hctx.putImageData(hintImg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    };

    let frame = 0;
    const loop = (now: number) => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (live.current.dirty) {
          rebuild(null);
          live.current.dirty = false;
          live.current.rect = null;
        } else if (live.current.rect) {
          rebuild(live.current.rect);
          live.current.rect = null;
        }
        // Units → pixels, through the zoom: everything below is drawn on the 1000-unit picture.
        const v = viewRef.current;
        const k = (canvas.width / 1000) * v.z;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(k, 0, 0, k, -v.x * k, -v.y * k);
        ctx.imageSmoothingEnabled = true;
        if (!live.current.finished) {
          ctx.globalAlpha = 0.14 + 0.16 * ((Math.sin(now / 320) + 1) / 2);
          ctx.drawImage(hintLayer, 0, 0, 1000, 1000);
          ctx.globalAlpha = 1;
        }
        ctx.drawImage(paintLayer, 0, 0, 1000, 1000);
        if (linesRef.current && !item.paint?.picture?.smooth) ctx.drawImage(linesRef.current, 0, 0, 1000, 1000);
        ctx.strokeStyle = INK;
        ctx.fillStyle = INK;
        ctx.lineWidth = LINE;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke(lineArt.path);
        for (const d of lineArt.dots) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [areas, lineArt, stepSets, steps, sources]);

  /* ------------------------------------------------------------ painting
   *
   * One finger (or a mouse, or a stylus) paints. Two fingers zoom and move the
   * picture and never paint: a stroke the first finger had begun is taken back
   * when the second lands. Zoomed in, the brush keeps its size on the screen, so
   * it paints finer. A stylus paints thicker as it presses harder, and once one
   * has been used, fingers and a resting palm only zoom — they never paint.
   */
  /** The stroke in progress, and the part it started in: with the helper on, it stays in that part. */
  const penRef = useRef<{ id: number; last: Point; before: Uint8Array; part: number; pressure: number } | null>(null);
  /** The part the last stroke started in, for the advice after it. */
  const lastPartRef = useRef(-1);
  /** What part of the picture is on screen: zoom ×1–×MAX_ZOOM, and the unit at the top-left corner. */
  const viewRef = useRef({ z: 1, x: 0, y: 0 });
  const [zoomed, setZoomed] = useState(false);
  /** Fingers on the picture now, by pointer id, in screen pixels. */
  const touchesRef = useRef(new Map<number, { x: number; y: number }>());
  /** A two-finger gesture under way: where it started, and the view then. */
  const pinchRef = useRef<{ dist: number; mid: { x: number; y: number }; view: { z: number; x: number; y: number } } | null>(null);
  /** A Fill tap waits for the finger to lift: if it becomes a pinch, nothing is filled. */
  const tapRef = useRef<{ id: number; at: { x: number; y: number }; p: Point } | null>(null);
  /** A stylus has been used: from then on, fingers only zoom (a palm on the screen paints nothing). */
  const stylusRef = useRef(false);

  const setView = (z: number, x: number, y: number) => {
    const zz = Math.min(MAX_ZOOM, Math.max(1, z));
    const span = 1000 / zz;
    viewRef.current = { z: zz, x: Math.min(1000 - span, Math.max(0, x)), y: Math.min(1000 - span, Math.max(0, y)) };
    setZoomed(zz > 1.01);
  };
  const fitView = () => setView(1, 0, 0);
  /** Screen pixels (relative to the picture) → units on the picture, through the zoom. */
  const unitsAt = (sx: number, sy: number): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: v.x + ((sx - r.left) / r.width) * (1000 / v.z), y: v.y + ((sy - r.top) / r.height) * (1000 / v.z) };
  };
  const toUnits = (e: { clientX: number; clientY: number }): Point => unitsAt(e.clientX, e.clientY);
  /**
   * Stay inside the lines keeps a stroke in the part it started in — any part,
   * not only the step's: every part of the picture can be coloured, and a
   * stroke never runs over a line into the next one. The eraser too.
   */
  const dab = (a: Point, b: Point) => {
    const pen = penRef.current;
    const part = pen?.part ?? -1;
    const allowed = inside && part >= 0 ? new Set([part]) : undefined;
    // The same size on screen at any zoom; a stylus's pressure makes it thinner or thicker.
    const r = (SIZES[size] / viewRef.current.z) * (pen?.pressure ?? 1);
    brush(paintRef.current, areas, a, b, r, tool === "eraser" ? 0 : crayonIndex(crayon), allowed);
    // Redraw only around the dab — wide enough for line cells, which show the paint beside them.
    const m = r / CELL + SEAM_MARGIN;
    const box = { x0: Math.floor(Math.min(a.x, b.x) / CELL - m), y0: Math.floor(Math.min(a.y, b.y) / CELL - m), x1: Math.ceil(Math.max(a.x, b.x) / CELL + m), y1: Math.ceil(Math.max(a.y, b.y) / CELL + m) };
    const was = live.current.rect;
    live.current.rect = was ? { x0: Math.min(was.x0, box.x0), y0: Math.min(was.y0, box.y0), x1: Math.max(was.x1, box.x1), y1: Math.max(was.y1, box.y1) } : box;
  };
  const pressureOf = (e: PointerEvent | React.PointerEvent) => (e.pointerType === "pen" && e.pressure > 0 ? 0.45 + e.pressure * 1.1 : 1);

  /** Take back the stroke a first finger began, when a second finger turns it into a pinch. */
  const dropStroke = () => {
    const pen = penRef.current;
    if (!pen) return;
    paintRef.current = pen.before;
    penRef.current = null;
    live.current.dirty = true;
  };

  const startPinch = () => {
    const [a, b] = [...touchesRef.current.values()];
    pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: { ...viewRef.current } };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (result) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the browser no longer tracks: paint without capture */
    }
    if (e.pointerType === "pen") stylusRef.current = true;
    if (e.pointerType === "touch") {
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchesRef.current.size >= 2) {
        // Two fingers: zoom and move, and whatever the first finger began is undone.
        dropStroke();
        tapRef.current = null;
        startPinch();
        return;
      }
      if (stylusRef.current) return; // a palm, with a stylus in the other hand
    }
    if (penRef.current) return;
    const p = toUnits(e);
    if (tool === "fill") {
      tapRef.current = { id: e.pointerId, at: { x: e.clientX, y: e.clientY }, p };
      return;
    }
    penRef.current = { id: e.pointerId, last: p, before: paintRef.current.slice(), part: areaAt(areas, p), pressure: pressureOf(e) };
    lastPartRef.current = penRef.current.part;
    setMessage(null);
    dab(p, p);
  };
  /** The fill tool: the whole part under the finger, in one tap, edge to edge — any part. */
  const fillAt = (p: Point) => {
    const l = areaAt(areas, p);
    if (l < 0) return;
    lastPartRef.current = l;
    const before = paintRef.current.slice();
    const c = crayonIndex(crayon);
    for (let i = 0; i < areas.labels.length; i++) if (areas.labels[i] === l) paintRef.current[i] = c;
    historyRef.current = [...historyRef.current.slice(-15), before];
    setMessage(null);
    setVer((v) => v + 1);
    live.current.dirty = true;
    review(before);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "touch" && touchesRef.current.has(e.pointerId)) {
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pinch = pinchRef.current;
      if (pinch && touchesRef.current.size >= 2) {
        const [a, b] = [...touchesRef.current.values()];
        const r = canvasRef.current!.getBoundingClientRect();
        const z = Math.min(MAX_ZOOM, Math.max(1, pinch.view.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist)));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        // The point of the picture that was under the fingers stays under them.
        const ux = pinch.view.x + ((pinch.mid.x - r.left) / r.width) * (1000 / pinch.view.z);
        const uy = pinch.view.y + ((pinch.mid.y - r.top) / r.height) * (1000 / pinch.view.z);
        setView(z, ux - ((mid.x - r.left) / r.width) * (1000 / z), uy - ((mid.y - r.top) / r.height) * (1000 / z));
        return;
      }
    }
    const pen = penRef.current;
    if (!pen || pen.id !== e.pointerId) return;
    const list = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of list.length ? list : [e.nativeEvent]) {
      const p = toUnits(ev);
      pen.pressure = pressureOf(ev);
      dab(pen.last, p);
      pen.last = p;
    }
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "touch") {
      touchesRef.current.delete(e.pointerId);
      if (touchesRef.current.size < 2) pinchRef.current = null;
    }
    const tap = tapRef.current;
    if (tap && tap.id === e.pointerId) {
      tapRef.current = null;
      // A tap, not a drag that turned into a pinch: fill the part.
      if (Math.hypot(e.clientX - tap.at.x, e.clientY - tap.at.y) < 12) fillAt(tap.p);
      return;
    }
    const pen = penRef.current;
    if (!pen || pen.id !== e.pointerId) return;
    penRef.current = null;
    historyRef.current = [...historyRef.current.slice(-15), pen.before];
    setVer((v) => v + 1);
    review(pen.before);
  };

  // A computer: Ctrl/⌘ + the wheel (or a trackpad pinch) zooms about the pointer. Native, so it can stop the page zooming.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const v = viewRef.current;
      const r = canvas.getBoundingClientRect();
      const z = Math.min(MAX_ZOOM, Math.max(1, v.z * Math.exp(-e.deltaY / 300)));
      const ux = v.x + ((e.clientX - r.left) / r.width) * (1000 / v.z);
      const uy = v.y + ((e.clientY - r.top) / r.height) * (1000 / v.z);
      setView(z, ux - ((e.clientX - r.left) / r.width) * (1000 / z), uy - ((e.clientY - r.top) / r.height) * (1000 / z));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- setView reads refs only

  /**
   * The parts each step must have coloured: the ones its author chose (bigger
   * than a speck) — not the slivers that joined it in play, so a hair-thin
   * strip can never hold a step back.
   */
  const required = useMemo(() => (item.paint?.steps ?? []).map((s) => new Set([...stepAreas(areas, s)].filter((l) => areas.sizes[l] >= SPECK))), [areas, item.paint]);
  const stateOf = (paint: Uint8Array, k: number, anyColour: boolean) => stepState(paint, areas, steps[k], anyColour, required[k]);

  /** Steps done: coloured past the bar with no part left behind, or said done by the child (and not rubbed out since). */
  const manualRef = useRef<Set<number>>(new Set());
  const doneNow = (paint: Uint8Array) => {
    const out = new Set<number>();
    steps.forEach((_, k) => {
      const st = stateOf(paint, k, own);
      // Said done stays done only while the step still meets what Done asked of it.
      if (isComplete(st, need) || (manualRef.current.has(k) && maySayDone(st))) out.add(k);
      else manualRef.current.delete(k);
    });
    return out;
  };

  /**
   * Every step is done — but the picture is the child's to finish: they may
   * want to touch something up. Say so, light up Finish, and keep painting.
   */
  const allStepsDone = () => setMessage({ tone: "correct", title: t("paint.allDone.title"), text: t("paint.allDone.text"), hold: 5000 });

  /** A step just finished: a short flash, and on to the suggested step without a stop. */
  const stepFinished = (nowDone: Set<number>) => {
    playSound("success");
    const next = recommend(cur, nowDone);
    if (next >= 0) goTo(next);
    setMessage({ tone: "correct", title: t("paint.stepDone", { n: cur + 1 }), text: next >= 0 ? t("paint.nextIs", { what: instruction(steps[next]) }) : undefined });
  };

  /**
   * The child says this step is done. The check can miss specks a child cannot
   * see, so once at least NEARLY (half) is coloured their word counts: the
   * step's last white gaps are filled in its colour (colour already there is
   * kept) and it is done. Under half, Done says what is left instead — tapping
   * Done through the steps must not finish a picture nobody coloured.
   */
  const completeStep = () => {
    if (!step || done.has(cur)) return;
    const paint = paintRef.current;
    // Done is a promise the child kept, not a shortcut: under half coloured, it says what is left.
    const st = stateOf(paint, cur, own);
    if (!maySayDone(st)) {
      // Under half overall, or a part not even begun: say which, and the glow shows where.
      setMessage(
        st.cover < NEARLY
          ? { tone: "hint", title: t("paint.notYet.title"), text: t("paint.notYet.text") }
          : { tone: "hint", title: t("paint.partWhite.title"), text: t("paint.partWhite.text") },
      );
      return;
    }
    const before = paint.slice();
    // In their own colours, the gaps take the crayon in hand; otherwise the step's colour.
    const c = crayonIndex(own ? crayon : step.color);
    const parts = stepSets[cur];
    for (let i = 0; i < paint.length; i++) if (!paint[i] && parts.has(areas.labels[i])) paint[i] = c;
    historyRef.current = [...historyRef.current.slice(-15), before];
    setVer((v) => v + 1);
    live.current.dirty = true;
    manualRef.current.add(cur);
    const nowDone = doneNow(paint);
    nowDone.add(cur);
    setDone(nowDone);
    if (nowDone.size === steps.length) {
      playSound("levelup");
      return allStepsDone();
    }
    stepFinished(nowDone);
  };

  /** After each brush stroke: is a step finished, and is there advice worth giving? */
  const review = (before: Uint8Array) => {
    const paint = paintRef.current;
    const nowDone = doneNow(paint);
    const finishedHere = !done.has(cur) && nowDone.has(cur);
    setDone(nowDone);
    if (nowDone.size === steps.length && steps.length > 0 && !(done.size === steps.length)) {
      playSound("levelup");
      return allStepsDone();
    }
    if (finishedHere) return stepFinished(nowDone);
    if (!step || tool === "eraser") return;
    const st = stateOf(paint, cur, own);
    if (st.wrong >= 0.06 && st.wrongCrayon && st.wrongCrayon !== crayonIndex(step.color)) {
      const name = colourName(t, step.color);
      // Holding the right crayon already: the fix is to paint over the other colour, not to pick again.
      setMessage(
        crayon === step.color
          ? { tone: "hint", title: t("paint.adviceColor.title"), text: t("paint.adviceColor.over", { color: name }) }
          : { tone: "hint", title: t("paint.adviceColor.title"), text: t("paint.adviceColor.text", { color: name }), action: { label: t("paint.useColor", { color: name }), run: () => setCrayon(step.color) } },
      );
      return;
    }
    if (!inside) {
      // Much of this stroke ran over a line into other parts: the helper keeps a stroke in its part.
      let changed = 0;
      let out = 0;
      for (let i = 0; i < paint.length; i++) {
        if (paint[i] === before[i]) continue;
        changed++;
        if (areas.labels[i] !== lastPartRef.current) out++;
      }
      if (changed > 200 && out / changed > 0.4) {
        setMessage({ tone: "nudge", title: t("paint.adviceInside.title"), text: t("paint.adviceInside.text"), action: { label: t("paint.helperOn"), run: () => setInside(true) } });
        return;
      }
    }
    // Most of it coloured but not complete: either specks still glow, or a whole part was missed.
    if (st.cover >= 0.6 && !isComplete(st, need))
      setMessage(
        st.cover >= need
          ? { tone: "hint", title: t("paint.partWhite.title"), text: t("paint.partWhite.text") }
          : { tone: "hint", title: t("paint.adviceAlmost.title"), text: t("paint.adviceAlmost.text") },
      );
  };

  // A flash goes by itself: nothing to close, nothing in the way.
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), message.hold ?? FLASH_MS[message.tone]);
    return () => window.clearTimeout(id);
  }, [message]);

  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    paintRef.current = prev;
    setVer((v) => v + 1);
    setMessage(null);
    setDone(doneNow(prev));
  };
  const clearAll = () => {
    historyRef.current = [...historyRef.current.slice(-15), paintRef.current];
    paintRef.current = blankPaint();
    setVer((v) => v + 1);
    setDone(new Set());
    setMessage(null);
  };

  /* ------------------------------------------------------------ finish */
  const finish = () => {
    const score = scorePainting(paintRef.current, areas, steps, own);
    let xp = 0;
    if (!sandbox) {
      const prev = TraceProgress.get(item.id);
      const passed = score.stars >= 2;
      if (passed && !isDone(prev)) {
        xp = stepXp("learned", score.stars, xpPerStep, ScoringAPI.current());
        if (xp > 0) onAwardXp?.(xp);
      }
      TraceProgress.set(item.id, {
        ...prev,
        status: passed ? "learned" : prev.status,
        earnedAt: passed && !isDone(prev) ? Date.now() : prev.earnedAt,
        attempts: (prev.attempts ?? 0) + 1,
        paintBest: Math.max(prev.paintBest ?? 0, score.accuracy),
        title: item.title,
        kind: item.kind,
        updatedAt: Date.now(),
      });
    }
    setMessage(null);
    fitView();
    setResult({ ...score, xp });
    // Keep it in My pictures (on the device now, on the server when it can). Not a Studio test.
    keptRef.current = null;
    setKept(null);
    if (!sandbox && score.stars > 0) {
      const paintedAt = Date.now();
      void renderPng().then(async (png) => {
        if (!png) return setKept(false);
        keptRef.current = png;
        setKept(await Gallery.save({ itemId: item.id, title: item.title, collectionId: source?.collectionId, accuracy: score.accuracy, stars: score.stars, ownColours: own, paintedAt, png }));
      });
    }
  };

  /**
   * The finished painting as a picture file: the child's colours under crisp
   * lines, no glow. A phone or tablet offers its share sheet (save to photos,
   * send to family); elsewhere it downloads. False when it could not be saved;
   * a cancelled share counts as done.
   */
  /** The painting as a PNG: the child's colours under crisp lines, no glow. */
  const renderPng = async (): Promise<Blob | null> => {
    const S = 1200;
    const out = document.createElement("canvas");
    out.width = out.height = S;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, S, S);
    // The paint, line cells taking their own side's colour as on screen.
    const layer = document.createElement("canvas");
    layer.width = layer.height = GRID;
    const lctx = layer.getContext("2d")!;
    const img = lctx.createImageData(GRID, GRID);
    const paint = paintRef.current;
    for (let i = 0; i < paint.length; i++) {
      let v = paint[i];
      if (!v && sources[i] !== i && sources[i] >= 0) v = paint[sources[i]];
      if (!v) continue;
      const [r, g, b] = rgb(hexOfIndex(v));
      img.data.set([r, g, b, 255], i * 4);
    }
    lctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer, 0, 0, S, S);
    if (linesRef.current && !item.paint?.picture?.smooth) ctx.drawImage(linesRef.current, 0, 0, S, S);
    ctx.setTransform(S / 1000, 0, 0, S / 1000, 0, 0);
    ctx.strokeStyle = ctx.fillStyle = INK;
    ctx.lineWidth = LINE;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.stroke(lineArt.path);
    for (const d of lineArt.dots) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    return new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  };

  /** What the end card's Save shares or downloads: the painting just kept, else a fresh render. */
  const savePicture = async (): Promise<boolean> => {
    const blob = keptRef.current ?? (await renderPng());
    return blob ? sharePicture(blob, item.title || t("paint.slate")) : false;
  };

  /** From the score card back to the same painting: nothing is lost, and Finish scores it again. */
  const keepColouring = () => {
    setResult(null);
    setKept(null);
    keptRef.current = null;
    live.current.dirty = true;
  };

  const again = () => {
    paintRef.current = blankPaint();
    historyRef.current = [];
    setDone(new Set());
    setResult(null);
    goTo(0);
    setVer((v) => v + 1);
  };

  // The picture says its name once, if it has a recording and Koda's voice is on.
  const sayIt = useCallback(() => {
    if (item.voice) void say(item.voiceText ?? item.title, item.script === "khmer" ? "km" : "en", item.voice);
  }, [item.voice, item.voiceText, item.title, item.script]);
  useEffect(() => {
    if (sandbox || !item.voice || !isVoiceEnabled()) return;
    sayIt();
    return () => stopVoice();
  }, [sandbox, item.id, item.voice, sayIt]);

  const painted = ver > 0 && paintRef.current.some((v) => v > 0);
  // Full only when complete: a bar at 100% beside a white sleeve would say the opposite of the glow.
  const stepNow = step ? stateOf(paintRef.current, cur, own) : null;
  const progress = !stepNow ? 0 : isComplete(stepNow, need) ? 1 : Math.min(0.95, stepNow.cover / need);
  const next = place?.next;

  /* ------------------------------------------------------------ view
   *
   * One screen, three shapes, by the width the player has (a container query,
   * so a sidebar on a computer is counted):
   * - phone (under @lg): the picture as large as fits; the step as one line with
   *   small numbered dots under it; crayons in one row that swipes sideways; a
   *   tool bar fixed to the bottom — brush, fill, eraser, undo, More, I'm done.
   *   Brush size, Start over, the two switches and the step list wait behind More.
   * - tablet (@lg to @4xl): the same, larger, with brush size in the bar.
   * - computer (@4xl up): everything in view — a side panel with the steps and
   *   switches, Start over in the bar — and keyboard shortcuts.
   * A phone on its side puts the tools beside the picture instead of under it.
   */
  // A computer's keyboard: B brush, F fill, E eraser, 1–3 brush size, ⌘Z / Ctrl+Z undo.
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keysRef.current = (e: KeyboardEvent) => {
    if (result || sheet) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
    const key = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && key === "z") {
      e.preventDefault();
      return undo();
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (key === "b") setTool("brush");
    else if (key === "f" && fillAllowed) setTool("fill");
    else if (key === "e") setTool("eraser");
    else if (key === "1" || key === "2" || key === "3") setSize((["s", "m", "l"] as const)[Number(key) - 1]);
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keysRef.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const toggleOwn = (on: boolean) => {
    setOwn(on);
    // Re-check every step against the new rule: in own colours a filled step is done whatever its colour.
    const paint = paintRef.current;
    const next = new Set<number>();
    steps.forEach((_, k) => {
      const st = stateOf(paint, k, on);
      if (isComplete(st, need) || (manualRef.current.has(k) && maySayDone(st))) next.add(k);
    });
    setDone(next);
    setMessage(null);
  };

  const stepChips = (compact: boolean) => (
    <ol className={`flex gap-1.5 ${compact ? "overflow-x-auto px-1 py-1.5 [scrollbar-width:none]" : "flex-wrap"}`} aria-label={t("paint.steps")}>
      {steps.map((s, k) => {
        const isDoneK = done.has(k);
        const isCur = k === cur && !result;
        return (
          <li key={s.id} className="shrink-0">
            <button
              type="button"
              onClick={() => {
                goTo(k);
                setSheet(false);
              }}
              disabled={Boolean(result)}
              aria-current={isCur ? "step" : undefined}
              aria-label={`${t("paint.stepN", { n: k + 1 })} · ${instruction(s)}${isDoneK ? ` · ${t("paint.done")}` : ""}`}
              title={instruction(s)}
              className={`relative flex items-center justify-center rounded-full font-bold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${compact ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"} ${
                isCur ? "ring-[3px] ring-indigo-400 ring-offset-2 ring-offset-surface dark:ring-indigo-600" : ""
              }`}
              style={{ background: crayonHex(s.color) }}
            >
              <span className={`grid place-items-center rounded-full bg-black/25 ${compact ? "h-5 w-5" : "h-6 w-6"}`}>{isDoneK ? <Check className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> : k + 1}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  const sizePicker = (
    <div className="flex items-center gap-0.5 self-start rounded-full bg-surface-muted p-1" role="radiogroup" aria-label={t("paint.size")}>
      {(Object.keys(SIZES) as Size[]).map((s, k) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={size === s}
          aria-label={t(`paint.sizes.${s}`)}
          title={`${t(`paint.sizes.${s}`)} (${k + 1})`}
          onClick={() => setSize(s)}
          className={`grid h-9 w-9 place-items-center rounded-full transition ${size === s ? "bg-surface shadow-sm" : ""}`}
        >
          <span className="rounded-full bg-ink" style={{ width: 4 + SIZES[s] / 4, height: 4 + SIZES[s] / 4 }} />
        </button>
      ))}
    </div>
  );

  const switches = (
    <>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
        <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-ink">{t("paint.helper")}</span>
          <span className="text-xs text-muted">{t("paint.helperNote")}</span>
        </span>
        <input type="checkbox" role="switch" checked={inside} onChange={(e) => setInside(e.target.checked)} className="h-5 w-5 accent-indigo-600" />
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
        <Palette className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-ink">{t("paint.ownColours")}</span>
          <span className="text-xs text-muted">{t("paint.ownColoursNote")}</span>
        </span>
        <input type="checkbox" role="switch" checked={own} disabled={Boolean(result)} onChange={(e) => toggleOwn(e.target.checked)} className="h-5 w-5 accent-indigo-600" />
      </label>
    </>
  );

  /*
   * The note sits over the step bar, never over the picture: on a phone a note
   * on the picture hid the very part a child was told to colour. It covers the
   * step's words for a few seconds, then they come back; a tap closes it sooner.
   */
  const flash = message && !result && (
    <div className="absolute inset-0 z-10 flex">
      <div
        role="status"
        aria-live="polite"
        onClick={() => setMessage(null)}
        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2 text-sm shadow-md ring-1 motion-safe:animate-[trace-pop_200ms_ease-out] ${
          message.tone === "correct" ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950 dark:ring-emerald-800" : message.tone === "nudge" ? "bg-rose-50 ring-rose-200 dark:bg-rose-950 dark:ring-rose-800" : "bg-indigo-50 ring-indigo-200 dark:bg-indigo-950 dark:ring-indigo-800"
        }`}
      >
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-white ${message.tone === "correct" ? "bg-emerald-600" : message.tone === "nudge" ? "bg-rose-600" : "bg-indigo-600"}`}>
          {message.tone === "correct" ? <Check className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-semibold text-ink">{message.title}</span>
          {message.text && <span className="line-clamp-2 text-xs text-body">{message.text}</span>}
        </span>
        {message.action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              message.action!.run();
              setMessage(null);
            }}
            className="ml-auto shrink-0 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {message.action.label}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-3 pb-4 @lg:gap-4 @lg:pb-8">
      {!sandbox && (
        <header className="flex items-center gap-2 @lg:gap-3">
          <UIButton variant="secondary" size="step" aria-label={t("trace.action.backToList")} title={t("trace.action.backToList")} onClick={onExit} className="!rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </UIButton>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h1 className="truncate text-lg font-bold leading-tight text-ink @lg:text-xl" lang={item.script === "khmer" ? "km" : undefined}>
              {item.title}
            </h1>
            {item.voice && (
              <button
                type="button"
                aria-label={t("trace.action.listen")}
                title={t("trace.action.listen")}
                onClick={sayIt}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-indigo-600 transition hover:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            )}
          </div>
          {next && !result && (
            <>
              {/* Wrapped, because a button's own display style would win over "hidden" */}
              <span className="hidden @lg:inline-flex">
                <UIButton variant="ghost" size="sm" icon={<ArrowRight />} onClick={next.open}>
                  {t("paint.nextPicture")}
                </UIButton>
              </span>
              <span className="@lg:hidden">
                <RoundTool label={t("paint.nextPicture")} onClick={next.open}>
                  <ArrowRight className="h-[18px] w-[18px]" />
                </RoundTool>
              </span>
            </>
          )}
        </header>
      )}

      <div className="grid items-start gap-5 @4xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-w-0 flex-col items-center gap-3 [@media(orientation:landscape)_and_(max-height:520px)]:flex-row [@media(orientation:landscape)_and_(max-height:520px)]:items-start [@media(orientation:landscape)_and_(max-height:520px)]:justify-center">
          <div className="flex w-full min-w-0 flex-col items-center gap-2 [@media(orientation:landscape)_and_(max-height:520px)]:w-auto">
            {/* What to do now: the crayon, the step's words, and Done */}
            {!result && step && (
              <div className="relative flex w-full max-w-xl flex-col gap-1 rounded-2xl bg-surface px-3 py-2 ring-1 ring-line">
                {flash}
                <div className="flex items-center gap-2.5">
                  <span className="h-7 w-7 shrink-0 rounded-full shadow ring-2 ring-white @lg:h-8 @lg:w-8" style={{ background: crayonHex(step.color) }} aria-hidden="true" />
                  <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-ink">
                    <span className="text-muted">
                      <span className="@lg:hidden">{cur + 1}/{steps.length}</span>
                      <span className="hidden @lg:inline">{t("paint.stepOf", { n: cur + 1, total: steps.length })}</span> ·{" "}
                    </span>
                    {instruction(step)}
                  </p>
                  {/* The child's word ends a step: the check can miss what they cannot see */}
                  <UIButton size="sm" variant={done.has(cur) ? "ghost" : "secondary"} icon={<Check />} onClick={completeStep} disabled={done.has(cur) || !painted}>
                    {done.has(cur) ? t("paint.done") : t("paint.stepDoneButton")}
                  </UIButton>
                </div>
                <UIProgressBar value={Math.round(progress * 100)} max={100} size="sm" tone={done.has(cur) ? "emerald" : "primary"} label={t("paint.stepProgress")} />
                {/* Under a computer's width the step list is these dots; a computer has the side panel */}
                <div className="-mx-1 @4xl:hidden">{stepChips(true)}</div>
              </div>
            )}

            <div className="relative aspect-square w-[min(100%,calc(100dvh_-_24rem))] shrink-0 @lg:w-[min(100%,calc(100dvh_-_21rem))] @4xl:w-[min(100%,calc(100dvh_-_19rem))] [@media(orientation:landscape)_and_(max-height:520px)]:w-[calc(100dvh_-_7rem)]">
              <canvas
                ref={canvasRef}
                aria-label={t("paint.slate")}
                className="absolute inset-0 block h-full w-full touch-none rounded-3xl ring-1 ring-line"
                style={{ cursor: result ? "default" : "crosshair" }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              />
              {/* Zoomed in: how far, and one tap back to the whole picture */}
              {zoomed && !result && (
                <button
                  type="button"
                  onClick={fitView}
                  className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-semibold text-ink shadow-md ring-1 ring-line backdrop-blur transition hover:ring-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  {t("paint.fit")}
                </button>
              )}
            </div>
          </div>

          {result ? (
            <ResultCard result={result} kept={kept} onSave={savePicture} onKeep={keepColouring} onNext={next ? next.open : undefined} onAgain={again} onBack={sandbox ? undefined : onExit} onHome={onGoHome} />
          ) : (
            /* The tools: fixed to the bottom of a phone, under the picture on a tablet or computer, beside it on a phone held sideways */
            <div className="sticky bottom-0 z-20 flex w-full max-w-xl flex-col gap-2.5 @lg:max-w-2xl rounded-t-3xl border-t border-line bg-surface/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur @lg:static @lg:rounded-none @lg:border-0 @lg:bg-transparent @lg:p-0 @lg:backdrop-blur-none [@media(orientation:landscape)_and_(max-height:520px)]:static [@media(orientation:landscape)_and_(max-height:520px)]:w-64 [@media(orientation:landscape)_and_(max-height:520px)]:border-0 [@media(orientation:landscape)_and_(max-height:520px)]:bg-transparent">
              {/* Crayons: one row to swipe on a phone (a fade at the edge says there is more), rows that wrap on a larger screen */}
              <div
                ref={crayonRowRef}
                className="flex gap-2 overflow-x-auto px-1.5 py-1.5 [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none] @lg:flex-wrap @lg:justify-center @lg:gap-1.5 @lg:overflow-visible @lg:[mask-image:none] [@media(orientation:landscape)_and_(max-height:520px)]:flex-wrap [@media(orientation:landscape)_and_(max-height:520px)]:overflow-visible [@media(orientation:landscape)_and_(max-height:520px)]:[mask-image:none]"
                role="radiogroup"
                aria-label={t("paint.crayons")}
              >
                {box.map((c) => {
                  const on = tool !== "eraser" && crayon === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={c.label}
                      title={c.label}
                      data-crayon={c.id}
                      onClick={() => {
                        setCrayon(c.id);
                        if (tool === "eraser") setTool("brush");
                      }}
                      className={`h-8 w-8 shrink-0 rounded-full shadow-sm ring-1 ring-black/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 @lg:h-9 @lg:w-9 ${on ? "scale-110 ring-[3px] !ring-indigo-500 ring-offset-2 ring-offset-surface" : "hover:scale-105"}`}
                      style={{ background: c.hex }}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 @lg:flex-wrap @lg:justify-center @lg:gap-2 [@media(orientation:landscape)_and_(max-height:520px)]:flex-wrap">
                {/* Brush, fill, eraser: one compact switch rather than three big buttons */}
                <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-muted p-1" role="radiogroup" aria-label={t("paint.tools")}>
                  {(
                    [
                      ["brush", t("paint.brush"), "B", <Brush key="b" className="h-[18px] w-[18px]" />],
                      ["fill", t("paint.fill"), "F", <PaintBucket key="f" className="h-[18px] w-[18px]" />],
                      ["eraser", t("paint.eraser"), "E", <Eraser key="e" className="h-[18px] w-[18px]" />],
                    ] as const
                  )
                    .filter(([id]) => id !== "fill" || fillAllowed)
                    .map(([id, label, key, icon]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={tool === id}
                      aria-label={label}
                      title={`${label} (${key})`}
                      onClick={() => setTool(id)}
                      className={`grid h-9 w-9 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 @lg:h-10 @lg:w-10 ${tool === id ? "bg-indigo-600 text-white shadow-sm" : "text-body hover:bg-surface hover:text-ink"}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <div className="hidden @lg:block">{sizePicker}</div>
                <RoundTool label={`${t("paint.undo")} (⌘Z)`} onClick={undo} disabled={historyRef.current.length === 0}>
                  <Undo2 className="h-[18px] w-[18px]" />
                </RoundTool>
                <span className="hidden @4xl:inline-flex">
                  <RoundTool label={t("paint.clear")} onClick={clearAll} disabled={!painted}>
                    <RotateCcw className="h-[18px] w-[18px]" />
                  </RoundTool>
                </span>
                <span className="@4xl:hidden">
                  <RoundTool label={t("paint.more")} onClick={() => setSheet(true)}>
                    <MoreHorizontal className="h-[18px] w-[18px]" />
                  </RoundTool>
                </span>
                <span className="min-w-0 flex-1 @lg:hidden" />
                <UIButton
                  icon={<Check />}
                  onClick={() => finish()}
                  disabled={!painted}
                  className={`shrink-0 @lg:min-w-36 ${steps.length > 0 && done.size === steps.length ? "ring-4 ring-emerald-300 motion-safe:animate-pulse dark:ring-emerald-700" : ""}`}
                >
                  <span className="@lg:hidden">{t("paint.finish")}</span>
                  <span className="hidden @lg:inline">{t("paint.imDone")}</span>
                </UIButton>
              </div>
            </div>
          )}
        </section>

        {/* A computer's side panel: every step, and the two switches */}
        <aside className="hidden min-w-0 flex-col gap-3 @4xl:flex">
          <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">{t("paint.steps")}</h2>
              <span className="text-xs text-muted">{t("paint.doneOf", { done: done.size, total: steps.length })}</span>
            </div>
            {stepChips(false)}
            <p className="text-xs text-muted">{t("paint.anyOrder")}</p>
          </div>
          {switches}
          <p className="px-1 text-xs text-muted">{t("paint.shortcuts")}</p>
        </aside>
      </div>

      {/* More, on a phone or tablet: what the bar has no room for */}
      <UIModal isOpen={sheet} onClose={() => setSheet(false)} title={t("paint.more")} tone="plain">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">{t("paint.size")}</span>
            {sizePicker}
          </div>
          <div className="flex flex-col gap-2">
            <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
              {t("paint.steps")}
              <span className="font-normal normal-case">{t("paint.doneOf", { done: done.size, total: steps.length })}</span>
            </span>
            {stepChips(false)}
          </div>
          {switches}
          <p className="flex items-center gap-2 text-xs text-muted">
            <Maximize2 className="h-3.5 w-3.5 shrink-0" />
            {t("paint.pinchTip")}
          </p>
          <UIButton
            variant="secondary"
            icon={<RotateCcw />}
            disabled={!painted}
            onClick={() => {
              clearAll();
              setSheet(false);
            }}
          >
            {t("paint.clear")}
          </UIButton>
        </div>
      </UIModal>
    </div>
  );
}

/** A phone: a touch screen whose short side is a phone's. Read once, when a picture opens. */
function isPhone(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches && Math.min(window.screen.width, window.screen.height) < 600;
  } catch {
    return false;
  }
}

/** A small round icon button for the tool bar: 36px on a phone, 40px larger. */
function RoundTool({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-body ring-1 ring-line transition hover:text-ink hover:ring-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 @lg:h-10 @lg:w-10"
    >
      {children}
    </button>
  );
}

/** How the painting went: the accuracy, its three parts, and where to go next. */
function ResultCard({ result, kept, onSave, onKeep, onNext, onAgain, onBack, onHome }: { result: PaintScore & { xp: number }; kept: boolean | null; onSave(): Promise<boolean>; onKeep(): void; onNext?(): void; onAgain(): void; onBack?(): void; onHome?(): void }) {
  const { t } = useT();
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  // In their own colours, colour was the child's to choose: it is not a part of the score.
  const parts: { key: string; value: number }[] = [
    { key: "filled", value: result.filled },
    ...(result.ownColours ? [] : [{ key: "colors", value: result.colors }]),
  ];
  const headline = result.stars === 3 ? "great" : result.stars === 2 ? "good" : "keepGoing";
  // On a short screen the card lands under the picture: bring it up.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Braced: newer browsers return a Promise from scrollIntoView, and an effect may only return a clean-up.
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, []);
  return (
    <div ref={ref} role="status" className="flex w-full max-w-xl flex-col gap-4 rounded-3xl bg-surface p-5 ring-1 ring-line motion-safe:animate-[trace-pop_220ms_ease-out]">
      <div className="flex items-center gap-4">
        <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#4f46e5 ${result.accuracy * 3.6}deg, var(--color-line, #e5e7eb) 0)` }}>
          <span className="grid h-16 w-16 place-items-center rounded-full bg-surface text-xl font-bold tabular-nums text-ink">{result.accuracy}%</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("paint.accuracy")}</p>
          <h2 className="text-xl font-bold text-ink">{t(`paint.result.${headline}`)}</h2>
          <div className="flex items-center gap-1" aria-label={t("paint.stars", { n: result.stars })}>
            {[1, 2, 3].map((n) => (
              <Star key={n} className={`h-5 w-5 ${n <= result.stars ? "fill-indigo-500 text-indigo-500" : "text-line"}`} />
            ))}
            {result.xp > 0 && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">+{result.xp} XP</span>}
          </div>
        </div>
      </div>
      <ul className="flex flex-col gap-2.5">
        {parts.map((p) => (
          <li key={p.key} className="flex flex-col gap-1">
            <span className="flex justify-between text-sm">
              <span className="text-body">{t(`paint.part.${p.key}`)}</span>
              <span className="font-semibold tabular-nums text-ink">{Math.round(p.value * 100)}%</span>
            </span>
            <UIProgressBar value={Math.round(p.value * 100)} max={100} size="sm" tone={p.value >= 0.85 ? "emerald" : "primary"} label={t(`paint.part.${p.key}`)} />
          </li>
        ))}
      </ul>
      {result.ownColours && (
        <p className="flex items-center gap-2 text-sm text-body">
          <Palette className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
          {t("paint.ownColoursResult")}
        </p>
      )}
      <p className="text-sm text-muted">{t(`paint.tip.${tipOf(result)}`)}</p>
      {kept && (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <Images className="h-4 w-4" />
          {t("paint.keptInGallery")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {onNext && (
          <UIButton icon={<ArrowRight />} onClick={onNext} className="flex-1">
            {t("paint.nextPicture")}
          </UIButton>
        )}
        <UIButton
          variant="secondary"
          icon={saved === "saved" ? <Check /> : <Download />}
          isLoading={saved === "saving"}
          onClick={async () => {
            setSaved("saving");
            setSaved((await onSave()) ? "saved" : "failed");
          }}
        >
          {saved === "saved" ? t("paint.saved") : t("paint.save")}
        </UIButton>
        {/* Back to this same painting, to fix something; Finish again scores it again */}
        <UIButton variant="secondary" icon={<Brush />} onClick={onKeep}>
          {t("paint.keepColouring")}
        </UIButton>
        <UIButton variant="ghost" icon={<RotateCcw />} onClick={onAgain}>
          {t("paint.paintAgain")}
        </UIButton>
        {onBack && (
          <UIButton variant="ghost" onClick={onBack}>
            {t("trace.action.backToList")}
          </UIButton>
        )}
        {onHome && !onNext && (
          <UIButton variant="ghost" onClick={onHome}>
            {t("paint.home")}
          </UIButton>
        )}
      </div>
    </div>
  );
}

/** The one thing to try next time: the weakest part. */
function tipOf(r: PaintScore): "perfect" | "filled" | "colors" {
  const weakest = (["filled", "colors"] as const).reduce((a, b) => (r[b] < r[a] ? b : a));
  return r[weakest] >= 0.95 ? "perfect" : weakest;
}
