/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authoring one chart column at a time: its picture, its word, and how many.
 *
 * Those three were spread across the panel — artwork in one dropdown restricted to eleven
 * shapes, the count in another, and the label nowhere at all, so the words stayed at the
 * "Apples, Pears, Plums" defaults while an author changed the pictures under them. Each column
 * is now one block, the picker is the shared catalog grid (shapes, sprites, emoji, *and* the
 * account's own SVG library), and picking artwork names the column after it.
 */

import React, { useState } from "react";
import { Palette } from "lucide-react";
import { PanelProps, PanelSection, SelectField, SliderField, TextField } from "../panelKit";
import { dataAnswer, dataPrompt, normalizeDataConfig, type DataQuestionKind } from "../../canvases/DataChartCanvas";
import {
  ASSET_PLURAL,
  assetForLabel,
  findAsset,
  shapeForLabel,
  type CatalogAsset,
  type ShapeAssetType,
} from "../../../assets/assetCatalog";
import { useSvgLibrary } from "../../../assets/SvgLibraryContext";
import { AssetGrid, CatalogAssetView } from "../../ui/AssetGrid";
import { Button, Dialog, Label } from "../../ui";

/** What a column of this artwork should be called: a shape's plural, or the asset's own name. */
const labelForAsset = (asset: CatalogAsset): string =>
  ASSET_PLURAL[asset.id as ShapeAssetType] ?? asset.label;

export const DataChartPanel: React.FC<PanelProps> = ({ question, update }) => {
  const { assets: customAssets } = useSvgLibrary();
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const current = normalizeDataConfig({
    kind: question.config.dataKind as DataQuestionKind,
    categories: question.config.dataCategories as string[],
    counts: question.config.dataCounts as number[],
    focus: question.config.dataFocus as number,
    against: question.config.dataAgainst as number,
    assets: question.config.dataAssets as string[],
  });

  const apply = (patch: Partial<typeof current>) => {
    const next = normalizeDataConfig({ ...current, ...patch });
    update({
      targetCount: dataAnswer(next),
      // The title names the task and the instruction asks the question. Using the prompt for
      // both prints the same sentence twice — once as the heading, once as the hint.
      title: "Read the chart",
      instruction: dataPrompt(next),
      config: {
        ...question.config,
        dataKind: next.kind,
        dataCategories: next.categories,
        dataCounts: next.counts,
        dataFocus: next.focus,
        dataAgainst: next.against,
        dataAssets: next.assets,
      },
    });
  };

  const setCount = (index: number, value: number) => {
    const counts = [...current.counts];
    counts[index] = value;
    apply({ counts });
  };

  const setCategory = (index: number, value: string) => {
    const categories = [...current.categories];
    categories[index] = value;
    apply({ categories });
  };

  /**
   * Artwork and label are one decision here, because on a chart they are one thing.
   *
   * Choosing a rocket renames the column "Rockets" — unless the author has written a label of
   * their own, which is left alone. A label that merely names the artwork already there counts
   * as not-their-own, and so does an empty one.
   */
  const chooseAsset = (index: number, asset: CatalogAsset) => {
    const assets = [...current.assets];
    const categories = [...current.categories];
    const previous = current.assets[index];
    const label = categories[index] ?? "";
    const named = assetForLabel(label, customAssets);
    const followsArtwork = !label.trim()
      || (named !== undefined && (!previous || named.id === previous));

    assets[index] = asset.id;
    if (followsArtwork) categories[index] = labelForAsset(asset);
    apply({ assets, categories });
    setPickerFor(null);
  };

  /** Back to "draw whatever the label names", the default a fresh chart starts from. */
  const clearAsset = (index: number) => {
    const assets = [...current.assets];
    assets[index] = "";
    apply({ assets });
    setPickerFor(null);
  };

  const assetFor = (index: number): CatalogAsset | undefined => {
    const stored = current.assets[index];
    if (!stored || stored === "emoji") return undefined;
    return findAsset(stored, customAssets)
      // A library asset that has since been deleted still deserves a tile rather than a blank.
      ?? { id: stored, label: stored, kind: "custom", category: "Custom" };
  };

  /**
   * The one mistake this panel exists to prevent: a word over a picture of something else.
   *
   * Two shades of it. A label naming catalog artwork that is not what is drawn is an outright
   * contradiction. A label naming nothing the catalog can draw — "Pears" — is the quieter case
   * that produced flowers labelled as pears in the seeded Grade 1 set, so it is worth saying
   * out loud even though an author may well mean it.
   */
  const warningFor = (index: number): { tone: "error" | "note"; text: string } | null => {
    const label = (current.categories[index] ?? "").trim();
    const drawn = assetFor(index);
    if (!label || !drawn) return null;
    const named = assetForLabel(label, customAssets);
    if (named?.id === drawn.id) return null;
    if (named) {
      return { tone: "error", text: `Labelled "${label}" but drawn with ${drawn.label.toLowerCase()} artwork.` };
    }
    return { tone: "note", text: `Nothing in the catalogue draws a "${label}" — this column shows ${drawn.label.toLowerCase()} artwork.` };
  };

  return (
    <PanelSection title={`Data - answer ${dataAnswer(current)}`}>
      <SelectField
        label="Question"
        value={current.kind}
        onChange={value => apply({ kind: value as DataQuestionKind })}
        options={[
          { value: "count", label: "How many in one group" },
          { value: "total", label: "How many altogether" },
          { value: "more", label: "How many more than" },
          { value: "most", label: "Which group has the most" },
        ]}
      />

      {current.counts.map((count, index) => {
        const asset = assetFor(index);
        const fallbackShape = shapeForLabel(current.categories[index]);
        const warning = warningFor(index);
        return (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setPickerFor(pickerFor === index ? null : index)}
                aria-label={`Choose artwork for column ${index + 1}`}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white transition-colors hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-indigo-400/40"
              >
                {asset
                  ? <CatalogAssetView asset={asset} size={30} />
                  : fallbackShape
                    ? <CatalogAssetView asset={{ id: fallbackShape, label: fallbackShape, kind: "shape", category: "Shapes" }} size={30} />
                    : <Palette size={16} className="text-slate-400" />}
              </button>
              <div className="min-w-0 flex-1">
                <Label>{`Column ${index + 1}`}</Label>
                <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {asset ? asset.label : fallbackShape ? `${ASSET_PLURAL[fallbackShape]} — from the label` : "Pick artwork"}
                </p>
              </div>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => setPickerFor(pickerFor === index ? null : index)}
                className="shrink-0"
              >
                Choose
              </Button>
            </div>

            <TextField
              label="Label"
              value={current.categories[index] ?? ""}
              placeholder={asset ? labelForAsset(asset) : "Group"}
              onChange={value => setCategory(index, value)}
            />

            {warning && (
              <p
                className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                  warning.tone === "error"
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"
                    : "bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300"
                }`}
              >
                {warning.text}
              </p>
            )}

            <SliderField
              label="Count"
              value={count}
              min={0}
              max={10}
              onChange={value => setCount(index, value)}
            />
          </div>
        );
      })}

      {(current.kind === "count" || current.kind === "more") && (
        <SelectField
          label="Asked about"
          value={String(current.focus)}
          onChange={value => apply({ focus: Number(value) })}
          options={current.categories.map((label, index) => ({ value: String(index), label }))}
        />
      )}
      {current.kind === "more" && (
        <SelectField
          label="Compared with"
          value={String(current.against)}
          onChange={value => apply({ against: Number(value) })}
          options={current.categories.map((label, index) => ({ value: String(index), label }))}
        />
      )}

      <Dialog isOpen={pickerFor !== null} onClose={() => setPickerFor(null)} maxWidthClassName="max-w-2xl">
        <div className="pr-8">
          <p className="text-base font-black text-slate-800 dark:text-white">
            Artwork for column {(pickerFor ?? 0) + 1}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Shapes, sprites, emoji, and your own SVG library. The column takes its name from what you pick.
          </p>
        </div>
        <div className="mt-4">
          {pickerFor !== null && (
            <AssetGrid
              selectedIds={[current.assets[pickerFor] || ""]}
              onSelect={asset => chooseAsset(pickerFor, asset)}
              columns={6}
            />
          )}
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => pickerFor !== null && clearAsset(pickerFor)}
          >
            Match the label instead
          </Button>
          <Button type="button" variant="outline" onClick={() => setPickerFor(null)}>Done</Button>
        </div>
      </Dialog>
    </PanelSection>
  );
};
