/**
 * Book recordings on this device.
 *
 * A clip's id is the SHA-256 of its bytes, so a clip never changes: once it is in
 * the cache it is right for ever. That is the whole design — a book is slow the
 * first time it is opened and instant every time after, on the bus, in a power
 * cut, on a phone that has not seen the internet since.
 *
 * Getting it there is the hard part, because the connection this is written for
 * is not a fast one that occasionally drops: it is a slow one that drops
 * constantly. So every fetch has a deadline, because a request that hangs for
 * ever leaves a book saying "preparing audio" until the child gives up; they go
 * a few at a time, because forty at once on a phone is forty that all crawl; and
 * a clip that fails is tried again, because on this connection the first failure
 * means almost nothing. What arrives is kept, and a second attempt asks only for
 * what is still missing.
 *
 * Everything here still fails quietly. A clip that cannot be fetched is simply
 * not played, and the sentences that did arrive still read aloud.
 */

import { API_BASE } from "../lib/sync";
import { accessToken } from "../lib/sync/session";
import type { Passage } from "./data/passage";

const CACHE = "koda-library-audio-v1";
const urls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

/**
 * How long one clip may take before the device gives up on it.
 *
 * Generous next to the four seconds a sentence of text is allowed: a recording
 * is tens of kilobytes, and on a bad connection tens of kilobytes take a while.
 * What matters is that the number exists at all — without it a stalled request
 * never resolves, and a book waits on it for ever.
 */
const CLIP_TIMEOUT_MS = 20_000;
/** How many clips are asked for at once. A phone on a weak link does worse with more. */
const AT_A_TIME = 3;
/** How many times a clip is asked for before it is left for the next visit. */
const ATTEMPTS = 3;
/** The wait before asking again, doubling each time — a dropped link is often back by then. */
const RETRY_BACKOFF_MS = 400;

const cacheKey = (id: string) => `/library-audio/${id}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** A device that knows it is offline says so; one that does not know is assumed online. */
const offline = (): boolean => typeof navigator !== "undefined" && navigator.onLine === false;

/** Whether this browser reports support for the AAC-in-MP4 files stored by the library. */
export function recordingAudioSupported(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const probe = document.createElement("audio");
    return [
      'audio/mp4; codecs="mp4a.40.2"',
      "audio/mp4",
      "audio/x-m4a",
    ].some((mime) => probe.canPlayType(mime) !== "");
  } catch {
    return false;
  }
}

/** A clip that has already been fetched and can be assigned without another async step. */
export const cachedClipUrl = (id: string): string | null => urls.get(id) ?? null;

async function fromCache(id: string): Promise<Blob | null> {
  try {
    if (typeof caches === "undefined") return null;
    const hit = await (await caches.open(CACHE)).match(cacheKey(id));
    if (!hit) return null;
    const blob = await hit.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

async function toCache(id: string, blob: Blob) {
  try {
    if (typeof caches === "undefined") return;
    await (await caches.open(CACHE)).put(cacheKey(id), new Response(blob, { headers: { "Content-Type": blob.type } }));
  } catch {
    /* storage full: it plays this time, and is fetched again next time */
  }
}

/**
 * One attempt at the network, with a deadline.
 *
 * The answer says whether asking again is worth anything. A dropped connection
 * or a server having a moment is worth another try; a clip the server says it
 * does not have is not, and trying twice more only makes a child wait longer
 * for the same nothing.
 */
async function download(id: string): Promise<{ blob: Blob } | "gone" | "again"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIP_TIMEOUT_MS);
  try {
    const token = await accessToken();
    const res = await fetch(`${API_BASE}/library/audio/${encodeURIComponent(id)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    if (!res.ok) return res.status >= 500 ? "again" : "gone";
    const blob = await res.blob();
    return blob.size > 0 ? { blob } : "gone";
  } catch {
    // Refused, timed out, or the connection went away mid-answer.
    return "again";
  } finally {
    clearTimeout(timer);
  }
}

/** A playable URL for a clip, or null if it is not reachable now. */
export function clipUrl(id: string): Promise<string | null> {
  const known = urls.get(id);
  if (known) return Promise.resolve(known);
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const job = (async () => {
    let blob = await fromCache(id);
    if (!blob) {
      for (let attempt = 0; attempt < ATTEMPTS && !blob; attempt++) {
        if (attempt > 0) {
          // Asking again the instant a request failed only wastes the battery;
          // a device that knows it is offline should not ask again at all.
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

/** Whether a clip is already on this device — in hand, or saved from a past visit. */
export async function clipSaved(id: string): Promise<boolean> {
  return urls.has(id) || (await fromCache(id)) !== null;
}

/** Every recording a book points at. */
export const clipsOf = (p: Pick<Passage, "sentences" | "wordAudio">): string[] =>
  [...new Set([...p.sentences.map((s) => s.audio).filter((x): x is string => !!x), ...Object.values(p.wordAudio ?? {})])];

/** How a save is going, for a page that wants to show it. */
export interface ClipProgress {
  ready: number;
  total: number;
}

/**
 * Prepare a known set of recordings and report how many are playable.
 *
 * A few at a time, in the order given, so the sentences at the start of a book
 * are on the device before the ones at the end — a child reading page one does
 * not wait on page eight. `onProgress` is called as each one lands, so a slow
 * first save can show that it is moving rather than look stuck.
 */
export async function prefetchClips(ids: readonly string[], onProgress?: (p: ClipProgress) => void): Promise<ClipProgress> {
  const unique = [...new Set(ids)];
  const total = unique.length;
  let ready = 0;
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const url = await clipUrl(unique[next++]);
      if (url) ready++;
      onProgress?.({ ready, total });
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_A_TIME, total) }, worker));
  return { ready, total };
}

/** Fetch a book's recordings now, so it reads aloud offline later. Resolves to how many are ready. */
export async function prefetchBook(p: Pick<Passage, "sentences" | "wordAudio">, onProgress?: (p: ClipProgress) => void): Promise<ClipProgress> {
  return prefetchClips(clipsOf(p), onProgress);
}

/** Upload a recording. Authors only; the server checks. */
export async function uploadClip(blob: Blob): Promise<{ id: string; bytes: number }> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const token = await accessToken();
  const res = await fetch(`${API_BASE}/library/audio`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ mime: blob.type || "audio/wav", data: btoa(bin) }),
  });
  const body = (await res.json().catch(() => null)) as { id?: string; bytes?: number; error?: { message?: string } } | null;
  if (!res.ok || !body?.id || typeof body.bytes !== "number") throw new Error(body?.error?.message ?? "The recording could not be uploaded.");
  // Cache the normalized M4A returned by the server, not the larger source
  // WAV/WebM the author uploaded under the same content id.
  await clipUrl(body.id);
  return { id: body.id, bytes: body.bytes };
}

/** Stored byte sizes for authoring UI; missing clips are omitted. */
export async function clipSizes(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const token = await accessToken();
  const res = await fetch(`${API_BASE}/library/audio/sizes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ids: [...new Set(ids)] }),
  });
  const body = (await res.json().catch(() => null)) as { sizes?: Record<string, number> } | null;
  if (!res.ok || !body?.sizes) return {};
  return body.sizes;
}

/** 16-bit mono PCM, as the speech endpoint returns it, wrapped as a WAV file. */
export function pcmToWav(base64Pcm: string, sampleRate = 24_000): Blob {
  const pcm = Uint8Array.from(atob(base64Pcm), (c) => c.charCodeAt(0));
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, pcm.length, true);
  return new Blob([header, pcm], { type: "audio/wav" });
}
