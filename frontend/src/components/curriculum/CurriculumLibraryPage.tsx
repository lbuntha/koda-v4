import React, { useEffect, useMemo, useState } from "react";
import { Archive, BookOpen, ChevronLeft, ChevronRight, Plus, RotateCcw, Search } from "lucide-react";
import { academicApi, AcademicCatalog } from "../../api/academic";
import { curriculumApi, CurriculumStatus, CurriculumSummary } from "../../api/curriculum";
import { createGrade1MathTemplate, GRADE_1_MATH_TEMPLATE_COUNTS } from "../../curriculum/grade1MathTemplate";
import { Badge, Button, Card, Dialog, Input, Label, Select, Skeleton, Textarea } from "../ui";

interface CurriculumLibraryPageProps {
  onOpen: (curriculumId: string) => void;
}

interface CreateDraft {
  startingPoint: "blank" | "grade1-math";
  title: string;
  description: string;
  version: string;
  gradeId: string;
  subjectId: string;
}

const PAGE_SIZE = 10;

const statusVariant = (status: CurriculumStatus): "success" | "warning" | "secondary" =>
  status === "published" ? "success" : status === "draft" ? "warning" : "secondary";

const dateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const elapsed = Date.now() - date.getTime();
  const days = Math.floor(elapsed / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};

const ScopeChips: React.FC<{ values: { id: string; label: string }[] }> = ({ values }) => (
  <div className="flex min-w-0 flex-wrap gap-1">
    {values.slice(0, 2).map(value => (
      <span key={value.id} className="rounded-full border border-[#E7E3F6] bg-[#FBFAFF] px-2 py-1 text-[9px] font-medium text-[#6D6997]">{value.label}</span>
    ))}
    {values.length > 2 && <span className="rounded-full border border-[#DCD5FA] bg-[#F3F0FF] px-2 py-1 text-[9px] font-medium text-[#534AB7]">+{values.length - 2}</span>}
  </div>
);

