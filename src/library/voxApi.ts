import { tutorHeaders } from "../lib/tutorApi";
import type { Language } from "./data/passage";

/**
 * Vox, a second source of voices for a book.
 *
 * Gemini has a handful of characters and no Khmer voice worth the name; Vox is a
 * self-hosted service with the voices an author makes for themselves — a Khmer
 * reader, a teacher's cloned voice. The browser never talks to it and never
 * holds its key: it asks this app's own server, which is the process that does.
 */

export interface VoxVoice {
  id: string;
  name: string;
  category: string;
  description: string;
}

/** What the browser is told when the server cannot help, in the server's own words. */
async function reasonFrom(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

export async function fetchVoxVoices(): Promise<VoxVoice[]> {
  const res = await fetch("/api/library/voices", { headers: await tutorHeaders() });
  if (!res.ok) throw new Error(await reasonFrom(res, "The Vox voices could not be loaded."));
  const body = (await res.json()) as { voices?: VoxVoice[] };
  return body.voices ?? [];
}

/** One line read in a Vox voice, as a WAV. Throws the server's reason when it cannot. */
export async function voxVoice(text: string, voiceId: string): Promise<Blob> {
  const res = await fetch("/api/library/voice/vox", {
    method: "POST",
    headers: await tutorHeaders(),
    body: JSON.stringify({ text, voiceId }),
  });
  if (!res.ok) throw new Error(await reasonFrom(res, "Vox could not be reached. Record your own voice instead."));
  const blob = await res.blob();
  if (!blob.size) throw new Error("The voice returned no audio. Try again.");
  return blob;
}

/**
 * The language a voice is named for, when its name says so ("Pitou_kh",
 * "Maya_Narrator_EN"). A hint for ordering the list, never a filter: a voice
 * with no tag may read anything, and the author is the one who can hear it.
 */
export function voiceLanguage(name: string): Language | null {
  if (/(?:^|[\s_-])kh$/i.test(name)) return "km";
  if (/(?:^|[\s_-])en$/i.test(name)) return "en";
  return null;
}

/** The voices best suited to a book's language first, the rest after, each group by name. */
export function orderedFor(voices: readonly VoxVoice[], language: Language): VoxVoice[] {
  const rank = (v: VoxVoice) => {
    const tag = voiceLanguage(v.name);
    return tag === language ? 0 : tag === null ? 1 : 2;
  };
  return [...voices].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/* -------------------------------------------------------------------------- */
/* ChatGPT                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The voices ChatGPT offers. Kept beside Vox's because the studio treats them
 * the same way — a source of voices an author picks from — and the server
 * refuses a name that is not on this list, so the list here is the same list.
 */
export const OPENAI_VOICES: ReadonlyArray<{ id: string; tone: string }> = [
  { id: "marin", tone: "Clear and natural" },
  { id: "cedar", tone: "Warm and steady" },
  { id: "coral", tone: "Friendly and bright" },
  { id: "shimmer", tone: "Soft and gentle" },
  { id: "nova", tone: "Lively and young" },
  { id: "sage", tone: "Calm and wise" },
  { id: "alloy", tone: "Neutral" },
  { id: "ash", tone: "Low and calm" },
  { id: "ballad", tone: "Expressive" },
  { id: "echo", tone: "Even" },
  { id: "fable", tone: "Storyteller" },
  { id: "onyx", tone: "Deep" },
  { id: "verse", tone: "Dramatic" },
];

/** One line read in a ChatGPT voice, as a WAV. Throws the server's reason when it cannot. */
export async function openaiVoice(text: string, voice: string, language: Language): Promise<Blob> {
  const res = await fetch("/api/library/voice/openai", {
    method: "POST",
    headers: await tutorHeaders(),
    body: JSON.stringify({ text, voice, language }),
  });
  if (!res.ok) throw new Error(await reasonFrom(res, "ChatGPT could not be reached. Record your own voice instead."));
  const blob = await res.blob();
  if (!blob.size) throw new Error("The voice returned no audio. Try again.");
  return blob;
}
