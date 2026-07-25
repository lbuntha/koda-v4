import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Award,
  CalendarDays,
  Download,
  Flame,
  Lightbulb,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  Zap,
} from "lucide-react";
import {
  analyticsApi,
  ActivitySnapshot,
  AnalyticsStudent,
  MasterySnapshot,
  RecommendationSnapshot,
} from "../api/analytics";
import { useAuth } from "../auth/AuthContext";
import {
  Badge,
  Button,
  Drawer,
  Input,
  Select,
  Skeleton,
  SkeletonCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui";

type Tab = "overview" | "skills" | "activity" | "recommendations" | "data";

const LEVELS = ["not_started", "beginner", "developing", "proficient", "master"] as const;
const LEVEL_LABEL: Record<string, string> = {
  not_started: "Not started",
  beginner: "Beginner",
  developing: "Developing",
  proficient: "Proficient",
  master: "Master",
};
const LEVEL_BADGE: Record<string, "secondary" | "warning" | "default" | "success"> = {
  not_started: "secondary",
  beginner: "warning",
  developing: "default",
  proficient: "success",
  master: "success",
};

const compactDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(parsed);
};

const duration = (ms: number) => {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const AnalyticsSkeleton = () => (
  <div className="space-y-4" aria-label="Loading learning progress">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} className="h-24" />)}
    </div>
    <Skeleton className="h-48" />
    <Skeleton className="h-32" />
  </div>
);

interface Props {
  student: AnalyticsStudent | null;
  onClose: () => void;
  onDataDeleted?: () => void;
}

