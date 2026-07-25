import React, { useMemo, useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { CountingAsset } from "../Assets";
import { Button, Dialog, Select } from "../ui";
import { COUNT_OBJECTS, CountingQuestion, CountingTechnique } from "../../types";
import { TECHNIQUE_OPTIONS } from "./techniqueOptions";

export type StudioSkillFilter = "all" | CountingTechnique;

interface SkillDeckPanelProps {
  questions: CountingQuestion[];
  activeId: string;
  selectedSkillId: StudioSkillFilter;
  onSelectSkill: (skillId: StudioSkillFilter) => void;
  onSelectQuestion: (questionId: string) => void;
  onAddQuestion: (technique?: CountingTechnique) => void;
  onDeleteQuestion: (questionId: string) => void;
}

export const SkillDeckPanel: React.FC<SkillDeckPanelProps> = ({
  questions,
  activeId,
  selectedSkillId,
  onSelectSkill,
  onSelectQuestion,
  onAddQuestion,
  onDeleteQuestion,
}) => {
  const [deleteCandidate, setDeleteCandidate] = useState<CountingQuestion | null>(null);
  const visibleQuestions = useMemo(() => {
    if (selectedSkillId === "all") return questions;
    return questions.filter((question) => question.technique === selectedSkillId);
  }, [questions, selectedSkillId]);
  const selectedTechnique = selectedSkillId === "all" ? undefined : selectedSkillId;

  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-[#E7E3F6] bg-white lg:w-64 lg:border-b-0 lg:border-r">
      <div className="shrink-0 border-b border-[#EEEAF8] bg-[#FBFAFF] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F3F0FF] text-[#534AB7]">
              <BookOpen size={14} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xs font-semibold text-[#0E0B55]">Skill worksheets</h2>
              <p className="text-[10px] text-[#8D89AE]">{visibleQuestions.length} of {questions.length} cards</p>
            </div>
          </div>
        </div>

        <Select
          value={selectedSkillId}
          onChange={(event) => onSelectSkill(event.target.value as StudioSkillFilter)}
          className="h-9 text-xs"
          aria-label="Filter worksheet cards by skill"
        >
          <option value="all">All skills ({questions.length})</option>
          {TECHNIQUE_OPTIONS.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name} ({questions.filter((question) => question.technique === skill.id).length})
            </option>
          ))}
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-color:#B8AFE8_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#B8AFE8] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
        {visibleQuestions.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-[#DCD6F2] bg-[#FBFAFF] p-4 text-center">
            <p className="text-xs font-medium text-[#6D6997]">No cards in this skill</p>
            <p className="mt-1 text-[10px] text-[#8D89AE]">Add a card or assign an existing card from Properties.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleQuestions.map((question, index) => {
              const isActive = question.id === activeId;
              const activeObject = COUNT_OBJECTS.find((object) => object.id === question.objectId) || COUNT_OBJECTS[0];
              const technique = TECHNIQUE_OPTIONS.find((option) => option.id === question.technique);
              return (
                <div
                  key={question.id}
                  className={`group flex w-full items-center rounded-xl border pr-1.5 transition-colors ${isActive ? "border-[#7C6DD8] bg-[#F3F0FF]" : "border-slate-200 bg-white hover:border-[#DCD6F2] hover:bg-[#FBFAFF]"}`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectQuestion(question.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 p-2.5 text-left"
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-[10px] font-semibold ${isActive ? "border-[#B8AFE8] bg-white text-[#534AB7]" : "border-[#EEEAF8] bg-[#FBFAFF] text-slate-500"}`}>
                      {technique?.defaultThumbnailUrl ? (
                        <img
                          src={technique.defaultThumbnailUrl}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-xs font-medium ${isActive ? "text-[#0E0B55]" : "text-slate-700"}`}>
                        {question.title.replace(/^\d+\.\s*/, "")}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#8D89AE]">
                        {activeObject.id === "custom_svg" ? (
                          <CountingAsset type="custom_svg" emoji={activeObject.emoji} size={14} className="inline-block" />
                        ) : <span>{activeObject.emoji}</span>}
                        <span>Count {question.targetCount}</span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteCandidate(question)}
                    disabled={questions.length <= 1}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-60 transition-all hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-20 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`Delete ${question.title.replace(/^\d+\.\s*/, "")}`}
                    title={questions.length <= 1 ? "At least one worksheet card is required" : "Delete question"}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[#EEEAF8] bg-white p-3">
        <Button size="sm" className="w-full" onClick={() => onAddQuestion(selectedTechnique)}>
          <Plus size={14} /> {selectedTechnique ? "Add card to skill" : "Add card"}
        </Button>
      </div>

      <Dialog isOpen={Boolean(deleteCandidate)} onClose={() => setDeleteCandidate(null)} maxWidthClassName="max-w-sm">
        <div className="pr-6">
          <h3 className="text-base font-semibold text-[#0E0B55]">Delete question?</h3>
          <p className="mt-2 text-xs leading-relaxed text-[#6D6997]">
            “{deleteCandidate?.title.replace(/^\d+\.\s*/, "")}” will be removed from this skill worksheet and cannot be restored from the Studio.
          </p>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={() => setDeleteCandidate(null)}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (!deleteCandidate) return;
              onDeleteQuestion(deleteCandidate.id);
              setDeleteCandidate(null);
            }}
          >
            <Trash2 size={13} /> Delete question
          </Button>
        </div>
      </Dialog>
    </aside>
  );
};
