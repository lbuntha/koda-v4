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
import { ArrowLeft, FileText, History } from "lucide-react";
import { CountingQuestion } from "../../types";
import { useCurriculumTree } from "../../curriculum/useCurriculumTree";
import { computeSkillCoverage, auditCurriculum, questionSkillIdsForCurriculum, SkillCoverage, CurriculumIssue } from "../../curriculum/types";
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
import { CurriculumStudioSkeleton } from "./CurriculumStudioSkeleton";
import { CurriculumDetailsDrawer, CurriculumDetailsTab } from "./CurriculumDetailsDrawer";
import { curriculumApi, CurriculumDrift, CurriculumReleaseImpact, CurriculumRolloutStrategy } from "../../api/curriculum";
import { isApiConfigured } from "../../api/client";
import { Badge, Button } from "../ui";
import { PublishRolloutDialog } from "./PublishRolloutDialog";

interface CurriculumStudioPageProps {
  curriculumId?: string;
  questions: CountingQuestion[];
  saveQuestions: (next: CountingQuestion[]) => void;
  onOpenSvgMaker: () => void;
  onBack?: () => void;
}

export const CurriculumStudioPage: React.FC<CurriculumStudioPageProps> = ({ curriculumId, questions, saveQuestions, onOpenSvgMaker, onBack }) => {
  const { tree, setTree, published, setPublished, persistenceStatus, loadError, owner, createdAt, updatedAt, revision } = useCurriculumTree(curriculumId);

  const [selectedGradeId, setSelectedGradeId] = useState(tree.primaryGradeId || tree.grades[0]?.id || "");
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    tree.primarySubjectId || tree.subjects.find(s => s.gradeId === (tree.primaryGradeId || tree.grades[0]?.id || ""))?.id || ""
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [isHealthDrawerOpen, setIsHealthDrawerOpen] = useState(false);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [isFillWithAiOpen, setIsFillWithAiOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<CountingQuestion | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<CountingQuestion | null>(null);
  const [detailsTab, setDetailsTab] = useState<CurriculumDetailsTab>("metadata");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [lastRelease, setLastRelease] = useState<string | null>(null);
  const [releaseImpact, setReleaseImpact] = useState<CurriculumReleaseImpact | null>(null);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);

  // The hook begins with a cached/example tree and hydrates the requested curriculum later.
  // A <select> can visually display its first option while its controlled value still points
  // at the old tree; the sidebar then filters units by that invisible stale id and looks empty.
  useEffect(() => {
    if (persistenceStatus === "loading") return;
    const nextGradeId = tree.grades.some(grade => grade.id === selectedGradeId)
      ? selectedGradeId
      : tree.primaryGradeId || tree.grades[0]?.id || "";
    const nextSubjectId = tree.subjects.some(
      subject => subject.id === selectedSubjectId && subject.gradeId === nextGradeId,
    )
      ? selectedSubjectId
      : tree.subjects.find(subject => (
          subject.id === tree.primarySubjectId && subject.gradeId === nextGradeId
        ))?.id || tree.subjects.find(subject => subject.gradeId === nextGradeId)?.id || "";
    const nextUnits = tree.units
      .filter(unit => unit.subjectId === nextSubjectId)
      .sort((a, b) => a.order - b.order);
    const nextUnitId = selectedUnitId && nextUnits.some(unit => unit.id === selectedUnitId)
      ? selectedUnitId
      : nextUnits[0]?.id || null;
    const nextSkillId = selectedSkillId && tree.skills.some(
      skill => skill.id === selectedSkillId && skill.unitId === nextUnitId,
    ) ? selectedSkillId : null;

    if (nextGradeId !== selectedGradeId) setSelectedGradeId(nextGradeId);
    if (nextSubjectId !== selectedSubjectId) setSelectedSubjectId(nextSubjectId);
    if (nextUnitId !== selectedUnitId) setSelectedUnitId(nextUnitId);
    if (nextSkillId !== selectedSkillId) setSelectedSkillId(nextSkillId);
  }, [
    persistenceStatus,
    tree.grades,
    tree.subjects,
    tree.units,
    tree.skills,
    tree.primaryGradeId,
    tree.primarySubjectId,
    selectedGradeId,
    selectedSubjectId,
    selectedUnitId,
    selectedSkillId,
  ]);
  const questionSkillIds = useMemo(
    () => questionSkillIdsForCurriculum(tree, curriculumId, questions),
    [tree, curriculumId, questions],
  );
  const coverage = useMemo(() => computeSkillCoverage(tree, questionSkillIds), [tree, questionSkillIds]);
  const coverageBySkillId = useMemo(() => {
    const map = new Map<string, SkillCoverage>();
    coverage.forEach(c => map.set(c.skill.id, c));
    return map;
  }, [coverage]);
  /**
   * Drift is the one health question the browser cannot answer on its own: it needs the
   * published release's hashes. Re-read whenever the draft is saved (`revision` bumps), so
   * the warning appears as soon as an edit takes the draft away from what learners play.
   */
  const [drift, setDrift] = useState<CurriculumDrift | null>(null);
  useEffect(() => {
    if (!curriculumId || !isApiConfigured()) return;
    let cancelled = false;
    void curriculumApi.drift(curriculumId)
      .then(result => { if (!cancelled) setDrift(result); })
      .catch(() => { /* health degrades to the local checks; not worth an error banner */ });
    return () => { cancelled = true; };
  }, [curriculumId, revision, published]);

  const issues = useMemo(() => {
    const found = auditCurriculum(tree, questionSkillIds);
    if (drift?.hasRelease && drift.drifted.length > 0) {
      const parts = drift.drifted
        .map(part => ({ tree: "structure", questions: "questions", assets: "artwork" }[part]))
        .join(", ");
      found.unshift({
        level: "rewards",
        id: `release-v${drift.revision}`,
        severity: "warning",
        message:
          `Draft ${parts} differ${drift.drifted.length === 1 ? "s" : ""} from release v${drift.revision} — `
          + "learners keep playing the release until you publish.",
      });
    }
    return found;
  }, [tree, questionSkillIds, drift]);

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
  const handleEditUnit = (unitId: string, label: string) => setTree(t => mutations.renameUnit(t, unitId, label));
  const handleEditSkill = (skillId: string, label: string) => setTree(t => mutations.updateSkill(t, skillId, { label }));

  const handleDeleteQuestion = (questionId: string) => {
    saveQuestions(questions.filter(q => q.id !== questionId));
  };

  const handleReorderQuestions = (orderedIds: string[]) => {
    if (!selectedSkillId) return;
    saveQuestions(spliceReordered(questions, selectedSkillId, orderedIds));
  };

  const handleAddQuestionSave = (question: CountingQuestion) => {
    saveQuestions([...questions, { ...question, curriculumId }]);
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

  if (persistenceStatus === "loading") return <CurriculumStudioSkeleton />;

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50 p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
            <span className="text-2xl">📕</span>
          </div>
          <h3 className="mb-1.5 text-sm font-bold text-slate-700">Can’t open this curriculum</h3>
          <p className="text-xs leading-relaxed text-slate-400">{loadError}</p>
          {onBack && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onBack}>
              <ArrowLeft size={14} /> Back to curricula
            </Button>
          )}
        </div>
      </div>
    );
  }

  const primaryGrade = tree.grades.find(grade => grade.id === (tree.primaryGradeId || selectedGradeId));
  const primarySubject = tree.subjects.find(subject => subject.id === (tree.primarySubjectId || selectedSubjectId));

  const openDetails = (tab: CurriculumDetailsTab) => {
    setDetailsTab(tab);
    setIsDetailsOpen(true);
  };

  const preparePublish = async () => {
    if (!curriculumId) {
      setPublished(value => !value);
      return;
    }
    if (!primaryGrade?.id || !primarySubject?.id) {
      setPublishError("Choose a primary grade and subject before publishing.");
      return;
    }
    setPublishError(null);
    setLastRelease(null);
    setPublishing(true);
    try {
      setReleaseImpact(await curriculumApi.releaseImpact(curriculumId, primaryGrade.id, primarySubject.id));
      setIsPublishDialogOpen(true);
    } catch (cause) {
      setPublishError(cause instanceof Error ? cause.message : "Unable to check this curriculum release");
    } finally {
      setPublishing(false);
    }
  };

  const publish = async (strategy: CurriculumRolloutStrategy) => {
    if (!curriculumId || !primaryGrade?.id || !primarySubject?.id) return;
    setPublishError(null);
    setPublishing(true);
    try {
      const result = await curriculumApi.publishRollout(curriculumId, {
        grade_id: primaryGrade.id,
        subject_id: primarySubject.id,
        strategy,
      });
      setPublished(true);
      setIsPublishDialogOpen(false);
      setReleaseImpact(null);
      setLastRelease(
        strategy === "new_learners"
          ? `v${result.release.revision} published · new learners will use this release · active learners kept their current path`
          : `v${result.release.revision} published · ${result.rollout.learnersUpdated} active learner${result.rollout.learnersUpdated === 1 ? "" : "s"} moved safely`,
      );
    } catch (cause) {
      setPublishError(cause instanceof Error ? cause.message : "Unable to publish this curriculum");
    } finally {
      setPublishing(false);
    }
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
        persistenceStatus={persistenceStatus}
        published={published}
        publishing={publishing}
        publishError={publishError}
        publishNotice={lastRelease}
        onPublish={() => void preparePublish()}
        onSelectGrade={handleSelectGrade}
        onSelectSubject={handleSelectSubject}
        onSelectUnit={handleSelectUnit}
        onSelectSkill={handleSelectSkill}
        onAddUnit={handleAddUnit}
        onAddSkill={handleAddSkill}
        onEditUnit={handleEditUnit}
        onEditSkill={handleEditSkill}
        onOpenHealthDrawer={() => setIsHealthDrawerOpen(true)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* One line on a desktop: title, state, and context share a row rather than stacking. */}
        <header className="flex shrink-0 flex-col gap-2 border-b border-[#E7E3F6] bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {onBack && (
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Back to curricula" title="Back to curricula">
                <ArrowLeft size={14} />
              </Button>
            )}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="truncate text-sm font-semibold text-[#0E0B55]">{tree.title || "Untitled curriculum"}</h1>
              <Badge variant={published ? "success" : "default"}>{published ? "Published" : "Draft"}</Badge>
              {tree.version && <Badge variant="default">v{tree.version}</Badge>}
              <span className="truncate text-[11px] text-[#6D6997]">
                {[primaryGrade?.label, primarySubject?.label, owner?.name ? `Owned by ${owner.name}` : null].filter(Boolean).join(" · ") || "Add curriculum metadata"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => openDetails("history")}><History size={13} /> History</Button>
            <Button variant="secondary" size="sm" onClick={() => openDetails("metadata")}><FileText size={13} /> Details</Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
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
            onUpdateSkill={patch => setTree(current => mutations.updateSkill(current, selectedSkill.id, patch))}
          />
        ) : selectedUnit ? (
          <UnitOverview
            unit={selectedUnit}
            skills={tree.skills.filter(s => s.unitId === selectedUnit.id).sort((a, b) => a.order - b.order)}
            coverageBySkillId={coverageBySkillId}
            onSelectSkill={handleSelectSkill}
            onUpdateUnit={patch => setTree(current => mutations.updateUnit(current, selectedUnit.id, patch))}
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
      </div>

      <CurriculumHealthDrawer
        isOpen={isHealthDrawerOpen}
        onClose={() => setIsHealthDrawerOpen(false)}
        issues={issues}
        onJumpToIssue={handleJumpToIssue}
        onRepairQuestionIssue={issue => {
          saveQuestions(questions.map(question => (
            question.skillId === issue.id ? { ...question, skillId: undefined } : question
          )));
        }}
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
          onAddSlides={(slides) => saveQuestions([
            ...questions,
            ...slides.map(question => ({ ...question, curriculumId })),
          ])}
        />
      )}

      <QuestionPreviewModal question={previewQuestion} onClose={() => setPreviewQuestion(null)} />

      <EditQuestionDrawer
        question={editingQuestion}
        onClose={() => setEditingQuestion(null)}
        onSave={handleEditQuestionSave}
        questions={questions}
        onOpenSvgMaker={onOpenSvgMaker}
      />

      <CurriculumDetailsDrawer
        curriculumId={curriculumId}
        isOpen={isDetailsOpen}
        initialTab={detailsTab}
        onClose={() => setIsDetailsOpen(false)}
        tree={tree}
        owner={owner}
        revision={revision}
        createdAt={createdAt}
        updatedAt={updatedAt}
        published={published}
        persistenceStatus={persistenceStatus}
        onSave={draft => {
          setTree(current => ({
            ...current,
            title: draft.title,
            description: draft.description,
            version: draft.version,
            primaryGradeId: draft.primaryGradeId,
            primarySubjectId: draft.primarySubjectId,
            grades: draft.grades,
            subjects: draft.subjects,
            rewards: draft.rewards,
          }));
          setPublished(draft.published);
          setSelectedGradeId(draft.primaryGradeId);
          setSelectedSubjectId(draft.primarySubjectId);
          setSelectedUnitId(null);
          setSelectedSkillId(null);
        }}
      />

      <PublishRolloutDialog
        isOpen={isPublishDialogOpen}
        impact={releaseImpact}
        gradeLabel={primaryGrade?.label || "Primary grade"}
        subjectLabel={primarySubject?.label || "Primary subject"}
        publishing={publishing}
        onClose={() => {
          if (!publishing) setIsPublishDialogOpen(false);
        }}
        onPublish={strategy => void publish(strategy)}
      />
    </div>
  );
};
