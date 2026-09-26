/**
 * Book recordings on this device.
 *
 * A clip's id is the SHA-256 of its bytes, so a clip never changes: once it is in
 * the cache it is right for ever. Clips are fetched when a book page opens, so a
 * book opened once online reads aloud on the bus.
 *
 * Everything here fails quietly. A clip that cannot be fetched is simply not
 * played, and the device voice reads the sentence instead.
 */

import { API_BASE } from "../lib/sync";
import { accessToken } from "../lib/sync/session";
import type { Passage } from "./data/passage";

const CACHE = "koda-library-audio-v1";
const urls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

const cacheKey = (id: string) => `/library-audio/${id}`;

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

/** A playable URL for a clip, or null if it is not reachable now. */
export function clipUrl(id: string): Promise<string | null> {
  const known = urls.get(id);
  if (known) return Promise.resolve(known);
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const job = (async () => {
    let blob = await fromCache(id);
    if (!blob) {
      try {
        const token = await accessToken();
        const res = await fetch(`${API_BASE}/library/audio/${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) return null;
        blob = await res.blob();
        if (blob.size === 0) return null;
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

/** Every recording a book points at. */
export const clipsOf = (p: Pick<Passage, "sentences" | "wordAudio">): string[] =>
  [...new Set([...p.sentences.map((s) => s.audio).filter((x): x is string => !!x), ...Object.values(p.wordAudio ?? {})])];

/** Prepare a known set of recordings and report whether each one is playable. */
export async function prefetchClips(ids: readonly string[]): Promise<{ ready: number; total: number }> {
  const unique = [...new Set(ids)];
  const got = await Promise.all(unique.map((id) => clipUrl(id)));
  return { ready: got.filter(Boolean).length, total: unique.length };
}

/** Fetch a book's recordings now, so it reads aloud offline later. Resolves to how many are ready. */
export async function prefetchBook(p: Pick<Passage, "sentences" | "wordAudio">): Promise<{ ready: number; total: number }> {
  return prefetchClips(clipsOf(p));
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
