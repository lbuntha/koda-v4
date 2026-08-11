/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { kodaUtterance } from "../components/canvases/kodaVoice";

export interface SpeechVoiceoverState {
  isSpeaking: boolean;
  isSupported: boolean;
  speak: (customText?: string) => void;
  stop: () => void;
  toggle: (customText?: string) => void;
}

/**
 * The read-aloud button on a canvas.
 *
 * How Koda *sounds* is not this hook's decision — `kodaUtterance` owns rate,
 * pitch, language, voice choice and the spoken form of the text. This hook owns
 * only when to start and stop. They were separate before, set to different
 * numbers, so pressing "Listen" and hearing Koda speak in the same activity were
 * audibly two different readers.
 */
export function useSpeechVoiceover(defaultText: string = ""): SpeechVoiceoverState {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);
    }
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback((customText?: string) => {
    if (typeof window !== "undefined" && !("speechSynthesis" in window)) {
      console.warn("SpeechSynthesis not supported in this browser.");
      return;
    }

    const textToSpeak = customText || defaultText;
    if (!textToSpeak || !textToSpeak.trim()) return;

    // Stop any current utterance
    window.speechSynthesis.cancel();

    const utterance = kodaUtterance(textToSpeak);
    utteranceRef.current = utterance;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      // Ignore canceled errors when stopped intentionally
      if (event.error !== "canceled" && event.error !== "interrupted") {
        console.warn("SpeechSynthesis error:", event.error);
      }
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
    /*
      Optimistic, and deliberately.

      `onstart` is the honest signal and an unreliable one: Chrome will not fire
      it until the voice list has loaded, and a queued utterance can sit silent
      for hundreds of milliseconds first. Anything keyed off this state — the
      button's own speaking look, and now Koda stepping in — then does nothing
      at all on the press that asked for it, which reads as a dead button.

      So the press turns it on and only the *end* turns it off. The failure mode
      flips from "nothing happened" to "it stopped a moment late", and `onend`
      and `onerror` both clear it.
    */
    setIsSpeaking(true);
  }, [defaultText]);

  const toggle = useCallback((customText?: string) => {
    if (isSpeaking) {
      stop();
    } else {
      speak(customText);
    }
  }, [isSpeaking, speak, stop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isSpeaking,
    isSupported,
    speak,
    stop,
    toggle
  };
}
