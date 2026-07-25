/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Two-step drawer: pick a technique, then edit it through the exact same
 * TECHNIQUE_PANELS registry the Studio tab already uses (App.tsx:2081-2089)
 * — no second question editor, just this one reused inside a Drawer instead
 * of the Property Studio's side panel.
 */

import React, { useMemo, useState } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import { CountingQuestion } from "../../types";
import { Skill } from "../../curriculum/types";
import { Drawer, Button, Label, Input, Textarea } from "../ui";
import { TECHNIQUE_OPTIONS } from "../studio/techniqueOptions";
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
  const [query, setQuery] = useState("");

  const filteredTechniques = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return TECHNIQUE_OPTIONS;
    return TECHNIQUE_OPTIONS.filter(technique =>
      `${technique.name} ${technique.id.replaceAll("_", " ")}`.toLowerCase().includes(term)
    );
  }, [query]);

  const handleClose = () => {
    setDraft(null);
    setQuery("");
    onClose();
  };

  const selectTechnique = (tech: (typeof TECHNIQUE_OPTIONS)[number]) => {
    const blank = createBlankSkillQuestion(tech.id, skill.id);
    setDraft({ ...blank, title: tech.name });
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
    <Drawer isOpen={isOpen} onClose={handleClose} title={draft ? "New Question" : "Add Question"} widthClassName="w-full sm:w-[480px]">
      {!draft ? (
        <div className="flex min-h-0 flex-col gap-3">
          <p className="koda-admin-label text-[#6D6997]">
            Choose a technique for <strong>{skill.label}</strong>.
          </p>

          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8D89AE]" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search components…"
              aria-label="Search question components"
              className="h-10 rounded-lg border-[#E7E3F6] bg-[#FBFAFF] pl-9 pr-9 text-xs"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#8D89AE] transition-colors hover:bg-[#F0EDFC] hover:text-[#534AB7]"
                aria-label="Clear component search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="koda-admin-chip text-[#6D6997]">
              {filteredTechniques.length} of {TECHNIQUE_OPTIONS.length} components
            </span>
            {query && filteredTechniques.length > 0 && (
              <span className="koda-admin-chip text-[#8D89AE]">Filtered</span>
            )}
          </div>

          <div className="grid max-h-[calc(100vh-220px)] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {filteredTechniques.map(tech => {
              const match = tech.name.match(/^(\d+)\.\s*(.*)$/);
              const number = match?.[1];
              const label = match?.[2] ?? tech.name;
              return (
              <button
                key={tech.id}
                onClick={() => selectTechnique(tech)}
                className="group flex min-h-14 items-center gap-2.5 rounded-lg border border-[#E7E3F6] bg-[#FBFAFF] px-2.5 py-2 text-left text-xs font-medium text-[#0E0B55] transition-colors hover:border-[#7C6DD8] hover:bg-[#F4F1FD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6DD8]/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#EEEAF8] bg-white transition-colors group-hover:border-[#DCD6F2]">
                  {tech.defaultThumbnailUrl ? (
                    <img
                      src={tech.defaultThumbnailUrl}
                      alt=""
                      className="h-full w-full object-contain"
                      title="Component default thumbnail"
                    />
                  ) : tech.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{label}</span>
                  {tech.defaultThumbnailUrl && (
                    <span className="mt-0.5 block text-[9px] font-medium text-[#7C6DD8]">
                      Includes default art
                    </span>
                  )}
                </span>
                {number && <span className="koda-admin-chip shrink-0 text-[#8D89AE]">{number}</span>}
              </button>
              );
            })}

            {filteredTechniques.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-[#DCD6F2] bg-[#FBFAFF] px-4 py-8 text-center">
                <p className="koda-admin-label text-[#0E0B55]">No components found</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="koda-admin-chip mt-1 text-[#534AB7] hover:text-[#453DA0]"
                >
                  Clear search
                </button>
              </div>
            )}
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