const LibrarySkeleton: React.FC = () => (
  <div className="space-y-4" role="status" aria-label="Loading curricula">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20" />)}</div>
    <Skeleton className="h-16 w-full" />
    <Card className="overflow-hidden rounded-2xl border-[#E7E3F6]">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex items-center gap-4 border-b border-[#EEEAF8] p-4 last:border-0"><Skeleton className="h-10 w-10 shrink-0" /><Skeleton className="h-10 flex-1" /><Skeleton className="hidden h-8 w-48 md:block" /></div>)}
    </Card>
  </div>
);

export const CurriculumLibraryPage: React.FC<CurriculumLibraryPageProps> = ({ onOpen }) => {
  const [curricula, setCurricula] = useState<CurriculumSummary[]>([]);
  const [catalog, setCatalog] = useState<AcademicCatalog>({ grades: [], subjects: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<"" | CurriculumStatus>("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreateDraft>({ startingPoint: "blank", title: "", description: "", version: "1.0", gradeId: "", subjectId: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [curriculumResponse, academicResponse] = await Promise.all([curriculumApi.list(), academicApi.list()]);
      setCurricula(curriculumResponse.curricula);
      setCatalog(academicResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load curricula");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return curricula.filter(item => (
      (!normalized || `${item.title} ${item.description}`.toLowerCase().includes(normalized))
      && (!grade || item.grades.some(value => value.id === grade))
      && (!subject || item.subjects.some(value => value.id === subject))
      && (!status || item.status === status)
    ));
  }, [curricula, query, grade, subject, status]);

  useEffect(() => { setPage(1); }, [query, grade, subject, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeGrades = catalog.grades.filter(item => item.active);
  const activeSubjects = catalog.subjects.filter(item => item.active);
  const gradeOne = activeGrades.find(item => item.key === "grade-1" || item.code.toLowerCase() === "g1" || item.name.toLowerCase() === "grade 1");
  const gradeOneMath = gradeOne && activeSubjects.find(item => item.grade_id === gradeOne.key && (item.code.toLowerCase() === "math" || item.name.toLowerCase().includes("math")));
  const createSubjects = activeSubjects.filter(item => item.grade_id === draft.gradeId);
  const counts = {
    total: curricula.filter(item => item.status !== "archived").length,
    published: curricula.filter(item => item.status === "published").length,
    drafts: curricula.filter(item => item.status === "draft").length,
    grades: new Set(curricula.filter(item => item.status !== "archived").flatMap(item => item.grades.map(value => value.id))).size,
  };

  const openCreate = () => {
    const gradeId = gradeOne?.key || activeGrades[0]?.key || "";
    const subjectId = gradeOneMath?.key || activeSubjects.find(item => item.grade_id === gradeId)?.key || "";
    setDraft({
      startingPoint: gradeOne && gradeOneMath ? "grade1-math" : "blank",
      title: gradeOne && gradeOneMath ? "Grade 1 Mathematics" : "",
      description: gradeOne && gradeOneMath ? "A complete Grade 1 mathematics scope covering operations, place value, measurement, time, data, and geometry." : "",
      version: "1.0",
      gradeId,
      subjectId,
    });
    setCreateError(null);
    setCreateOpen(true);
  };

  const createCurriculum = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.gradeId || !draft.subjectId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await curriculumApi.create({
        title: draft.title.trim(),
        description: draft.description.trim(),
        version: draft.version.trim() || "1.0",
        primary_grade_id: draft.gradeId,
        primary_subject_id: draft.subjectId,
      });
      if (draft.startingPoint === "grade1-math" && created.id) {
        const selectedGrade = activeGrades.find(item => item.key === draft.gradeId);
        const selectedSubject = activeSubjects.find(item => item.key === draft.subjectId);
        if (!selectedGrade || !selectedSubject) throw new Error("The Grade 1 Math catalog context is unavailable.");
        const template = createGrade1MathTemplate({
          curriculumId: created.tree?.id,
          gradeId: selectedGrade.key,
          gradeLabel: selectedGrade.name,
          gradeOrder: selectedGrade.order,
          subjectId: selectedSubject.key,
          subjectLabel: selectedSubject.name,
          subjectOrder: selectedSubject.order,
          subjectCode: selectedSubject.code,
          subjectIcon: selectedSubject.icon,
          subjectColor: selectedSubject.color,
          title: draft.title.trim(),
          description: draft.description.trim(),
          version: draft.version.trim() || "1.0",
        });
        await curriculumApi.put(template, created.revision, false, created.id);
      }
      setCreateOpen(false);
      if (created.id) onOpen(created.id);
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : "Unable to create curriculum");
    } finally {
      setCreating(false);
    }
  };

  const toggleArchive = async (item: CurriculumSummary) => {
    const archived = item.status !== "archived";
    if (archived && !window.confirm(`Archive “${item.title}”? It will become read-only until restored.`)) return;
    setArchivingId(item.id);
    setError(null);
    try {
      await curriculumApi.archive(item.id, archived);
      setCurricula(current => current.map(row => row.id === item.id ? { ...row, status: archived ? "archived" : "draft", updatedAt: new Date().toISOString() } : row));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update curriculum status");
    } finally {
      setArchivingId(null);
    }
  };

  const clearFilters = () => { setQuery(""); setGrade(""); setSubject(""); setStatus(""); };

  return (
    <div className="h-full overflow-y-auto bg-[#FBFAFF] p-4 md:p-6">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="koda-admin-page-title">Curricula</h1><p className="mt-1 text-xs text-[#6D6997]">Manage learning programs across multiple grades and subjects.</p></div>
          <Button onClick={openCreate}><Plus size={14} /> New curriculum</Button>
        </div>

        {loading ? <LibrarySkeleton /> : <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[["Total curricula", counts.total], ["Published", counts.published], ["Drafts", counts.drafts], ["Grades covered", counts.grades]].map(([label, value]) => (
              <Card key={String(label)} className="border-[#E7E3F6] p-3.5 shadow-[0_3px_14px_rgba(83,74,183,0.04)]"><span className="text-[10px] font-medium text-[#6D6997]">{label}</span><strong className="mt-1 block text-xl font-semibold text-[#0E0B55]">{value}</strong></Card>
            ))}
          </div>

          {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

          <div className="grid gap-2 rounded-2xl border border-[#E7E3F6] bg-white p-3 shadow-[0_4px_18px_rgba(83,74,183,0.04)] sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_160px_180px_150px_auto]">
            <div className="relative sm:col-span-2 lg:col-span-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8D89AE]" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search curricula…" className="h-10 pl-9" /></div>
            <Select value={grade} onChange={event => setGrade(event.target.value)} className="h-10 text-xs"><option value="">All grades</option>{activeGrades.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</Select>
            <Select value={subject} onChange={event => setSubject(event.target.value)} className="h-10 text-xs"><option value="">All subjects</option>{activeSubjects.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</Select>
            <Select value={status} onChange={event => setStatus(event.target.value as "" | CurriculumStatus)} className="h-10 text-xs"><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></Select>
            <Button variant="ghost" size="sm" onClick={clearFilters} disabled={!query && !grade && !subject && !status}>Clear</Button>
          </div>

          {visible.length === 0 ? (
            <Card className="mt-3 flex flex-col items-center border-dashed border-[#DCD5FA] py-14 text-center"><BookOpen size={24} className="mb-2 text-[#8D89AE]" /><p className="text-sm font-semibold text-[#0E0B55]">No curricula found</p><p className="mt-1 text-xs text-[#6D6997]">{curricula.length ? "Try clearing a filter or changing the search." : "Create the first curriculum to begin."}</p></Card>
          ) : <>
            <Card className="mt-3 hidden overflow-hidden rounded-2xl border-[#E7E3F6] shadow-[0_6px_24px_rgba(83,74,183,0.05)] md:block">
              <div className="overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left"><thead><tr className="border-b border-[#E7E3F6] bg-[#FBFAFF]"><th className="px-4 py-3 text-[10px] font-medium text-[#6D6997]">Curriculum</th><th className="px-4 py-3 text-[10px] font-medium text-[#6D6997]">Grades</th><th className="px-4 py-3 text-[10px] font-medium text-[#6D6997]">Subjects</th><th className="px-4 py-3 text-[10px] font-medium text-[#6D6997]">Status</th><th className="px-4 py-3 text-[10px] font-medium text-[#6D6997]">Updated</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>
                {visible.map(item => <tr key={item.id} className="border-b border-[#EEEAF8] last:border-0 hover:bg-[#FCFBFF]"><td className="px-4 py-3.5"><div className="flex min-w-[220px] items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#534AB7]"><BookOpen size={15} /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#0E0B55]">{item.title}</p><p className="mt-0.5 max-w-[300px] truncate text-[10px] text-[#6D6997]">{item.description || `${item.unitCount} units · ${item.skillCount} skills`} · v{item.version}</p></div></div></td><td className="px-4 py-3.5"><ScopeChips values={item.grades} /></td><td className="px-4 py-3.5"><ScopeChips values={item.subjects} /></td><td className="px-4 py-3.5"><Badge variant={statusVariant(item.status)}>{item.status}</Badge></td><td className="whitespace-nowrap px-4 py-3.5 text-[10px] text-[#6D6997]">{dateLabel(item.updatedAt)}</td><td className="px-4 py-3.5"><div className="flex justify-end gap-2"><Button variant="outline" size="xs" onClick={() => onOpen(item.id)} disabled={item.status === "archived"}>Open</Button><Button variant="ghost" size="xs" onClick={() => void toggleArchive(item)} loading={archivingId === item.id} title={item.status === "archived" ? "Restore curriculum" : "Archive curriculum"}>{item.status === "archived" ? <RotateCcw size={12} /> : <Archive size={12} />}<span>{item.status === "archived" ? "Restore" : "Archive"}</span></Button></div></td></tr>)}
              </tbody></table></div>
              <div className="flex items-center justify-between gap-3 border-t border-[#E7E3F6] px-4 py-3 text-[10px] text-[#6D6997]"><span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={14} /></Button><span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#F3F0FF] px-2 font-medium text-[#534AB7]">{page} / {pageCount}</span><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={page === pageCount} aria-label="Next page"><ChevronRight size={14} /></Button></div></div>
            </Card>

            <div className="mt-3 grid gap-3 md:hidden">{visible.map(item => <Card key={item.id} className="border-[#E7E3F6] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#0E0B55]">{item.title}</p><p className="mt-1 line-clamp-2 text-[10px] text-[#6D6997]">{item.description || `${item.unitCount} units · ${item.skillCount} skills`} · v{item.version}</p></div><Badge variant={statusVariant(item.status)}>{item.status}</Badge></div><div className="mt-3"><ScopeChips values={item.grades} /></div><div className="mt-1.5"><ScopeChips values={item.subjects} /></div><div className="mt-3 flex items-center justify-between gap-2 border-t border-[#EEEAF8] pt-3"><span className="text-[10px] text-[#6D6997]">Updated {dateLabel(item.updatedAt).toLowerCase()}</span><div className="flex gap-2"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void toggleArchive(item)} loading={archivingId === item.id} aria-label={item.status === "archived" ? "Restore curriculum" : "Archive curriculum"}>{item.status === "archived" ? <RotateCcw size={12} /> : <Archive size={12} />}</Button><Button variant="outline" size="xs" onClick={() => onOpen(item.id)} disabled={item.status === "archived"}>Open</Button></div></div></Card>)}</div>
          </>}
        </>}
      </div>

      <Dialog isOpen={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidthClassName="max-w-lg">
        <div className="mb-5 pr-6"><h2 className="koda-admin-section-title">New curriculum</h2><p className="mt-1 text-xs text-[#6D6997]">Choose the starting grade and subject. You can expand its scope later.</p></div>
        <form onSubmit={createCurriculum} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Starting point</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={draft.startingPoint === "grade1-math" ? "secondary" : "outline"}
                className="h-auto justify-start px-3 py-2.5 text-left"
                disabled={!gradeOne || !gradeOneMath}
                onClick={() => gradeOne && gradeOneMath && setDraft(current => ({
                  ...current,
                  startingPoint: "grade1-math",
                  title: "Grade 1 Mathematics",
                  description: "A complete Grade 1 mathematics scope covering operations, place value, measurement, time, data, and geometry.",
                  gradeId: gradeOne.key,
                  subjectId: gradeOneMath.key,
                }))}
              >
                <BookOpen size={15} />
                <span><span className="block text-xs font-semibold">Grade 1 Math</span><span className="block text-[10px] font-normal opacity-70">{GRADE_1_MATH_TEMPLATE_COUNTS.units} units · {GRADE_1_MATH_TEMPLATE_COUNTS.skills} skills</span></span>
              </Button>
              <Button type="button" variant={draft.startingPoint === "blank" ? "secondary" : "outline"} className="h-auto justify-start px-3 py-2.5 text-left" onClick={() => setDraft(current => ({ ...current, startingPoint: "blank" }))}>
                <Plus size={15} />
                <span><span className="block text-xs font-semibold">Blank curriculum</span><span className="block text-[10px] font-normal opacity-70">Build the scope yourself</span></span>
              </Button>
            </div>
            {draft.startingPoint === "grade1-math" && <p className="text-[10px] leading-relaxed text-[#6D6997]">Creates an unpublished standards-aligned outline for review. Activities and learner results are not generated.</p>}
          </div>
          <div className="space-y-1.5"><Label htmlFor="new-curriculum-title">Title</Label><Input id="new-curriculum-title" autoFocus maxLength={160} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="Primary Mathematics Program" /></div>
          <div className="space-y-1.5"><Label htmlFor="new-curriculum-description">Description</Label><Textarea id="new-curriculum-description" rows={3} maxLength={2000} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="Learning scope and intended learners" /></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="new-curriculum-grade">Primary grade</Label><Select id="new-curriculum-grade" disabled={draft.startingPoint === "grade1-math"} value={draft.gradeId} onChange={event => { const gradeId = event.target.value; const subjectId = activeSubjects.find(item => item.grade_id === gradeId)?.key || ""; setDraft(current => ({ ...current, gradeId, subjectId })); }}>{activeGrades.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</Select></div><div className="space-y-1.5"><Label htmlFor="new-curriculum-subject">Primary subject</Label><Select id="new-curriculum-subject" disabled={draft.startingPoint === "grade1-math"} value={draft.subjectId} onChange={event => setDraft(current => ({ ...current, subjectId: event.target.value }))}>{createSubjects.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</Select></div></div>
          <div className="space-y-1.5"><Label htmlFor="new-curriculum-version">Version</Label><Input id="new-curriculum-version" maxLength={40} value={draft.version} onChange={event => setDraft(current => ({ ...current, version: event.target.value }))} /></div>
          <p className="rounded-xl border border-[#E7E3F6] bg-[#F3F0FF] px-3 py-2 text-[10px] leading-relaxed text-[#6D6997]">The primary context controls where Studio opens first. One curriculum can still contain several grades and subjects.</p>
          {createError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{createError}</p>}
          <div className="flex justify-end gap-2 border-t border-[#EEEAF8] pt-4"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button><Button type="submit" loading={creating} loadingText="Creating..." disabled={!draft.title.trim() || !draft.gradeId || !draft.subjectId}>{draft.startingPoint === "grade1-math" ? "Create Grade 1 draft" : "Create curriculum"}</Button></div>
        </form>
      </Dialog>
    </div>
  );
};
