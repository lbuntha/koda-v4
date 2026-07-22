/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real question grid for one Skill: read, preview, edit, reorder (up/down —
 * no drag library in the project's dependencies, see the build plan), and
 * delete.
 */

import React, { useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, Sparkles, ListOrdered, Eye, Pencil } from "lucide-react";
import { CountingQuestion } from "../../types";
import { CurriculumTree, Skill, SkillCoverage, getSkillPath, formatSkillPath } from "../../curriculum/types";
import { filterAndSortBySkill, formatTechniqueLabel } from "./questionOps";
import { Badge, Button } from "../ui";

interface SkillDetailProps {
  skill: Skill;
  tree: CurriculumTree;
  coverage: SkillCoverage;
  questions: CountingQuestion[];
  onDeleteQuestion: (questionId: string) => void;
  onReorderQuestions: (orderedIds: string[]) => void;
  onAddQuestion: () => void;
  onFillWithAi: () => void;
  onPreviewQuestion: (questionId: string) => void;
  onEditQuestion: (questionId: string) => void;
}

export const SkillDetail: React.FC<SkillDetailProps> = ({
  skill,
  tree,
  coverage,
  questions,
  onDeleteQuestion,
  onReorderQuestions,
  onAddQuestion,
  onFillWithAi,
  onPreviewQuestion,
  onEditQuestion,
}) => {
  const path = getSkillPath(skill.id, tree);
  const [isReordering, setIsReordering] = useState(false);

  const skillQuestions = filterAndSortBySkill(questions, skill.id);

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= skillQuestions.length) return;
    const orderedIds = skillQuestions.map(q => q.id);
    [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];
    onReorderQuestions(orderedIds);
  };

  return (
    <div className="p-6 md:p-8">
      {path && (
        <span className="block text-2xs font-mono uppercase tracking-widest text-slate-400 mb-1.5">
          {formatSkillPath(path)}
        </span>
      )}
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-xl font-extrabold text-slate-800">{skill.label}</h1>
        <Badge variant={coverage.isComplete ? "success" : "warning"}>
          {coverage.questionCount}/{coverage.minQuestions}
        </Badge>
      </div>
      {skill.description && <p className="text-xs text-slate-500 mb-1">{skill.description}</p>}
      {skill.standardRef && <span className="text-2xs font-mono text-slate-400">{skill.standardRef}</span>}

      <div className="flex items-center gap-2 mt-6 mb-4">
        <Button size="sm" onClick={onAddQuestion} className="gap-1.5">
          <Plus size={13} /> Add Question
        </Button>
        <Button size="sm" variant="secondary" onClick={onFillWithAi} className="gap-1.5">
          <Sparkles size={13} /> Fill with AI
        </Button>
        <Button
          size="sm"
          variant={isReordering ? "default" : "outline"}
          onClick={() => setIsReordering(v => !v)}
          className="gap-1.5 ml-auto"
          disabled={skillQuestions.length < 2}
        >
          <ListOrdered size={13} /> {isReordering ? "Done Reordering" : "Reorder"}
        </Button>
      </div>

      {skillQuestions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
          <p className="text-xs text-slate-400">No questions yet — add one or fill this skill with AI.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {skillQuestions.map((q, index) => (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-700 leading-snug flex-1 truncate">{q.title}</h4>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onPreviewQuestion(q.id)}
                    title="Preview question"
                    className="text-slate-300 hover:text-indigo-500 transition-colors cursor-pointer"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => onEditQuestion(q.id)}
                    title="Edit question"
                    className="text-slate-300 hover:text-indigo-500 transition-colors cursor-pointer"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDeleteQuestion(q.id)}
                    title="Delete question"
                    className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-2xs">{formatTechniqueLabel(q.technique)}</Badge>
                <span className="text-2xs font-mono text-slate-400">target {q.targetCount}</span>
              </div>

              {isReordering && (
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 mt-1">
                  <button
                    onClick={() => moveQuestion(index, -1)}
                    disabled={index === 0}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default text-2xs font-bold cursor-pointer"
                  >
                    <ArrowUp size={11} /> Up
                  </button>
                  <button
                    onClick={() => moveQuestion(index, 1)}
                    disabled={index === skillQuestions.length - 1}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default text-2xs font-bold cursor-pointer"
                  >
                    <ArrowDown size={11} /> Down
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
