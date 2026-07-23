/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Edits one existing question in place, scoped to Curriculum Studio.
 * Mirrors the main Studio tab's Property Studio (Visual / Rules / AI), minus
 * the Design tab (drag-position authoring needs the full canvas workspace)
 * and JSON tab (raw schema editing isn't part of the curriculum flow) — both
 * stay exclusive to the Studio tab. Visual reuses AssetPicker, Rules reuses
 * TECHNIQUE_PANELS, AI reuses AiGeneratorPanel: no new editing logic here,
 * just this drawer's chrome around the same pieces the Studio tab is built
 * from, plus a live CanvasPreview so changes are visible without leaving it.
 */

import React, { useState, useEffect } from "react";
import { Eye, Sliders, Wand2 } from "lucide-react";
import { CountingQuestion, CustomSvgAsset } from "../../types";
import { Drawer, Button, Label, Input, Textarea, Tabs, TabsList, TabsTrigger, TabsContent } from "../ui";
import { TECHNIQUE_PANELS } from "../studio/panels";
import { CanvasPreview } from "../studio/CanvasPreview";
import { LazyBoundary } from "../LazyBoundary";
import { AssetPicker } from "../studio/AssetPicker";
import { AiGeneratorPanel } from "../studio/ai-generator";

interface EditQuestionDrawerProps {
  question: CountingQuestion | null;
  questions: CountingQuestion[];
  customSvgs: CustomSvgAsset[];
  onClose: () => void;
  onSave: (question: CountingQuestion) => void;
  onOpenSvgMaker?: () => void;
}

export const EditQuestionDrawer: React.FC<EditQuestionDrawerProps> = ({
  question,
  questions,
  customSvgs,
  onClose,
  onSave,
  onOpenSvgMaker,
}) => {
  const [draft, setDraft] = useState<CountingQuestion | null>(question);
  const [activeTab, setActiveTab] = useState<"visual" | "rules" | "ai">("visual");

  // Re-seed the draft (and land back on Visual) whenever a different question is opened for editing.
  useEffect(() => {
    setDraft(question);
    setActiveTab("visual");
  }, [question]);

  const update = (patch: Partial<CountingQuestion>) => setDraft(d => (d ? { ...d, ...patch } : d));
  const updateConfig = (patch: Partial<CountingQuestion["config"]>) =>
    setDraft(d => (d ? { ...d, config: { ...d.config, ...patch } } : d));

  const handleSave = () => {
    if (!draft) return;
    onSave(draft);
    onClose();
  };

  const TechniquePanel = draft ? TECHNIQUE_PANELS[draft.technique] : null;
  const hasCustomLayout = !!(
    draft?.config?.customPositions ||
    draft?.config?.containerPositions ||
    (draft?.config as any)?.basketDimensions ||
    (draft?.config as any)?.shelfDimensions ||
    (draft?.config as any)?.plateDimensions
  );

  return (
    <Drawer isOpen={!!question} onClose={onClose} title="Edit Question" widthClassName="w-full sm:w-[460px]">
      {draft && (
        <div className="space-y-5">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)}>
            <TabsList className="grid grid-cols-3 gap-1 w-full">
              <TabsTrigger value="visual" className="flex items-center justify-center gap-1 text-[11px] font-bold">
                <Eye size={12} className="text-indigo-500" />
                <span>Visual</span>
              </TabsTrigger>
              <TabsTrigger value="rules" className="flex items-center justify-center gap-1 text-[11px] font-bold">
                <Sliders size={12} className="text-purple-500" />
                <span>Rules</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center justify-center gap-1 text-[11px] font-bold">
                <Wand2 size={12} className="text-fuchsia-500" />
                <span>AI ✨</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <Label>Question Title</Label>
                <Input value={draft.title} onChange={e => update({ title: e.target.value })} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Instructions Hint</Label>
                <Textarea rows={2} value={draft.instruction} onChange={e => update({ instruction: e.target.value })} />
              </div>

              <AssetPicker
                question={draft}
                customSvgs={customSvgs}
                onOpenSvgMaker={onOpenSvgMaker}
                onSelectObject={(item) => {
                  const patch: Partial<CountingQuestion> = { objectId: item.id };
                  if (item.assetType) {
                    patch.config = { ...draft.config, assetType: item.assetType };
                  }
                  update(patch);
                }}
                onSelectCustomSvg={(asset) => {
                  update({
                    objectId: "custom_svg",
                    config: {
                      ...draft.config,
                      assetType: "custom_svg",
                      customSvgAssetId: asset.id,
                      customSvgMarkup: asset.markup,
                      customSvgLabel: asset.label,
                      customSvgScale: asset.scale,
                    },
                  });
                }}
              />
            </TabsContent>

            <TabsContent value="rules" className="space-y-5">
              {TechniquePanel && <LazyBoundary><TechniquePanel question={draft} update={update} updateConfig={updateConfig} /></LazyBoundary>}

              {hasCustomLayout && (
                <Button
                  onClick={() =>
                    updateConfig({
                      customPositions: undefined,
                      layoutReference: undefined,
                      containerPositions: undefined,
                      basketDimensions: undefined,
                      shelfDimensions: undefined,
                      plateDimensions: undefined,
                    } as any)
                  }
                  variant="destructive"
                  className="w-full text-xs font-bold"
                >
                  Reset Custom Layouts &amp; Positions
                </Button>
              )}
            </TabsContent>

            <TabsContent value="ai">
              <AiGeneratorPanel
                activeQuestion={draft}
                questions={questions}
                updateActiveQuestion={update}
                onSwitchToVisual={() => setActiveTab("visual")}
              />
            </TabsContent>
          </Tabs>

          <div className="pt-3 border-t border-slate-100">
            <Label>Live Preview</Label>
            <CanvasPreview
              question={draft}
              className="w-full min-h-[280px] rounded-2xl border border-slate-200 bg-white p-2 overflow-hidden mt-1.5"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
};
