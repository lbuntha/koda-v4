import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Users } from "lucide-react";
import { assignmentsApi, Assignment, AssignableStudent, ReleaseSummary } from "../api/assignments";
import { curriculumApi, CurriculumSummary } from "../api/curriculum";
import { Badge, Button, Card, Dialog, Label, Select, Skeleton } from "../components/ui";

export const AssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<AssignableStudent[]>([]);
  const [curricula, setCurricula] = useState<CurriculumSummary[]>([]);
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [studentId, setStudentId] = useState("");
  const [curriculumId, setCurriculumId] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignmentResponse, studentResponse, curriculumResponse] = await Promise.all([
        assignmentsApi.list(),
        assignmentsApi.students(),
        curriculumApi.list(),
      ]);
      setAssignments(assignmentResponse.assignments);
      setStudents(studentResponse.students);
      setCurricula(curriculumResponse.curricula.filter(item => item.status === "published"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selectedCurriculum = useMemo(
    () => curricula.find(item => item.id === curriculumId),
    [curricula, curriculumId],
  );

  useEffect(() => {
    if (!curriculumId) {
      setReleases([]);
      setReleaseId("");
      setGradeId("");
      return;
    }
    setLoadingReleases(true);
    void curriculumApi.releases(curriculumId)
      .then(response => {
        setReleases(response.releases);
        setReleaseId(response.releases[0]?.releaseId || "");
        setGradeId(selectedCurriculum?.grades[0]?.id || "");
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "Unable to load releases"))
      .finally(() => setLoadingReleases(false));
  }, [curriculumId, selectedCurriculum]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!studentId || !curriculumId || !releaseId || !gradeId) return;
    setSaving(true);
    setError(null);
    try {
      const created = await assignmentsApi.create({
        student_id: studentId,
        curriculum_id: curriculumId,
        release_id: releaseId,
        grade_id: gradeId,
        scope: { kind: "all", ids: [] },
        mode: "scheduled",
        placement_required: true,
      });
      setAssignments(current => [created, ...current]);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create assignment");
    } finally {
      setSaving(false);
    }
  };

  const publishRelease = async () => {
    if (!curriculumId) return;
    setPublishing(true);
    setError(null);
    try {
      const release = await curriculumApi.publishRelease(curriculumId);
      setReleases([release]);
      setReleaseId(release.releaseId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to publish release");
    } finally {
      setPublishing(false);
    }
  };

  const changeStatus = async (item: Assignment) => {
    const next = item.status === "active" ? "paused" : "active";
    setUpdating(item.id);
    try {
      const updated = await assignmentsApi.setStatus(item.id, next);
      setAssignments(current => current.map(row => row.id === item.id ? updated : row));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update assignment");
    } finally {
      setUpdating(null);
    }
  };

  const studentName = (id: string) => students.find(student => student.id === id)?.name || "Unknown student";
  const curriculumName = (id: string) => curricula.find(curriculum => curriculum.id === id)?.title || "Curriculum";

  return (
    <div className="h-full overflow-y-auto bg-[#FBFAFF] p-4 md:p-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="koda-admin-page-title">Assignments</h1>
            <p className="mt-1 text-xs text-[#6D6997]">Pin a published release to a student and start placement.</p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!students.length || !curricula.length}><Plus size={14} /> New assignment</Button>
        </div>

        {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
        {loading ? (
          <Card className="space-y-3 border-[#E7E3F6] p-5">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
          </Card>
        ) : assignments.length === 0 ? (
          <Card className="flex flex-col items-center border-dashed border-[#DCD5FA] py-16 text-center">
            <ClipboardList size={28} className="mb-2 text-[#8D89AE]" />
            <p className="text-sm font-semibold text-[#0E0B55]">No assignments yet</p>
            <p className="mt-1 max-w-sm text-xs text-[#6D6997]">Publish a curriculum release, then assign it to a student to begin placement.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden border-[#E7E3F6] p-0">
            <div className="hidden grid-cols-[1.1fr_1.4fr_1fr_100px_110px] gap-3 border-b border-[#E7E3F6] bg-[#FBFAFF] px-4 py-3 text-[10px] font-medium text-[#6D6997] md:grid">
              <span>Student</span><span>Curriculum</span><span>Release</span><span>Status</span><span />
            </div>
            {assignments.map(item => (
              <div key={item.id} className="grid gap-3 border-b border-[#EEEAF8] px-4 py-4 last:border-0 md:grid-cols-[1.1fr_1.4fr_1fr_100px_110px] md:items-center">
                <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F0FF] text-[#534AB7]"><Users size={14} /></span><span className="text-xs font-semibold text-[#0E0B55]">{studentName(item.studentId)}</span></div>
                <span className="text-xs text-[#6D6997]">{curriculumName(item.curriculumId)}</span>
                <span className="text-xs text-[#6D6997]">v{item.releaseId.slice(0, 8)} · Grade {item.gradeId}</span>
                <Badge variant={item.status === "active" ? "success" : "secondary"}>{item.status}</Badge>
                <Button variant="ghost" size="xs" loading={updating === item.id} onClick={() => void changeStatus(item)}>{item.status === "active" ? "Pause" : "Resume"}</Button>
              </div>
            ))}
          </Card>
        )}
      </div>

      <Dialog isOpen={open} onClose={() => !saving && setOpen(false)} maxWidthClassName="max-w-lg">
        <div className="mb-5"><h2 className="koda-admin-section-title">New assignment</h2><p className="mt-1 text-xs text-[#6D6997]">The student will receive a short placement from this exact release.</p></div>
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5"><Label>Student</Label><Select value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">Choose a student</option>{students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Curriculum</Label><Select value={curriculumId} onChange={event => setCurriculumId(event.target.value)}><option value="">Choose a published curriculum</option>{curricula.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Release</Label><Select value={releaseId} onChange={event => setReleaseId(event.target.value)} disabled={!curriculumId || loadingReleases}><option value="">{loadingReleases ? "Loading releases…" : "Choose release"}</option>{releases.map(release => <option key={release.releaseId} value={release.releaseId}>v{release.revision} · {release.questionCount} questions</option>)}</Select>{curriculumId && !loadingReleases && releases.length === 0 && <Button type="button" variant="ghost" size="xs" className="mt-1" onClick={() => void publishRelease()} loading={publishing} loadingText="Publishing...">Publish a release</Button>}</div><div className="space-y-1.5"><Label>Grade</Label><Select value={gradeId} onChange={event => setGradeId(event.target.value)} disabled={!selectedCurriculum}><option value="">Choose grade</option>{selectedCurriculum?.grades.map(grade => <option key={grade.id} value={grade.id}>{grade.label}</option>)}</Select></div></div>
          <div className="rounded-xl border border-[#E7E3F6] bg-[#F3F0FF] px-3 py-2 text-[10px] leading-relaxed text-[#6D6997]">Placement is generated from released, gradeable questions. Its result sets a starting frontier; it does not award mastery.</div>
          <div className="flex justify-end gap-2 border-t border-[#EEEAF8] pt-4"><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button type="submit" loading={saving} loadingText="Assigning..." disabled={!studentId || !curriculumId || !releaseId || !gradeId}>Assign student</Button></div>
        </form>
      </Dialog>
    </div>
  );
};
