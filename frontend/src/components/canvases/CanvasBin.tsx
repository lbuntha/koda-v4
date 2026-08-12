import React, { forwardRef } from "react";
import { CanvasAccent, accentChipClass, accentTextClass, captionClass, emptySlotClass, surfaceClass } from "./canvasTheme";
import { useCanvasAudience } from "./presentation";

export interface CanvasBinProps {
  /** What this bin is for, in the child's words — "Move these", "Counted". */
  label: React.ReactNode;
  /** Live count for this bin. Kept to a number or two words; it is read mid-drag. */
  tally?: React.ReactNode;
  accent?: CanvasAccent;
  isDark?: boolean;
  /** A drag is currently over this bin. */
  active?: boolean;
  /** This bin has everything it was waiting for. */
  complete?: boolean;
  /** Nothing in the bin yet — shows the drop target instead of empty space. */
  isEmpty?: boolean;
  /**
   * Draw the panel fill and hairline. Off puts the objects on the open board.
   *
   * A bin is two things stacked: a *region* (label, tally, drop maths, the ring
   * that says a drag is over it) and a *box drawn around that region*. Only the
   * second is optional, and this turns off only the second — every measurement
   * a canvas makes against this element is unchanged, because the padding stays.
   * That is not a detail: `BIN_PADDING` in `objectLayout.ts` is a copy of this
   * component's `p-3 sm:p-4 md:p-5`, so dropping the padding along with the fill
   * would silently resize every object on the board.
   */
  surface?: boolean;
  /** Centred invitation shown while the bin is empty, e.g. "Drop apples here". */
  emptyHint?: React.ReactNode;
  /** Icon above the empty hint. */
  emptyIcon?: React.ReactNode;
  /** Overlays that belong inside the bin's content area (guides, celebrations). */
  children?: React.ReactNode;
  className?: string;
  /**
   * For canvases that position their bins themselves — Line Up puts its tray and
   * its line-up band at computed offsets, because the objects it drags between
   * them live in the same coordinate space.
   */
  style?: React.CSSProperties;
}

/**
 * A labelled drop target.
 *
 * Every drag-and-drop canvas needs the same thing — a bin with a name, a live
 * count, an obvious "put it here" state and an obvious "the drag is over me"
 * state — and each one used to draw it slightly differently: different label
 * sizes, some with a tally and some without, some with no empty state at all,
 * so a child moving between activities had to relearn where things go. This is
 * that chrome in one place.
 *
 * Two deliberate constraints:
 *
 * - **No transforms on the bin.** Canvases measure these boxes to decide what
 *   was dropped where, so a hover scale would quietly move the drop maths. The
 *   active state is carried by a ring and a brighter fill instead.
 * - **Objects are not children.** Draggable objects live in the stage, above
 *   the bins, so they can be dragged between them. `children` here is for
 *   overlays that belong to the bin itself.
 */
export const CanvasBin = forwardRef<HTMLDivElement, CanvasBinProps>(({
  label,
  tally,
  accent = "indigo",
  isDark = false,
  active = false,
  complete = false,
  isEmpty = false,
  emptyHint,
  emptyIcon,
  children,
  className = "",
  surface = true,
  style
}, ref) => {
  const { learnerMode } = useCanvasAudience();
  const tone: CanvasAccent = complete ? "emerald" : accent;

  return (
    <div
      ref={ref}
      style={style}
      /*
        The padding is not decoration and stays whether the fill does or not —
        see `surface`. Without a fill the box simply stops being painted; it is
        still exactly the same box the stage measures objects into.
      */
      className={`flex-1 basis-0 min-w-0 min-h-0 relative flex flex-col rounded-3xl p-3 sm:p-4 md:p-5
        transition-[background-color,box-shadow] duration-200 ${surface ? surfaceClass(isDark, "panel") : ""}
        ${active ? `ring-4 ${accentChipClass(tone, isDark)}` : ""} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        {/*
          The label is the one word a child needs mid-drag, so it is set at
          reading size for them and stays a quiet mono caption for an adult
          authoring the slide.
        */}
        <span
          className={
            learnerMode
              ? `font-extrabold tracking-tight text-sm sm:text-base md:text-lg truncate ${
                  active || complete ? accentTextClass(tone, isDark) : isDark ? "text-slate-300" : "text-slate-600"
                }`
              : `font-mono text-[9px] sm:text-[10px] md:text-[11px] font-bold uppercase tracking-[0.18em] truncate ${captionClass(isDark)}`
          }
        >
          {label}
        </span>
        {tally !== undefined && tally !== null && (
          <span
            className={`font-mono font-black tabular-nums flex-shrink-0 rounded-full px-2.5 py-0.5
              text-[10px] sm:text-xs md:text-sm ${accentChipClass(tone, isDark)}`}
          >
            {tally}
          </span>
        )}
      </div>

      {/*
        The floor is a touch target, not a shape: a bin given a short fixed height
        by its canvas (a tray, a countdown strip) must not quietly grow its content
        area past the box the layout measured, or the objects placed against that
        box land outside it.
      */}
      <div className="flex-1 min-h-[44px] relative">
        {isEmpty && emptyHint && (
          <div
            className={`absolute inset-1 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center
              gap-2 text-center px-3 pointer-events-none transition-opacity duration-200
              ${active ? accentTextClass(tone, isDark) : emptySlotClass(isDark)}`}
          >
            {emptyIcon}
            <span className="text-[11px] sm:text-xs md:text-sm font-bold tracking-tight max-w-[22ch]">
              {emptyHint}
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
});

CanvasBin.displayName = "CanvasBin";
