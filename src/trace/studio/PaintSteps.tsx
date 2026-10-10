/**
 * Trace Studio, colouring items: the steps a child colours the line art in.
 *
 * The line art is the item's strokes (traced over the photo on the Line art
 * tab). Here the author adds steps, gives each a crayon and the words read to
 * the child, and taps the areas each step colours — tap an area again to take
 * it out, or tap another step's area to move it. "Try it" plays the item
 * exactly as a child would, saving nothing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Pipette, Play, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { useT } from "../../lib/i18n";
import { UIButton } from "../../components/ui";
import { strokePolyline } from "../geometry/bezier";
import type { PaintStep, Point, TraceItem } from "../geometry/types";
import { hasArt } from "../geometry/types";
import { areaColours, fittedPixels, insidePoints, loadImage, stepsFromColours } from "../paint/picture";
import { fillLeftovers } from "../paint/leftovers";
import { SuggestError, askForSteps, partsToName, stepsFromSuggestion, suggestImage } from "../paint/suggest";
import { canUseAi } from "./autoStrokes";
import { strokePolyline as polylineOf } from "../geometry/bezier";
import { GRID, LINE, areaAt, labelAreas, seamSources, owners, stepAreas } from "../paint/areas";
import { ColorPlayer } from "../paint/ColorPlayer";
import { PALETTE, colourName, crayonHex, customColours, isCustom, rgb } from "../paint/palette";
import type { History } from "./ui";
import { IconButton, Section, UndoRedo, inputCls } from "./ui";

/** The magic brush's radius, in units. */
const BRUSH = 14;

