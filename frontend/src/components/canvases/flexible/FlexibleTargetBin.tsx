import React from "react";
import { FlexibleTarget, FlexibleItem } from "./types";
import { surfaceClass, emptySlotClass, accentChipClass } from "../canvasTheme";
import { CountingAsset } from "../../Assets";

interface FlexibleTargetBinProps {
  target: FlexibleTarget;
  isPlayMode: boolean;
  isDark: boolean;
  bgStyle: string;
  localItems: FlexibleItem[];
  draggedTargetId: string | null;
  isActiveDropTarget: boolean;
  isItemInTarget: (item: FlexibleItem, target: FlexibleTarget) => boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onRemove: () => void;
}

export const FlexibleTargetBin: React.FC<FlexibleTargetBinProps> = ({
  target,
  isPlayMode,
  isDark,
  bgStyle,
  localItems,
  draggedTargetId,
  isActiveDropTarget,
  isItemInTarget,
  onPointerDown,
  onRemove
}) => {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{ 
        position: "absolute",
        left: `${target.x}px`, 
        top: `${target.y}px`, 
        width: `${target.width}px`, 
        height: `${target.height}px` 
      }}
      className={`absolute flex flex-col items-center justify-center p-2 rounded-2xl border-2 transition-all group select-none
        ${draggedTargetId === target.id ? "z-40 cursor-grabbing shadow-lg" : "z-10"}
        ${isPlayMode
          ? isActiveDropTarget
            ? `border-solid ${accentChipClass("emerald", isDark)} scale-105 cursor-grabbing`
            : `border-dashed ${emptySlotClass(isDark)} ${surfaceClass(isDark, "raised")} cursor-grab active:cursor-grabbing`
          : `cursor-grab border-dashed ${
              bgStyle === "board"
                ? isDark ? "border-emerald-500/30 bg-emerald-950/10 text-emerald-300" : "border-emerald-450 bg-emerald-50/20 text-emerald-600"
                : isDark ? "border-indigo-500/30 bg-indigo-950/10 text-indigo-300" : "border-indigo-300/30 bg-indigo-50/20 text-indigo-600"
            }`
        }
      `}
    >
      <span className={`text-xs font-extrabold uppercase tracking-wide truncate max-w-full ${
        isPlayMode ? (isDark ? "text-slate-200" : "text-slate-800") : ""
      }`}>
        {target.label}
      </span>
      
      {/* Show Bound Items Indicator in Design Mode */}
      {!isPlayMode && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] hover:bg-rose-600 shadow cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      )}

      {/* Visual outlines for slots inside bins */}
      <div className="w-full flex-1 flex flex-wrap items-center justify-center gap-1.5 mt-1.5 pt-1.5 border-t border-current/10">
        {(() => {
          const placedInside = localItems.filter(i => isItemInTarget(i, target));
          if (placedInside.length > 0) {
            return placedInside.map(i => (
              <span key={i.id} className="text-lg select-none select-none-all">{i.emoji}</span>
            ));
          }

          // Empty bin: show a faded "ghost" of the item(s) that belong here so
          // the child can see what goes in this basket. Derived from the item
          // bindings (targetBin), deduped by emoji + asset type.
          const expected = Array.from(
            new Map(
              localItems
                .filter(i => i.targetBin === target.id)
                .map(i => [`${i.emoji}|${i.type || ""}`, i])
            ).values()
          ).slice(0, 3);

          if (expected.length > 0) {
            return (
              <div className="flex items-center justify-center gap-1.5 opacity-25 grayscale-[15%] select-none pointer-events-none">
                {expected.map(i => (
                  <CountingAsset key={i.id} type={(i.type || "emoji") as any} emoji={i.emoji} size={26} />
                ))}
              </div>
            );
          }

          return (
            <span className={`text-[11px] font-medium ${isPlayMode ? "opacity-30" : "opacity-40"}`}>Place items here</span>
          );
        })()}
      </div>
    </div>
  );
};
