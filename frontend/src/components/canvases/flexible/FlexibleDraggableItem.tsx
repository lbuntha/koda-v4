import React from "react";
import { FlexibleItem } from "./types";
import { CountingAsset } from "../../Assets";

interface FlexibleDraggableItemProps {
  item: FlexibleItem;
  isPlayMode: boolean;
  mode: string;
  isDragged: boolean;
  isTapped: boolean;
  tapIndex: number;
  assetType: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onRemove: () => void;
}

export const FlexibleDraggableItem: React.FC<FlexibleDraggableItemProps> = ({
  item,
  isPlayMode,
  mode,
  isDragged,
  isTapped,
  tapIndex,
  assetType,
  onPointerDown,
  onRemove
}) => {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{ 
        position: "absolute",
        left: `${item.x}px`, 
        top: `${item.y}px` 
      }}
      className={`absolute w-11 h-11 flex items-center justify-center text-2xl transition-all select-none
        ${isDragged ? "z-40 scale-125 cursor-grabbing drop-shadow-xl" : "z-20 cursor-grab"}
        ${mode === "tapcount" && isPlayMode ? "cursor-pointer hover:scale-110 active:scale-95" : ""}
        ${!isPlayMode ? "group cursor-grab border border-transparent hover:border-indigo-400 hover:bg-indigo-50/10 rounded-lg" : ""}
      `}
    >
      {/* Item Emoji */}
      <span className={`select-none select-none-all ${isTapped ? "opacity-40 filter grayscale-[40%]" : ""}`}>
        <CountingAsset 
          type={(item.type || assetType) as any} 
          emoji={item.emoji} 
          size={36} 
        />
      </span>

      {/* Show numbering tag in tapcount mode */}
      {mode === "tapcount" && isTapped && (
        <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[9px] font-bold h-5 w-5 rounded-full flex items-center justify-center shadow animate-bounce">
          {tapIndex}
        </span>
      )}

      {/* Drag Indicator handle in design mode */}
      {!isPlayMode && (
        <div className="absolute inset-0 flex flex-col justify-between p-0.5 pointer-events-none">
          {/* Delete Button on top right */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[9px] hover:bg-rose-600 shadow cursor-pointer opacity-0 group-hover:opacity-100 pointer-events-auto transition-opacity"
          >
            ×
          </button>
          
          {/* Target bind indicator on bottom left */}
          {item.targetBin && (
            <span className="absolute -bottom-1 -left-1 bg-emerald-500 text-white text-[7px] font-bold px-1 rounded-full border border-white">
              Target
            </span>
          )}
        </div>
      )}
    </div>
  );
};
