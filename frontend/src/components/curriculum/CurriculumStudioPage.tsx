/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Top orchestrator for the Curriculum Studio tab — owns the tree, the
 * selection state, and the coverage/audit computations everything else
 * here renders from. Deliberately the only place that bridges
 * curriculum/types.ts (no CountingQuestion import, ever) with the real
 * CountingQuestion[] deck: it extracts questionSkillIds once and hands
 * plain values down, never question objects, to curriculum/* code.
 */

import React, { useEffect, useMemo, useState } from "react";
import { CountingQuestion, CustomSvgAsset } from "../../types";
import { useCurriculumTree } from "../../curriculum/useCurriculumTree";
import { EXAMPLE_QUESTIONS } from "../../curriculum/seedExample";
import { computeSkillCoverage, auditCurriculum, SkillCoverage, Skill, CurriculumIssue } from "../../curriculum/types";
import * as mutations from "../../curriculum/mutations";
import { CurriculumSidebar } from "./CurriculumSidebar";
import { UnitOverview } from "./UnitOverview";
import { SkillDetail } from "./SkillDetail";
import { AddQuestionDrawer } from "./AddQuestionDrawer";
import { FillWithAiDrawer } from "./FillWithAiDrawer";
import { CurriculumHealthDrawer } from "./CurriculumHealthDrawer";
import { QuestionPreviewModal } from "./QuestionPreviewModal";
import { EditQuestionDrawer } from "./EditQuestionDrawer";
import { spliceReordered, filterAndSortBySkill } from "./questionOps";

interface CurriculumStudioPageProps {
  questions: CountingQuestion[];
  saveQuestions: (next: CountingQuestion[]) => void;
  customSvgs: CustomSvgAsset[];
  onOpenSvgMaker: () => void;
}

