import { tutorHeaders } from "../lib/tutorApi";
import { BANNER, PORTRAIT, type PictureKind } from "./pictureShape";

/**
 * A real (raster) picture for a book, from a prompt.
 *
 * The server never returns exactly a banner's or a portrait's ratio — neither
 * image API offers it — so what comes back is only ever *close*, and
 * `cropToShape` is what makes it exact before it becomes a page's picture.
 */

export type ImageProvider = "gemini" | "openai";

async function reasonFrom(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

/** One picture, close to `kind`'s shape but not yet exactly it. Throws the server's reason when it cannot. */
export async function generateBookImage(prompt: string, kind: PictureKind, provider: ImageProvider): Promise<Blob> {
  const res = await fetch(`/api/library/image/${provider}`, {
    method: "POST",
    headers: await tutorHeaders(),
    body: JSON.stringify({ prompt, kind }),
  });
  if (!res.ok) throw new Error(await reasonFrom(res, "The picture could not be made. Try again."));
  const blob = await res.blob();
  if (!blob.size) throw new Error("No picture came back. Try again.");
  return blob;
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
  if (!ctx) throw new Error("This browser cannot prepare pictures.");
  ctx.drawImage(bitmap, sx, sy, width, height, 0, 0, width, height);
  bitmap.close?.();
  const out = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  if (!out) throw new Error("The picture could not be prepared.");
  return out;
}
