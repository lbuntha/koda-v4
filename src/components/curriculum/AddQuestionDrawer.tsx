/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Two-step drawer: pick a technique, then edit it through the exact same
 * TECHNIQUE_PANELS registry the Studio tab already uses (App.tsx:2081-2089)
 * — no second question editor, just this one reused inside a Drawer instead
 * of the Property Studio's side panel.
 */

import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { CountingQuestion } from "../../types";
import { Skill } from "../../curriculum/types";
import { Drawer, Button, Label, Input, Textarea } from "../ui";
import { TECHNIQUE_OPTIONS, defaultTargetCountForTechnique } from "../studio/techniqueOptions";
import { TECHNIQUE_PANELS } from "../studio/panels";
import { LazyBoundary } from "../LazyBoundary";
import { createBlankSkillQuestion } from "./questionOps";

interface AddQuestionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  skill: Skill;
  onSave: (question: CountingQuestion) => void;
}

export const AddQuestionDrawer: React.FC<AddQuestionDrawerProps> = ({ isOpen, onClose, skill, onSave }) => {
  const [draft, setDraft] = useState<CountingQuestion | null>(null);

  const handleClose = () => {
    setDraft(null);
    onClose();
  };

  const selectTechnique = (tech: (typeof TECHNIQUE_OPTIONS)[number]) => {
    const blank = createBlankSkillQuestion(tech.id, skill.id);
    setDraft({ ...blank, title: tech.name, targetCount: defaultTargetCountForTechnique(tech.id) });
  };

  const update = (patch: Partial<CountingQuestion>) => setDraft(d => (d ? { ...d, ...patch } : d));
  const updateConfig = (patch: Partial<CountingQuestion["config"]>) =>
    setDraft(d => (d ? { ...d, config: { ...d.config, ...patch } } : d));

  const handleSave = () => {
    if (!draft) return;
    onSave(draft);
    handleClose();
  };

  const TechniquePanel = draft ? TECHNIQUE_PANELS[draft.technique] : null;

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title={draft ? "New Question" : "Add Question"} widthClassName="w-full sm:w-[420px]">
      {!draft ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Choose a technique for <strong>{skill.label}</strong>.
          </p>
          <div className="grid grid-cols-1 gap-1.5 max-h-[70vh] overflow-y-auto pr-1">
            {TECHNIQUE_OPTIONS.map(tech => (
              <button
                key={tech.id}
                onClick={() => selectTechnique(tech)}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-left text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                <span className="flex-shrink-0">{tech.icon}</span>
                <span className="truncate">{tech.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <button
            onClick={() => setDraft(null)}
            className="flex items-center gap-1 text-2xs font-bold text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <ChevronLeft size={12} /> Back to techniques
          </button>

          <div className="flex flex-col gap-1.5">
            <Label>Question Title</Label>
            <Input value={draft.title} onChange={e => update({ title: e.target.value })} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Instructions Hint</Label>
            <Textarea rows={2} value={draft.instruction} onChange={e => update({ instruction: e.target.value })} />
          </div>

          {TechniquePanel && (
            <LazyBoundary>
              <TechniquePanel question={draft} update={update} updateConfig={updateConfig} />
            </LazyBoundary>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={() => setDraft(null)} className="flex-1">
              Back
            </Button>
            <Button size="sm" onClick={handleSave} className="flex-1">
              Add Question
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
};
