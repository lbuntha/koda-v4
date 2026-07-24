import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { academicApi, GradeCatalogInput, GradeCatalogItem, SubjectCatalogInput, SubjectCatalogItem } from "../api/academic";
import type { GradeBand } from "../api/auth";
import { Button, Card, Input, Label, Select, Skeleton, SkeletonCard, SkeletonText, Textarea } from "../components/ui";

// Mirrors backend default_band_for_order — the band a grade gets when unset.
const autoBand = (order: number): GradeBand => (order <= 6 ? "kid" : order <= 9 ? "student" : "focus");
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const codeify = (value: string) => value.toUpperCase().trim().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

const emptyGrade = (): GradeCatalogInput => ({ key: "", code: "", name: "", description: "", age_range: "", order: 1, layout_band: null, active: true, revision: 0 });
const emptySubject = (gradeId = ""): SubjectCatalogInput => ({ key: "", grade_id: gradeId, code: "", name: "", description: "", icon: "", color: "#534AB7", order: 1, active: true, revision: 0 });
const gradeInput = (item: GradeCatalogItem): GradeCatalogInput => ({ key: item.key, code: item.code, name: item.name, description: item.description, age_range: item.age_range, order: item.order, layout_band: item.layout_band, active: item.active, revision: item.revision });
const subjectInput = (item: SubjectCatalogItem): SubjectCatalogInput => ({ key: item.key, grade_id: item.grade_id, code: item.code, name: item.name, description: item.description, icon: item.icon, color: item.color, order: item.order, active: item.active, revision: item.revision });
const sortGrades = (items: GradeCatalogItem[]) => [...items].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
const sortSubjects = (items: SubjectCatalogItem[]) => [...items].sort((a, b) => a.grade_id.localeCompare(b.grade_id) || a.order - b.order || a.name.localeCompare(b.name));
const upsertByKey = <T extends { key: string }>(items: T[], saved: T): T[] => [...items.filter(item => item.key !== saved.key), saved];

interface CatalogCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onNew: () => void;
  children: React.ReactNode;
}

const CatalogCard: React.FC<CatalogCardProps> = ({ title, description, icon, onNew, children }) => (
  <Card className="min-w-0 border-[#E7E3F6] p-4 shadow-[0_6px_24px_rgba(83,74,183,0.06)] sm:p-5">
    <div className="flex items-start justify-between gap-3 border-b border-[#EEEAF8] pb-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#534AB7]">{icon}</span>
        <div className="min-w-0">
          <h2 className="koda-admin-card-title text-[#0E0B55]">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">{description}</p>
        </div>
      </div>
      <Button size="sm" onClick={onNew}><Plus size={14} /> New</Button>
    </div>
    {children}
  </Card>
);

const CatalogCardSkeleton: React.FC = () => (
  <SkeletonCard className="min-h-[35rem] p-4 sm:p-5">
    <div className="flex items-start gap-3 border-b border-[#EEEAF8] pb-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
      <div className="flex-1 pt-1"><Skeleton className="h-4 w-32" /><Skeleton className="mt-2 h-3 w-3/4" /></div>
      <Skeleton className="h-9 w-20" />
    </div>
    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(150px,0.72fr)_minmax(0,1.28fr)]">
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl border border-[#EEEAF8] p-3"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="mt-2 h-2.5 w-1/2" /></div>
        ))}
      </div>
      <div className="space-y-4">
        <SkeletonText lines={2} />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
        <Skeleton className="ml-auto h-9 w-28" />
      </div>
    </div>
  </SkeletonCard>
);

