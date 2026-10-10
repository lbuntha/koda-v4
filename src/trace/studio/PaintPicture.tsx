/**
 * Trace Studio, colouring items: the picture. The author uploads a colouring
 * page (black lines) or a coloured example; Koda finds its lines and the parts
 * between them, shown here each in its own soft tint so a missing line (two
 * parts run together) is easy to see. Line strength moves the cut between
 * line and paper; extra lines can be drawn to close a gap.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Eraser, Eye, ImageUp, PenLine, RefreshCw, Trash2, Undo2, Wand2 } from "lucide-react";
import { useT } from "../../lib/i18n";
import { UIButton } from "../../components/ui";
import type { EraseMark, Point, TraceItem } from "../geometry/types";
import { GRID, labelAreas, seamSources } from "../paint/areas";
import { strokePolyline } from "../geometry/bezier";
import { LINE } from "../paint/areas";
import { DEFAULT_GAP, DEFAULT_STRENGTH, SPECK, smoothLines, fittedPixels, loadImage, partCount, pictureFrom, readFile } from "../paint/picture";
import type { History } from "./ui";
import { IconButton, Section, Slider, UndoRedo } from "./ui";

const uid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Eraser radius, in units. */
const ERASE = { xs: 4, s: 10, m: 22, l: 45 } as const;

