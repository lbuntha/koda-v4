import React from "react";
import { cn } from "../../lib/utils";

/**
 * A speech bubble: a soft surface with a tail pointing at whoever is talking.
 *
 * Presentational only, and deliberately so. Three places in this codebase draw
 * something a character says — Koda's canvas bubble, the read-aloud guide in the
 * question display, and the tutor bubble — and each had grown its own rounding,
 * its own shadow and its own idea of a tail, so the same character spoke from
 * three different-looking mouths. This owns the surface; what goes *in* it,
 * including any read-along reveal, stays with whoever knows what the words mean.
 *
 *   <SpeechBubble tail="top" align="end">Drag each apple into the next box.</SpeechBubble>
 *
 * Positioning is the caller's too. A bubble has to sit relative to a specific
 * character, and a component that guessed at `absolute` offsets would be wrong
 * for every second caller — pass `className` with the placement.
 */

export type SpeechBubbleTail = "top" | "bottom" | "left" | "right" | "none";
export type SpeechBubbleAlign = "start" | "center" | "end";

export interface SpeechBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Which edge the tail sits on. `none` is a plain rounded surface. */
  tail?: SpeechBubbleTail;
  /** Where along that edge the tail sits — the end nearest the speaker. */
  align?: SpeechBubbleAlign;
  /**
   * Pixels from the aligned edge to the tail's centre, when `align` alone cannot
   * reach the speaker.
   *
   * A bubble is usually much wider than whoever is talking, so "near the right
   * end" is not the same as "under their chin" — and a tail that points at empty
   * space is worse than no tail, because the eye follows it and finds nothing.
   * Ignored with `align: "center"`, which is already exact.
   */
  tailOffset?: number;
  tone?: "plain" | "violet";
  /** `sm` for a passing hint, `md` for something meant to be read. */
  size?: "sm" | "md";
}

/**
 * Surface and tail must match exactly, or the tail reads as a separate chip.
 *
 * The hairline edge is on in both themes, not just dark. A white bubble on a
 * white page has only its shadow to define it, and a shadow does not reach the
 * tail — which sticks out past the bubble's box — so the tail was the one part
 * of the shape with no edge at all and read as a stray chevron floating nearby.
 */
const TONE: Record<NonNullable<SpeechBubbleProps["tone"]>, { surface: string; fill: string; edge: string }> = {
  plain: {
    surface:
      "bg-white text-slate-800 border border-slate-900/[0.07] shadow-[0_10px_30px_-12px_rgba(15,23,42,0.35)] " +
      "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700/70 dark:shadow-none",
    fill: "bg-white dark:bg-slate-900",
    edge: "border-slate-900/[0.07] dark:border-slate-700/70",
  },
  violet: {
    surface:
      "bg-violet-50 text-violet-900 border border-violet-900/[0.08] shadow-[0_10px_30px_-14px_rgba(76,29,149,0.45)] " +
      "dark:bg-violet-950/70 dark:text-violet-100 dark:border-violet-500/30 dark:shadow-none",
    fill: "bg-violet-50 dark:bg-violet-950/70",
    edge: "border-violet-900/[0.08] dark:border-violet-500/30",
  },
};

/**
 * The tail is a rotated square tucked half under the surface, so only its two
 * outer sides show. A triangle would need a second element to carry the border
 * in dark mode; this way the tail wears the same edge the bubble does.
 */
const TAIL_SIDE: Record<Exclude<SpeechBubbleTail, "none">, string> = {
  top: "-top-[7px] border-l border-t",
  bottom: "-bottom-[7px] border-r border-b",
  left: "-left-[7px] border-l border-b",
  right: "-right-[7px] border-r border-t",
};

const TAIL_ALIGN: Record<Exclude<SpeechBubbleTail, "none">, Record<SpeechBubbleAlign, string>> = {
  top: { start: "left-6", center: "left-1/2 -translate-x-1/2", end: "right-6" },
  bottom: { start: "left-6", center: "left-1/2 -translate-x-1/2", end: "right-6" },
  left: { start: "top-5", center: "top-1/2 -translate-y-1/2", end: "bottom-5" },
  right: { start: "top-5", center: "top-1/2 -translate-y-1/2", end: "bottom-5" },
};

/** Which CSS edge `tailOffset` measures from, per side and alignment. */
const TAIL_EDGE: Record<Exclude<SpeechBubbleTail, "none">, Record<"start" | "end", "left" | "right" | "top" | "bottom">> = {
  top: { start: "left", end: "right" },
  bottom: { start: "left", end: "right" },
  left: { start: "top", end: "bottom" },
  right: { start: "top", end: "bottom" },
};

/** Half the tail's 12px box — what turns "centre at X" into a CSS offset. */
const TAIL_HALF = 6;

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  tail = "top",
  align = "center",
  tailOffset,
  tone = "plain",
  size = "md",
  className,
  children,
  ...props
}) => {
  const palette = TONE[tone];
  const offset =
    tail !== "none" && align !== "center" && tailOffset !== undefined
      ? { [TAIL_EDGE[tail][align]]: Math.max(0, tailOffset - TAIL_HALF) }
      : undefined;

  return (
    <div
      className={cn(
        "relative rounded-2xl text-left",
        size === "sm" ? "px-3 py-2 text-[12px] leading-snug" : "px-3.5 py-2.5 text-[13px] leading-relaxed",
        "font-semibold",
        palette.surface,
        className,
      )}
      {...props}
    >
      {tail !== "none" && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute h-3 w-3 rotate-45 rounded-[2px]",
            palette.fill,
            palette.edge,
            TAIL_SIDE[tail],
            // An explicit offset replaces the alignment class it would fight with.
            offset ? "" : TAIL_ALIGN[tail][align],
          )}
          style={offset}
        />
      )}
      {children}
    </div>
  );
};
