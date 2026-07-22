/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Sparkles, HelpCircle } from "lucide-react";

export interface GhostGuideOverlayProps {
  show: boolean;
  label?: string;
  isDark?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Where the hint pill sits inside the highlighted region. Defaults to "top"
   * so the pill never covers the objects the learner is being pointed at.
   */
  labelPlacement?: "top" | "center" | "bottom";
}

/**
 * Visual overlay component for the Scaffolded Ghost Guide.
 * Displays a non-intrusive, pulsing silhouette around target containers or slots
 * when triggered by student inactivity or 2+ drop errors.
 */
export const GhostGuideOverlay: React.FC<GhostGuideOverlayProps> = ({
  show,
  label = "Hint: Place item here",
  isDark = false,
  className = "",
  style = {},
  labelPlacement = "top"
}) => {
  if (!show) return null;

  const placement =
    labelPlacement === "center" ? "justify-center" : labelPlacement === "bottom" ? "justify-end" : "justify-start";

  return (
    <div
      style={style}
      className={`absolute inset-0 rounded-3xl border-2 border-dashed pointer-events-none z-30 flex flex-col items-center ${placement} p-3 animate-pulse transition-all duration-500 select-none ${
        isDark
          ? "border-violet-400/80 bg-violet-400/15 text-violet-300 shadow-lg shadow-violet-500/20"
          : "border-violet-500/80 bg-violet-300/25 text-violet-900 shadow-md shadow-violet-400/25"
      } ${className}`}
    >
      <div className="flex items-center gap-1.5 font-mono font-extrabold text-xs tracking-tight bg-violet-600/90 text-white px-3 py-1 rounded-full shadow-sm animate-bounce">
        <Sparkles size={13} className="text-violet-200 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
};