export const ChildAnalyticsDrawer: React.FC<Props> = ({ student, onClose, onDataDeleted }) => {
  const { account } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [mastery, setMastery] = useState<MasterySnapshot | null>(null);
  const [activity, setActivity] = useState<ActivitySnapshot | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [subject, setSubject] = useState("all");
  const [grade, setGrade] = useState("all");
  const [assignment, setAssignment] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const canManageData = account?.role === "admin" || account?.role === "parent";

  const load = useCallback(async () => {
    if (!student) return;
    setLoading(true);
    setError(null);
    try {
      const [masteryResult, activityResult, recommendationResult] = await Promise.all([
        analyticsApi.mastery(student.id),
        analyticsApi.activity(student.id),
        analyticsApi.recommendations(student.id),
      ]);
      setMastery(masteryResult);
      setActivity(activityResult);
      setRecommendations(recommendationResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Learning progress could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [student]);

  useEffect(() => {
    if (student) {
      setTab("overview");
      setSearch("");
      setLevel("all");
      setSubject("all");
      setGrade("all");
      setAssignment("all");
      setEventType("all");
      setDeleteText("");
      void load();
    }
  }, [student, load]);

  const subjects = useMemo(
    () => [...new Set((mastery?.skills ?? []).map(skill => skill.subjectId).filter((value): value is string => Boolean(value)))],
    [mastery],
  );
  const grades = useMemo(
    () => [...new Set((mastery?.skills ?? []).map(skill => skill.gradeId).filter((value): value is string => Boolean(value)))],
    [mastery],
  );
  const assignments = useMemo(
    () => [...new Set((mastery?.skills ?? []).map(skill => skill.assignmentId).filter((value): value is string => Boolean(value)))],
    [mastery],
  );
  const filteredSkills = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (mastery?.skills ?? []).filter(skill =>
      (level === "all" || skill.level === level)
      && (subject === "all" || skill.subjectId === subject)
      && (grade === "all" || skill.gradeId === grade)
      && (assignment === "all" || skill.assignmentId === assignment)
      && (!query || skill.skillLabel.toLowerCase().includes(query)),
    );
  }, [assignment, grade, level, mastery, search, subject]);
  const eventTypes = useMemo(
    () => [...new Set((activity?.events ?? []).map(event => event.eventType).filter((value): value is string => Boolean(value)))],
    [activity],
  );
  const filteredEvents = useMemo(
    () => (activity?.events ?? []).filter(event => eventType === "all" || event.eventType === eventType),
    [activity, eventType],
  );

  const downloadExport = async () => {
    if (!student) return;
    setExporting(true);
    try {
      const payload = await analyticsApi.exportData(student.id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${student.name.toLowerCase().replace(/\s+/g, "-")}-learning-data.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const purge = async () => {
    if (!student || deleteText !== "DELETE") return;
    setDeleting(true);
    try {
      await analyticsApi.purgeData(student.id, "Learning data deleted from progress dashboard");
      setDeleteText("");
      await load();
      onDataDeleted?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deletion failed.");
    } finally {
      setDeleting(false);
    }
  };

  const summary = activity?.summary;
  const practicedSkills = (mastery?.skills ?? []).filter(skill => skill.plays > 0);
  const strongestSkill = [...practicedSkills].sort((left, right) => right.score - left.score)[0];
  const supportSkills = [...practicedSkills]
    .filter(skill => skill.isDue || skill.score < 0.6)
    .sort((left, right) => left.score - right.score)
    .slice(0, 3);

  return (
    <Drawer
      isOpen={Boolean(student)}
      onClose={onClose}
      title={student ? `${student.avatar ?? "🧒"} ${student.name}'s learning progress` : undefined}
      widthClassName="w-full sm:w-[620px] lg:w-[760px]"
    >
      {loading ? <AnalyticsSkeleton /> : error && !mastery ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p>{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={load}>Try again</Button>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={value => setTab(value as Tab)} variant="underline">
          <TabsList aria-label="Learning progress sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            {canManageData && <TabsTrigger value="data">Data</TabsTrigger>}
          </TabsList>

          {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

          <TabsContent value="overview" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Rank", value: mastery?.rank.tierLabel ?? "Rookie", icon: Award },
                { label: "Accuracy", value: summary?.accuracy == null ? "—" : `${Math.round(summary.accuracy * 100)}%`, icon: Target },
                { label: "First try", value: summary?.firstTryAccuracy == null ? "—" : `${Math.round(summary.firstTryAccuracy * 100)}%`, icon: Sparkles },
                { label: "Independent", value: summary?.independenceRate == null ? "—" : `${Math.round(summary.independenceRate * 100)}%`, icon: ShieldAlert },
                { label: "XP earned", value: String(summary?.xpEarned ?? 0), icon: Zap },
                { label: "Current streak", value: `${summary?.currentStreakDays ?? 0} days`, icon: Flame },
                { label: "Time learning", value: duration(summary?.timeOnTaskMs ?? 0), icon: CalendarDays },
                { label: "Completed", value: String(summary?.lessonsCompleted ?? 0), icon: Award },
              ].map(item => (
                <div key={item.label} className="rounded-2xl border border-[#E7E3F6] bg-white p-4">
                  <item.icon size={17} className="mb-3 text-[#6D55D8]" />
                  <p className="koda-admin-label">{item.label}</p>
                  <p className="koda-admin-metric mt-1 text-[#0E0B55]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <p className="koda-admin-label text-emerald-700">Growing strength</p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">
                  {strongestSkill?.skillLabel || "Complete an activity to reveal a strength"}
                </p>
                {strongestSkill && (
                  <p className="mt-1 text-xs text-emerald-700">
                    {Math.round(strongestSkill.score * 100)}% evidence score · {strongestSkill.plays} tries
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="koda-admin-label text-amber-700">Needs support</p>
                <p className="mt-1 text-sm font-semibold text-amber-950">
                  {supportSkills.length
                    ? supportSkills.map(skill => skill.skillLabel).join(", ")
                    : "No urgent review is due"}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Based on verified accuracy and review due dates.
                </p>
              </div>
            </div>
            {(activity?.xpBreakdown?.length ?? 0) > 0 && (
              <div className="rounded-2xl border border-[#E7E3F6] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="koda-admin-section-title">XP evidence</p>
                    <p className="koda-admin-secondary mt-1">Where earned XP came from</p>
                  </div>
                  <Badge variant="warning">{summary?.xpEarned ?? 0} XP</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {activity!.xpBreakdown.slice(0, 5).map(row => (
                    <div key={`${row.releaseId}:${row.skillId}`} className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF9FF] px-3 py-2">
                      <span className="truncate text-xs font-semibold text-[#17143D]">{row.skillLabel}</span>
                      <span className="shrink-0 text-xs font-semibold text-[#6D55D8]">
                        {row.correctXp} answers + {row.firstTryXp} first try + {row.completionXp} completion = {row.totalXp} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-[#E7E3F6] bg-[#FAF9FF] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="koda-admin-section-title">Proficiency map</p>
                  <p className="koda-admin-secondary mt-1">
                    {mastery?.rank.proficientPlus ?? 0} proficient or mastered of {mastery?.rank.assignedSkills ?? 0} assigned skills
                  </p>
                </div>
                <Badge variant="success">{mastery?.rank.mastered ?? 0} mastered</Badge>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E9E5F6]">
                <div
                  className="h-full rounded-full bg-[#6D55D8] transition-all"
                  style={{ width: `${Math.round((mastery?.rank.progressToNext ?? 0) * 100)}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-semibold text-[#0E0B55]">{summary?.lessonsCompleted ?? 0}</p><p className="koda-admin-label">Lessons</p></div>
                <div><p className="text-lg font-semibold text-[#0E0B55]">{summary?.activeDays ?? 0}</p><p className="koda-admin-label">Active days</p></div>
                <div><p className="text-lg font-semibold text-[#0E0B55]">{summary?.hints ?? 0}</p><p className="koda-admin-label">Hints used</p></div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="skills" className="space-y-3 pt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-3 text-[#9893B6]" />
                <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a skill…" className="pl-9" />
              </div>
              <Select value={level} onChange={event => setLevel(event.target.value)} aria-label="Mastery level">
                <option value="all">All levels</option>
                {LEVELS.map(value => <option key={value} value={value}>{LEVEL_LABEL[value]}</option>)}
              </Select>
              <Select value={grade} onChange={event => setGrade(event.target.value)} aria-label="Grade">
                <option value="all">All grades</option>
                {grades.map(value => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Select value={subject} onChange={event => setSubject(event.target.value)} aria-label="Subject">
                <option value="all">All subjects</option>
                {subjects.map(value => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Select value={assignment} onChange={event => setAssignment(event.target.value)} aria-label="Assignment">
                <option value="all">All assignments</option>
                {assignments.map((value, index) => <option key={value} value={value}>Assignment {index + 1}</option>)}
              </Select>
            </div>
            <p className="koda-admin-secondary">{filteredSkills.length} skills</p>
            <div className="space-y-2">
              {filteredSkills.map(skill => (
                <div key={`${skill.curriculumId}-${skill.skillId}`} className="rounded-xl border border-[#E7E3F6] bg-white p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#17143D]">{skill.skillLabel}</p>
                      <p className="koda-admin-secondary mt-1">
                        {skill.plays} tries · {skill.sessions} sessions · {Math.round(skill.score * 100)}% score
                      </p>
                    </div>
                    <Badge variant={LEVEL_BADGE[skill.level]}>{LEVEL_LABEL[skill.level]}</Badge>
                  </div>
                  {skill.toNextLevel.length > 0 && (
                    <p className="mt-2 text-xs text-[#6D6997]">Next: {skill.toNextLevel.join(" · ")}</p>
                  )}
                </div>
              ))}
              {filteredSkills.length === 0 && <div className="rounded-xl bg-[#FAF9FF] p-8 text-center koda-admin-secondary">No skills match these filters.</div>}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-3 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="koda-admin-secondary">{filteredEvents.length} recent events</p>
              <Select value={eventType} onChange={event => setEventType(event.target.value)} className="w-44" aria-label="Event type">
                <option value="all">All activity</option>
                {eventTypes.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              {filteredEvents.map(event => (
                <div key={event.id} className="flex items-start gap-3 rounded-xl border border-[#E7E3F6] bg-white p-3">
                  <div className="mt-0.5 rounded-lg bg-[#F1EDFF] p-2 text-[#6D55D8]"><Activity size={15} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold capitalize text-[#17143D]">{(event.eventType ?? "activity").replaceAll("_", " ")}</p>
                      {event.outcome && <Badge variant={event.outcome === "correct" ? "success" : "warning"}>{event.outcome}</Badge>}
                      {!event.verified && <Badge variant="secondary">Unverified</Badge>}
                    </div>
                    <p className="koda-admin-secondary mt-1">{event.technique ?? event.skillId ?? "Learning session"} · {compactDate(event.occurredAt)}</p>
                  </div>
                </div>
              ))}
              {filteredEvents.length === 0 && <div className="rounded-xl bg-[#FAF9FF] p-8 text-center koda-admin-secondary">No activity recorded yet.</div>}
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-3 pt-4">
            {(recommendations?.runs ?? []).map(run => (
              <div key={run.runId} className="rounded-2xl border border-[#E7E3F6] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#6D55D8]" />
                    <p className="text-sm font-semibold text-[#17143D]">Recommendation set {run.sequence}</p>
                  </div>
                  <p className="koda-admin-secondary">{compactDate(run.createdAt)}</p>
                </div>
                <div className="mt-3 space-y-2">
                  {run.served.map((item, index) => (
                    <div key={`${item.skillId}-${index}`} className="rounded-xl bg-[#FAF9FF] p-3">
                      <p className="text-sm font-medium text-[#17143D]">{item.skillLabel ?? item.skillId ?? "Recommended skill"}</p>
                      <p className="koda-admin-secondary mt-1">{item.reason ?? "Selected from the learner's current progression state."}</p>
                    </div>
                  ))}
                </div>
                {run.excluded.length > 0 && (
                  <details className="mt-3 text-xs text-[#6D6997]">
                    <summary className="cursor-pointer font-medium">Skipped candidates ({run.excluded.length})</summary>
                    <div className="mt-2 space-y-1">
                      {run.excluded.map((item, index) => <p key={`${item.skillId}-${index}`}>{item.skillLabel ?? item.skillId}: {item.reason}</p>)}
                    </div>
                  </details>
                )}
                {run.decisions.filter(decision => decision.action === "skipped").map((decision, index) => (
                  <div key={`${decision.skill_id}-${index}`} className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <Badge variant="warning">Skipped</Badge>
                    <p className="text-xs text-amber-800">
                      {decision.skill_id ?? "Recommended skill"} · {compactDate(decision.occurred_at)}
                    </p>
                  </div>
                ))}
                <p className="mt-3 text-[10px] uppercase tracking-wider text-[#9893B6]">Scoring r{run.scoringRevision} · Engine {run.engineRevision}</p>
              </div>
            ))}
            {(recommendations?.runs.length ?? 0) === 0 && (
              <div className="rounded-xl bg-[#FAF9FF] p-8 text-center">
                <Lightbulb size={22} className="mx-auto mb-2 text-[#8A7AE6]" />
                <p className="text-sm font-semibold text-[#17143D]">No recommendations yet</p>
                <p className="koda-admin-secondary mt-1">A recommendation history appears after the learner starts an assigned path.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="data" className="space-y-4 pt-4">
            <p className="koda-admin-secondary">
              Learning data is retained while this child profile exists. Export and deletion actions are recorded in the audit trail.
            </p>
            <div className="rounded-2xl border border-[#E7E3F6] bg-white p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Download size={18} className="mt-0.5 text-[#6D55D8]" />
                <div className="flex-1">
                  <p className="koda-admin-section-title">Export learning data</p>
                  <p className="koda-admin-secondary mt-1">Download events, mastery, assignments, placement, and recommendation history as JSON.</p>
                  <Button className="mt-4" size="sm" variant="outline" loading={exporting} loadingText="Preparing…" onClick={downloadExport}>
                    <Download size={14} /> Export JSON
                  </Button>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert size={18} className="mt-0.5 text-rose-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-rose-900">Delete learning history</p>
                  <p className="mt-1 text-xs leading-5 text-rose-700">This permanently removes events, mastery, sessions, recommendations, assignments, and placements. The child profile stays available.</p>
                  <label className="mt-4 block text-xs font-medium text-rose-900" htmlFor="analytics-delete-confirm">Type DELETE to confirm</label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input id="analytics-delete-confirm" value={deleteText} onChange={event => setDeleteText(event.target.value)} placeholder="DELETE" />
                    <Button variant="destructive" loading={deleting} loadingText="Deleting…" disabled={deleteText !== "DELETE"} onClick={purge}>
                      <Trash2 size={14} /> Delete history
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </Drawer>
  );
};