export const AcademicCatalogSettings: React.FC = () => {
  const [grades, setGrades] = useState<GradeCatalogItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectCatalogItem[]>([]);
  const [gradeDraft, setGradeDraft] = useState<GradeCatalogInput>(emptyGrade);
  const [subjectDraft, setSubjectDraft] = useState<SubjectCatalogInput>(emptySubject);
  const [loading, setLoading] = useState(true);
  const [savingGrade, setSavingGrade] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);
  const [deletingGradeKey, setDeletingGradeKey] = useState<string | null>(null);
  const [deletingSubjectKey, setDeletingSubjectKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await academicApi.list();
      setGrades(sortGrades(catalog.grades));
      setSubjects(sortSubjects(catalog.subjects));
      setGradeDraft(current => current.key ? (catalog.grades.find(item => item.key === current.key) ? gradeInput(catalog.grades.find(item => item.key === current.key)!) : emptyGrade()) : current);
      setSubjectDraft(current => current.key ? (catalog.subjects.find(item => item.key === current.key) ? subjectInput(catalog.subjects.find(item => item.key === current.key)!) : emptySubject(current.grade_id)) : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load curriculum models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredSubjects = useMemo(
    () => subjects.filter(item => !subjectDraft.grade_id || item.grade_id === subjectDraft.grade_id),
    [subjects, subjectDraft.grade_id],
  );

  const updateGrade = (patch: Partial<GradeCatalogInput>) => setGradeDraft(current => ({ ...current, ...patch }));
  const updateSubject = (patch: Partial<SubjectCatalogInput>) => setSubjectDraft(current => ({ ...current, ...patch }));

  const saveGrade = async () => {
    if (!gradeDraft.name.trim() || !gradeDraft.code.trim()) return setError("Grade name and code are required.");
    const payload = { ...gradeDraft, key: gradeDraft.key || slugify(gradeDraft.name), code: codeify(gradeDraft.code) };
    setSavingGrade(true); setError(null); setMessage(null);
    try {
      const saved = gradeDraft.revision ? await academicApi.updateGrade(gradeDraft.key, payload) : await academicApi.createGrade(payload);
      setGrades(current => sortGrades(upsertByKey(current, saved)));
      setGradeDraft(gradeInput(saved));
      setMessage(`${saved.name} saved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save grade");
    } finally { setSavingGrade(false); }
  };

  const saveSubject = async () => {
    if (!subjectDraft.grade_id || !subjectDraft.name.trim() || !subjectDraft.code.trim()) return setError("Subject grade, name, and code are required.");
    const payload = { ...subjectDraft, key: subjectDraft.key || `${subjectDraft.grade_id}-${slugify(subjectDraft.name)}`, code: codeify(subjectDraft.code) };
    setSavingSubject(true); setError(null); setMessage(null);
    try {
      const saved = subjectDraft.revision ? await academicApi.updateSubject(subjectDraft.key, payload) : await academicApi.createSubject(payload);
      setSubjects(current => sortSubjects(upsertByKey(current, saved)));
      setSubjectDraft(subjectInput(saved));
      setMessage(`${saved.name} saved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save subject");
    } finally { setSavingSubject(false); }
  };

  const removeGrade = async (item: GradeCatalogItem) => {
    if (!window.confirm(`Delete ${item.name}? Referenced grades cannot be deleted.`)) return;
    setDeletingGradeKey(item.key);
    setError(null); setMessage(null);
    try { await academicApi.deleteGrade(item.key); setGrades(current => current.filter(grade => grade.key !== item.key)); setGradeDraft(emptyGrade()); setMessage(`${item.name} deleted.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete grade"); }
    finally { setDeletingGradeKey(null); }
  };

  const removeSubject = async (item: SubjectCatalogItem) => {
    if (!window.confirm(`Delete ${item.name}? Referenced subjects cannot be deleted.`)) return;
    setDeletingSubjectKey(item.key);
    setError(null); setMessage(null);
    try { await academicApi.deleteSubject(item.key); setSubjects(current => current.filter(subject => subject.key !== item.key)); setSubjectDraft(emptySubject(item.grade_id)); setMessage(`${item.name} deleted.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete subject"); }
    finally { setDeletingSubjectKey(null); }
  };

  if (loading) {
    return (
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-2" role="status" aria-label="Loading grade and subject models" aria-busy="true">
        <span className="sr-only">Loading grade and subject models…</span>
        <CatalogCardSkeleton />
        <CatalogCardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="grid min-h-0 gap-4 xl:grid-cols-2">
        <CatalogCard title="Grade models" description="Manage grade identity, learner age range, order, and availability." icon={<GraduationCap size={18} />} onNew={() => setGradeDraft(emptyGrade())}>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(150px,0.72fr)_minmax(0,1.28fr)]">
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1 xl:max-h-[31rem]">
              {grades.map(item => (
                <button key={item.key} type="button" onClick={() => setGradeDraft(gradeInput(item))} className={`w-full rounded-xl border p-3 text-left transition ${gradeDraft.key === item.key ? "border-[#7C6DD8] bg-[#F5F2FF]" : "border-[#E7E3F6] bg-white hover:bg-[#FBFAFF]"}`}>
                  <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-[#0E0B55]">{item.name}</span><span className={`h-2 w-2 rounded-full ${item.active ? "bg-emerald-500" : "bg-slate-300"}`} /></span>
                  <span className="mt-1 block text-[11px] text-[#6D6997]">{item.code}{item.age_range ? ` · ${item.age_range}` : ""}</span>
                </button>
              ))}
              {grades.length === 0 && <p className="rounded-xl border border-dashed border-[#DCD6F3] p-4 text-center text-xs text-[#6D6997]">No grades yet.</p>}
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3"><div><Label>Name</Label><Input value={gradeDraft.name} onChange={e => updateGrade({ name: e.target.value })} placeholder="Grade 1" /></div><div><Label>Code</Label><Input value={gradeDraft.code} onChange={e => updateGrade({ code: e.target.value })} placeholder="G1" /></div></div>
              <div><Label>Stable key</Label><Input value={gradeDraft.key || slugify(gradeDraft.name)} disabled={gradeDraft.revision > 0} onChange={e => updateGrade({ key: slugify(e.target.value) })} placeholder="grade-1" /></div>
              <div><Label>Description</Label><Textarea rows={3} value={gradeDraft.description} onChange={e => updateGrade({ description: e.target.value })} placeholder="Learning stage and curriculum scope" /></div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Age range</Label><Input value={gradeDraft.age_range} onChange={e => updateGrade({ age_range: e.target.value })} placeholder="6–7 years" /></div><div><Label>Display order</Label><Input type="number" min={0} value={gradeDraft.order} onChange={e => updateGrade({ order: Number(e.target.value) })} /></div></div>
              <div><Label>Student page layout</Label><Select value={gradeDraft.layout_band ?? ""} onChange={e => updateGrade({ layout_band: e.target.value ? (e.target.value as GradeBand) : null })}><option value="">Auto — {autoBand(gradeDraft.order)} (from order)</option><option value="kid">Kid (grades 1–6): playful, supervised</option><option value="student">Student (grades 7–9): independent</option><option value="focus">Focus (grades 10–12): professional</option></Select></div>
              <label className="flex items-center gap-2 text-xs text-[#6D6997]"><input type="checkbox" checked={gradeDraft.active} onChange={e => updateGrade({ active: e.target.checked })} className="accent-[#534AB7]" /> Available for curriculum design</label>
              <div className="flex flex-wrap justify-end gap-2">{gradeDraft.revision > 0 && <Button variant="destructive" size="sm" onClick={() => void removeGrade(gradeDraft as GradeCatalogItem)} loading={deletingGradeKey === gradeDraft.key} loadingText="Deleting..."><Trash2 size={13} /> Delete</Button>}<Button size="sm" onClick={() => void saveGrade()} loading={savingGrade} loadingText="Saving..."><Pencil size={13} /> {gradeDraft.revision ? "Save grade" : "Create grade"}</Button></div>
            </div>
          </div>
        </CatalogCard>

        <CatalogCard title="Subject models" description="Manage subjects within a grade, including visual metadata and order." icon={<BookOpen size={18} />} onNew={() => setSubjectDraft(emptySubject(subjectDraft.grade_id || grades[0]?.key || ""))}>
          <div className="mt-4 space-y-4">
            <div><Label>Filter by grade</Label><Select value={subjectDraft.grade_id} onChange={e => setSubjectDraft(emptySubject(e.target.value))}><option value="">Select a grade</option>{grades.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</Select></div>
            <div className="grid gap-4 md:grid-cols-[minmax(150px,0.72fr)_minmax(0,1.28fr)]">
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1 xl:max-h-[27rem]">
                {filteredSubjects.map(item => (
                  <button key={item.key} type="button" onClick={() => setSubjectDraft(subjectInput(item))} className={`w-full rounded-xl border p-3 text-left transition ${subjectDraft.key === item.key ? "border-[#7C6DD8] bg-[#F5F2FF]" : "border-[#E7E3F6] bg-white hover:bg-[#FBFAFF]"}`}>
                    <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-[#0E0B55]">{item.name}</span><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.active ? item.color : "#CBD5E1" }} /></span>
                    <span className="mt-1 block text-[11px] text-[#6D6997]">{item.code}</span>
                  </button>
                ))}
                {!!subjectDraft.grade_id && filteredSubjects.length === 0 && <p className="rounded-xl border border-dashed border-[#DCD6F3] p-4 text-center text-xs text-[#6D6997]">No subjects for this grade.</p>}
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3"><div><Label>Name</Label><Input value={subjectDraft.name} onChange={e => updateSubject({ name: e.target.value })} placeholder="Mathematics" /></div><div><Label>Code</Label><Input value={subjectDraft.code} onChange={e => updateSubject({ code: e.target.value })} placeholder="MATH" /></div></div>
                <div><Label>Stable key</Label><Input value={subjectDraft.key || (subjectDraft.grade_id && subjectDraft.name ? `${subjectDraft.grade_id}-${slugify(subjectDraft.name)}` : "")} disabled={subjectDraft.revision > 0} onChange={e => updateSubject({ key: slugify(e.target.value) })} placeholder="grade-1-math" /></div>
                <div><Label>Description</Label><Textarea rows={3} value={subjectDraft.description} onChange={e => updateSubject({ description: e.target.value })} placeholder="Subject scope and learning focus" /></div>
                <div className="grid grid-cols-3 gap-3"><div><Label>Icon</Label><Input value={subjectDraft.icon} onChange={e => updateSubject({ icon: e.target.value })} placeholder="Calculator" /></div><div><Label>Color</Label><Input type="color" value={subjectDraft.color} onChange={e => updateSubject({ color: e.target.value })} className="p-1" /></div><div><Label>Order</Label><Input type="number" min={0} value={subjectDraft.order} onChange={e => updateSubject({ order: Number(e.target.value) })} /></div></div>
                <label className="flex items-center gap-2 text-xs text-[#6D6997]"><input type="checkbox" checked={subjectDraft.active} onChange={e => updateSubject({ active: e.target.checked })} className="accent-[#534AB7]" /> Available for curriculum design</label>
                <div className="flex flex-wrap justify-end gap-2">{subjectDraft.revision > 0 && <Button variant="destructive" size="sm" onClick={() => void removeSubject(subjectDraft as SubjectCatalogItem)} loading={deletingSubjectKey === subjectDraft.key} loadingText="Deleting..."><Trash2 size={13} /> Delete</Button>}<Button size="sm" onClick={() => void saveSubject()} loading={savingSubject} loadingText="Saving..."><Pencil size={13} /> {subjectDraft.revision ? "Save subject" : "Create subject"}</Button></div>
              </div>
            </div>
          </div>
        </CatalogCard>
      </div>

      {(message || error) && <div className={`rounded-xl border px-4 py-3 text-xs ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}
    </div>
  );
};