/** A soft tint per part, the same each time for the same part. */
function tint(label: number): [number, number, number] {
  const h = (label * 137.508) % 360;
  const s = 0.55;
  const l = 0.86;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function PaintPicture({ item, onChange, history, onDrawLines, onNext }: { item: TraceItem; onChange(next: TraceItem): void; history: History; onDrawLines(): void; onNext(): void }) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const picture = item.paint?.picture;
  const original = item.guide?.image?.src;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [strength, setStrength] = useState(picture?.strength ?? DEFAULT_STRENGTH);
  const [gap, setGap] = useState(picture?.gap ?? DEFAULT_GAP);
  // An undo can bring back other settings: the sliders follow the picture.
  useEffect(() => {
    if (picture) {
      setStrength(picture.strength);
      setGap(picture.gap ?? 0);
    }
  }, [picture?.strength, picture?.gap]); // eslint-disable-line react-hooks/exhaustive-deps -- the settings only
  const pixelsRef = useRef<{ src: string; px: Uint8ClampedArray } | null>(null);
  const itemRef = useRef(item);
  itemRef.current = item;

  const pixelsOf = async (src: string) => {
    if (pixelsRef.current?.src !== src) pixelsRef.current = { src, px: fittedPixels(await loadImage(src)) };
    return pixelsRef.current.px;
  };

  /** Find the lines again at this strength, and keep them on the item. */
  const rebuild = async (src: string, s: number, g: number, base: TraceItem, erase: EraseMark[] = base.paint?.picture?.erase ?? []) => {
    const px = await pixelsOf(src);
    const picture = pictureFrom(px, s, g, erase);
    // Smooth lines stay smooth: the magic pen redraws them from the new lines.
    if (base.paint?.picture?.smooth) onChange({ ...base, strokes: smoothLines(picture.walls, uid), paint: { steps: base.paint.steps, picture: { ...picture, smooth: true } } });
    else onChange({ ...base, paint: { steps: base.paint?.steps ?? [], picture } });
  };

  // A slider settles before the lines are found again.
  useEffect(() => {
    if (!original || !picture || (strength === picture.strength && gap === (picture.gap ?? 0))) return;
    const h = window.setTimeout(() => void rebuild(original, strength, gap, itemRef.current), 180);
    return () => window.clearTimeout(h);
  }, [strength, gap]); // eslint-disable-line react-hooks/exhaustive-deps -- only the sliders trigger this

  const upload = async (file: File) => {
    setBusy(true);
    setError(false);
    try {
      const src = await readFile(file);
      const base: TraceItem = { ...item, guide: { ...item.guide, image: { src, x: 0, y: 0, w: 1000, h: 1000, opacity: 0.5 } } };
      setStrength(DEFAULT_STRENGTH);
      setGap(DEFAULT_GAP);
      await rebuild(src, DEFAULT_STRENGTH, DEFAULT_GAP, base, []);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  /** The magic pen: the picture's lines redrawn as smooth strokes (replacing any drawn ones). */
  const smoothOn = () => {
    if (!picture) return;
    onChange({ ...item, strokes: smoothLines(picture.walls, uid), paint: { steps: item.paint?.steps ?? [], picture: { ...picture, smooth: true } } });
  };
  const smoothOff = () => {
    if (!picture) return;
    onChange({ ...item, strokes: [], paint: { steps: item.paint?.steps ?? [], picture: { ...picture, smooth: false } } });
  };

  /* ------------------------------------------------------------ eraser */
  const [erasing, setErasing] = useState(false);
  const [eraseSize, setEraseSize] = useState<keyof typeof ERASE>("s");
  const marks = picture?.erase ?? [];
  const setMarks = (next: EraseMark[]) => original && void rebuild(original, strength, gap, itemRef.current, next);
  const rubRef = useRef<Point[] | null>(null);
  const toUnits = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.round(((e.clientX - r.left) / r.width) * 1000), y: Math.round(((e.clientY - r.top) / r.height) * 1000) };
  };
  /** Show the rub as it happens: white over the preview, before the lines are found again. */
  const rubDab = (canvas: HTMLCanvasElement, a: Point, b: Point) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const k = canvas.width / 1000;
    ctx.save();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = ERASE[eraseSize] * 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  };
  const rubDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!erasing || showOriginal) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* paint without capture */
    }
    const p = toUnits(e);
    rubRef.current = [p];
    rubDab(e.currentTarget, p, p);
  };
  const rubMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pts = rubRef.current;
    if (!pts) return;
    const p = toUnits(e);
    rubDab(e.currentTarget, pts[pts.length - 1], p);
    pts.push(p);
  };
  const rubUp = () => {
    const pts = rubRef.current;
    rubRef.current = null;
    if (pts) setMarks([...marks, { r: ERASE[eraseSize], points: pts }]);
  };

  const remove = () => {
    const { image: _i, ...guide } = item.guide ?? {};
    onChange({ ...item, guide, paint: { steps: item.paint?.steps ?? [] } });
  };

  const areas = useMemo(() => (picture || item.strokes.length ? labelAreas(item) : null), [item.strokes, picture?.walls]); // eslint-disable-line react-hooks/exhaustive-deps -- parts follow the line art only
  const sources = useMemo(() => (areas ? seamSources(areas) : new Int32Array(0)), [areas]);
  const parts = areas ? partCount(areas) : 0;

  /* ------------------------------------------------------------ preview */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<{ lines?: HTMLImageElement; original?: HTMLImageElement }>({});
  useEffect(() => {
    let live = true;
    void Promise.all([picture ? loadImage(picture.lines) : undefined, original ? loadImage(original) : undefined]).then(([lines, orig]) => live && setImages({ lines, original: orig }));
    return () => {
      live = false;
    };
  }, [picture?.lines, original]); // eslint-disable-line react-hooks/exhaustive-deps -- the images only

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !areas) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.height = Math.round(canvas.clientWidth * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, W);
      if (showOriginal && images.original) {
        const img = images.original;
        const k = Math.min(W / img.naturalWidth, W / img.naturalHeight);
        ctx.drawImage(img, (W - img.naturalWidth * k) / 2, (W - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
        return;
      }
      const layer = document.createElement("canvas");
      layer.width = layer.height = GRID;
      const lctx = layer.getContext("2d")!;
      const data = lctx.createImageData(GRID, GRID);
      const colours = areas.sizes.map((size, l) => (size >= SPECK ? tint(l) : null));
      for (let i = 0; i < areas.labels.length; i++) {
        const l = sources[i] >= 0 ? areas.labels[sources[i]] : -1;
        const c = l >= 0 ? colours[l] : null;
        if (!c) continue;
        data.data.set([c[0], c[1], c[2], 255], i * 4);
      }
      lctx.putImageData(data, 0, 0);
      ctx.drawImage(layer, 0, 0, W, W);
      ctx.imageSmoothingEnabled = true;
      if (picture?.smooth) {
        // Smoothed: the strokes are the line art, drawn as the child will see them.
        const k = W / 1000;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.strokeStyle = ctx.fillStyle = "#1f2544";
        ctx.lineWidth = LINE;
        ctx.lineCap = ctx.lineJoin = "round";
        for (const s of item.strokes) {
          const pts = strokePolyline(s);
          ctx.beginPath();
          if (pts.length === 1) {
            ctx.arc(pts[0].x, pts[0].y, (s.radius ?? 20) + LINE / 2, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }
          pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          if (s.closed) ctx.closePath();
          ctx.stroke();
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      } else if (images.lines) ctx.drawImage(images.lines, 0, 0, W, W);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [areas, sources, images, showOriginal, picture?.smooth, item.strokes]);

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) void upload(f);
      }}
    />
  );

  if (!picture) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 rounded-3xl border-2 border-dashed border-line bg-surface px-6 py-12 text-center">
        {fileInput}
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
          <ImageUp className="h-8 w-8" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-ink">{t("traceStudio.picture.emptyTitle")}</h2>
          <p className="max-w-md text-sm text-muted">{t("traceStudio.picture.emptyText")}</p>
        </div>
        <ul className="grid w-full max-w-md gap-2 text-left text-sm text-body sm:grid-cols-2">
          <li className="rounded-2xl bg-surface-muted p-3">
            <span className="font-semibold text-ink">{t("traceStudio.picture.kindLines")}</span>
            <span className="mt-0.5 block text-xs text-muted">{t("traceStudio.picture.kindLinesNote")}</span>
          </li>
          <li className="rounded-2xl bg-surface-muted p-3">
            <span className="font-semibold text-ink">{t("traceStudio.picture.kindColour")}</span>
            <span className="mt-0.5 block text-xs text-muted">{t("traceStudio.picture.kindColourNote")}</span>
          </li>
        </ul>
        <UIButton icon={<ImageUp className="h-4 w-4" />} onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? t("traceStudio.picture.reading") : t("traceStudio.picture.upload")}
        </UIButton>
        {error && <p className="text-sm text-rose-700 dark:text-rose-300">{t("traceStudio.picture.error")}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      {fileInput}
      <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center gap-1 border-b border-line px-3 py-2">
          <span className={`min-w-0 flex-1 truncate text-sm ${erasing ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-body"}`}>
            {showOriginal ? t("traceStudio.picture.original") : erasing ? t("traceStudio.picture.eraseHint") : t("traceStudio.picture.partsHint")}
          </span>
          {erasing && (
            <>
              <div className="flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5" role="radiogroup" aria-label={t("traceStudio.picture.eraseSize")}>
                {(Object.keys(ERASE) as (keyof typeof ERASE)[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={eraseSize === k}
                    aria-label={t(`paint.sizes.${k}`)}
                    title={t(`paint.sizes.${k}`)}
                    onClick={() => setEraseSize(k)}
                    className={`grid h-7 w-7 place-items-center rounded-md ${eraseSize === k ? "bg-surface shadow-sm" : ""}`}
                  >
                    <span className="rounded-full bg-ink" style={{ width: 3 + ERASE[k] / 4, height: 3 + ERASE[k] / 4 }} />
                  </button>
                ))}
              </div>
              <IconButton size="sm" label={t("traceStudio.picture.eraseUndo")} disabled={marks.length === 0} onClick={() => setMarks(marks.slice(0, -1))}>
                <Undo2 className="h-4 w-4" />
              </IconButton>
            </>
          )}
          <UndoRedo history={history} undoLabel={t("traceStudio.undo")} redoLabel={t("traceStudio.redo")} />
          <IconButton size="sm" label={t("traceStudio.picture.erase")} active={erasing} onClick={() => {
            setErasing((v) => !v);
            setShowOriginal(false);
          }}>
            <Eraser className="h-4 w-4" />
          </IconButton>
          <IconButton size="sm" label={t("traceStudio.picture.showOriginal")} active={showOriginal} onClick={() => setShowOriginal((v) => !v)} tip="bottom-end">
            <Eye className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="mx-auto w-full max-w-[640px] p-3">
          <canvas
            ref={canvasRef}
            aria-label={t("traceStudio.picture.preview")}
            className="block aspect-square w-full touch-none rounded-xl ring-1 ring-line"
            style={{ cursor: erasing && !showOriginal ? "crosshair" : "default" }}
            onPointerDown={rubDown}
            onPointerMove={rubMove}
            onPointerUp={rubUp}
            onPointerCancel={rubUp}
          />
          {marks.length > 0 && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">
              <Eraser className="h-3.5 w-3.5" />
              <span className="flex-1">{t("traceStudio.picture.erased", { count: marks.length })}</span>
              <button type="button" className="font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300" onClick={() => setMarks([])}>
                {t("traceStudio.picture.eraseClear")}
              </button>
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {/* The magic pen */}
        <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Wand2 className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
            {t("traceStudio.picture.magic")}
          </span>
          <p className="text-xs text-muted">{picture.smooth ? t("traceStudio.picture.magicOn") : t("traceStudio.picture.magicHint")}</p>
          {picture.smooth ? (
            <div className="flex flex-wrap gap-2">
              <UIButton size="sm" variant="secondary" icon={<PenLine className="h-4 w-4" />} onClick={onDrawLines}>
                {t("traceStudio.picture.magicEdit")}
              </UIButton>
              <UIButton size="sm" variant="ghost" icon={<Undo2 className="h-4 w-4" />} onClick={smoothOff}>
                {t("traceStudio.picture.magicOff")}
              </UIButton>
            </div>
          ) : (
            <UIButton size="sm" icon={<Wand2 className="h-4 w-4" />} onClick={smoothOn}>
              {t("traceStudio.picture.magicApply")}
            </UIButton>
          )}
        </div>
        <Section title={t("traceStudio.picture.title")} aside={t("traceStudio.picture.parts", { count: parts })}>
          <Slider label={t("traceStudio.picture.strength")} value={strength} min={70} max={230} step={5} onChange={setStrength} />
          <p className="text-xs text-muted">{t("traceStudio.picture.strengthHint")}</p>
          <Slider label={t("traceStudio.picture.gap")} value={gap} min={0} max={4} step={1} onChange={setGap} />
          <p className="text-xs text-muted">{t("traceStudio.picture.gapHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <UIButton size="sm" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => fileRef.current?.click()} disabled={busy}>
              {t("traceStudio.picture.replace")}
            </UIButton>
            <UIButton size="sm" variant="ghost" icon={<PenLine className="h-4 w-4" />} onClick={onDrawLines}>
              {item.strokes.length ? t("traceStudio.picture.editLines", { count: item.strokes.length }) : t("traceStudio.picture.drawLines")}
            </UIButton>
            <IconButton size="sm" tone="danger" label={t("traceStudio.picture.remove")} onClick={remove} tip="bottom-end">
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
          <p className="text-xs text-muted">{t("traceStudio.picture.drawLinesHint")}</p>
        </Section>
        <UIButton icon={<ArrowRight className="h-4 w-4" />} onClick={onNext}>
          {t("traceStudio.picture.next")}
        </UIButton>
      </div>
    </div>
  );
}
