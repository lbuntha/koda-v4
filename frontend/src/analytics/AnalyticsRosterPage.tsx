import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Search, Trash2 } from "lucide-react";
import { analyticsApi, AnalyticsStudent } from "../api/analytics";
import { adminApi } from "../api/admin";
import { Button, Card, ConfirmModal, Input, SkeletonCard } from "../components/ui";
import { ChildAnalyticsDrawer } from "./ChildAnalyticsDrawer";
import { KidAvatar } from "../components/KidAvatar";

export const AnalyticsRosterPage: React.FC = () => {
  const [students, setStudents] = useState<AnalyticsStudent[]>([]);
  const [selected, setSelected] = useState<AnalyticsStudent | null>(null);
  const [deleting, setDeleting] = useState<AnalyticsStudent | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyticsApi.roster()
      .then(result => setStudents(result.students))
      .catch(caught => setError(caught instanceof Error ? caught.message : "Learners could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students.filter(student => !query || student.name.toLowerCase().includes(query));
  }, [search, students]);

  const deleteLearner = async (student: AnalyticsStudent) => {
    try {
      await adminApi.deleteStudent(student.id);
      setStudents(current => current.filter(item => item.id !== student.id));
      if (selected?.id === student.id) setSelected(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Learner could not be deleted.");
      throw caught;
    }
  };

  if (loading) {
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index} className="h-28" />)}</div>;
  }
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;

  return (
    <>
      <div className="space-y-4">
        <div className="relative max-w-xl">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-[#9893B6]" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a learner…" className="pl-10" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(student => (
            <Card key={student.id} variant="standard" className="flex items-center gap-3 p-3.5 rounded-2xl border-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EDFF] p-1 text-lg dark:bg-white/10">
                <KidAvatar avatar={student.avatar ?? undefined} className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-[#0E0B55] dark:text-[#EDECF8]">{student.name}</p>
                <p className="truncate text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">Mastery, activity, and next steps</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="xs" variant="outline" onClick={() => setSelected(student)} className="rounded-xl px-2.5 py-1 text-[11px] font-extrabold border-2">
                  <BarChart3 size={12} /> View
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setDeleting(student)}
                  className="rounded-xl px-2 py-1 text-[11px] font-extrabold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
                  aria-label={`Delete ${student.name}`}
                >
                  <Trash2 size={12} /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
        {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-[#DCD6F2] bg-white/60 p-10 text-center koda-admin-secondary">No learners found.</div>}
      </div>
      <ChildAnalyticsDrawer student={selected} onClose={() => setSelected(null)} />
      <ConfirmModal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? deleteLearner(deleting) : Promise.resolve())}
        title={`Delete ${deleting?.name ?? "this learner"}?`}
        description="This permanently deletes the learner profile, learning history, XP, mastery, and assignments. This action cannot be undone."
        confirmText="Delete learner"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
};
