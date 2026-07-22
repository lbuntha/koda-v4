/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface SpeechVoiceoverState {
  isSpeaking: boolean;
  isSupported: boolean;
  speak: (customText?: string) => void;
  stop: () => void;
  toggle: (customText?: string) => void;
}

/**
 * Custom hook to provide native browser Text-to-Speech (speechSynthesis)
 * with child-friendly speech rate and pitch adjustments for Koda early learners.
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

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;

    // Child-friendly voice settings: slightly slower rate, slightly higher pitch
    utterance.rate = 0.92;
    utterance.pitch = 1.08;
    utterance.volume = 1.0;

    // Attempt to pick a natural-sounding English voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const preferredVoice = voices.find(
        (v) =>
          (v.lang.includes("en") && (v.name.includes("Samantha") || v.name.includes("Google") || v.name.includes("Karen") || v.name.includes("Natural"))) ||
          v.lang.startsWith("en")
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

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
