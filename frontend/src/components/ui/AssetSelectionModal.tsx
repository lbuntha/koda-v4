/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multi-select for a Goods Sort shelf, over the shared `AssetGrid`.
 *
 * The grid, its category tabs and its search used to be written out here as well as in four
 * other places, and this copy hardcoded its own category map. It now renders the catalog like
 * every other picker, restricted to sprites because a shelf item must be one.
 *
 * Selection is stored as bare sprite keys (`"chips"`), which is what `GOODS_CATALOG` and every
 * authored Goods Sort level use. The catalog namespaces the same artwork as `goods:chips`, so
 * the two forms are converted at this boundary and nowhere else.
 */

import React, { useState } from "react";
import { Palette } from "lucide-react";
import { spriteId, spriteKey } from "../../assets/assetCatalog";
import { AssetGrid } from "./AssetGrid";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

export interface AssetSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Bare sprite keys, e.g. `["chips", "cola"]`. */
  selectedTypes: string[];
  onApplySelection: (selectedTypes: string[]) => void;
  onOpenSvgEditor?: () => void;
}

export const AssetSelectionModal: React.FC<AssetSelectionModalProps> = ({
  isOpen,
  onClose,
  selectedTypes,
  onApplySelection,
  onOpenSvgEditor,
}) => {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedTypes);

  if (!isOpen) return null;

  const toggle = (key: string) => {
    if (localSelected.includes(key)) {
      // A shelf with nothing on it has no puzzle in it.
      if (localSelected.length === 1) return;
      setLocalSelected(localSelected.filter((item) => item !== key));
      return;
    }
    setLocalSelected([...localSelected, key]);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-4xl">
      <div className="relative flex w-full flex-col overflow-hidden rounded-3xl bg-white dark:bg-[#111329]">
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25 dark:bg-indigo-500">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-base font-black text-slate-800 dark:text-white sm:text-lg">
                <span>Select Goods Assets</span>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {localSelected.length} Selected
                </span>
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Pick the items that go on the shelf
              </p>
            </div>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-5">
          <AssetGrid
            kinds={["sprite"]}
            multiSelect
            columns={6}
            selectedIds={localSelected.map(spriteId)}
            onSelect={(asset) => toggle(spriteKey(asset.id))}
          />
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-white/10 dark:bg-white/[0.03] sm:flex-row">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocalSelected(["chips"])}
              className="text-xs font-extrabold text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Reset to default
            </button>

            {onOpenSvgEditor && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSvgEditor();
                }}
                className="flex items-center gap-1.5 rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900/60"
              >
                <Palette size={13} />
                <span>Open SVG Asset Editor</span>
              </button>
            )}
          </div>

          <div className="flex w-full items-center gap-2.5 sm:w-auto">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="flex-1 sm:flex-initial">
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                onApplySelection(localSelected);
                onClose();
              }}
              className="flex-1 bg-indigo-600 text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-700 sm:flex-initial"
            >
              Apply Selection
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
