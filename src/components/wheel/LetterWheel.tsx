import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { useReducedMotion } from "motion/react";
import { RING, VIEW, angleOf, captureRadiusFor, layoutRing, pointAt, tileRadiusFor, type Script } from "./wheelLayout";
import { autoSubmits, backspace, dragStep, hitTile, labelsOf, releaseAction, tapStep, type Pt } from "./traceModel";
import { TUNE, dampingFor, isAtRest, stepSpring, stepTip, substeps, tipAt, tracePath, type Spring, type Tip, type Tune } from "./tracePhysics";

/**
 * The letter ring: a child spells a word by tracing across tiles.
 *
 * A shared component, not part of any skill or module. Koda Library uses it for
 * a story's spelling words; a spelling skill can use it for its lessons. It knows
 * nothing about either — it reports what was traced and shows the verdict it is
 * handed back.
 *
 * Three ways in, one trace:
 *
 *  - **Drag** across tiles. Lifting the finger submits. Dragging back onto the
 *    previous tile unwinds the last one.
 *  - **Tap** tiles one at a time. Tapping the last one takes it off. The trace is
 *    submitted with *Check*, or by itself at `autoSubmitAt`.
 *  - **Keyboard**: Tab to a tile, Enter or Space to choose it, arrows to move
 *    round the ring, Backspace to take the last one off, Escape to start over.
 *
 * Motion is decoration and never function. With reduced motion asked for, the
 * ring is drawn straight from state and every behaviour is identical — which is
 * also how it runs under test.
 */

export type WheelVerdict = "correct" | "wrong" | "bonus" | "ignored";

export interface LetterWheelProps {
  /** Tile labels in ring order, distractors included. A new array starts a new word. */
  tiles: readonly string[];
  script?: Script;
  /** Called with a finished trace. Return how it went so the ring can show it. */
  onSubmit(labels: string[], indices: number[]): WheelVerdict | void;
  /** Every change to the trace, for a chip or slots drawn by the caller. */
  onTraceChange?(labels: string[]): void;
  /** Start over was pressed. Never an attempt — the caller must not log it as one. */
  onStartOver?(): void;
  onShuffle?(): void;
  /** Shortest trace worth submitting. A shorter drag is dropped silently. */
  minTiles?: number;
  /** Taps and keys submit on their own at exactly this many tiles. */
  autoSubmitAt?: number;
  /** A tile to mark as the hint's suggestion. The child still has to choose it. */
  highlight?: number | null;
  disabled?: boolean;
  /** What the ring is for, read by a screen reader. */
  label?: string;
  /** Motion tuning, for the demo page. Play uses the defaults. */
  tune?: Partial<Tune>;
  /**
   * How a tile is drawn, when that differs from what it spells — a Khmer vowel
   * or subscript is drawn on a dotted circle (◌ា). Labels, answers and the
   * word chip always use the tile itself.
   */
  display?: (tile: string) => string;
}

const COLOR = {
  picked: "var(--color-indigo-600, #6B46C1)",
  pickedEdge: "#4C2E92",
  good: "var(--color-emerald-600, #2E9D73)",
  bad: "var(--color-rose-600, #FF2D78)",
  muted: "var(--koda-surface-muted, #F0F4FF)",
  line: "var(--koda-line, #E2E8F0)",
  ink: "var(--koda-ink, #0F172A)",
  // The tile edge: `line` matches the dark-theme tile fill exactly, so it vanished.
  edge: "var(--koda-muted, #64748B)",
};
const KHMER_FONT = "'Noto Sans Khmer','Khmer OS','Khmer MN',sans-serif";
const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
};

interface TileAnim {
  ang: Spring;
  off: Spring;
  sc: Spring;
}

