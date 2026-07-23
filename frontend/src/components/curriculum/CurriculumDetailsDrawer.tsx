import React, { useEffect, useMemo, useState } from "react";
import { Clock3, FileText, History, ShieldCheck, UserRound } from "lucide-react";
import { academicApi, AcademicCatalog } from "../../api/academic";
import type { CurriculumAuditEvent, CurriculumOwner } from "../../api/curriculum";
import { curriculumApi } from "../../api/curriculum";
import type { CurriculumTree, Grade, Subject } from "../../curriculum/types";
import type { CurriculumPersistenceStatus } from "../../curriculum/useCurriculumTree";
import { Badge, Button, Drawer, Input, Label, Select, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "../ui";

export type CurriculumDetailsTab = "metadata" | "history";

interface MetadataDraft {
  title: string;
  description: string;
  version: string;
  primaryGradeId: string;
  primarySubjectId: string;
  published: boolean;
  grades: Grade[];
  subjects: Subject[];
}

interface CurriculumDetailsDrawerProps {
  curriculumId?: string;
  isOpen: boolean;
  initialTab: CurriculumDetailsTab;
  onClose: () => void;
  tree: CurriculumTree;
  owner: CurriculumOwner | null;
  revision: number;
  createdAt: string | null;
  updatedAt: string | null;
  published: boolean;
  persistenceStatus: CurriculumPersistenceStatus;
  onSave: (draft: MetadataDraft) => void;
}

const actionLabels: Record<string, string> = {
  created: "Curriculum created",
  metadata_updated: "Metadata updated",
  published: "Curriculum published",
  unpublished: "Curriculum returned to draft",
  archived: "Curriculum archived",
  restored: "Curriculum restored",
  unit_added: "Unit added",
  unit_updated: "Unit updated",
  unit_removed: "Unit removed",
  skill_added: "Skill added",
  skill_updated: "Skill updated",
  skill_removed: "Skill removed",
  scope_updated: "Grade or subject scope updated",
  worksheet_assignment_changed: "Worksheet assignment changed",
  saved: "Curriculum saved",
};

const dateLabel = (value: string | null | undefined) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
};

const itemLabels = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (!item || typeof item !== "object") return "";
    const row = item as Record<string, unknown>;
    return String(row.label || row.title || row.id || row.questionId || "");
  }).filter(Boolean);
};

const eventDetail = (event: CurriculumAuditEvent): string => {
  const summary = event.summary || {};
  const fields = Array.isArray(summary.changedFields) ? summary.changedFields.map(String) : [];
  if (fields.length) return `Changed ${fields.join(", ")}`;
  const items = itemLabels(summary.items);
  if (items.length) return items.join(", ");
  const assignments = itemLabels(summary.assignments);
  if (assignments.length) return `${assignments.length} worksheet${assignments.length === 1 ? "" : "s"}: ${assignments.join(", ")}`;
  if (event.action === "published") return "Status changed to Published";
  if (event.action === "unpublished") return "Status changed to Draft";
  if (event.action === "created") return "Initial curriculum structure and metadata saved";
  return `Revision ${event.revision}`;
};

const makeDraft = (tree: CurriculumTree, published: boolean): MetadataDraft => {
  const primaryGradeId = tree.primaryGradeId || tree.grades[0]?.id || "";
  const primarySubjectId = tree.primarySubjectId
    || tree.subjects.find(subject => subject.gradeId === primaryGradeId)?.id
    || "";
  return {
    title: tree.title || "",
    description: tree.description || "",
    version: tree.version || "1.0",
    primaryGradeId,
    primarySubjectId,
    published,
    grades: tree.grades,
    subjects: tree.subjects,
  };
};

