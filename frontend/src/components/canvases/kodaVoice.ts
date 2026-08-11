/**
 * Koda's voice — speech synthesis + the mute switch.
 *
 * Split out from KodaActor because canvases often need the voice without the
 * bubble: to speak a running count on each tap, or to gate their own sound
 * effects on the same mute the child toggled. One hook, one mute, one place
 * the browser's speechSynthesis quirks are handled.
 */

import { useCallback, useEffect, useState } from "react";

export interface KodaVoice {
  muted: boolean;
  toggleMute: () => void;
  /** Speak immediately, cancelling anything already queued. No-op when muted. */
  speak: (text: string) => void;
  cancel: () => void;
  isSpeaking: boolean;
}

/**
 * How Koda sounds. One set of numbers, because there is one Koda.
 *
 * Slightly under speed and slightly over pitch: a child following an instruction
 * needs the gap between words more than they need it delivered quickly.
 */
export const VOICE = { rate: 0.94, pitch: 1.06, lang: "en-US" } as const;

/**
 * What a string sounds like when read out.
 *
 * Two things a screen shows happily and a speaker cannot:
 *
 *   - markdown emphasis — `**18**` was being read as "star star eighteen";
 *   - emoji — a prompt ending "🎉" is announced as "party popper", which lands
 *     in the middle of the sentence a child is trying to follow.
 *
 * Arrows and dashes become words rather than silence, so "8 → 7" reads as
 * "8 to 7" instead of the numbers running together.
 */
/**
 * One emoji, however many code points it is built from.
 *
 * A pictographic base, then any variation selectors and skin-tone modifiers,
 * then any number of zero-width-joined parts — "👨‍👩‍👧" is seven code points and
 * has to go as one, or the leftovers are announced individually.
 * Flags are a pair of regional indicators and match nothing else.
 */
const EMOJI =
  /(?:\p{RI}\p{RI}|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*)*)/gu;

export const toSpeech = (text: string) =>
  text
    .replace(/\*\*/g, "")
    .replace(/\s*→\s*/g, " to ")
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(EMOJI, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/**
 * An English voice, chosen the same way every time.
 *
 * Without this the browser picks by its own default, which on a machine set to
 * another language reads English text in that language's phonetics — the single
 * worst thing that can happen to a six-year-old following an instruction. The
 * named voices are the natural-sounding ones; any English voice beats none.
 *
 * `getVoices()` is empty until the engine has loaded them, and Chrome only fires
 * `voiceschanged` afterwards — so the first utterance of a session used to get
 * the default voice and every later one a different one. Callers re-ask on each
 * utterance and the list is cached once it arrives.
 */
const PREFERRED = ["Samantha", "Karen", "Google US English", "Natural"];

export const pickVoice = (): SpeechSynthesisVoice | null => {
  if (!canSpeak()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const english = voices.filter(v => v.lang?.toLowerCase().startsWith("en"));
  if (!english.length) return null;
  for (const name of PREFERRED) {
    const match = english.find(v => v.name.includes(name));
    if (match) return match;
  }
  return english[0];
};

/**
 * Build an utterance that sounds like Koda.
 *
 * The one place rate, pitch, language and voice are decided — there were two,
 * set differently, so the read-aloud button and Koda's own speech were audibly
 * two different people reading the same activity.
 */
export const kodaUtterance = (text: string): SpeechSynthesisUtterance => {
  const utterance = new SpeechSynthesisUtterance(toSpeech(text));
  utterance.rate = VOICE.rate;
  utterance.pitch = VOICE.pitch;
  utterance.volume = 1;
  utterance.lang = VOICE.lang;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  return utterance;
};

/**
 * Mute is persisted so a child who turns Koda off does not get talked at again
 * on the next slide. `storageKey` scopes that per activity when needed.
 */
export function useKodaVoice(storageKey = "koda_muted"): KodaVoice {
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(storageKey) === "true";
    } catch {
      // Safari private mode throws on localStorage access; default to audible.
      return false;
    }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);

  const cancel = useCallback(() => {
    if (!canSpeak()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (muted || !text || !canSpeak()) return;

    window.speechSynthesis.cancel();
    // Chrome/Safari drop an utterance queued in the same tick as cancel();
    // a short gap lets the engine finish tearing down the previous one.
    window.setTimeout(() => {
      const utterance = kodaUtterance(text);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }, 50);
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        /* non-persistent is fine */
      }
      if (next) cancel();
      return next;
    });
  }, [storageKey, cancel]);

  // Never leave an utterance running after the canvas unmounts.
  useEffect(() => cancel, [cancel]);

  return { muted, toggleMute, speak, cancel, isSpeaking };
}