const uid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function PaintSteps({ item, onChange, history }: { item: TraceItem; onChange(next: TraceItem): void; history: History }) {
  const { t } = useT();
  const steps = useMemo(() => item.paint?.steps ?? [], [item.paint]);
  const [sel, setSel] = useState<number | null>(steps.length ? 0 : null);
  const [trying, setTrying] = useState(false);
  const [showPhoto, setShowPhoto] = useState(true);
  const [hover, setHover] = useState(-1);
  /** The magic brush: brush over white bits to join them to the selected step. */
  const [magic, setMagic] = useState(false);
  const [brushed, setBrushed] = useState<Set<number> | null>(null);
  const [noColours, setNoColours] = useState(false);
  const areas = useMemo(() => labelAreas(item), [item.strokes, item.paint?.picture?.walls]); // eslint-disable-line react-hooks/exhaustive-deps -- areas follow the line art only
  const sources = useMemo(() => seamSources(areas), [areas]);
  const own = useMemo(() => owners(areas, steps), [areas, steps]);
  const selected = sel !== null ? steps[sel] : undefined;
  /** Small unowned parts that border a step's part: the slivers left white between two coloured parts. */
  const filled = useMemo(() => fillLeftovers(areas, steps), [areas, steps]);
  const slivers = useMemo(() => {
    const before = new Set([...owners(areas, steps)].flatMap((o, l) => (o < 0 ? [l] : [])));
    const after = owners(areas, filled.steps);
    return new Set([...before].filter((l) => after[l] >= 0));
  }, [areas, steps, filled]);

  const setSteps = (next: PaintStep[]) => onChange({ ...item, paint: { ...item.paint, steps: next } });
  const editStep = (k: number, patch: Partial<PaintStep>) => setSteps(steps.map((s, i) => (i === k ? { ...s, ...patch } : s)));
  const addStep = () => {
    const used = new Set(steps.map((s) => s.color));
    const color = PALETTE.find((c) => !used.has(c.id))?.id ?? PALETTE[0].id;
    setSteps([...steps, { id: uid(), color, seeds: [] }]);
    setSel(steps.length);
  };
  const removeStep = (k: number) => {
    setSteps(steps.filter((_, i) => i !== k));
    setSel(steps.length > 1 ? Math.max(0, Math.min(k, steps.length - 2)) : null);
  };
  const moveStep = (k: number, d: -1 | 1) => {
    const j = k + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[k], next[j]] = [next[j], next[k]];
    setSteps(next);
    setSel(j);
  };

  /* ------------------------------------------------- AI suggestion */
  const [aiAllowed, setAiAllowed] = useState<boolean | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void canUseAi().then((ok) => live && setAiAllowed(ok));
    return () => {
      live = false;
    };
  }, []);
  /** Ask the AI what each part is and its colour; its steps replace these (the author edits from there). */
  const suggest = async () => {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const parts = partsToName(areas);
      const smooth = item.paint?.picture?.smooth;
      const image = suggestImage(areas, parts, smooth ? null : linesImg, (ctx) => {
        if (!smooth && item.paint?.picture) return;
        ctx.strokeStyle = "#1f2544";
        ctx.lineWidth = LINE;
        ctx.lineCap = ctx.lineJoin = "round";
        for (const st of item.strokes) {
          ctx.beginPath();
          polylineOf(st).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
          if (st.closed) ctx.closePath();
          ctx.stroke();
        }
      });
      const made = stepsFromSuggestion(await askForSteps({ image, parts, title: item.title, language: item.script === "khmer" ? "km" : "en" }), parts, uid);
      if (made.length === 0) throw new SuggestError("empty");
      setSteps(made);
      setSel(0);
    } catch (e) {
      setSuggestError(e instanceof SuggestError ? e.code : "ai_failed");
    } finally {
      setSuggesting(false);
    }
  };

  /** One step per colour of the uploaded picture — for a coloured example. */
  const fromColours = async () => {
    const src = item.guide?.image?.src;
    if (!src) return;
    const px = fittedPixels(await loadImage(src));
    const made = stepsFromColours(areaColours(px, areas), areas, uid);
    setNoColours(made.length === 0);
    if (made.length === 0) return;
    setSteps(made);
    setSel(0);
  };

  /** Parts under a brush dab that the selected step may take: white ones and its own, never another step's. */
  const partsUnder = (p: Point): number[] => {
    const r = BRUSH / (1000 / GRID);
    const cx = (p.x / 1000) * GRID;
    const cy = (p.y / 1000) * GRID;
    const found = new Set<number>();
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(GRID - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(GRID - 1, Math.ceil(cx + r)); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
        const l = areas.labels[y * GRID + x];
        if (l >= 0 && (own[l] < 0 || own[l] === sel)) found.add(l);
      }
    }
    return [...found];
  };
  const brushDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* brush without capture */
    }
    setBrushed(new Set(partsUnder(toUnits(e))));
  };
  const brushMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!brushed) return;
    const more = partsUnder(toUnits(e)).filter((l) => !brushed.has(l));
    if (more.length) setBrushed(new Set([...brushed, ...more]));
  };
  /** Join everything brushed to the selected step. Lines are never touched: they are not parts. */
  const brushUp = () => {
    const joined = brushed;
    setBrushed(null);
    if (!joined || sel === null || !selected) return;
    const fresh = [...joined].filter((l) => own[l] !== sel);
    if (fresh.length) {
      const points = insidePoints(areas, fresh);
      editStep(sel, { seeds: [...selected.seeds, ...fresh.map((l) => points.get(l)!)] });
    }
  };

  /** Tap an area: add it to the selected step, take it out, or move it from another step. */
  const tap = (p: Point) => {
    const l = areaAt(areas, p);
    if (l < 0) return;
    const owner = own[l];
    if (sel === null || !selected) {
      if (owner >= 0) setSel(owner);
      return;
    }
    const without = (s: PaintStep) => ({ ...s, seeds: s.seeds.filter((q) => areaAt(areas, q) !== l) });
    if (owner === sel) return setSteps(steps.map((s, i) => (i === sel ? without(s) : s)));
    setSteps(steps.map((s, i) => (i === sel ? { ...without(s), seeds: [...without(s).seeds, { x: Math.round(p.x), y: Math.round(p.y) }] } : owner === i ? without(s) : s)));
  };

  /* ------------------------------------------------------------ canvas */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photo = item.guide?.image;
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const linesSrc = item.paint?.picture?.lines;
  const [linesImg, setLinesImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let live = true;
    if (!linesSrc) setLinesImg(null);
    else void loadImage(linesSrc).then((img) => live && setLinesImg(img));
    return () => {
      live = false;
    };
  }, [linesSrc]);
  useEffect(() => {
    if (!photo?.src) {
      setPhotoImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => setPhotoImg(img);
    img.src = photo.src;
  }, [photo?.src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || trying) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.height = Math.round(canvas.clientWidth * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const k = canvas.width / 1000;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (photoImg && photo && showPhoto && !photo.hidden) {
        // Fitted inside its box, as the Studio and the line finder place it.
        const f = Math.min((photo.w * k) / photoImg.naturalWidth, (photo.h * k) / photoImg.naturalHeight);
        const w = photoImg.naturalWidth * f;
        const h = photoImg.naturalHeight * f;
        ctx.globalAlpha = 0.3;
        ctx.drawImage(photoImg, photo.x * k + (photo.w * k - w) / 2, photo.y * k + (photo.h * k - h) / 2, w, h);
        ctx.globalAlpha = 1;
      }
      // Areas: each step's in its crayon, the selected step's strongest, the hovered one tinted.
      const layer = document.createElement("canvas");
      layer.width = layer.height = GRID;
      const lctx = layer.getContext("2d")!;
      const img = lctx.createImageData(GRID, GRID);
      const colors = steps.map((s) => rgb(crayonHex(s.color)));
      for (let i = 0; i < areas.labels.length; i++) {
        const l = sources[i] >= 0 ? areas.labels[sources[i]] : -1;
        if (l < 0) continue;
        const o = own[l];
        // A sliver about to be left white shows in rose, so it is seen before a child finds it.
        const isBrushed = brushed?.has(l) && sel !== null;
        const c = isBrushed ? colors[sel!] : o >= 0 ? colors[o] : l === hover ? [79, 70, 229] : slivers.has(l) ? [244, 63, 94] : null;
        if (!c) continue;
        img.data[i * 4] = c[0];
        img.data[i * 4 + 1] = c[1];
        img.data[i * 4 + 2] = c[2];
        img.data[i * 4 + 3] = isBrushed ? 255 : o < 0 ? (slivers.has(l) && l !== hover ? 150 : 60) : sel === null || o === sel ? (l === hover ? 200 : 235) : 90;
      }
      lctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(layer, 0, 0, canvas.width, canvas.height);
      if (linesImg && !item.paint?.picture?.smooth) ctx.drawImage(linesImg, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.strokeStyle = "#1f2544";
      ctx.fillStyle = "#1f2544";
      ctx.lineWidth = LINE;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const s of item.strokes) {
        if (s.shape === "dot" || s.nodes.length === 1) {
          const n = s.nodes[0];
          if (!n) continue;
          ctx.beginPath();
          ctx.arc(n.x, n.y, (s.radius ?? 20) + LINE / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        ctx.beginPath();
        strokePolyline(s).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        if (s.closed) ctx.closePath();
        ctx.stroke();
      }
      // Each step's number on its first area, so the order reads at a glance.
      ctx.font = "bold 34px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      steps.forEach((s, i) => {
        const seed = s.seeds[0];
        if (!seed) return;
        ctx.beginPath();
        ctx.arc(seed.x, seed.y, 24, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = crayonHex(s.color);
        ctx.stroke();
        ctx.fillStyle = "#1f2544";
        ctx.fillText(String(i + 1), seed.x, seed.y + 1);
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [areas, sources, own, steps, sel, hover, item.strokes, photo, photoImg, linesImg, showPhoto, trying, slivers, brushed]);

  const toUnits = (e: React.PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1000, y: ((e.clientY - r.top) / r.height) * 1000 };
  };

  const empty = steps.flatMap((s, i) => (stepAreas(areas, s).size === 0 ? [i + 1] : []));

  if (trying) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <UIButton size="sm" variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setTrying(false)}>
            {t("traceStudio.paint.backToEdit")}
          </UIButton>
          <span className="text-sm text-muted">{t("traceStudio.paint.tryNote")}</span>
        </div>
        <ColorPlayer item={item} sandbox onExit={() => setTrying(false)} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span className={`min-w-0 flex-1 truncate text-sm ${selected ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-body"}`}>
            {!hasArt(item)
              ? t("traceStudio.paint.noLineArt")
              : selected
                ? magic
                  ? t("traceStudio.paint.magicHint", { n: (sel ?? 0) + 1 })
                  : t("traceStudio.paint.tapHint", { n: (sel ?? 0) + 1 })
                : t("traceStudio.paint.pickStep")}
          </span>
          <UndoRedo history={history} undoLabel={t("traceStudio.undo")} redoLabel={t("traceStudio.redo")} />
          <IconButton size="sm" label={t("traceStudio.paint.magicBrush")} active={magic} disabled={!hasArt(item)} onClick={() => setMagic((v) => !v)}>
            <Wand2 className="h-4 w-4" />
          </IconButton>
          {photo && (
            <IconButton size="sm" label={showPhoto ? t("traceStudio.paint.hidePhoto") : t("traceStudio.paint.showPhoto")} active={showPhoto} onClick={() => setShowPhoto((v) => !v)} tip="bottom-end">
              {showPhoto ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </IconButton>
          )}
        </div>
        <div className="mx-auto w-full max-w-[640px] p-3">
          <canvas
            ref={canvasRef}
            aria-label={t("traceStudio.paint.canvas")}
            className="block aspect-square w-full touch-none rounded-xl ring-1 ring-line"
            style={{ cursor: selected ? (magic ? "crosshair" : "copy") : "pointer" }}
            onPointerDown={(e) => (magic && selected ? brushDown(e) : tap(toUnits(e)))}
            onPointerMove={(e) => (brushed ? brushMove(e) : setHover(areaAt(areas, toUnits(e))))}
            onPointerUp={brushUp}
            onPointerCancel={brushUp}
            onPointerLeave={() => setHover(-1)}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <ol className="flex flex-col gap-2 rounded-2xl bg-indigo-50/60 p-4 text-sm text-body dark:bg-indigo-950/30">
          {(["how1", "how2", "how3"] as const).map((k, i) => (
            <li key={k} className="flex items-start gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">{i + 1}</span>
              <span>{t(`traceStudio.paint.${k}`)}</span>
            </li>
          ))}
        </ol>
        {/* Suggested steps: the AI names the parts and their colours; a coloured example gives its own colours */}
        {hasArt(item) && (
          <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
              {t("traceStudio.paint.suggestTitle")}
            </span>
            <UIButton size="sm" icon={<Sparkles className="h-4 w-4" />} onClick={() => void suggest()} isLoading={suggesting} disabled={!aiAllowed || suggesting}>
              {suggesting ? t("traceStudio.paint.suggesting") : steps.length ? t("traceStudio.paint.suggestAgain") : t("traceStudio.paint.suggest")}
            </UIButton>
            <p className={`text-xs ${suggestError ? "text-rose-700 dark:text-rose-300" : "text-muted"}`}>
              {suggestError
                ? t(`traceStudio.paint.suggestError.${["not_a_trace_creator", "no_ai_key", "offline", "empty", "plan_required"].includes(suggestError) ? suggestError : "ai_failed"}`)
                : aiAllowed === false
                  ? t("traceStudio.paint.suggestNotAllowed")
                  : t("traceStudio.paint.suggestHint")}
            </p>
            {item.guide?.image && (
              <>
                <UIButton size="sm" variant="secondary" onClick={() => void fromColours()}>
                  {steps.length ? t("traceStudio.paint.replaceFromColours") : t("traceStudio.paint.fromColours")}
                </UIButton>
                <p className="text-xs text-muted">{noColours ? t("traceStudio.paint.noColours") : t("traceStudio.paint.fromColoursHint")}</p>
              </>
            )}
          </div>
        )}
        <Section title={t("traceStudio.paint.steps")} aside={t("traceStudio.paint.stepCount", { count: steps.length })}>
          {steps.length === 0 ? (
            <p className="text-sm text-muted">{t("traceStudio.paint.noSteps")}</p>
          ) : (
            <ol className="-mx-2 flex flex-col gap-1">
              {steps.map((s, i) => {
                const isSel = i === sel;
                const count = stepAreas(areas, s).size;
                return (
                  <li key={s.id} className={`rounded-xl px-2 py-1.5 ${isSel ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-900" : "hover:bg-surface-muted"}`}>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setSel(isSel ? null : i)} className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white shadow-sm" style={{ background: crayonHex(s.color) }}>
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-black/25">{i + 1}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{s.instruction?.trim() || (isCustom(s.color) ? s.color.toUpperCase() : t(`paint.color.${s.color}`))}</span>
                          <span className={`block text-xs ${count === 0 ? "text-rose-700 dark:text-rose-300" : "text-muted"}`}>{t("traceStudio.paint.areaCount", { count })}</span>
                        </span>
                      </button>
                      <span className={`flex gap-0.5 ${isSel ? "" : "opacity-0 [li:hover_&]:opacity-100"}`}>
                        <IconButton size="sm" label={t("traceStudio.moveUp")} disabled={i === 0} onClick={() => moveStep(i, -1)}>
                          <ChevronUp className="h-4 w-4" />
                        </IconButton>
                        <IconButton size="sm" label={t("traceStudio.moveDown")} disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}>
                          <ChevronDown className="h-4 w-4" />
                        </IconButton>
                        <IconButton size="sm" tone="danger" label={t("traceStudio.delete")} onClick={() => removeStep(i)} tip="bottom-end">
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </span>
                    </div>
                    {isSel && (
                      <div className="flex flex-col gap-3 px-1 pb-1.5 pt-2.5">
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("traceStudio.paint.crayon")}>
                          {[...PALETTE.map((c) => ({ id: c.id, hex: c.hex, label: t(`paint.color.${c.id}`) })), ...customColours(steps).map((hex) => ({ id: hex, hex, label: hex.toUpperCase() }))].map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              role="radio"
                              aria-checked={s.color === c.id}
                              aria-label={c.label}
                              title={c.label}
                              onClick={() => editStep(i, { color: c.id })}
                              className={`h-7 w-7 rounded-full ring-1 ring-black/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${s.color === c.id ? "ring-[3px] !ring-indigo-500 ring-offset-2 ring-offset-surface" : "hover:scale-110"}`}
                              style={{ background: c.hex }}
                            />
                          ))}
                          {/* Any colour: the system picker, opened from a swatch-sized button. */}
                          <label
                            title={t("traceStudio.paint.custom")}
                            className={`relative grid h-7 w-7 cursor-pointer place-items-center rounded-full text-muted ring-1 ring-line transition focus-within:ring-2 focus-within:ring-indigo-500 hover:scale-110 hover:text-ink ${isCustom(s.color) ? "bg-surface" : "bg-surface-muted"}`}
                          >
                            <Pipette className="h-3.5 w-3.5" />
                            <input
                              type="color"
                              aria-label={t("traceStudio.paint.custom")}
                              value={crayonHex(s.color)}
                              onChange={(e) => editStep(i, { color: e.target.value.toLowerCase() })}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                          </label>
                        </div>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t("traceStudio.paint.words")}</span>
                          <input
                            className={inputCls}
                            value={s.instruction ?? ""}
                            placeholder={t("paint.colourThis", { color: colourName(t, s.color) })}
                            onChange={(e) => editStep(i, { instruction: e.target.value || undefined })}
                          />
                        </label>
                        {count > 0 && (
                          <UIButton size="sm" variant="ghost" onClick={() => editStep(i, { seeds: [] })}>
                            {t("traceStudio.paint.clearAreas")}
                          </UIButton>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="flex flex-wrap gap-2">
            <UIButton size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addStep} disabled={!hasArt(item)}>
              {t("traceStudio.paint.addStep")}
            </UIButton>
            <UIButton size="sm" icon={<Play className="h-4 w-4" />} onClick={() => setTrying(true)} disabled={steps.length === 0 || empty.length > 0}>
              {t("traceStudio.paint.try")}
            </UIButton>
          </div>
          {filled.placed > 0 && (
            <div className="flex flex-col gap-1.5 rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
              <p className="text-xs text-rose-800 dark:text-rose-200">{t("traceStudio.paint.sliversNote", { count: filled.placed })}</p>
              <UIButton size="sm" variant="secondary" icon={<Sparkles className="h-4 w-4" />} onClick={() => setSteps(filled.steps)}>
                {t("traceStudio.paint.fillSlivers", { count: filled.placed })}
              </UIButton>
            </div>
          )}
          {empty.length > 0 && <p className="text-xs text-rose-700 dark:text-rose-300">{t("traceStudio.paint.emptySteps", { steps: empty.join(", ") })}</p>}
        </Section>
        <p className="px-1 text-xs text-muted">{t("traceStudio.paint.howScored")}</p>
      </div>
    </div>
  );
}
