/**
 * Reading a story aloud, under the same rules as every skill.
 *
 * The rules come from the skill SDK, restated for a module that is not a skill:
 * yield while the live voice coach holds the floor; honour the learner's own
 * "Koda's Voice" switch; a recorded clip first; then the server's voice; then the
 * device's.
 *
 * Khmer is the exception and deliberately so. Neither the server voice nor most
 * devices can read Khmer, and a Khmer sentence read by an English voice is noise
 * a child will try to imitate. So Khmer is only spoken from a recording or a
 * device voice that is actually Khmer — and `canSpeak` says so up front, so a page
 * can leave out a speaker button rather than show one that stays silent.
 */

import { playClip, stopClip, voiceFloorHeld } from "../lib/voiceClips";
import { tutorHeaders } from "../lib/tutorApi";
import { isVoiceEnabled, playBase64Pcm, speakWebSpeech } from "../utils/audio";
import type { Language, Passage, Sentence } from "./data/passage";
import { clipUrl } from "./clips";

const SERVER_TIMEOUT_MS = 4_000;

function deviceVoiceFor(lang: Language): SpeechSynthesisVoice | null {
  try {
    const want = lang === "km" ? "km" : "en";
    return window.speechSynthesis?.getVoices().find((v) => v.lang.toLowerCase().startsWith(want)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether this language can be read aloud here, and if not, why — so a page can
 * say "Koda's voice is off" rather than blame the device for a switch the family
 * turned off themselves.
 */
export function voiceStatus(lang: Language): "ok" | "off" | "no-voice" {
  if (!isVoiceEnabled()) return "off";
  return lang === "en" || deviceVoiceFor("km") !== null ? "ok" : "no-voice";
}

/** Whether anything can read this language aloud on this device right now. */
export const canSpeak = (lang: Language): boolean => voiceStatus(lang) === "ok";

async function serverVoice(text: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
  try {
    const res = await fetch("/api/tutor/speech", {
      method: "POST",
      headers: await tutorHeaders(),
      body: JSON.stringify({ text, voice: "Kore" }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { audio?: string };
    return data.audio ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let playing: HTMLAudioElement | null = null;
let playingFrame: number | null = null;
let audioElement: HTMLAudioElement | null = null;
let finishPlaying: ((played: boolean) => void) | null = null;

/** One configured media element is reused so iOS keeps playback permission between sentences. */
function recordingPlayer(): HTMLAudioElement {
  const player = audioElement ?? (audioElement = new Audio());
  player.preload = "auto";
  player.setAttribute("playsinline", "");
  return player;
}

/** Play a book recording. Resolves true when it played to the end, false if it could not play. */
async function playRecording(clipId: string, onTime?: (elapsedMs: number | null, durationMs?: number) => void): Promise<boolean> {
  const url = await clipUrl(clipId);
  if (!url) return false;
  return new Promise<boolean>((resolve) => {
    try {
      // Mobile Safari is much more reliable when a reader reuses one media
      // element for a sequence of clips instead of creating one per sentence.
      const a = recordingPlayer();
      a.pause();
      a.src = url;
      a.currentTime = 0;
      a.load();
      playing = a;
      let settled = false;
      const finish = (played: boolean) => {
        if (settled) return;
        settled = true;
        if (finishPlaying === finish) finishPlaying = null;
        if (playing === a) playing = null;
        if (playingFrame !== null) cancelAnimationFrame(playingFrame);
        playingFrame = null;
        onTime?.(null);
        resolve(played);
      };
      finishPlaying = finish;
      const follow = () => {
        onTime?.(a.currentTime * 1000, Number.isFinite(a.duration) ? a.duration * 1000 : undefined);
        if (!a.paused && !a.ended) playingFrame = requestAnimationFrame(follow);
      };
      a.onended = () => finish(true);
      a.onerror = () => finish(false);
      a.onpause = () => finish(false);
      void a.play().then(follow).catch(() => finish(false));
    } catch {
      resolve(false);
    }
  });
}

/** Whether this sentence can be read aloud here: its own recording, or a voice for its language. */
export const sentenceSpeaks = (book: Pick<Passage, "language">, s: Pick<Sentence, "audio">): boolean =>
  !!s.audio || (isVoiceEnabled() && canSpeak(book.language));

/** Whether a book has anything that can be read aloud, for "Read to me". */
export const bookSpeaks = (book: Pick<Passage, "language" | "sentences">): boolean =>
  book.sentences.some((s) => sentenceSpeaks(book, s));

/**
 * Say `text`. A book's own recording comes first when `clipId` is given; then the
 * voices below. Resolves when it has been said, or at once if it will not be.
 * Never rejects.
 */
export async function say(text: string, lang: Language, clipId?: string, onTime?: (elapsedMs: number | null, durationMs?: number) => void): Promise<void> {
  if (!text || voiceFloorHeld()) return;
  stop();
  if (clipId && (await playRecording(clipId, onTime))) return;
  if (!isVoiceEnabled()) return;

  let done!: () => void;
  const finished = new Promise<void>((resolve) => (done = resolve));
  if (playClip(text, 1, done)) return finished;

  if (lang === "km") {
    const v = deviceVoiceFor("km");
    if (!v) return;
    return new Promise<void>((resolve) => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = v;
        u.lang = v.lang;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });
  }

  const audio = await serverVoice(text);
  if (audio) {
    const source = playBase64Pcm(audio);
    if (source) return new Promise<void>((resolve) => (source.onended = () => resolve()));
  }
  return new Promise<void>((resolve) => {
    speakWebSpeech(text, 0.95, resolve);
  });
}

export function stop() {
  if (playingFrame !== null) cancelAnimationFrame(playingFrame);
  playingFrame = null;
  const current = playing;
  const finish = finishPlaying;
  finishPlaying = null;
  finish?.(false);
  try {
    current?.pause();
  } catch {
    /* already stopped */
  }
  playing = null;
  stopClip();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* no speech engine */
  }
}
