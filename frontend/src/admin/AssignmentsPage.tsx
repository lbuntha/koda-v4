import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpCircle, ChevronLeft, ChevronRight, ClipboardList, Plus, Trash2, Users } from "lucide-react";
import { assignmentsApi, Assignment, AssignableStudent, ReleaseSummary } from "../api/assignments";
import { curriculumApi, CurriculumSummary } from "../api/curriculum";
import { Badge, Button, ConfirmModal, Dialog, Label, Select, SectionCard, Skeleton } from "../components/ui";
import { CurriculumPromotion, promotionsApi } from "../api/promotions";
import { KidAvatar } from "../components/KidAvatar";

const PAGE_SIZE = 10;

export const AssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<AssignableStudent[]>([]);
  const [curricula, setCurricula] = useState<CurriculumSummary[]>([]);
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [latestRelease, setLatestRelease] = useState<Record<string, ReleaseSummary>>({});
  const [promotions, setPromotions] = useState<CurriculumPromotion[]>([]);
  const [studentId, setStudentId] = useState("");
  const [curriculumId, setCurriculumId] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  /** The assignment awaiting a remove confirmation, if any. */
  const [confirmRemove, setConfirmRemove] = useState<Assignment | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(assignments.length / PAGE_SIZE));
  const visibleAssignments = useMemo(
    () => assignments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [assignments, page]
  );

  useEffect(() => {
    setPage(1);
  }, [assignments.length]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignmentResponse, studentResponse, curriculumResponse, promotionResponse] = await Promise.all([
        assignmentsApi.list(),
        assignmentsApi.students(),
        curriculumApi.list(),
        promotionsApi.adminList(),
      ]);
      setAssignments(assignmentResponse.assignments);
      setStudents(studentResponse.students);
      setCurricula(curriculumResponse.curricula.filter(item => item.status === "published"));
      setPromotions(promotionResponse.promotions);
      // Releases are immutable and assignments pin one, so a learner can sit on old content
      // indefinitely. Knowing the newest release per curriculum is what lets a row say so.
      const assignedCurricula = [...new Set(assignmentResponse.assignments.map(row => row.curriculumId))];
      const latest = await Promise.all(assignedCurricula.map(async id => {
        try {
          const response = await curriculumApi.releases(id);
          return [id, response.releases[0]] as const;
        } catch {
          return [id, undefined] as const;
        }
      }));
      setLatestRelease(Object.fromEntries(
        latest.filter((entry): entry is readonly [string, ReleaseSummary] => Boolean(entry[1])),
      ));
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

  const removeAssignment = async (item: Assignment) => {
    setUpdating(item.id);
    try {
      await assignmentsApi.remove(item.id);
      setAssignments(current => current.filter(row => row.id !== item.id));
      setPromotions(current => current.filter(row => row.fromAssignmentId !== item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove assignment");
      throw cause;
    } finally {
      setUpdating(null);
    }
  };

  const upgradeRelease = async (item: Assignment, releaseSummary: ReleaseSummary) => {
    setUpdating(item.id);
    setError(null);
    try {
      const updated = await assignmentsApi.setRelease(item.id, releaseSummary.releaseId);
      setAssignments(current => current.map(row => row.id === item.id ? updated : row));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the release");
    } finally {
      setUpdating(null);
    }
  };

  const studentName = (id: string) => students.find(student => student.id === id)?.name || "Unknown student";
  const studentAvatar = (id: string) => students.find(student => student.id === id)?.avatar ?? null;
  const curriculumName = (id: string) => curricula.find(curriculum => curriculum.id === id)?.title || "Curriculum";

  // No wrapper padding or background here: DashboardLayout already supplies both, and
  // adding them again doubled the gap between the toolbar and the table.
  return (
    <>
      {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      <SectionCard
        title={`All assignments (${assignments.length})`}
        action={
          <Button size="sm" onClick={() => setOpen(true)} disabled={!students.length || !curricula.length}>
            <Plus size={14} /> New assignment
          </Button>
        }
      >
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
          </div>
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <ClipboardList size={28} className="mb-2 text-[#8D89AE]" />
            <p className="text-sm font-semibold text-[#0E0B55] dark:text-white">No assignments yet</p>
            <p className="mt-1 max-w-sm text-xs text-[#6D6997] dark:text-slate-400">Publish a curriculum release, then assign it to a student to begin placement.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E7E3F6] bg-[#FBFAFF] dark:border-white/10 dark:bg-white/5">
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#6D6997] dark:text-slate-400">Student</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#6D6997] dark:text-slate-400">Curriculum</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#6D6997] dark:text-slate-400">Release & Grade</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#6D6997] dark:text-slate-400">Status</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-[#6D6997] dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEAF8] dark:divide-white/5">
                  {visibleAssignments.map(item => {
                    const newest = latestRelease[item.curriculumId];
                    const behind = newest && newest.releaseId !== item.releaseId;
                    const promotion = promotions.find(row => row.fromAssignmentId === item.id);
                    const formattedGrade = item.gradeId ? `Grade ${item.gradeId.replace(/^(grade-?|g)/i, "")}` : "Grade 1";
                    const shortRelease = item.releaseId.length > 14 ? `${item.releaseId.slice(0, 10)}…` : item.releaseId;

                    return (
                      <tr key={item.id} className="hover:bg-[#FCFBFF] transition-colors dark:hover:bg-white/5">
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex items-center gap-2.5">
                            {/* Same avatar treatment as the child rows in User Management;
                                the generic icon only stands in when nothing is stored. */}
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F3F0FF] p-0.5 text-[#534AB7] dark:bg-violet-400/15 dark:text-[#CDBEFF]">
                              {studentAvatar(item.studentId) ? (
                                <KidAvatar
                                  avatar={studentAvatar(item.studentId) ?? undefined}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <Users size={14} />
                              )}
                            </span>
                            <span className="font-semibold text-[#0E0B55] dark:text-white text-xs">{studentName(item.studentId)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <span className="font-medium text-[#0E0B55] text-xs dark:text-slate-200">{curriculumName(item.curriculumId)}</span>
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-md border border-[#E7E3F6] bg-[#FBFAFF] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#534AB7] dark:border-white/10 dark:bg-white/5 dark:text-[#CDBEFF]">
                                {shortRelease}
                              </span>
                              <span className="text-xs text-[#6D6997] dark:text-slate-400 font-medium">{formattedGrade}</span>
                            </div>
                            {behind && (
                              <button
                                type="button"
                                onClick={() => void upgradeRelease(item, newest)}
                                disabled={updating === item.id}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#DCD5FA] bg-[#F3F0FF] px-2 py-0.5 text-[9px] font-bold text-[#534AB7] transition-colors hover:bg-[#E9E3FF] disabled:opacity-60"
                                title="This learner is on an older release. Published changes reach them only after this update."
                              >
                                <ArrowUpCircle size={11} /> Update to v{newest.revision}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex flex-col items-start gap-0.5">
                            <Badge variant={item.status === "active" ? "success" : "secondary"}>
                              {item.status === "active" ? "Active" : "Paused"}
                            </Badge>
                            {promotion && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                                promotion.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-[#F3F0FF] text-[#534AB7] dark:bg-violet-400/20 dark:text-[#CDBEFF]"
                              }`}>
                                Promotion {promotion.status}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant={item.status === "active" ? "outline" : "default"}
                              size="xs"
                              loading={updating === item.id}
                              onClick={() => void changeStatus(item)}
                              className="cursor-pointer"
                            >
                              {item.status === "active" ? "Pause" : "Resume"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={updating === item.id}
                              onClick={() => setConfirmRemove(item)}
                              className="cursor-pointer text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                              title="Remove this assignment"
                            >
                              <Trash2 size={12} />
                              <span>Remove</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {assignments.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-[#E7E3F6] px-5 py-3 text-xs text-[#6D6997] dark:border-white/10 dark:text-slate-400">
                <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, assignments.length)} of {assignments.length}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer"
                    onClick={() => setPage(v => Math.max(1, v - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#F3F0FF] px-2 text-xs font-bold text-[#534AB7] dark:bg-violet-400/20 dark:text-[#CDBEFF]">
                    {page} / {pageCount}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer"
                    onClick={() => setPage(v => Math.min(pageCount, v + 1))}
                    disabled={page === pageCount}
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

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

      <ConfirmModal
        isOpen={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => {
          if (confirmRemove) await removeAssignment(confirmRemove);
        }}
        variant="danger"
        title={`Remove ${studentName(confirmRemove?.studentId ?? "")}’s assignment?`}
        description="Their placement result and progress position for this assignment go with it. Completed work stays in their history, so XP and streaks are unaffected. This cannot be undone — pause it instead if you only want to stop it for now."
        confirmText="Remove"
      />
    </>
  );
};
