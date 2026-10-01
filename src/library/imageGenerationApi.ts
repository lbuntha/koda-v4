import { tutorHeaders } from "../lib/tutorApi";
import { BANNER, PORTRAIT, type PictureKind } from "./pictureShape";
import { translate } from "../lib/i18n";

/**
 * A real (raster) picture for a book, from a prompt.
 *
 * The server never returns exactly a banner's or a portrait's ratio — neither
 * image API offers it — so what comes back is only ever *close*, and
 * `cropToShape` is what makes it exact before it becomes a page's picture.
 */

export type ImageProvider = "gemini" | "openai";
/** The look of a made picture. The description says what; this says how. */
export type ImageStyle = "3d" | "flat" | "painted";

async function reasonFrom(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

/** One picture, close to `kind`'s shape but not yet exactly it. Throws the server's reason when it cannot. */
export async function generateBookImage(prompt: string, kind: PictureKind, provider: ImageProvider, style: ImageStyle = "painted"): Promise<Blob> {
  const res = await fetch(`/api/library/image/${provider}`, {
    method: "POST",
    headers: await tutorHeaders(),
    body: JSON.stringify({ prompt, kind, style }),
  });
  if (!res.ok) throw new Error(await reasonFrom(res, translate("studio.picture.makeFailedRetry")));
  const blob = await res.blob();
  if (!blob.size) throw new Error(translate("studio.picture.noneBack"));
  return blob;
}

export interface BriefOptions {
  provider: ImageProvider;
  mode: "svg" | "image";
  kind: PictureKind;
  /** The subject alone — no people or animals unless they are the subject. */
  subjectOnly: boolean;
  /** Draw it as it looks in Cambodia. */
  cambodia: boolean;
}

/** A short description ("សាលា", "a school") rewritten as a full brief for the picture models. */
export async function improvePicturePrompt(text: string, options: BriefOptions): Promise<string> {
  const res = await fetch("/api/library/image/prompt", {
    method: "POST",
    headers: await tutorHeaders(),
    body: JSON.stringify({ text, ...options }),
  });
  if (!res.ok) throw new Error(await reasonFrom(res, translate("studio.picture.improveFailedRetry")));
  const body = (await res.json().catch(() => null)) as { prompt?: string } | null;
  if (!body?.prompt) throw new Error(translate("studio.picture.nothingBack"));
  return body.prompt;
}

export interface CropRect {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/**
 * The rectangle to cut from a `w`×`h` image to reach `target` (width ÷
 * height), centred, without ever growing past the source.
 *
 * Neither Imagen nor ChatGPT will hand back precisely a 2:1 banner or a 3:4
 * portrait — the closest they offer is always a little more square than we
 * asked for. So the longer side is trimmed evenly from both ends until the
 * ratio is exact, and the untouched side sets the size: a picture only ever
 * gets smaller here, never stretched or padded, which is what would happen if
 * a landscape shot were forced onto a portrait canvas. Kept as plain numbers,
 * apart from the canvas work, so the arithmetic can be tested without a screen.
 */
export function cropRect(w: number, h: number, target: number): CropRect {
  const ratio = w / h;
  const width = ratio > target ? Math.round(h * target) : w;
  const height = ratio > target ? h : Math.round(w / target);
  return { sx: Math.round((w - width) / 2), sy: Math.round((h - height) / 2), width, height };
}

/** Crop an image to exactly a shape's ratio, centred, never upscaled. See `cropRect`. */
export async function cropToShape(blob: Blob, kind: PictureKind): Promise<Blob> {
  const shape = kind === "portrait" ? PORTRAIT : BANNER;
  const bitmap = await createImageBitmap(blob);
  const { sx, sy, width, height } = cropRect(bitmap.width, bitmap.height, shape.width / shape.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(translate("studio.picture.browserCannotPictures"));
  ctx.drawImage(bitmap, sx, sy, width, height, 0, 0, width, height);
  bitmap.close?.();
  const out = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  if (!out) throw new Error(translate("studio.picture.prepareFailed"));
  return out;
}
