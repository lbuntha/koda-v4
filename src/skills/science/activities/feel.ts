import { useCallback } from "react";
import type { KodaSDK } from "../../types";

/**
 * The chime and the buzz for one answer, each behind its own switch.
 *
 * `sound_chimes` and `haptic_feedback` are declared in the manifest, so each
 * must change something — here is the one place all three engines ask.
 */
export function useAnswerFeel(koda: KodaSDK): (correct: boolean) => void {
  const sound = koda.config.isEnabled("sound_chimes", true);
  const haptics = koda.config.isEnabled("haptic_feedback", true);
  return useCallback((correct: boolean) => {
    if (sound && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (haptics) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
  }, [koda, sound, haptics]);
}

/**
 * Say lines one after another, each as its own utterance.
 *
 * Recordings are matched by their exact words, so "question. answer A. answer
 * B" as one string would never find a clip; three calls find three.
 */
export async function sayLines(koda: KodaSDK, lines: string[]): Promise<void> {
  const rate = koda.config.get("speechRate", 1);
  for (const line of lines) await koda.speech.say(line, { rate });
}
