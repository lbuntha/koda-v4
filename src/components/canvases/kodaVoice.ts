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

/** Strip the markdown emphasis markers so `**18**` is spoken as "18". */
export const toSpeech = (text: string) => text.replace(/\*\*/g, "");

const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

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
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
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
