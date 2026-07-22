/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useSpeechVoiceover } from "./useSpeechVoiceover";

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

  const btnSize = size === "sm" ? "h-7 px-2.5 text-[10px]" : "h-8 px-3 text-xs";
  const iconSize = size === "sm" ? 13 : 15;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(text);
      }}
      title={isSpeaking ? "Stop listening" : "Listen to question instructions"}
      className={`rounded-full border font-bold font-mono tracking-wide flex items-center gap-1.5 shadow-sm transition-all duration-200 cursor-pointer select-none active:scale-95 group ${btnSize} ${
        isSpeaking
          ? "bg-violet-600 text-white border-violet-400 ring-2 ring-violet-400/40 shadow-md animate-pulse"
          : isDark
            ? "bg-slate-800/90 hover:bg-slate-700 text-violet-300 border-violet-500/40 shadow-black/30"
            : "bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 border-violet-500/30"
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
          <Volume2 size={iconSize} className="group-hover:scale-110 transition-transform" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
