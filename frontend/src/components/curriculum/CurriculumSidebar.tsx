/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Genuinely new — not a reskin of components/ui/Sidebar.tsx (that component
 * is app-specific chrome: hardcoded nav items, an OpenAI key panel, a
 * launch button). This is a Unit → Skill tree, nothing else.
 *
 * Grade/Subject is a compact switcher up top, not a tree level — a teacher
 * works inside one grade/subject for an entire session, so it doesn't earn
 * permanent nested tree space. The persistent tree below is exactly two
 * levels (Unit → Skill); a Unit row shows a rollup ring (how many of its
 * skills are complete), a Skill row shows its own coverage chip — different
 * information, so different visual weight.
 */

import React, { useState } from "react";
import { BookOpen, Plus, Pencil, AlertTriangle, Search, Cloud, CloudOff, Loader2, Send } from "lucide-react";
import { Select, Input, Badge, Button } from "../ui";
import { CurriculumTree, Grade, Subject, Unit, Skill, SkillCoverage, subjectHasQuestionSupport } from "../../curriculum/types";
import { CurriculumPersistenceStatus } from "../../curriculum/useCurriculumTree";

interface CurriculumSidebarProps {
  tree: CurriculumTree;
  selectedGradeId: string;
  selectedSubjectId: string;
  selectedUnitId: string | null;
  selectedSkillId: string | null;
  coverageBySkillId: Map<string, SkillCoverage>;
  issueCount: number;
  persistenceStatus: CurriculumPersistenceStatus;
  published: boolean;
  onTogglePublished: () => void;
  onSelectGrade: (gradeId: string) => void;
  onSelectSubject: (subjectId: string) => void;
  onSelectUnit: (unitId: string) => void;
  onSelectSkill: (skillId: string) => void;
  onAddUnit: (label: string) => void;
  onAddSkill: (unitId: string, label: string) => void;
  onEditUnit: (unitId: string, label: string) => void;
  onEditSkill: (skillId: string, label: string) => void;
  onOpenHealthDrawer: () => void;
}

