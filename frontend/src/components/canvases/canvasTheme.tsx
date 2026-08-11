import React from "react";
import { Badge } from "../ui/Badge";

/**
 * Shared visual language for every canvas.
 *
 * A canvas picks one accent (matching its activity family) and every standard
 * chrome element — header icon, objective chip, status footer — tints from it,
 * so all canvases read as one component family.
 */
/**
 * No amber/yellow. On a light worksheet it is at once low-contrast against the page and
 * high-glare, which is tiring for a child looking at it for a whole lesson. Leaving it out of
 * the union makes that structural: a canvas cannot pick it back up by accident.
 */
export type CanvasAccent =
  | "rose"
  | "violet"
  | "indigo"
  | "emerald"
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

export const accentIconClass = (accent: CanvasAccent | string = "indigo", isDark: boolean = false) => {
  const valid = CANVAS_ACCENTS[accent as CanvasAccent] ? (accent as CanvasAccent) : "indigo";
  return isDark ? CANVAS_ACCENTS[valid].iconDark : CANVAS_ACCENTS[valid].iconLight;
};

export const accentChipClass = (accent: CanvasAccent | string = "indigo", isDark: boolean = false) => {
  const valid = CANVAS_ACCENTS[accent as CanvasAccent] ? (accent as CanvasAccent) : "indigo";
  return isDark ? CANVAS_ACCENTS[valid].chipDark : CANVAS_ACCENTS[valid].chipLight;
};

export const accentTextClass = (accent: CanvasAccent | string = "indigo", isDark: boolean = false) => {
  const valid = CANVAS_ACCENTS[accent as CanvasAccent] ? (accent as CanvasAccent) : "indigo";
  return isDark ? CANVAS_ACCENTS[valid].textDark : CANVAS_ACCENTS[valid].textLight;
};

/**
 * Container surfaces.
 *
 * A zone (tray, stage, plate) is a **near-white panel with a hairline edge**,
 * not a grey wash. A 4.5% black fill is the same thing as painting the page
 * grey: it reads as a hole rather than as a surface, and it drags every object
 * sitting on it down with it. Holding the fill at the page's own brightness and
 * letting a single-pixel edge do the separating is what makes a board look
 * light — the edge costs nothing and carries no colour.
 *
 * Colour is still reserved for state — active drop target, filled slot, solved —
 * so that when something does light up, it means something. A hairline is not
 * colour; it is a boundary.
 *
 * `raised` stays a fill, because something sitting *on* a panel is separated by
 * elevation rather than by another edge. It runs dark enough to read against the
 * near-white panel and light enough not to compete with the objects on it.
 *
 * The dark values sit above their background rather than below it: on a
 * near-black stage a few percent of white is what "raised" looks like, where the
 * same few percent of black is invisible.
 */
export const surfaceClass = (
  isDark: boolean,
  level: "flat" | "raised" | "panel" = "flat"
) => {
  if (level === "panel") {
    /*
      A `panel` is a region a child looks *into* — a bin, a stage, a plate. It is
      the only level that draws an edge, and the only one big enough to need one:
      at this size a fill pale enough to keep the board light is also too pale to
      find, so the hairline does the separating instead.

      Not applied to every surface: a 6px progress track and a dashed empty slot
      already own their border, and giving them a second one is how a dashed 2px
      outline quietly becomes a solid 1px one.
    */
    return isDark
      ? "bg-white/[0.045] border border-white/[0.07]"
      : "bg-[#FAFAFC] border border-[#ECECF3]";
  }
  if (level === "raised") return isDark ? "bg-white/[0.14]" : "bg-slate-900/[0.07]";
  return isDark ? "bg-white/[0.06]" : "bg-slate-900/[0.035]";
};

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
 *
 * ## Lighter than a button, on purpose
 *
 * It used to take `Badge` as it comes — `h-9`, `border-2`, `rounded-full` —
 * which is, to the pixel, the read-aloud button standing next to it in the
 * question header. Two identical pills, one you press and one you read, and
 * nothing in the shape saying which is which: the row read as two buttons and
 * sat heavy under the heading it belongs to.
 *
 * So a chip is now visibly not a button. Shorter, no ring, a softer fill and a
 * step down the type ramp — it still carries the accent, and it still lines up
 * with its siblings, but the only bordered pill in the header is the one a
 * child can press. `tracking-wider` rather than `widest` for the same reason:
 * a counter is read at a glance, not scanned like a label.
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
  <Badge
    variant={accent as any}
    icon={icon}
    className={`h-7 border-0 px-2.5 text-[11px] ${
      mono ? "font-mono tracking-wider" : "font-extrabold"
    } ${className}`}
    {...rest}
  >
    {children}
  </Badge>
);