export function LetterWheel({
  tiles, script = "latin", onSubmit, onTraceChange, onStartOver, onShuffle,
  minTiles = 2, autoSubmitAt, highlight = null, disabled = false, label = "Letter ring", tune: tuneIn, display = (t: string) => t,
}: LetterWheelProps) {
  const motionOK = !(useReducedMotion() ?? false);
  const tune = useMemo<Tune>(() => ({ ...TUNE, ...tuneIn }), [tuneIn]);
  const n = tiles.length;
  const wordKey = `${script}|${tiles.join("|·|")}`;
  const r = tileRadiusFor(script);
  const asTiles = useMemo(() => tiles.map((t) => ({ label: t })), [tiles]);

  /* ---- state: what React draws ---------------------------------------- */
  const [order, setOrder] = useState<number[]>(() => tiles.map((_, i) => i)); // slot → tile
  const [picked, setPicked] = useState<number[]>([]);
  const [dragging, setDragging] = useState(false);
  const [flash, setFlash] = useState<{ kind: "good" | "bad"; text: string } | null>(null);
  const [focusTile, setFocusTile] = useState<number | null>(null);

  /* ---- refs: what a gesture and the animation loop read ---------------- */
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const hubRef = useRef<SVGGElement>(null);
  const tileRefs = useRef<Array<SVGGElement | null>>([]);
  const scaleRefs = useRef<Array<SVGGElement | null>>([]);
  const pickedRef = useRef<number[]>([]);
  const orderRef = useRef(order);
  const draggingRef = useRef(false);
  const gesture = useRef<{ start: number[]; downHit: number; touched: Set<number> } | null>(null);
  const pointer = useRef({ x: 0, y: 0, vx: 0, vy: 0, t: 0 });
  const tip = useRef<Tip | null>(null);
  const anim = useRef<TileAnim[]>(tiles.map((_, i) => ({ ang: { x: angleOf(i, tiles.length), v: 0 }, off: { x: 0, v: 0 }, sc: { x: 1, v: 0 } })));
  const hub = useRef<Spring>({ x: 0, v: 0 });
  const raf = useRef(0);
  const last = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  orderRef.current = order;

  const slotOf = useCallback((tile: number) => orderRef.current.indexOf(tile), []);
  const restAt = useCallback((tile: number) => layoutRing(n)[slotOf(tile)] ?? { x: VIEW.cx, y: VIEW.cy, angle: 0 }, [n, slotOf]);
  const centres = useCallback((): Pt[] => tiles.map((_, i) => restAt(i)), [tiles, restAt]);

  /* ---- a new word resets everything ------------------------------------ */
  useEffect(() => {
    const fresh = tiles.map((_, i) => i);
    orderRef.current = fresh;
    setOrder(fresh);
    anim.current = fresh.map((_, i) => ({ ang: { x: angleOf(i, fresh.length), v: 0 }, off: { x: 0, v: 0 }, sc: { x: 1, v: 0 } }));
    pickedRef.current = [];
    setPicked([]);
    draggingRef.current = false;
    setDragging(false);
    gesture.current = null;
    tip.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordKey]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(flashTimer.current); }, []);

  const commit = useCallback((next: number[]) => {
    const prev = pickedRef.current;
    if (next.length === prev.length && next.every((v, i) => v === prev[i])) return;
    // A tile just chosen pops outward a little.
    if (next.length > prev.length) {
      const a = anim.current[next[next.length - 1]];
      if (a) { a.off.v += 80; a.sc.v += 3; }
    }
    pickedRef.current = next;
    setPicked(next);
    onTraceChange?.(labelsOf(asTiles, next));
  }, [asTiles, onTraceChange]);

  /* ---- drawing --------------------------------------------------------- */
  const tilePos = useCallback((i: number) => {
    const a = anim.current[i];
    if (!motionOK || !a) return restAt(i);
    return { ...pointAt(a.ang.x, a.off.x), angle: a.ang.x };
  }, [motionOK, restAt]);

  const drawPath = useCallback(() => {
    const anchors = pickedRef.current.map((i) => tilePos(i));
    const live = draggingRef.current && pickedRef.current.length > 0;
    const t = live ? (motionOK && tip.current ? tip.current : tipAt(pointer.current)) : null;
    const d = tracePath(anchors, t);
    pathRef.current?.setAttribute("d", d);
    glowRef.current?.setAttribute("d", d);
  }, [motionOK, tilePos]);

  const paintMotion = useCallback(() => {
    tiles.forEach((_, i) => {
      const p = tilePos(i);
      tileRefs.current[i]?.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      scaleRefs.current[i]?.setAttribute("transform", `scale(${(anim.current[i]?.sc.x ?? 1).toFixed(3)})`);
    });
    hubRef.current?.setAttribute("transform", `rotate(${(hub.current.x * 57.2958).toFixed(1)} ${VIEW.cx} ${VIEW.cy})`);
    drawPath();
  }, [tiles, tilePos, drawPath]);

  const frame = useCallback((now: number) => {
    const { count, dt } = substeps((now - (last.current || now)) / 1000, tune.step, tune.maxSteps);
    last.current = now;
    let busy = draggingRef.current;
    const chosen = new Set(pickedRef.current);
    for (let s = 0; s < count; s++) {
      anim.current.forEach((a, i) => {
        const targetAng = angleOf(slotOf(i), n);
        const targetSc = chosen.has(i) ? 1.08 : 1;
        a.ang = stepSpring(a.ang, targetAng, tune.angK, tune.angC, dt);
        a.off = stepSpring(a.off, 0, tune.tileK, dampingFor(tune.tileK), dt);
        a.sc = stepSpring(a.sc, targetSc, tune.tileK, dampingFor(tune.tileK, 0.6), dt);
        if (!isAtRest(a.ang, targetAng) || !isAtRest(a.off, 0) || !isAtRest(a.sc, targetSc)) busy = true;
      });
      hub.current = stepSpring(hub.current, 0, tune.hubK, tune.hubC, dt);
      if (!isAtRest(hub.current, 0)) busy = true;
      if (draggingRef.current && tip.current) {
        const lastPicked = pickedRef.current[pickedRef.current.length - 1];
        tip.current = stepTip(tip.current, pointer.current, lastPicked === undefined ? null : tilePos(lastPicked), dt, tune);
      }
    }
    pointer.current.vx *= 0.8;
    pointer.current.vy *= 0.8;
    paintMotion();
    raf.current = busy ? requestAnimationFrame(frame) : 0;
  }, [n, paintMotion, slotOf, tilePos, tune]);

  const kick = useCallback(() => {
    if (!motionOK || typeof requestAnimationFrame !== "function") { drawPath(); return; }
    if (raf.current) return;
    last.current = 0;
    raf.current = requestAnimationFrame(frame);
  }, [motionOK, frame, drawPath]);

  // After every render: positions and the trace are never left stale.
  useLayoutEffect(() => { if (motionOK) paintMotion(); else drawPath(); });

  /* ---- submitting ------------------------------------------------------ */
  const showFlash = useCallback((kind: "good" | "bad", text: string) => {
    clearTimeout(flashTimer.current);
    setFlash({ kind, text });
    flashTimer.current = setTimeout(() => setFlash(null), 900);
  }, []);

  const submit = useCallback(() => {
    const idx = pickedRef.current;
    if (!idx.length) return;
    const labels = labelsOf(asTiles, idx);
    const verdict = onSubmit(labels, [...idx]) ?? "ignored";
    const word = labels.join("");
    if (verdict === "wrong") {
      showFlash("bad", word);
      idx.forEach((i) => { const a = anim.current[i]; if (a) { a.off.v -= 120; a.sc.v -= 2.4; } });
    } else if (verdict === "correct" || verdict === "bonus") {
      showFlash("good", word);
    }
    commit([]);
    kick();
  }, [asTiles, commit, kick, onSubmit, showFlash]);

  const startOver = useCallback(() => {
    if (!pickedRef.current.length) return;
    commit([]);
    onStartOver?.();
    kick();
  }, [commit, kick, onStartOver]);

  /* ---- pointer --------------------------------------------------------- */
  const toView = (e: { clientX: number; clientY: number }): Pt => {
    const box = svgRef.current?.getBoundingClientRect();
    // Not laid out (a test, a hidden tab): read client coordinates as drawing units.
    if (!box || !box.width || !box.height) return { x: e.clientX, y: e.clientY };
    return { x: ((e.clientX - box.left) * VIEW.width) / box.width, y: ((e.clientY - box.top) * VIEW.height) / box.height };
  };

  const endGesture = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const g = gesture.current;
    gesture.current = null;
    tip.current = null;
    if (g && g.touched.size <= 1) {
      // One tile and no drag across: that was a tap. It edits the trace; it does not submit.
      const next = tapStep(g.start, g.downHit);
      commit(next);
      if (autoSubmits(next, autoSubmitAt)) submit();
      else kick();
      return;
    }
    if (releaseAction(pickedRef.current, minTiles) === "submit") submit();
    else { commit([]); kick(); }
  }, [autoSubmitAt, commit, kick, minTiles, submit]);

  useEffect(() => {
    if (!dragging) return;
    const up = () => endGesture();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, [dragging, endGesture]);

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (disabled || e.button > 0) return;
    if ((e.target as Element).closest?.("[data-wheel-hub]")) return;
    const p = toView(e);
    const hit = hitTile(centres(), p, captureRadiusFor(r));
    if (hit === null) return;
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* the window listener covers it */ }
    gesture.current = { start: [...pickedRef.current], downHit: hit, touched: new Set([hit]) };
    pointer.current = { x: p.x, y: p.y, vx: 0, vy: 0, t: performance.now() };
    tip.current = tipAt(p);
    draggingRef.current = true;
    setDragging(true);
    commit(dragStep(pickedRef.current, hit));
    kick();
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    // A lost pointerup would otherwise leave the ring drawing on plain hover.
    if (e.pointerType === "mouse" && e.buttons === 0) { endGesture(); return; }
    const p = toView(e);
    const now = performance.now();
    const dt = Math.max(1, now - pointer.current.t) / 1000;
    pointer.current = { x: p.x, y: p.y, vx: (p.x - pointer.current.x) / dt, vy: (p.y - pointer.current.y) / dt, t: now };
    const hit = hitTile(centres(), p, captureRadiusFor(r));
    if (hit !== null) gesture.current?.touched.add(hit);
    commit(dragStep(pickedRef.current, hit));
    if (!motionOK) drawPath();
  };

  /* ---- keyboard -------------------------------------------------------- */
  const onTileKey = (i: number) => (e: KeyboardEvent<SVGGElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const next = tapStep(pickedRef.current, i);
      commit(next);
      if (autoSubmits(next, autoSubmitAt)) submit(); else kick();
    } else if (e.key === "Backspace") {
      e.preventDefault(); commit(backspace(pickedRef.current)); kick();
    } else if (e.key === "Escape") {
      e.preventDefault(); startOver();
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      const slot = (slotOf(i) + step + n) % n;
      tileRefs.current[orderRef.current[slot]]?.focus();
    }
  };

  const shuffle = () => {
    if (disabled || n < 2) return;
    // Rotate by at least one slot, so the ring always visibly changes.
    const turn = 1 + Math.floor(Math.random() * (n - 1));
    const next = orderRef.current.map((_, s) => orderRef.current[(s + turn) % n]);
    anim.current.forEach((a) => { a.ang.v += 3; });
    hub.current.v += 14;
    orderRef.current = next;
    setOrder(next);
    commit([]);
    onShuffle?.();
    kick();
  };

  /* ---- render ---------------------------------------------------------- */
  const pickedLabels = labelsOf(asTiles, picked);
  const chipText = flash ? `${flash.text} ${flash.kind === "good" ? "✓" : "✕"}` : pickedLabels.join("");
  const chipBg = flash?.kind === "good" ? COLOR.good : flash?.kind === "bad" ? COLOR.bad : COLOR.picked;
  const font = script === "khmer" ? KHMER_FONT : "inherit";
  const layout = layoutRing(n);

  return (
    <div data-letter-wheel style={{ width: "100%", maxWidth: 440, margin: "0 auto" }}>
      <div
        aria-live="polite"
        data-wheel-chip
        style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 44 }}
      >
        {/* In the flow, not floating over the ring: at 360px a floating chip lands on the top tile. */}
        <span
          style={{
            opacity: chipText ? 1 : 0, transform: `translateY(${chipText ? 0 : -6}px)`,
            transition: motionOK ? "opacity .16s, transform .16s" : "none",
            padding: "6px 14px", borderRadius: 999, background: chipBg, color: "#fff", fontFamily: font,
            fontSize: 18, fontWeight: 800, letterSpacing: script === "khmer" ? 0 : "0.12em", whiteSpace: "nowrap",
          }}
        >
          {chipText}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        role="group"
        aria-label={`${label}. ${n} tiles. Drag across them, or choose them one at a time.`}
        aria-disabled={disabled || undefined}
        style={{ display: "block", width: "100%", height: "auto", touchAction: "none", cursor: disabled ? "default" : "pointer", userSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        <circle cx={VIEW.cx} cy={VIEW.cy} r={RING.outer} fill="none" stroke={COLOR.line} strokeWidth={3} />
        <circle cx={VIEW.cx} cy={VIEW.cy} r={RING.dashed} fill="none" stroke={COLOR.line} strokeWidth={2} strokeDasharray="7 9" />
        <path ref={glowRef} data-wheel-trace-glow fill="none" stroke={COLOR.picked} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" opacity={0.18} />
        <path ref={pathRef} data-wheel-trace fill="none" stroke={COLOR.picked} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />

        <g
          data-wheel-hub
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Shuffle the letters"
          style={{ cursor: "pointer", outline: "none" }}
          onClick={shuffle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); shuffle(); } }}
        >
          <circle cx={VIEW.cx} cy={VIEW.cy} r={28} fill={COLOR.muted} stroke={COLOR.line} strokeWidth={2} />
          <g ref={hubRef}>
            <path d={`M${VIEW.cx - 9} ${VIEW.cy - 2}a9 9 0 0 1 15-6M${VIEW.cx + 9} ${VIEW.cy + 2}a9 9 0 0 1-15 6`} fill="none" stroke={COLOR.ink} strokeWidth={3} strokeLinecap="round" />
            <path d={`M${VIEW.cx + 5} ${VIEW.cy - 10}l2 4-4 1z`} fill={COLOR.ink} />
            <path d={`M${VIEW.cx - 5} ${VIEW.cy + 10}l-2-4 4-1z`} fill={COLOR.ink} />
          </g>
        </g>

        {tiles.map((t, i) => {
          const at = picked.indexOf(i);
          const on = at >= 0;
          const rest = layout[order.indexOf(i)] ?? { x: VIEW.cx, y: VIEW.cy };
          return (
            <g
              key={`${wordKey}:${i}`}
              ref={(el) => { tileRefs.current[i] = el; }}
              data-wheel-tile={i}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`${display(t)}${on ? `, chosen ${ordinal(at + 1)}` : ""}${highlight === i ? ", suggested" : ""}`}
              aria-pressed={on}
              transform={motionOK ? undefined : `translate(${rest.x.toFixed(1)} ${rest.y.toFixed(1)})`}
              style={{ outline: "none" }}
              onKeyDown={onTileKey(i)}
              onFocus={() => setFocusTile(i)}
              onBlur={() => setFocusTile((f) => (f === i ? null : f))}
            >
              {focusTile === i && <circle r={r + 7} fill="none" stroke={COLOR.picked} strokeWidth={3} />}
              {highlight === i && !on && <circle data-wheel-hint r={r + 9} fill="none" stroke={COLOR.good} strokeWidth={3} strokeDasharray="6 5" />}
              <g ref={(el) => { scaleRefs.current[i] = el; }} transform={motionOK ? undefined : `scale(${on ? 1.08 : 1})`}>
                <circle r={r} fill={on ? COLOR.picked : COLOR.muted} stroke={on ? COLOR.pickedEdge : COLOR.edge} strokeOpacity={on ? 1 : 0.45} strokeWidth={3} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  y={script === "khmer" ? -4 : 2}
                  fill={on ? "#fff" : COLOR.ink}
                  fontSize={script === "khmer" ? 26 : 30}
                  fontWeight={script === "khmer" ? 600 : 800}
                  fontFamily={font}
                  aria-hidden="true"
                >
                  {display(t)}
                </text>
                {on && (
                  <g aria-hidden="true">
                    <circle cx={r - 9} cy={-(r - 9)} r={12} fill={COLOR.picked} stroke="#fff" strokeWidth={2} />
                    <text x={r - 9} y={-(r - 10)} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={13} fontWeight={800}>{at + 1}</text>
                  </g>
                )}
              </g>
            </g>
          );
        })}
      </svg>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, minHeight: 48, marginTop: 4 }}>
        {picked.length > 0 && !dragging && (
          <>
            <button type="button" onClick={startOver} disabled={disabled} style={btn(false)}>Start over</button>
            {picked.length >= Math.max(1, minTiles) && (
              <button type="button" onClick={submit} disabled={disabled} style={btn(true)}>Check</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const btn = (primary: boolean): CSSProperties => ({
  minHeight: 44, minWidth: 96, padding: "8px 18px", borderRadius: 999, font: "inherit", fontWeight: 800, cursor: "pointer",
  border: `2px solid ${primary ? COLOR.picked : COLOR.line}`,
  background: primary ? COLOR.picked : COLOR.muted,
  color: primary ? "#fff" : COLOR.ink,
});

export default LetterWheel;
