/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A question's countable-object picker. Now a thin wrapper over the shared `AssetGrid`, which
 * lists the whole catalog — drawable shapes, Goods Sort sprites, emoji and the account's own
 * SVG library — instead of the three hardcoded lists this used to render.
 */

import React from "react";
import { CountingQuestion } from "../../types";
import { assetSelection, type CatalogAsset } from "../../assets/assetCatalog";
import { AssetGrid } from "../ui/AssetGrid";
import { Label } from "../ui";

interface AssetPickerProps {
  question: CountingQuestion;
  onSelectAsset: (asset: CatalogAsset) => void;
  onOpenSvgMaker?: () => void;
}

/** The catalog id a question is currently drawing, for highlighting the chosen tile. */
export function selectedAssetId(question: CountingQuestion): string {
  if (question.config?.customSvgAssetId) return question.config.customSvgAssetId;
  return question.config?.assetType || question.objectId;
}

export const AssetPicker: React.FC<AssetPickerProps> = ({
  question,
  onSelectAsset,
  onOpenSvgMaker,
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      <Label>Assets</Label>
      <span className="rounded border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-violet-600">
        Catalog
      </span>
    </div>
    <AssetGrid
      selectedIds={[selectedAssetId(question)]}
      onSelect={onSelectAsset}
      emptyCustomHint={onOpenSvgMaker && (
        <button
          onClick={onOpenSvgMaker}
          className="mt-1 cursor-pointer text-[9px] font-black text-indigo-600 underline hover:text-indigo-800"
        >
          Create Custom SVG &rarr;
        </button>
      )}
    />
  </div>
);

export { assetSelection };
