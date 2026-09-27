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
/**
 * How big a stored photo is, and how it is encoded.
 *
 * Both measured against a real book's pictures rather than chosen by feel. A
 * page's picture is never drawn wider than the reader itself — about 400pt
 * across a phone, 700 beside the words on a computer — so 1200 covers a phone at
 * three times the pixel density and a computer at nearly two, and 1600 was
 * paying for detail no screen ever showed. On one book's photographs that alone
 * took a 373 KB picture to 217 KB.
 *
 * WebP takes it to 178 KB — less than half — for the same picture at the same
 * size. It is not assumed to exist: both encodings are made and the smaller one
 * that is genuinely what it claims to be wins, so a browser that quietly answers
 * a WebP request with a PNG (which is what the standard says it may do) cannot
 * make a book's pictures *larger* without anybody noticing.
 */
const LONG_SIDE = 1200;
const QUALITY = 0.82;
/** How long one photo may take before the device gives up on it. */
const PHOTO_TIMEOUT_MS = 20_000;
/** How many are asked for at once. A phone on a weak link does worse with more. */
const AT_A_TIME = 3;
/** How many times a photo is asked for before it is left for the next visit. */
const ATTEMPTS = 3;
/** The wait before asking again, doubling each time. */
const RETRY_BACKOFF_MS = 400;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** A device that knows it is offline says so; one that does not know is assumed online. */
const offline = (): boolean => typeof navigator !== "undefined" && navigator.onLine === false;

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

/**
 * One attempt at the network, with a deadline.
 *
 * The answer says whether asking again is worth anything: a dropped connection
 * or a server having a moment is, a photo the server says it does not have is
 * not. The same rule the recordings follow, for the same reason — this app is
 * used on a connection that drops, and a request with no deadline leaves a page
 * waiting on it for ever.
 */
async function download(id: string): Promise<{ blob: Blob } | "gone" | "again"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHOTO_TIMEOUT_MS);
  try {
    const token = await accessToken();
    const res = await fetch(`${API_BASE}/library/images/${encodeURIComponent(id)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    if (!res.ok) return res.status >= 500 ? "again" : "gone";
    const blob = await res.blob();
    return blob.size > 0 ? { blob } : "gone";
  } catch {
    return "again";
  } finally {
    clearTimeout(timer);
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
      for (let attempt = 0; attempt < ATTEMPTS && !blob; attempt++) {
        if (attempt > 0) {
          if (offline()) break;
          await sleep(RETRY_BACKOFF_MS * 2 ** (attempt - 1));
        }
        const got = await download(id);
        if (got === "gone") return null;
        if (got !== "again") blob = got.blob;
      }
      if (!blob) return null;
      await toCache(id, blob);
    }
    const url = URL.createObjectURL(blob);
    urls.set(id, url);
    return url;
  })().finally(() => pending.delete(id));
  pending.set(id, job);
  return job;
}

/** Whether a photo is already on this device — in hand, or saved from a past visit. */
export async function photoSaved(key: string): Promise<boolean> {
  const id = photoId(key);
  return urls.has(id) || (await fromCache(id)) !== null;
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

/**
 * Fetch a book's photos now, so it shows them offline later.
 *
 * A few at a time, in the order the book uses them, so the cover and the first
 * page are on the device while the last page is still coming — and so a phone is
 * not asked to hold a dozen downloads open at once on a link that struggles with
 * three. `onProgress` is called as each one lands.
 */
export async function prefetchPhotos(p: PhotoHolder, onProgress?: (p: { ready: number; total: number }) => void): Promise<{ ready: number; total: number }> {
  const keys = photosOf(p);
  const total = keys.length;
  let ready = 0;
  let next = 0;
  const worker = async () => {
    while (next < keys.length) {
      if (await photoUrl(keys[next++])) ready++;
      onProgress?.({ ready, total });
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_A_TIME, total) }, worker));
  return { ready, total };
}

/** The file types an author may choose. HEIC and friends are shrunk to JPEG where the browser can read them. */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

/** Shrink a photo to LONG_SIDE and re-encode it as small as it will honestly go, upright. */
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
  return smallestOf(canvas);
}

/**
 * The smallest honest encoding of what is on the canvas.
 *
 * A browser asked for a format it cannot write does not say so — the standard
 * has it quietly answer with a PNG instead, which for a photograph is several
 * times *larger* than the JPEG it replaced. So neither format is assumed: both
 * are written, anything that came back as something other than what was asked
 * for is discarded, and the smaller of what remains wins. The cost is one extra
 * encode on the author's own machine; what it buys is that no child ever
 * downloads a PNG of a photograph because their author's browser was older than
 * the code that chose the format for them.
 */
async function smallestOf(canvas: HTMLCanvasElement): Promise<Blob> {
  const encode = (type: string) =>
    new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, QUALITY)).then((blob) =>
      blob && blob.type === type && blob.size > 0 ? blob : null,
    );
  const candidates = (await Promise.all([encode("image/webp"), encode("image/jpeg")])).filter(
    (blob): blob is Blob => blob !== null,
  );
  const best = candidates.sort((a, b) => a.size - b.size)[0];
  if (!best) throw new Error("The photo could not be prepared.");
  return best;
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
