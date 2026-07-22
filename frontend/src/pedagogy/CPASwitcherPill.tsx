/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Shapes, LayoutGrid, Hash } from "lucide-react";
import { CPARepresentation } from "./useCPASwitcher";

export interface CPASwitcherPillProps {
  representation: CPARepresentation;
  onChange: (rep: CPARepresentation) => void;
  isDark?: boolean;
  className?: string;
}

const options: {
  id: CPARepresentation;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  activeBg: string;
  activeBgDark: string;
  activeText: string;
  activeTextDark: string;
  activeRing: string;
  description: string;
}[] = [
  {
    id: "concrete",
    label: "Concrete",
    icon: Shapes,
    activeBg: "bg-amber-100",
    activeBgDark: "bg-amber-500/20",
    activeText: "text-amber-800",
    activeTextDark: "text-amber-200",
    activeRing: "focus-visible:ring-amber-400",
    description: "Concrete – physical objects"
  },
  {
    id: "pictorial",
    label: "Ten-Frame",
    icon: LayoutGrid,
    activeBg: "bg-indigo-100",
    activeBgDark: "bg-indigo-500/20",
    activeText: "text-indigo-800",
    activeTextDark: "text-indigo-200",
    activeRing: "focus-visible:ring-indigo-400",
    description: "Ten-Frame – pictorial grid"
  },
  {
    id: "abstract",
    label: "Digits",
    icon: Hash,
    activeBg: "bg-emerald-100",
    activeBgDark: "bg-emerald-500/20",
    activeText: "text-emerald-800",
    activeTextDark: "text-emerald-200",
    activeRing: "focus-visible:ring-emerald-400",
    description: "Abstract – digits & numbers"
  }
];

/**
 * Compact 3-way CPA toggle — Property Studio edition.
 * No visible outer border. Active state uses a tinted background only.
 * Fully accessible: role=group, aria-checked, aria-label, focus-visible ring.
 */
export const CPASwitcherPill: React.FC<CPASwitcherPillProps> = ({
  representation,
  onChange,
  isDark = false,
  className = ""
}) => {
  return (
    <div
      role="group"
      aria-label="Representation mode"
      className={`flex items-stretch gap-0.5 p-0.5 rounded-lg transition-colors select-none ${
        isDark ? "bg-slate-800/60" : "bg-slate-100"
      } ${className}`}
    >
      {options.map((opt) => {
        const isActive = representation === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={opt.description}
            title={opt.description}
            onClick={(e) => {
              e.stopPropagation();
              onChange(opt.id);
            }}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold
              tracking-wide transition-all duration-150 cursor-pointer focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-offset-1 ${opt.activeRing}
              ${isActive
                ? isDark
                  ? `${opt.activeBgDark} ${opt.activeTextDark} shadow-sm`
                  : `${opt.activeBg} ${opt.activeText} shadow-sm`
                : isDark
                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/60"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/70"
              }
            `}
          >
            <opt.icon size={13} aria-hidden="true" className="flex-shrink-0" />
            <span className="leading-none">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