export const CurriculumSidebar: React.FC<CurriculumSidebarProps> = ({
  tree,
  selectedGradeId,
  selectedSubjectId,
  selectedUnitId,
  selectedSkillId,
  coverageBySkillId,
  issueCount,
  persistenceStatus,
  published,
  onTogglePublished,
  onSelectGrade,
  onSelectSubject,
  onSelectUnit,
  onSelectSkill,
  onAddUnit,
  onAddSkill,
  onEditUnit,
  onEditSkill,
  onOpenHealthDrawer,
}) => {
  const [query, setQuery] = useState("");
  const [addingUnitLabel, setAddingUnitLabel] = useState<string | null>(null);
  const [addingSkillFor, setAddingSkillFor] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const subjects = tree.subjects.filter(s => s.gradeId === selectedGradeId);
  const units = tree.units.filter(u => u.subjectId === selectedSubjectId).sort((a, b) => a.order - b.order);
  const selectedSubject = tree.subjects.find(s => s.id === selectedSubjectId);
  const subjectHasTechniques = selectedSubject ? subjectHasQuestionSupport(selectedSubject) : true;

  const matchesQuery = (label: string) => !query.trim() || label.toLowerCase().includes(query.trim().toLowerCase());

  const commitAddUnit = () => {
    if (draftLabel.trim()) onAddUnit(draftLabel.trim());
    setAddingUnitLabel(null);
    setDraftLabel("");
  };

  const commitAddSkill = (unitId: string) => {
    if (draftLabel.trim()) onAddSkill(unitId, draftLabel.trim());
    setAddingSkillFor(null);
    setDraftLabel("");
  };

  const cancelEdit = () => {
    setEditingUnitId(null);
    setEditingSkillId(null);
    setEditLabel("");
  };

  const commitEditUnit = (unit: Unit) => {
    const label = editLabel.trim();
    if (label && label !== unit.label) onEditUnit(unit.id, label);
    cancelEdit();
  };

  const commitEditSkill = (skill: Skill) => {
    const label = editLabel.trim();
    if (label && label !== skill.label) onEditSkill(skill.id, label);
    cancelEdit();
  };

  return (
    <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
      {/* Brand */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0">
          <BookOpen size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xs font-extrabold text-slate-800 leading-none">Curriculum Studio</h2>
          <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-slate-400">
            {persistenceStatus === "loading" || persistenceStatus === "saving" ? <Loader2 size={9} className="animate-spin" /> : persistenceStatus === "error" ? <CloudOff size={9} /> : <Cloud size={9} />}
            {persistenceStatus === "loading" ? "Loading" : persistenceStatus === "saving" ? "Saving" : persistenceStatus === "error" ? "Offline cache" : "MongoDB saved"}
          </span>
        </div>
      </div>

      {/* Grade / Subject context switcher — not a tree level */}
      <div className="p-3 border-b border-slate-100 grid grid-cols-2 gap-2">
        <Select value={selectedGradeId} onChange={(e) => onSelectGrade(e.target.value)} className="h-9 text-xs px-2.5">
          {tree.grades.map(g => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </Select>
        <Select value={selectedSubjectId} onChange={(e) => onSelectSubject(e.target.value)} className="h-9 text-xs px-2.5">
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>
      </div>

      {!subjectHasTechniques && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[10.5px] text-amber-800 leading-snug">
            No question types support <strong>{selectedSubject?.label}</strong> yet — every technique today is a counting interaction.
          </p>
        </div>
      )}

      {/* Search */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a unit or skill…"
            className="h-8 pl-7 text-[11.5px]"
          />
        </div>
      </div>

      {/* Unit -> Skill tree */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
        {units.map(unit => {
          const skills = tree.skills
            .filter(s => s.unitId === unit.id)
            .sort((a, b) => a.order - b.order)
            .filter(s => matchesQuery(s.label) || matchesQuery(unit.label));
          if (query.trim() && skills.length === 0 && !matchesQuery(unit.label)) return null;

          const completeCount = skills.filter(s => coverageBySkillId.get(s.id)?.isComplete).length;
          const ringPct = skills.length ? completeCount / skills.length : 0;
          const isUnitActive = selectedUnitId === unit.id && !selectedSkillId;

          return (
            <div key={unit.id} className="mb-1">
              {editingUnitId === unit.id ? (
                <Input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") cancelEdit(); }}
                  onBlur={() => commitEditUnit(unit)}
                  placeholder="Unit name…"
                  aria-label={`Edit ${unit.label}`}
                  className="h-8"
                />
              ) : (
                <div className={`group flex w-full items-center rounded-lg transition-colors ${isUnitActive ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
                  <button
                    type="button"
                    onClick={() => onSelectUnit(unit.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1.5 text-left"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="8" fill="none" stroke="#E2E8F0" strokeWidth="2.6" />
                      {skills.length > 0 && (
                        <circle
                          cx="10" cy="10" r="8" fill="none" stroke={ringPct === 1 ? "#0E9F6E" : "#C2760C"} strokeWidth="2.6"
                          strokeDasharray={`${ringPct * 50.3} 50.3`} strokeLinecap="round" transform="rotate(-90 10 10)"
                        />
                      )}
                    </svg>
                    <span className="flex-1 truncate text-xs font-bold text-slate-700">{unit.label}</span>
                    <span className="flex-shrink-0 font-mono text-[10px] text-slate-400">{completeCount}/{skills.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingUnitId(unit.id); setEditingSkillId(null); setEditLabel(unit.label); }}
                    className="mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition-opacity hover:bg-white hover:text-indigo-600 focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Edit ${unit.label}`}
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              )}

              <div className="ml-4 pl-2 border-l border-slate-100 space-y-0.5 mt-0.5">
                {skills.map(skill => {
                  const cov = coverageBySkillId.get(skill.id);
                  const isActive = selectedSkillId === skill.id;
                  const dotColor = !cov || cov.questionCount === 0 ? "bg-slate-300" : cov.isComplete ? "bg-emerald-500" : "bg-amber-500";
                  return (
                    editingSkillId === skill.id ? (
                      <Input
                        key={skill.id}
                        autoFocus
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") cancelEdit(); }}
                        onBlur={() => commitEditSkill(skill)}
                        placeholder="Skill name…"
                        aria-label={`Edit ${skill.label}`}
                        className="h-8"
                      />
                    ) : (
                      <div
                        key={skill.id}
                        className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          isActive ? "bg-indigo-600" : "hover:bg-slate-50"
                        }`}
                        onClick={() => onSelectSkill(skill.id)}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-white" : dotColor}`} />
                        <span className={`text-[11.5px] flex-1 truncate ${isActive ? "text-white font-bold" : "text-slate-600"}`}>
                          {skill.label}
                        </span>
                        <Badge
                          variant={cov?.isComplete ? "success" : "warning"}
                          className={`text-[9px] px-1.5 py-0 flex-shrink-0 ${isActive ? "bg-white/20 text-white border-white/30" : ""}`}
                        >
                          {cov?.questionCount ?? 0}/{cov?.minQuestions ?? skill.minQuestions}
                        </Badge>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingSkillId(skill.id); setEditingUnitId(null); setEditLabel(skill.label); }}
                          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 ${isActive ? "text-white/80 hover:bg-white/10" : "text-slate-400 hover:bg-white hover:text-indigo-600"}`}
                          aria-label={`Edit ${skill.label}`}
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    )
                  );
                })}

                {addingSkillFor === unit.id ? (
                  <Input
                    autoFocus
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitAddSkill(unit.id); if (e.key === "Escape") { setAddingSkillFor(null); setDraftLabel(""); } }}
                    onBlur={() => commitAddSkill(unit.id)}
                    placeholder="Skill name…"
                    className="h-7 text-[11px] ml-0"
                  />
                ) : (
                  <button
                    onClick={() => { setAddingSkillFor(unit.id); setDraftLabel(""); }}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-[10.5px] text-slate-400 hover:text-indigo-600 cursor-pointer"
                  >
                    <Plus size={11} /> Add Skill
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {addingUnitLabel !== null ? (
          <Input
            autoFocus
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitAddUnit(); if (e.key === "Escape") { setAddingUnitLabel(null); setDraftLabel(""); } }}
            onBlur={commitAddUnit}
            placeholder="Unit name…"
            className="h-8 text-xs"
          />
        ) : (
          <button
            onClick={() => { setAddingUnitLabel(""); setDraftLabel(""); }}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold text-slate-400 hover:text-indigo-600 cursor-pointer"
          >
            <Plus size={12} /> Add Unit
          </button>
        )}
      </div>

      {/* Health badge */}
      <div className="p-3 border-t border-slate-100">
        <Button
          size="sm"
          variant={published ? "outline" : "default"}
          className="mb-2 w-full"
          onClick={onTogglePublished}
          disabled={persistenceStatus === "loading" || persistenceStatus === "saving"}
        >
          <Send size={12} /> {published ? "Published" : "Publish curriculum"}
        </Button>
        <button
          onClick={onOpenHealthDrawer}
          disabled={issueCount === 0}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:cursor-default ${
            issueCount > 0 ? "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100" : "bg-slate-50 border border-slate-100 text-slate-400"
          }`}
        >
          <AlertTriangle size={13} className="flex-shrink-0" />
          <span className="flex-1 text-left">Curriculum health</span>
          <span className="font-mono">{issueCount}</span>
        </button>
      </div>
    </aside>
  );
};
