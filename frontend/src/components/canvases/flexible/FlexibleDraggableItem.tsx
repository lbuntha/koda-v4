import React from "react";
import { FlexibleItem } from "./types";
import { CountingAsset } from "../../Assets";
import { accentChipClass, accentTileClass, CanvasAccent } from "../canvasTheme";
import { objectStyle } from "../objectMotion";
import { ITEM_SIZE } from "./layout";

interface FlexibleDraggableItemProps {
  item: FlexibleItem;
  isPlayMode: boolean;
  mode: string;
  accent: CanvasAccent;
  isDark: boolean;
  isDragged: boolean;
  isTapped: boolean;
  tapIndex: number;
  assetType: string;
  /**
   * Draw the card behind the object, the way a Count board does.
   *
   * Off is the historical look — artwork alone on the background. On, the object
   * rests on the slide's accent, and being counted takes the fuller chip with a
   * ring, so the two states differ in weight rather than only in opacity.
   */
  hasFrame: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onRemove: () => void;
}

export const FlexibleDraggableItem: React.FC<FlexibleDraggableItemProps> = ({
  item,
  isPlayMode,
  mode,
  accent,
  isDark,
  isDragged,
  isTapped,
  tapIndex,
  assetType,
  hasFrame,
  onPointerDown,
  onRemove
}) => {
  const isTapCount = mode === "tapcount" && isPlayMode;
  /*
    Counted objects wear the ring; everything else wears the soft tile. Matches
    `CountCanvas` exactly, because a child moving between the two boards should
    not have to learn that "counted" looks like one thing here and another
    there.
  */
  const frame = !hasFrame
    ? ""
    : isTapped
      ? `${accentChipClass(accent, isDark)} border-2`
      : `${accentTileClass(accent, isDark)} border-0`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={
        isTapCount
          ? `Item ${item.emoji}, ${isTapped ? `counted as ${tapIndex}` : "not counted yet"}. Tap to count it.`
          : `Item ${item.emoji}. Drag it to its bin.`
      }
      aria-pressed={isTapCount ? isTapped : undefined}
      onPointerDown={onPointerDown}
      /* Positioned and animated the shared way — see `objectMotion`. The design
         stage above it carries a `scale()`, which composes with this because the
         position rides on `translate` rather than on `transform`. */
      style={objectStyle({ x: item.x, y: item.y, size: ITEM_SIZE, dragging: isDragged })}
      className={`flex items-center justify-center select-none rounded-xl ${frame}
        outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/40
        ${isDragged ? "scale-125 drop-shadow-xl cursor-grabbing" : "cursor-grab"}
        ${isTapCount ? "cursor-pointer hover:scale-110 active:scale-95" : ""}
        ${!isPlayMode ? "group hover:ring-2 hover:ring-indigo-400/40" : ""}`}
    >
      <span className={isTapped ? "opacity-40 grayscale-[40%]" : ""}>
        <CountingAsset
          type={(item.type || assetType) as any}
          emoji={item.emoji}
          size={Math.round(ITEM_SIZE * (hasFrame ? 0.82 : 0.92))}
        />
      </span>

      {/* The number this item was given as it was counted */}
      {isTapCount && isTapped && (
        <span
          className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold h-5 w-5 rounded-full flex items-center justify-center animate-scale-in ${accentChipClass(accent, isDark)}`}
        >
          {tapIndex}
        </span>
      )}

      {/* Authoring affordances */}
      {!isPlayMode && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[9px] hover:bg-rose-600 shadow cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity z-20"
            aria-label="Remove item"
          >
            ×
          </button>

          {item.targetBin && (
            <span className={`absolute -bottom-1 -left-1 text-[7px] font-bold px-1 rounded-full pointer-events-none ${accentChipClass("emerald", isDark)}`}>
              Target
            </span>
          )}
        </>
      )}
    </div>
  );
};
