import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Search } from "lucide-react";
import { analyticsApi, AnalyticsStudent } from "../api/analytics";
import { Button, Input, SkeletonCard } from "../components/ui";
import { ChildAnalyticsDrawer } from "./ChildAnalyticsDrawer";

export const AnalyticsRosterPage: React.FC = () => {
  const [students, setStudents] = useState<AnalyticsStudent[]>([]);
  const [selected, setSelected] = useState<AnalyticsStudent | null>(null);
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
            <div key={student.id} className="flex items-center gap-3 rounded-2xl border border-[#E7E3F6] bg-white p-4 shadow-[0_5px_20px_rgba(83,74,183,0.05)]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F1EDFF] text-2xl">{student.avatar ?? "🧒"}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#17143D]">{student.name}</p>
                <p className="koda-admin-secondary mt-0.5">Mastery, activity, and next steps</p>
              </div>
              <Button size="xs" variant="outline" onClick={() => setSelected(student)}>
                <BarChart3 size={13} /> View
              </Button>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-[#DCD6F2] bg-white/60 p-10 text-center koda-admin-secondary">No learners found.</div>}
      </div>
      <ChildAnalyticsDrawer student={selected} onClose={() => setSelected(null)} />
    </>
  );
};