export const CurriculumDetailsDrawer: React.FC<CurriculumDetailsDrawerProps> = ({
  curriculumId,
  isOpen,
  initialTab,
  onClose,
  tree,
  owner,
  revision,
  createdAt,
  updatedAt,
  published,
  persistenceStatus,
  onSave,
}) => {
  const [tab, setTab] = useState<CurriculumDetailsTab>(initialTab);
  const [draft, setDraft] = useState<MetadataDraft>(() => makeDraft(tree, published));
  const [submitted, setSubmitted] = useState(false);
  const [observedSaving, setObservedSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [events, setEvents] = useState<CurriculumAuditEvent[]>([]);
  const [catalog, setCatalog] = useState<AcademicCatalog>({ grades: [], subjects: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const availableSubjects = useMemo(
    () => draft.subjects.filter(subject => subject.gradeId === draft.primaryGradeId),
    [draft.subjects, draft.primaryGradeId],
  );

  const lockedSubjectIds = useMemo(() => new Set(tree.units.map(unit => unit.subjectId)), [tree.units]);
  const lockedGradeIds = useMemo(() => new Set(tree.subjects.filter(subject => lockedSubjectIds.has(subject.id)).map(subject => subject.gradeId)), [tree.subjects, lockedSubjectIds]);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    setDraft(makeDraft(tree, published));
    setSubmitted(false);
    setObservedSaving(false);
    setSaveError(null);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || tab !== "metadata") return;
    let cancelled = false;
    void academicApi.list().then(response => { if (!cancelled) setCatalog(response); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [isOpen, tab]);

  useEffect(() => {
    if (!submitted) return;
    if (persistenceStatus === "saving") setObservedSaving(true);
    if (observedSaving && persistenceStatus === "saved") {
      setSubmitted(false);
      setObservedSaving(false);
      onClose();
    } else if (observedSaving && persistenceStatus === "error") {
      setSubmitted(false);
      setObservedSaving(false);
      setSaveError("The server could not save these changes. Your local cache is still available.");
    }
  }, [submitted, observedSaving, persistenceStatus, onClose]);

  useEffect(() => {
    if (!isOpen || tab !== "history") return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    void curriculumApi.audit(100, curriculumId).then(
      response => { if (!cancelled) setEvents(response.events); },
      cause => { if (!cancelled) setHistoryError(cause instanceof Error ? cause.message : "Unable to load audit history"); },
    ).finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, tab, revision, curriculumId]);

  const unchanged = JSON.stringify(draft) === JSON.stringify(makeDraft(tree, published));
  const invalid = !draft.title.trim() || !draft.version.trim() || !draft.primaryGradeId || !draft.primarySubjectId;

  const handleSave = () => {
    if (invalid) return;
    if (unchanged) {
      onClose();
      return;
    }
    setSaveError(null);
    setSubmitted(true);
    setObservedSaving(false);
    onSave({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      version: draft.version.trim(),
    });
  };

  const toggleGrade = (gradeId: string) => {
    const included = draft.grades.some(grade => grade.id === gradeId);
    if (included && lockedGradeIds.has(gradeId)) return;
    if (included) {
      const grades = draft.grades.filter(grade => grade.id !== gradeId);
      const subjects = draft.subjects.filter(subject => subject.gradeId !== gradeId);
      const primaryGradeId = draft.primaryGradeId === gradeId ? grades[0]?.id || "" : draft.primaryGradeId;
      const primarySubjectId = subjects.some(subject => subject.id === draft.primarySubjectId)
        ? draft.primarySubjectId
        : subjects.find(subject => subject.gradeId === primaryGradeId)?.id || "";
      setDraft(current => ({ ...current, grades, subjects, primaryGradeId, primarySubjectId }));
      return;
    }
    const item = catalog.grades.find(grade => grade.key === gradeId);
    if (!item) return;
    const grade: Grade = { id: item.key, label: item.name, order: item.order, description: item.description, ageRange: item.age_range, code: item.code, active: item.active };
    setDraft(current => ({ ...current, grades: [...current.grades, grade].sort((a, b) => a.order - b.order), primaryGradeId: current.primaryGradeId || grade.id }));
  };

  const toggleSubject = (subjectId: string) => {
    const included = draft.subjects.some(subject => subject.id === subjectId);
    if (included && lockedSubjectIds.has(subjectId)) return;
    if (included) {
      const subjects = draft.subjects.filter(subject => subject.id !== subjectId);
      const primarySubjectId = draft.primarySubjectId === subjectId
        ? subjects.find(subject => subject.gradeId === draft.primaryGradeId)?.id || ""
        : draft.primarySubjectId;
      setDraft(current => ({ ...current, subjects, primarySubjectId }));
      return;
    }
    const item = catalog.subjects.find(subject => subject.key === subjectId);
    if (!item || !draft.grades.some(grade => grade.id === item.grade_id)) return;
    const subject: Subject = { id: item.key, gradeId: item.grade_id, label: item.name, order: item.order, description: item.description, code: item.code, icon: item.icon, color: item.color, active: item.active };
    setDraft(current => ({ ...current, subjects: [...current.subjects, subject].sort((a, b) => a.order - b.order), primarySubjectId: current.primarySubjectId || subject.id }));
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Curriculum details" widthClassName="w-full sm:w-[500px]">
      <Tabs value={tab} onValueChange={value => setTab(value as CurriculumDetailsTab)} variant="underline" className="flex min-h-full flex-col">
        <TabsList className="sticky top-0 z-10 bg-white" aria-label="Curriculum details sections">
          <TabsTrigger value="metadata"><FileText size={14} /> Metadata</TabsTrigger>
          <TabsTrigger value="history"><History size={14} /> Audit history</TabsTrigger>
        </TabsList>

        <TabsContent value="metadata" className="flex flex-1 flex-col pt-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="curriculum-title">Title</Label>
              <Input id="curriculum-title" value={draft.title} maxLength={160} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="Primary Mathematics" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="curriculum-description">Description</Label>
              <Textarea id="curriculum-description" rows={4} maxLength={2000} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="Purpose, learning scope, and intended learners" />
            </div>
            <div className="rounded-2xl border border-[#E7E3F6] bg-[#FBFAFF] p-4">
              <div className="mb-1 text-sm font-semibold text-[#0E0B55]">Curriculum scope</div>
              <p className="mb-3 text-[10px] leading-relaxed text-[#6D6997]">Choose every grade and subject included in this curriculum. Contexts already used by units stay locked.</p>
              <Label>Grades</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {catalog.grades.filter(item => item.active).map(item => {
                  const active = draft.grades.some(grade => grade.id === item.key);
                  const locked = active && lockedGradeIds.has(item.key);
                  return <button key={item.key} type="button" aria-pressed={active} onClick={() => toggleGrade(item.key)} title={locked ? "This grade contains units and cannot be removed" : undefined} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${active ? "border-[#534AB7] bg-[#534AB7] text-white" : "border-[#E7E3F6] bg-white text-[#6D6997] hover:border-[#7C6DD8]"} ${locked ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}>{item.name}</button>;
                })}
              </div>
              <Label className="mt-3 block">Subjects</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {catalog.subjects.filter(item => item.active && draft.grades.some(grade => grade.id === item.grade_id)).map(item => {
                  const active = draft.subjects.some(subject => subject.id === item.key);
                  const locked = active && lockedSubjectIds.has(item.key);
                  return <button key={item.key} type="button" aria-pressed={active} onClick={() => toggleSubject(item.key)} title={locked ? "This subject contains units and cannot be removed" : undefined} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${active ? "border-[#534AB7] bg-[#F3F0FF] text-[#534AB7]" : "border-[#E7E3F6] bg-white text-[#6D6997] hover:border-[#7C6DD8]"} ${locked ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}>{item.name}</button>;
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="curriculum-grade">Primary grade</Label>
                <Select
                  id="curriculum-grade"
                  value={draft.primaryGradeId}
                  onChange={event => {
                    const primaryGradeId = event.target.value;
                    const primarySubjectId = draft.subjects.find(subject => subject.gradeId === primaryGradeId)?.id || "";
                    setDraft(current => ({ ...current, primaryGradeId, primarySubjectId }));
                  }}
                >
                  {draft.grades.map(grade => <option key={grade.id} value={grade.id}>{grade.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="curriculum-subject">Primary subject</Label>
                <Select id="curriculum-subject" value={draft.primarySubjectId} onChange={event => setDraft(current => ({ ...current, primarySubjectId: event.target.value }))}>
                  {availableSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="curriculum-version">Version</Label>
                <Input id="curriculum-version" value={draft.version} maxLength={40} onChange={event => setDraft(current => ({ ...current, version: event.target.value }))} placeholder="1.0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="curriculum-status">Status</Label>
                <Select id="curriculum-status" value={draft.published ? "published" : "draft"} onChange={event => setDraft(current => ({ ...current, published: event.target.value === "published" }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E7E3F6] bg-[#FBFAFF] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0E0B55]"><ShieldCheck size={16} className="text-[#534AB7]" /> Ownership</div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#534AB7]"><UserRound size={16} /></span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{owner?.name || "Local curriculum owner"}</p>
                  <p className="truncate text-[11px] text-[#6D6997]">{owner?.email || "Server ownership appears after sign-in"}</p>
                </div>
                {owner?.role && <Badge className="ml-auto capitalize">{owner.role}</Badge>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#E7E3F6] pt-3 text-[10px] text-[#6D6997]">
                <div><span className="block font-medium text-slate-600">Created</span>{dateLabel(createdAt)}</div>
                <div><span className="block font-medium text-slate-600">Updated</span>{dateLabel(updatedAt)}</div>
              </div>
            </div>
          </div>

          {saveError && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{saveError}</p>}

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#E7E3F6] pt-4">
            <p className="text-[10px] text-[#6D6997]">Revision {revision}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={submitted}>Cancel</Button>
              <Button onClick={handleSave} disabled={invalid || submitted} loading={submitted} loadingText="Saving...">Save metadata</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="pt-5">
          {historyLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading curriculum audit history">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}
            </div>
          ) : historyError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{historyError}</p>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center text-[#6D6997]">
              <History size={24} className="mb-2 text-[#8D89AE]" />
              <p className="text-sm font-medium text-[#0E0B55]">No audit events yet</p>
              <p className="mt-1 text-xs">Changes will appear after the curriculum is saved.</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {events.map((event, index) => (
                <li key={event.id || `${event.occurred_at}-${index}`} className="rounded-2xl border border-[#E7E3F6] bg-white p-3.5 shadow-[0_2px_10px_rgba(83,74,183,0.04)]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#534AB7]"><Clock3 size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#0E0B55]">{actionLabels[event.action] || event.action.replaceAll("_", " ")}</p>
                        <Badge variant="default">r{event.revision}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#6D6997]">{eventDetail(event)}</p>
                      <p className="mt-2 text-[10px] text-[#8D89AE]">{event.actor?.name || "System"} · {dateLabel(event.occurred_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </Drawer>
  );
};
