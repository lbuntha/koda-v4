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
  label?: string;
  size?: "sm" | "md";
}

export const SpeechReadAloudButton: React.FC<SpeechReadAloudButtonProps> = ({
  text,
  isDark = false,
  className = "",
  label = "Listen",
  size = "md"
}) => {
  const { isSpeaking, isSupported, toggle } = useSpeechVoiceover(text);

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
      className={`h-9 rounded-full border-2 font-extrabold tracking-wide transition-all cursor-pointer ${
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
          <span>{label}</span>
        </>
      )}
    </Button>
  );
};
