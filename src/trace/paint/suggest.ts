/**
 * Suggested colour steps for a black-and-white page, from the AI.
 *
 * The model sees the line art with every part lightly tinted and numbered,
 * and answers with steps: a colour, the part numbers, and words for the child.
 * Its answer is checked here, not trusted: unknown or repeated parts are
 * dropped, a colour that is neither a crayon nor a hex becomes the nearest
 * crayon or is skipped, and steps left with no parts are dropped.
 */

import type { PaintStep, Point } from "../geometry/types";
import { tutorHeaders } from "../../lib/tutorApi";
import type { Areas } from "./areas";
import { GRID, SPECK } from "./grid";
import { isColour } from "./palette";
import { insidePoints } from "./picture";

/** Parts this small are not numbered: too small to label, they join a neighbour when children play. */
const LABELLED = SPECK * 2;
const MAX_PARTS = 160;

export interface SuggestPart {
  id: number;
  label: number;
  at: Point;
  size: number;
}

/** The parts worth naming, biggest first, numbered 1…n. */
export function partsToName(areas: Areas): SuggestPart[] {
  const chosen = areas.sizes
    .map((size, label) => ({ size, label }))
    .filter((p) => p.size >= LABELLED)
    .sort((a, b) => b.size - a.size)
    .slice(0, MAX_PARTS);
  const points = insidePoints(areas, chosen.map((p) => p.label));
  return chosen.map((p, i) => ({ id: i + 1, label: p.label, at: points.get(p.label)!, size: p.size }));
}

/** The model's answer → steps the Studio can use. Pure, and safe on any input. */
export function stepsFromSuggestion(raw: unknown, parts: SuggestPart[], newId: () => string): PaintStep[] {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const used = new Set<number>();
  const out: PaintStep[] = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    const color = typeof s?.color === "string" ? s.color.trim().toLowerCase() : "";
    if (!isColour(color)) continue;
    const seeds = (Array.isArray(s?.parts) ? s.parts : []).flatMap((n: unknown) => {
      const p = byId.get(Number(n));
      if (!p || used.has(p.id)) return [];
      used.add(p.id);
      return [p.at];
    });
    if (seeds.length === 0) continue;
    const words = typeof s?.instruction === "string" ? s.instruction.trim().slice(0, 120) : "";
    out.push({ id: newId(), color, seeds, ...(words ? { instruction: words } : {}) });
  }
  return out;
}

/** The numbered picture the model looks at: line art, soft tints per part, and each part's number. */
export function suggestImage(areas: Areas, parts: SuggestPart[], lines: CanvasImageSource | null, strokes: (ctx: CanvasRenderingContext2D) => void): string {
  const S = 768;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  // Soft tints, so where one part ends and the next begins is plain.
  const layer = document.createElement("canvas");
  layer.width = layer.height = GRID;
  const lctx = layer.getContext("2d")!;
  const img = lctx.createImageData(GRID, GRID);
  const named = new Map(parts.map((p) => [p.label, p.id]));
  for (let i = 0; i < areas.labels.length; i++) {
    const id = named.get(areas.labels[i]);
    if (id === undefined) continue;
    const h = (id * 137.508) % 360;
    const [r, g, b] = hsl(h, 0.6, 0.88);
    img.data.set([r, g, b, 255], i * 4);
  }
  lctx.putImageData(img, 0, 0);
  ctx.drawImage(layer, 0, 0, S, S);
  if (lines) ctx.drawImage(lines, 0, 0, S, S);
  ctx.save();
  ctx.scale(S / 1000, S / 1000);
  strokes(ctx);
  ctx.restore();
  const k = S / 1000;
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of parts) {
    const x = p.at.x * k;
    const y = p.at.y * k;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111827";
    ctx.fillText(String(p.id), x, y + 0.5);
  }
  return c.toDataURL("image/png");
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export class SuggestError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Ask the AI. Throws a SuggestError with the server's code (not_a_trace_creator, no_ai_key, ai_failed, offline). */
export async function askForSteps(body: { image: string; parts: SuggestPart[]; title: string; language: "km" | "en" }): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch("/api/trace/colour-steps", {
      method: "POST",
      headers: await tutorHeaders(),
      signal: controller.signal,
      body: JSON.stringify({ image: body.image, title: body.title, language: body.language, parts: body.parts.map((p) => ({ id: p.id, x: p.at.x, y: p.at.y, size: p.size })) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new SuggestError(data?.error?.code ?? data?.code ?? `http_${res.status}`);
    }
    return (await res.json()).steps;
  } catch (e) {
    if (e instanceof SuggestError) throw e;
    throw new SuggestError("offline");
  } finally {
    clearTimeout(timer);
  }
}