export const CurriculumStudioPage: React.FC<CurriculumStudioPageProps> = ({ questions, saveQuestions, customSvgs, onOpenSvgMaker }) => {
  const { tree, setTree } = useCurriculumTree();

  const [selectedGradeId, setSelectedGradeId] = useState(tree.grades[0]?.id ?? "");
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    tree.subjects.find(s => s.gradeId === (tree.grades[0]?.id ?? ""))?.id ?? ""
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [isHealthDrawerOpen, setIsHealthDrawerOpen] = useState(false);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [isFillWithAiOpen, setIsFillWithAiOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<CountingQuestion | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<CountingQuestion | null>(null);

  // First-run seeding: a brand-new teacher should see "Counting & Number
  // Sense" at a real 10/10, not an empty tree next to a seed literally
  // named around 10 questions. Runs once; a ref-free length/id check keeps
  // it idempotent across re-renders and refreshes.
  useEffect(() => {
    const existingIds = new Set(questions.map(q => q.id));
    const missing = EXAMPLE_QUESTIONS.filter(q => !existingIds.has(q.id));
    if (missing.length === EXAMPLE_QUESTIONS.length) {
      saveQuestions([...questions, ...EXAMPLE_QUESTIONS]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const questionSkillIds = useMemo(() => questions.map(q => q.skillId), [questions]);
  const coverage = useMemo(() => computeSkillCoverage(tree, questionSkillIds), [tree, questionSkillIds]);
  const coverageBySkillId = useMemo(() => {
    const map = new Map<string, SkillCoverage>();
    coverage.forEach(c => map.set(c.skill.id, c));
    return map;
  }, [coverage]);
  const issues = useMemo(() => auditCurriculum(tree, questionSkillIds), [tree, questionSkillIds]);

  const selectedUnit = tree.units.find(u => u.id === selectedUnitId) ?? null;
  const selectedSkill = tree.skills.find(s => s.id === selectedSkillId) ?? null;

  const handleSelectGrade = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    const firstSubject = tree.subjects.find(s => s.gradeId === gradeId);
    setSelectedSubjectId(firstSubject?.id ?? "");
    setSelectedUnitId(null);
    setSelectedSkillId(null);
  };

  const handleSelectSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedUnitId(null);
    setSelectedSkillId(null);
  };

  const handleSelectUnit = (unitId: string) => {
    setSelectedUnitId(unitId);
    setSelectedSkillId(null);
  };

  const handleSelectSkill = (skillId: string) => {
    const skill = tree.skills.find(s => s.id === skillId);
    if (skill) setSelectedUnitId(skill.unitId);
    setSelectedSkillId(skillId);
  };

  const handleAddUnit = (label: string) => setTree(t => mutations.addUnit(t, selectedSubjectId, label));
  const handleAddSkill = (unitId: string, label: string) => setTree(t => mutations.addSkill(t, unitId, { label }));
  const handleEditSkill = (skill: Skill) => {
    const nextLabel = window.prompt("Skill name", skill.label);
    if (nextLabel && nextLabel.trim() && nextLabel.trim() !== skill.label) {
      setTree(t => mutations.updateSkill(t, skill.id, { label: nextLabel.trim() }));
    }
  };

  const handleDeleteQuestion = (questionId: string) => {
    saveQuestions(questions.filter(q => q.id !== questionId));
  };

  const handleReorderQuestions = (orderedIds: string[]) => {
    if (!selectedSkillId) return;
    saveQuestions(spliceReordered(questions, selectedSkillId, orderedIds));
  };

  const handleAddQuestionSave = (question: CountingQuestion) => {
    saveQuestions([...questions, question]);
  };

  const handleEditQuestionSave = (updated: CountingQuestion) => {
    saveQuestions(questions.map(q => (q.id === updated.id ? updated : q)));
  };

  const handleJumpToIssue = (issue: CurriculumIssue) => {
    if (issue.level === "skill") {
      const skill = tree.skills.find(s => s.id === issue.id);
      if (skill) {
        setSelectedUnitId(skill.unitId);
        setSelectedSkillId(skill.id);
      }
    } else if (issue.level === "unit") {
      setSelectedUnitId(issue.id);
      setSelectedSkillId(null);
    } else if (issue.level === "subject") {
      setSelectedSubjectId(issue.id);
      setSelectedUnitId(null);
      setSelectedSkillId(null);
    } else if (issue.level === "grade") {
      handleSelectGrade(issue.id);
    }
    setIsHealthDrawerOpen(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-slate-50">
      <CurriculumSidebar
        tree={tree}
        selectedGradeId={selectedGradeId}
        selectedSubjectId={selectedSubjectId}
        selectedUnitId={selectedUnitId}
        selectedSkillId={selectedSkillId}
        coverageBySkillId={coverageBySkillId}
        issueCount={issues.length}
        onSelectGrade={handleSelectGrade}
        onSelectSubject={handleSelectSubject}
        onSelectUnit={handleSelectUnit}
        onSelectSkill={handleSelectSkill}
        onAddUnit={handleAddUnit}
        onAddSkill={handleAddSkill}
        onEditSkill={handleEditSkill}
        onOpenHealthDrawer={() => setIsHealthDrawerOpen(true)}
      />

      <main className="flex-1 overflow-y-auto">
        {selectedSkill ? (
          <SkillDetail
            skill={selectedSkill}
            tree={tree}
            coverage={coverageBySkillId.get(selectedSkill.id)!}
            questions={questions}
            onDeleteQuestion={handleDeleteQuestion}
            onReorderQuestions={handleReorderQuestions}
            onAddQuestion={() => setIsAddQuestionOpen(true)}
            onFillWithAi={() => setIsFillWithAiOpen(true)}
            onPreviewQuestion={(questionId) => setPreviewQuestion(questions.find(q => q.id === questionId) ?? null)}
            onEditQuestion={(questionId) => setEditingQuestion(questions.find(q => q.id === questionId) ?? null)}
          />
        ) : selectedUnit ? (
          <UnitOverview
            unit={selectedUnit}
            skills={tree.skills.filter(s => s.unitId === selectedUnit.id).sort((a, b) => a.order - b.order)}
            coverageBySkillId={coverageBySkillId}
            onSelectSkill={handleSelectSkill}
          />
        ) : (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="text-sm font-bold text-slate-700 mb-1.5">Pick a unit to get started</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose a Unit from the sidebar to see its skills, or add a new one below the tree.
              </p>
            </div>
          </div>
        )}
      </main>

      <CurriculumHealthDrawer
        isOpen={isHealthDrawerOpen}
        onClose={() => setIsHealthDrawerOpen(false)}
        issues={issues}
        onJumpToIssue={handleJumpToIssue}
      />

      {selectedSkill && (
        <AddQuestionDrawer
          isOpen={isAddQuestionOpen}
          onClose={() => setIsAddQuestionOpen(false)}
          skill={selectedSkill}
          onSave={handleAddQuestionSave}
        />
      )}

      {selectedSkill && (
        <FillWithAiDrawer
          isOpen={isFillWithAiOpen}
          onClose={() => setIsFillWithAiOpen(false)}
          skill={selectedSkill}
          skillQuestions={filterAndSortBySkill(questions, selectedSkill.id)}
          coverage={coverageBySkillId.get(selectedSkill.id)!}
          onAddSlides={(slides) => saveQuestions([...questions, ...slides])}
        />
      )}

      <QuestionPreviewModal question={previewQuestion} onClose={() => setPreviewQuestion(null)} />

      <EditQuestionDrawer
        question={editingQuestion}
        onClose={() => setEditingQuestion(null)}
        onSave={handleEditQuestionSave}
        questions={questions}
        customSvgs={customSvgs}
        onOpenSvgMaker={onOpenSvgMaker}
      />
    </div>
  );
};
