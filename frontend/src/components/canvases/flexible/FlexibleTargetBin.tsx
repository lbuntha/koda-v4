import React from "react";
import { FlexibleTarget, FlexibleItem } from "./types";
import { CanvasBin } from "../CanvasBin";
import { CanvasAccent } from "../canvasTheme";
import { CountingAsset } from "../../Assets";

interface FlexibleTargetBinProps {
  target: FlexibleTarget;
  isPlayMode: boolean;
  isDark: boolean;
  accent: CanvasAccent;
  localItems: FlexibleItem[];
  draggedTargetId: string | null;
  isActiveDropTarget: boolean;
  isItemInTarget: (item: FlexibleItem, target: FlexibleTarget) => boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onRemove: () => void;
}

/**
 * A sorting basket.
 *
 * The chrome is `CanvasBin`'s, so a bin here reads exactly like the bins in
 * every other activity — same label, same live tally, same "the drag is over
 * me" ring. It used to draw its own: a dashed border in one of four colours
 * chosen by the *backdrop* the teacher picked, which made the same basket look
 * like a different kind of thing on a chalkboard slide than on a meadow one.
 *
 * Positioned by the canvas: bins here are authored at fixed coordinates on the
 * design grid, so the wrapper carries the position and the bin fills it.
 */
export const FlexibleTargetBin: React.FC<FlexibleTargetBinProps> = ({
  target,
  isPlayMode,
  isDark,
  accent,
  localItems,
  draggedTargetId,
  isActiveDropTarget,
  isItemInTarget,
  onPointerDown,
  onRemove
}) => {
  const placedInside = localItems.filter(item => isItemInTarget(item, target));
  const expected = localItems.filter(item => item.targetBin === target.id);
  const isComplete = expected.length > 0 && placedInside.length >= expected.length;

  /* What belongs in here, shown faded while it is empty: the child can see what
     this basket is for without being able to read its label. */
  const ghosts = Array.from(
    new Map(expected.map(item => [`${item.emoji}|${item.type || ""}`, item])).values()
  ).slice(0, 3);

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: `${target.x}px`,
        top: `${target.y}px`,
        width: `${target.width}px`,
        height: `${target.height}px`,
        zIndex: draggedTargetId === target.id ? 40 : 10
      }}
      className={`group select-none touch-none ${
        draggedTargetId === target.id ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <CanvasBin
        className="w-full h-full"
        label={target.label}
        tally={isPlayMode && expected.length > 0 ? `${placedInside.length} / ${expected.length}` : undefined}
        accent={accent}
        isDark={isDark}
        active={isActiveDropTarget}
        complete={isComplete}
        isEmpty={placedInside.length === 0}
        emptyHint={placedInside.length === 0 && ghosts.length === 0 ? "Place items here" : undefined}
      >
        {placedInside.length === 0 && ghosts.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-25 grayscale-[15%] select-none pointer-events-none">
            {ghosts.map(item => (
              <CountingAsset key={item.id} type={(item.type || "emoji") as any} emoji={item.emoji} size={26} />
            ))}
          </div>
        )}
      </CanvasBin>

      {/* Remove, in design mode */}
      {!isPlayMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] hover:bg-rose-600 shadow cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity z-20"
          aria-label={`Remove ${target.label}`}
        >
          ×
        </button>
      )}
    </div>
  );
};
