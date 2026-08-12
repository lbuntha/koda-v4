/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useSpeechVoiceover } from "./useSpeechVoiceover";
import { Button } from "../components/ui";

export interface SpeechReadAloudButtonProps {
  text: string;
  isDark?: boolean;
  className?: string;
  /**
   * The word beside the icon. Pass `null` for the icon alone.
   *
   * Icon-only is what the question header uses: the speaker sits in front of the
   * sentence it reads, where the word "Listen" would be a label for a control
   * standing next to the thing it acts on — and one more line of chrome under a
   * question that has quite enough already. A speaker icon is not ambiguous, and
   * the `title` still says it in words for anyone who hovers.
   */
  label?: string | null;
  size?: "sm" | "md";
  /**
   * Called as speech starts and stops, so the surrounding page can react.
   *
   * The voice belongs to a character, and a character that stays perfectly
   * still while a voice comes out of them is unsettling — so whoever draws Koda
   * needs to know when Koda is talking. Reported rather than exposed as shared
   * state because `useSpeechVoiceover` is per-instance: a second call here would
   * be a second, disagreeing copy of "is speech running".
   */
  onSpeakingChange?: (speaking: boolean) => void;
}

export const SpeechReadAloudButton: React.FC<SpeechReadAloudButtonProps> = ({
  text,
  isDark = false,
  className = "",
  label = "Listen",
  size = "md",
  onSpeakingChange
}) => {
  const { isSpeaking, isSupported, toggle } = useSpeechVoiceover(text);

  const report = React.useRef(onSpeakingChange);
  React.useEffect(() => {
    report.current = onSpeakingChange;
  });
  React.useEffect(() => {
    report.current?.(isSpeaking);
    // Unmounting mid-sentence stops the voice, so it must also clear the flag —
    // otherwise a canvas swap leaves Koda talking to nobody.
    return () => report.current?.(false);
  }, [isSpeaking]);

  if (!isSupported) return null;

  const iconSize = size === "sm" ? 13 : 15;

  return (
    <Button
      type="button"
      variant={isSpeaking ? "default" : isDark ? "secondary" : "outline"}
      size={size === "sm" ? "xs" : "sm"}
      onClick={(e) => {
        e.stopPropagation();
        toggle(text);
      }}
      title={isSpeaking ? "Stop listening" : "Listen to question instructions"}
      /*
        `h-8`, not `h-9`. A 36px pill with a 2px ring is a lot of furniture to
        hang under a question — and it was setting the height of the whole row,
        so the sentence a child has to read arrived with a bar of chrome beneath
        it. 32px still clears the 24px touch-target floor by a wide margin, and
        the ring stays: this is the one thing in the header that is pressed, and
        it should look it.
      */
      className={`h-8 rounded-full border-2 font-extrabold tracking-wide transition-all cursor-pointer ${
        isSpeaking
          ? "bg-violet-600 border-violet-500 text-white shadow-md animate-pulse"
          : isDark
            ? "border-violet-500/40 bg-slate-800/90 text-violet-300 hover:bg-slate-700 hover:text-violet-200"
            : "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800"
      } ${className}`}
    >
      {isSpeaking ? (
        <>
          <VolumeX size={iconSize} className="animate-bounce" />
          <span className="flex items-center gap-0.5">
            <span className="w-1 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
            <span className="w-1 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
          </span>
        </>
      ) : (
        <>
          <Volume2 size={iconSize} className="transition-transform group-hover:scale-110" />
          {label !== null && <span>{label}</span>}
        </>
      )}
    </Button>
  );
};
