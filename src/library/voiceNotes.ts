/**
 * A child reading aloud, recorded and sent to their grown-ups.
 *
 * The child's side is a small state machine — record, listen back, send or try
 * again — kept here rather than in the reader so the reader only draws it. The
 * parent's side is four calls: list, play, mark heard, delete. The server checks
 * who may do each (`server/app/routers/voice_notes.py`); a child's session is the
 * only one that can send, so a message is always from the child it names.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "../lib/sync";
import { API_BASE } from "../lib/sync";
import { accessToken } from "../lib/sync/session";

/** The longest one message may run. Stopped for the child when it is reached. */
export const MAX_RECORDING_MS = 4 * 60 * 1000;
/** Speech, not music: small enough that four minutes uploads on a weak connection. */
const BITRATE = 32_000;

export interface VoiceNote {
  id: string;
  learnerId: string;
  bookId: string;
  bookTitle: string;
  pages: number[];
  durationMs: number;
  createdAt: string;
  heard: boolean;
}

const token = async () => (await accessToken()) ?? null;

/** Can this browser record at all? Asked before a microphone button is drawn. */
export const canRecordVoice = (): boolean =>
  typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** The format this browser records best: MP4 on Safari, Opus elsewhere. */
function recordingType(): string | undefined {
  const isSupported = window.MediaRecorder.isTypeSupported?.bind(window.MediaRecorder);
  if (!isSupported) return undefined;
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) => isSupported(type));
}

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function sendVoiceNote(recording: Blob, book: { id: string; title: string }, pages: number[], durationMs: number): Promise<VoiceNote> {
  return request<VoiceNote>("/library/voice-notes", {
    method: "POST",
    token: await token(),
    timeoutMs: 120_000,
    body: {
      mime: (recording.type || "audio/webm").split(";")[0],
      data: await toBase64(recording),
      bookId: book.id,
      bookTitle: book.title,
      pages,
      durationMs: Math.round(durationMs),
    },
  });
}

export async function listVoiceNotes(learnerId: string): Promise<{ notes: VoiceNote[]; unheard: number }> {
  return request(`/library/voice-notes?learnerId=${encodeURIComponent(learnerId)}`, { token: await token() });
}

/** A message's audio, as a URL an `<audio>` can play. The caller revokes it. */
export async function voiceNoteUrl(id: string): Promise<string> {
  const auth = await token();
  const res = await fetch(`${API_BASE}/library/voice-notes/${encodeURIComponent(id)}/audio`, {
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });
  if (!res.ok) throw new Error(String(res.status));
  return URL.createObjectURL(await res.blob());
}

export async function markVoiceNoteHeard(id: string): Promise<void> {
  await request(`/library/voice-notes/${encodeURIComponent(id)}/heard`, { method: "POST", token: await token() });
}

export async function deleteVoiceNote(id: string): Promise<void> {
  await request(`/library/voice-notes/${encodeURIComponent(id)}`, { method: "DELETE", token: await token() });
}

export type VoiceStage = "idle" | "asking" | "recording" | "review" | "sending" | "sent" | "failed" | "blocked";

/**
 * Record, listen back, send.
 *
 * `page` is the page on screen; every page shown while recording is noted, so a
 * parent reads "pages 2–4" rather than a bare recording. A recording stops by
 * itself at `MAX_RECORDING_MS`. Leaving the reader stops the microphone and
 * throws the recording away.
 */
export function useVoiceNote(book: { id: string; title: string }, page: number) {
  const [stage, setStage] = useState<VoiceStage>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; startedAt: number; timer: ReturnType<typeof setInterval> } | null>(null);
  const take = useRef<{ blob: Blob; durationMs: number; pages: number[] } | null>(null);
  const pages = useRef<Set<number>>(new Set());
  const live = useRef(true);
  const urlRef = useRef<string | null>(null);

  const setPlayable = (next: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    setUrl(next);
  };

  useEffect(() => {
    if (stage === "recording" && page > 0) pages.current.add(page);
  }, [stage, page]);

  // A reading recorded but not yet sent is easy to lose: one tap on Back, or a
  // closed tab. The tab gets the browser's own "Leave site?"; the reader asks
  // its own question (see `BookReader`).
  const unsent = stage === "asking" || stage === "recording" || stage === "review" || stage === "sending" || stage === "failed";
  useEffect(() => {
    if (!unsent) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsent]);

  const release = () => {
    const r = rec.current;
    if (!r) return;
    clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    rec.current = null;
  };

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      const r = rec.current;
      if (r) {
        r.mr.onstop = null;
        if (r.mr.state !== "inactive") r.mr.stop();
      }
      release();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const stop = useCallback(() => {
    const r = rec.current;
    if (r && r.mr.state !== "inactive") r.mr.stop();
  }, []);

  const start = async () => {
    if (rec.current) return;
    setError("");
    setPlayable(null);
    take.current = null;
    setStage("asking");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      if (live.current) setStage("blocked");
      return;
    }
    if (!live.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const type = recordingType();
    const mr = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: BITRATE });
    const parts: BlobPart[] = [];
    mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    mr.onstop = () => {
      const r = rec.current;
      const durationMs = r ? Date.now() - r.startedAt : 0;
      release();
      if (!live.current) return;
      const blob = new Blob(parts, { type: (mr.mimeType || type || "audio/webm").split(";")[0] });
      if (!blob.size) {
        setStage("idle");
        return;
      }
      take.current = { blob, durationMs, pages: [...pages.current].sort((a, b) => a - b) };
      setPlayable(URL.createObjectURL(blob));
      setElapsed(durationMs);
      setStage("review");
    };
    pages.current = new Set(page > 0 ? [page] : []);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const ms = Date.now() - startedAt;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) stop();
    }, 250);
    rec.current = { mr, stream, startedAt, timer };
    setElapsed(0);
    // A chunk a second, so a phone that kills the page mid-read has kept most of it.
    mr.start(1000);
    setStage("recording");
  };

  const discard = () => {
    take.current = null;
    setPlayable(null);
    setElapsed(0);
    setStage("idle");
  };

  /** Send the take. True once it is on the server. */
  const send = async (): Promise<boolean> => {
    const t = take.current;
    if (!t) return false;
    setStage("sending");
    setError("");
    try {
      await sendVoiceNote(t.blob, book, t.pages, t.durationMs);
      if (!live.current) return true;
      take.current = null;
      setPlayable(null);
      setStage("sent");
      setTimeout(() => live.current && setStage((s) => (s === "sent" ? "idle" : s)), 3500);
      return true;
    } catch (e) {
      if (!live.current) return false;
      setError(e instanceof Error ? e.message : "");
      setStage("failed");
      return false;
    }
  };

  return { stage, elapsed, url, error, unsent, start, stop, discard, send, again: start, dismiss: () => setStage("idle") };
}

export type VoiceNoteRecorder = ReturnType<typeof useVoiceNote>;

/** 75000 → "1:15". */
export const clock = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
