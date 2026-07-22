import React from "react";

/**
 * Shared visual language for every canvas.
 *
 * A canvas picks one accent (matching its activity family) and every standard
 * chrome element — header icon, objective chip, status footer — tints from it,
 * so all canvases read as one component family.
 */
export type CanvasAccent =
  | "rose"
  | "violet"
  | "indigo"
  | "emerald"
  | "amber"
  | "purple"
  | "slate";

interface AccentTokens {
  /** Header icon tile */
  iconLight: string;
  iconDark: string;
  /** Soft pill used for objective chips / status */
  chipLight: string;
  chipDark: string;
  /** Text-only emphasis */
  textLight: string;
  textDark: string;
}

export const CANVAS_ACCENTS: Record<CanvasAccent, AccentTokens> = {
  rose: {
    iconLight: "bg-rose-50 text-rose-600",
    iconDark: "bg-rose-500/15 text-rose-400",
    chipLight: "bg-rose-50 text-rose-700 border-rose-200",
    chipDark: "bg-rose-500/30 text-rose-100 border-rose-400/50",
    textLight: "text-rose-600",
    textDark: "text-rose-400"
  },
  violet: {
    iconLight: "bg-violet-50 text-violet-600",
    iconDark: "bg-violet-500/15 text-violet-400",
    chipLight: "bg-violet-50 text-violet-700 border-violet-200",
    chipDark: "bg-violet-500/30 text-violet-100 border-violet-400/50",
    textLight: "text-violet-600",
    textDark: "text-violet-400"
  },
  indigo: {
    iconLight: "bg-indigo-50 text-indigo-600",
    iconDark: "bg-indigo-500/15 text-indigo-400",
    chipLight: "bg-indigo-50 text-indigo-700 border-indigo-200",
    chipDark: "bg-indigo-500/30 text-indigo-100 border-indigo-400/50",
    textLight: "text-indigo-600",
    textDark: "text-indigo-400"
  },
  emerald: {
    iconLight: "bg-emerald-50 text-emerald-600",
    iconDark: "bg-emerald-500/15 text-emerald-400",
    chipLight: "bg-emerald-50 text-emerald-700 border-emerald-200",
    chipDark: "bg-emerald-500/30 text-emerald-100 border-emerald-400/50",
    textLight: "text-emerald-600",
    textDark: "text-emerald-400"
  },
  amber: {
    iconLight: "bg-amber-50 text-amber-600",
    iconDark: "bg-amber-500/15 text-amber-400",
    chipLight: "bg-amber-50 text-amber-700 border-amber-200",
    chipDark: "bg-amber-500/30 text-amber-100 border-amber-400/50",
    textLight: "text-amber-600",
    textDark: "text-amber-400"
  },
  purple: {
    iconLight: "bg-purple-50 text-purple-600",
    iconDark: "bg-purple-500/15 text-purple-400",
    chipLight: "bg-purple-50 text-purple-700 border-purple-200",
    chipDark: "bg-purple-500/30 text-purple-100 border-purple-400/50",
    textLight: "text-purple-600",
    textDark: "text-purple-400"
  },
  slate: {
    iconLight: "bg-slate-100 text-slate-600",
    iconDark: "bg-white/10 text-slate-300",
    chipLight: "bg-slate-100 text-slate-600 border-slate-200",
    chipDark: "bg-white/10 text-slate-300 border-white/15",
    textLight: "text-slate-600",
    textDark: "text-slate-300"
  }
};

export const accentIconClass = (accent: CanvasAccent, isDark: boolean) =>
  isDark ? CANVAS_ACCENTS[accent].iconDark : CANVAS_ACCENTS[accent].iconLight;

export const accentChipClass = (accent: CanvasAccent, isDark: boolean) =>
  isDark ? CANVAS_ACCENTS[accent].chipDark : CANVAS_ACCENTS[accent].chipLight;

export const accentTextClass = (accent: CanvasAccent, isDark: boolean) =>
  isDark ? CANVAS_ACCENTS[accent].textDark : CANVAS_ACCENTS[accent].textLight;

/**
 * Container surfaces.
 *
 * Zones (trays, stages, plates) are separated by ELEVATION, never by coloured
 * borders: one neutral translucent fill that reads identically in both themes.
 * Colour is reserved for state — active drop target, filled slot, solved — so
 * that when something does light up, it means something.
 *
 * The dark values run higher than the light ones on purpose: these sit on a
 * near-black stage, where a few percent of white is invisible, while the same
 * few percent of black reads clearly on a white page. Each level roughly
 * doubles the one below so a raised item never dissolves into its tray.
 */
export const surfaceClass = (isDark: boolean, level: "flat" | "raised" = "flat") =>
  isDark
    ? level === "raised"
      ? "bg-white/[0.16]"
      : "bg-white/[0.08]"
    : level === "raised"
      ? "bg-slate-900/[0.09]"
      : "bg-slate-900/[0.045]";

/**
 * Empty drop-target outline (numbered slots, ten-frame cells, array cells).
 *
 * This is the one outline the standard keeps, because it is functional — it
 * says "put something here". It stays neutral until the target goes live, at
 * which point the accent takes over.
 */
export const emptySlotClass = (isDark: boolean) =>
  isDark ? "border-white/25 text-slate-400" : "border-slate-900/20 text-slate-400";

/** Hairline divider — the only "border" the standard allows on a container. */
export const hairlineClass = (isDark: boolean) =>
  isDark ? "border-white/[0.08]" : "border-slate-900/[0.07]";

/** Muted caption text for zone labels. */
export const captionClass = (isDark: boolean) =>
  isDark ? "text-slate-500" : "text-slate-400";

export interface CanvasChipProps {
  accent?: CanvasAccent;
  isDark?: boolean;
  icon?: React.ReactNode;
  /** Uppercase mono styling — use for objectives and status counters */
  mono?: boolean;
  className?: string;
  children: React.ReactNode;
  title?: string;
  "aria-label"?: string;
}

/**
 * The one chip used across canvases: objectives ("Cross out 3"), counters
 * ("3 of 8 counted"), and mode labels. Same height, radius and type ramp
 * everywhere so headers line up between activities.
 */
export const CanvasChip: React.FC<CanvasChipProps> = ({
  accent = "indigo",
  isDark = false,
  icon,
  mono = true,
  className = "",
  children,
  ...rest
}) => (
  <div
    {...rest}
    className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full border flex-shrink-0 whitespace-nowrap
      ${mono ? "font-mono text-[10px] font-black uppercase tracking-widest" : "text-[11px] font-bold"}
      ${accentChipClass(accent, isDark)} ${className}`}
  >
    {icon}
    {children}
  </div>
);
