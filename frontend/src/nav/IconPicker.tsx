/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Grid of the available menu icons. The selected name is stored on the menu.
 */

import React from "react";
import { useSvgLibrary } from "../assets/SvgLibraryContext";
import { SvgLibraryAsset } from "../assets/SvgLibraryAsset";
import { ICON_NAMES, resolveIcon, SVG_ICON_PREFIX } from "./icons";

export const IconPicker: React.FC<{ value: string; onChange: (name: string) => void }> = ({ value, onChange }) => {
  const { assets } = useSvgLibrary();

  return (
    <div className="space-y-3">
      {assets.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#6D6997]">SVG Library</p>
          <div className="grid grid-cols-7 gap-1.5">
            {assets.map(asset => {
              const ref = `${SVG_ICON_PREFIX}${asset.id}`;
              const active = value === ref;
              return (
                <button
                  key={asset.id}
                  type="button"
                  title={asset.label}
                  onClick={() => onChange(ref)}
                  className={`flex aspect-square cursor-pointer items-center justify-center rounded-lg transition-all ${active ? "bg-indigo-100 ring-2 ring-indigo-500" : "bg-slate-50 hover:bg-slate-100"}`}
                >
                  <SvgLibraryAsset assetId={asset.id} size={22} />
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#6D6997]">Standard icons</p>
        <div className="grid grid-cols-7 gap-1.5">
          {ICON_NAMES.map((name) => {
            const Icon = resolveIcon(name);
            const active = value === name;
            return (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => onChange(name)}
                className={`flex aspect-square cursor-pointer items-center justify-center rounded-lg transition-all ${active ? "bg-indigo-100 text-indigo-600 ring-2 ring-indigo-500" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
