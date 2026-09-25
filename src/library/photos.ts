/**
 * Photos in books: uploaded by an author, kept on each device for offline.
 *
 * A photo is named in a book as `photo-<id>`, anywhere a picture key goes — the
 * cover or a page. The id is the SHA-256 of the stored bytes (the server
 * computes it), so a photo never changes and a cached copy is right for ever.
 *
 * Before upload a photo is shrunk in the browser to at most 1600px on its long
 * side and re-saved as JPEG: a phone photo is 3–8 MB and a book page needs a
 * fraction of that, and a child on a slow connection downloads what we send.
 *
 * Reading fails quietly: a photo that cannot be fetched is drawn as the plain
 * book picture, never as a broken image.
 */

import { API_BASE } from "../lib/sync";
import { accessToken } from "../lib/sync/session";
import type { Passage } from "./data/passage";

export const PHOTO_PREFIX = "photo-";
const CACHE = "koda-library-photos-v1";
const LONG_SIDE = 1600;
const QUALITY = 0.85;

const urls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export const isPhoto = (key: string | null | undefined): key is string => !!key && key.startsWith(PHOTO_PREFIX);
export const photoId = (key: string) => key.slice(PHOTO_PREFIX.length);
const cacheKey = (id: string) => `/library-photos/${id}`;

async function fromCache(id: string): Promise<Blob | null> {
  try {
    if (typeof caches === "undefined") return null;
    const hit = await (await caches.open(CACHE)).match(cacheKey(id));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

async function toCache(id: string, blob: Blob) {
  try {
    if (typeof caches === "undefined") return;
    await (await caches.open(CACHE)).put(cacheKey(id), new Response(blob, { headers: { "Content-Type": blob.type } }));
  } catch {
    /* storage full: it shows this time, and is fetched again next time */
  }
}

/** A displayable URL for a photo key, or null if it is not reachable now. */
export function photoUrl(key: string): Promise<string | null> {
  const id = photoId(key);
  const known = urls.get(id);
  if (known) return Promise.resolve(known);
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const job = (async () => {
    let blob = await fromCache(id);
    if (!blob) {
      try {
        const token = await accessToken();
        const res = await fetch(`${API_BASE}/library/images/${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) return null;
        blob = await res.blob();
        await toCache(id, blob);
      } catch {
        return null;
      }
    }
    const url = URL.createObjectURL(blob);
    urls.set(id, url);
    return url;
  })().finally(() => pending.delete(id));
  pending.set(id, job);
  return job;
}

/** A photo URL already in memory, for a first render without a flash. */
export const knownPhotoUrl = (key: string): string | null => urls.get(photoId(key)) ?? null;

/** What a book might hold a photo in: the cover, a page, or a word's picture. */
type PhotoHolder = Pick<Passage, "picture" | "sentences"> & Partial<Pick<Passage, "pictures">>;

/**
 * Every photo a book shows: its cover, any page's picture, and any word's.
 *
 * A word's picture is in `pictures` and can be a photo like any other — a
 * Words question whose answer is a photograph of a mango. Leaving those out
 * meant the studio never offered one back for reuse, and `prefetchPhotos` left
 * it behind, so the question drew an empty frame on a bus with no signal.
 */
export const photosOf = (p: PhotoHolder): string[] =>
  [...new Set([p.picture, ...p.sentences.map((s) => s.picture), ...Object.values(p.pictures ?? {})].filter(isPhoto))];

/** Fetch a book's photos now, so it shows them offline later. */
export async function prefetchPhotos(p: PhotoHolder): Promise<{ ready: number; total: number }> {
  const keys = photosOf(p);
  const got = await Promise.all(keys.map((k) => photoUrl(k)));
  return { ready: got.filter(Boolean).length, total: keys.length };
}

/** The file types an author may choose. HEIC and friends are shrunk to JPEG where the browser can read them. */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

/** Shrink a photo to LONG_SIDE and re-save it as JPEG, upright. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot prepare photos.");
  ctx.fillStyle = "#fff"; // a transparent PNG becomes white, not black, as JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const out = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", QUALITY));
  if (!out) throw new Error("The photo could not be prepared.");
  return out;
}

/** Shrink and upload a photo. Authors only; the server checks. Resolves to its picture key. */
export async function uploadPhoto(file: Blob): Promise<string> {
  let blob: Blob;
  try {
    blob = await shrinkPhoto(file);
  } catch {
    throw new Error("That file could not be read as a photo. Try a JPEG or PNG.");
  }
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const token = await accessToken();
  const res = await fetch(`${API_BASE}/library/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ mime: blob.type || "image/jpeg", data: btoa(bin) }),
  });
  const body = (await res.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null;
  if (!res.ok || !body?.id) throw new Error(body?.error?.message ?? "The photo could not be uploaded.");
  urls.set(body.id, URL.createObjectURL(blob));
  await toCache(body.id, blob);
  return PHOTO_PREFIX + body.id;
}
