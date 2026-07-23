/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SVG / custom-SVG-library / emoji picker for a question's objectId — the
 * same three grids App.tsx's Studio tab renders inline in its Visual panel
 * (SVG_OBJECTS, the teacher's saved custom SVGs, EMOJI_OBJECTS). Extracted so
 * a second consumer (Curriculum Studio's EditQuestionDrawer) doesn't have to
 * re-implement the same selection/highlight logic.
 */

import React from "react";
import { CountingQuestion, CountableObject, CustomSvgAsset, SVG_OBJECTS, EMOJI_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { Label } from "../ui";
import { useSvgLibrary } from "../../assets/SvgLibraryContext";

interface AssetPickerProps {
  question: CountingQuestion;
  customSvgs?: CustomSvgAsset[];
  onSelectObject: (item: CountableObject) => void;
  onSelectCustomSvg: (asset: CustomSvgAsset) => void;
  onOpenSvgMaker?: () => void;
}

export const AssetPicker: React.FC<AssetPickerProps> = ({
  question,
  customSvgs,
  onSelectObject,
  onSelectCustomSvg,
  onOpenSvgMaker,
}) => {
  const { assets: sharedSvgAssets } = useSvgLibrary();
  const availableCustomSvgs = customSvgs ?? sharedSvgAssets;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <Label>SVG Assets</Label>
          <span className="text-[9px] bg-violet-50 text-violet-600 font-mono font-bold px-1.5 py-0.5 rounded border border-violet-100 uppercase tracking-wider">
            Vector
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SVG_OBJECTS.map((item) => {
            const isSelected = question.objectId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectObject(item)}
                className={`h-11 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/25 scale-105"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}
                title={item.label}
              >
                <CountingAsset type={item.assetType as any} size={28} />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5 mt-3 border-t border-slate-100 pt-3">
          <div className="flex justify-between items-center">
            <Label className="text-[10px] text-slate-400 uppercase font-black">My Custom Library</Label>
            <span className="text-[9px] bg-indigo-50 text-indigo-600 font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">
              Library
            </span>
          </div>

          {availableCustomSvgs.length > 0 ? (
            <div className="grid grid-cols-4 gap-1.5">
              {availableCustomSvgs.map((asset) => {
                const isSelected = question.objectId === "custom_svg" && (
                  question.config?.customSvgAssetId === asset.id || question.config?.customSvgMarkup === asset.markup
                );
                return (
                  <button
                    key={asset.id}
                    onClick={() => onSelectCustomSvg(asset)}
                    className={`h-11 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/25 scale-105"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                    title={asset.label}
                  >
                    <CountingAsset type="custom_svg" customSvgMarkup={asset.markup} size={28} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-3 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <p className="text-[10px] text-slate-500 font-bold">No custom SVGs built yet</p>
              {onOpenSvgMaker && (
                <button
                  onClick={onOpenSvgMaker}
                  className="mt-1 text-[9px] text-indigo-600 hover:text-indigo-800 font-black underline cursor-pointer"
                >
                  Create Custom SVG &rarr;
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <Label>Emoji Assets</Label>
          <span className="text-[9px] bg-amber-50 text-amber-600 font-mono font-bold px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-wider">
            Emoji
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {EMOJI_OBJECTS.map((item) => {
            const isSelected = question.objectId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectObject(item)}
                className={`text-2xl h-11 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/25 scale-105"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}
                title={item.label}
              >
                {item.emoji}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
