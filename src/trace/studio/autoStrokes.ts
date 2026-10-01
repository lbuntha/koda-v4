/**
 * Starter strokes: from an item's guide (its typed letter or uploaded picture)
 * to numbered, editable strokes.
 *
 * Free, on the device: draw the guide as black and white, thin it to a centre
 * line, cut that into pieces, and number them in reading order. Paid
 * (`trace.ai`): show a model the pieces and let it put them in the order and
 * direction a child is taught. Either way the result is a draft the creator
 * shapes and tests — a model drafts, a person decides.
 */

import { request } from "../../lib/sync";
import { accessToken } from "../../lib/sync/session";
import { tutorHeaders } from "../../lib/tutorApi";
import { polylineLength } from "../geometry/polyline";
import type { Stroke, TraceItem } from "../geometry/types";
import type { Mask, Piece, StrokePlanEntry } from "../geometry/vectorize";
import { cleanPlan, pieces as toPieces, readingOrder, strokesFromPlan } from "../geometry/vectorize";

export type Source = "glyph" | "image";

const SIZE = 256;
const FONT = '"Noto Sans Khmer", "Kantumruy Pro", system-ui, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Otsu's threshold: the grey that best splits a picture into ink and paper. */
function otsu(lum: Uint8ClampedArray | number[]): number {
  const hist = new Array(256).fill(0);
  for (const v of lum) hist[Math.round(v)]++;
  const total = lum.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  return [c, ctx];
}

function toMask(ctx: CanvasRenderingContext2D, threshold?: number): Mask {
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const lum = new Uint8ClampedArray(SIZE * SIZE);
  for (let i = 0; i < lum.length; i++) lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  const t = threshold ?? otsu(lum);
  const on = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < lum.length; i++) on[i] = lum[i] < t ? 1 : 0;
  return { w: SIZE, h: SIZE, on };
}

/** The guide as a black-and-white mask, or null when there is no such guide. */
export async function rasterizeGuide(item: TraceItem, source: Source): Promise<Mask | null> {
  const k = SIZE / 1000;
  const [, ctx] = canvas();
  if (source === "glyph") {
    const g = item.guide?.glyph;
    if (!g?.text) return null;
    const px = g.size * k;
    try {
      await document.fonts.load(`${px}px ${FONT}`, g.text);
    } catch {
      /* draws with a fallback font */
    }
    ctx.fillStyle = "#000000";
    ctx.font = `${px}px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    // Left-aligned at the centred position, so the base letter alone lands in the same place.
    const width = ctx.measureText(g.text).width;
    const left = g.x * k - width / 2;
    ctx.textAlign = "left";
    ctx.fillText(g.text, left, g.y * k);
    const mask = toMask(ctx, 128);
    // A mark (vowel, foot) is typed on its letter so its place shows; trace only the mark.
    if (item.kind === "mark" && item.carrier?.text && g.text.startsWith(item.carrier.text) && g.text.length > item.carrier.text.length) {
      const [, base] = canvas();
      base.fillStyle = "#000000";
      base.font = ctx.font;
      base.textBaseline = "alphabetic";
      base.textAlign = "left";
      base.fillText(item.carrier.text, left, g.y * k);
      const carrier = toMask(base, 128);
      // Remove the letter, with a pixel to spare so its edge does not stay behind.
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          let near = 0;
          for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = carrier.on[(y + dy) * SIZE + (x + dx)] ?? 0;
          if (near) mask.on[y * SIZE + x] = 0;
        }
    }
    return mask;
  }
  const im = item.guide?.image;
  if (!im?.src) return null;
  const img = await loadImage(im.src);
  // The Studio shows the picture with "meet": whole picture, centred in its box.
  const scale = Math.min(im.w / img.width, im.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (im.x + (im.w - w) / 2) * k, (im.y + (im.h - h) / 2) * k, w * k, h * k);
  return toMask(ctx);
}

const COLORS = ["#e0245e", "#2563eb", "#059669", "#7c3aed", "#db2777", "#0891b2", "#4f46e5", "#16a34a"];

/** What the model looks at: the guide in grey, every piece in colour with its number. */
export function overlayPng(mask: Mask, list: Piece[]): string {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  const cell = S / mask.w;
  ctx.fillStyle = "#d9d9d9";
  for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) if (mask.on[y * mask.w + x]) ctx.fillRect(x * cell, y * cell, cell, cell);
  const k = S / 1000;
  list.forEach((p, i) => {
    const color = COLORS[i % COLORS.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    p.points.forEach((q, j) => (j ? ctx.lineTo(q.x * k, q.y * k) : ctx.moveTo(q.x * k, q.y * k)));
    ctx.stroke();
    const mid = p.points[Math.floor(p.points.length / 2)];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mid.x * k, mid.y * k, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(p.id), mid.x * k, mid.y * k + 1);
  });
  return c.toDataURL("image/png");
}

/** May this creator use the AI? Asked once when the Studio opens a tool that offers it. */
export async function canUseAi(): Promise<boolean> {
  try {
    const token = (await accessToken()) ?? null;
    return (await request<{ allowed: boolean }>("/trace/studio/ai", { token, timeoutMs: 6_000 })).allowed;
  } catch {
    return false;
  }
}

export class AiStrokesError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function aiOrder(item: TraceItem, mask: Mask, list: Piece[]): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch("/api/trace/stroke-order", {
      method: "POST",
      headers: await tutorHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        image: overlayPng(mask, list),
        title: item.title,
        kind: item.kind,
        script: item.script,
        pieces: list.map((p) => ({
          id: p.id,
          start: [Math.round(p.points[0].x), Math.round(p.points[0].y)],
          end: [Math.round(p.points[p.points.length - 1].x), Math.round(p.points[p.points.length - 1].y)],
          length: polylineLength(p.points),
          closed: p.closed,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AiStrokesError(body?.code ?? body?.error?.code ?? `http_${res.status}`);
    }
    return (await res.json()).strokes;
  } catch (e) {
    if (e instanceof AiStrokesError) throw e;
    throw new AiStrokesError("offline");
  } finally {
    clearTimeout(timer);
  }
}

export interface AutoResult {
  strokes: Stroke[];
  /** The AI ordered them (false: reading order). */
  usedAi: boolean;
  /** Why the AI was not used, when it was asked for. */
  aiError?: string;
  pieceCount: number;
}

/**
 * Make starter strokes for an item. With `useAi`, a failed or refused AI call
 * falls back to reading order and says why — the creator always gets a draft.
 */
export async function autoStrokes(item: TraceItem, { source, useAi, newId }: { source: Source; useAi: boolean; newId(): string }): Promise<AutoResult | null> {
  const mask = await rasterizeGuide(item, source);
  if (!mask) return null;
  const list = toPieces(mask);
  if (list.length === 0) return { strokes: [], usedAi: false, pieceCount: 0 };
  let plan: StrokePlanEntry[] = readingOrder(list);
  let usedAi = false;
  let aiError: string | undefined;
  if (useAi) {
    try {
      plan = cleanPlan(await aiOrder(item, mask, list), list);
      usedAi = true;
    } catch (e) {
      aiError = e instanceof AiStrokesError ? e.code : "failed";
    }
  }
  return { strokes: strokesFromPlan(list, plan, newId), usedAi, aiError, pieceCount: list.length };
}
