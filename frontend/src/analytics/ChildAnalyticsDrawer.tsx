import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Award,
  CalendarDays,
  Download,
  Flame,
  Lightbulb,
  RotateCcw,
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
  ConfirmModal,
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

const formatLabel = (val?: string | null) => {
  if (!val) return "Learning Activity";
  const cleaned = val
    .replace(/^(seed-[a-z0-9]+-skill-|skill-)/i, "")
    .replace(/_/g, " ")
    .toLowerCase();
  return cleaned.replace(/\b\w/g, char => char.toUpperCase());
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
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
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

  const purgeQuick = async () => {
    if (!student) return;
    setDeleting(true);
    try {
      await analyticsApi.purgeData(student.id, "Learning data reset for testing");
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
      title={
        student
          ? `${student.avatar && student.avatar.length <= 4 ? `${student.avatar} ` : ""}${student.name}'s learning progress`
          : undefined
      }
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
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
                <div key={item.label} className="rounded-xl border border-[#E7E3F6] bg-white p-3 shadow-[0_2px_8px_rgba(83,74,183,0.03)] dark:border-white/10 dark:bg-[#161B2E]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6D6997] dark:text-[#9A94B8]">{item.label}</span>
                    <item.icon size={13} className="shrink-0 text-[#6D55D8] dark:text-[#BEACFF]" />
                  </div>
                  <p className="mt-1 text-sm font-extrabold tracking-tight text-[#0E0B55] dark:text-[#EDECF8]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Growing strength</p>
                <p className="mt-0.5 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  {strongestSkill?.skillLabel || "Complete an activity to reveal a strength"}
                </p>
                {strongestSkill && (
                  <p className="mt-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                    {Math.round(strongestSkill.score * 100)}% evidence score · {strongestSkill.plays} tries
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Needs support</p>
                <p className="mt-0.5 text-xs font-bold text-amber-950 dark:text-amber-200">
                  {supportSkills.length
                    ? supportSkills.map(skill => skill.skillLabel).join(", ")
                    : "No urgent review is due"}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  Based on verified accuracy and review due dates.
                </p>
              </div>
            </div>
            {(activity?.xpBreakdown?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-[#E7E3F6] bg-white p-3 dark:border-white/10 dark:bg-[#161B2E]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#0E0B55] dark:text-[#EDECF8]">XP evidence</p>
                    <p className="text-[10px] text-[#6D6997] dark:text-[#9A94B8]">Where earned XP came from</p>
                  </div>
                  <Badge variant="warning">{summary?.xpEarned ?? 0} XP</Badge>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  {activity!.xpBreakdown.slice(0, 5).map(row => (
                    <div key={`${row.releaseId}:${row.skillId}`} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF9FF] px-2.5 py-1.5 dark:bg-white/5">
                      <span className="truncate text-xs font-semibold text-[#17143D] dark:text-[#DEDCF0]">{row.skillLabel}</span>
                      <span className="shrink-0 text-[11px] font-bold text-[#6D55D8] dark:text-[#BEACFF]">
                        {row.correctXp} correct + {row.firstTryXp} bonus + {row.completionXp} comp = {row.totalXp} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-xl border border-[#E7E3F6] bg-[#FAF9FF] p-3.5 dark:border-white/10 dark:bg-[#161B2E]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black tracking-tight text-[#0E0B55] dark:text-[#EDECF8]">Proficiency map</p>
                  <p className="mt-0.5 text-[11px] font-medium text-[#6D6997] dark:text-[#9A94B8]">
                    {mastery?.rank.proficientPlus ?? 0} proficient or mastered of {mastery?.rank.assignedSkills ?? 0} assigned skills
                  </p>
                </div>
                <Badge variant="success">{mastery?.rank.mastered ?? 0} mastered</Badge>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#E9E5F6] dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-[#6D55D8] transition-all dark:bg-[#BEACFF]"
                  style={{ width: `${Math.round((mastery?.rank.progressToNext ?? 0) * 100)}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-around border-t border-[#E7E3F6]/60 pt-2.5 text-center dark:border-white/10">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-extrabold text-[#0E0B55] dark:text-[#EDECF8]">{summary?.lessonsCompleted ?? 0}</span>
                  <span className="text-[10px] font-bold text-[#6D6997] dark:text-[#9A94B8]">Lessons</span>
                </div>
                <div className="h-3 w-px bg-[#E7E3F6] dark:bg-white/10" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-extrabold text-[#0E0B55] dark:text-[#EDECF8]">{summary?.activeDays ?? 0}</span>
                  <span className="text-[10px] font-bold text-[#6D6997] dark:text-[#9A94B8]">Active days</span>
                </div>
                <div className="h-3 w-px bg-[#E7E3F6] dark:bg-white/10" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-extrabold text-[#0E0B55] dark:text-[#EDECF8]">{summary?.hints ?? 0}</span>
                  <span className="text-[10px] font-bold text-[#6D6997] dark:text-[#9A94B8]">Hints used</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="skills" className="space-y-2.5 pt-3">
            <div className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
              <div className="relative xl:col-span-1">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-[#9893B6]" />
                <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find skill…" className="h-8 pl-8 text-xs" />
              </div>
              <Select value={level} onChange={event => setLevel(event.target.value)} aria-label="Mastery level" className="h-8 text-xs">
                <option value="all">All levels</option>
                {LEVELS.map(value => <option key={value} value={value}>{LEVEL_LABEL[value]}</option>)}
              </Select>
              <Select value={grade} onChange={event => setGrade(event.target.value)} aria-label="Grade" className="h-8 text-xs">
                <option value="all">All grades</option>
                {grades.map(value => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Select value={subject} onChange={event => setSubject(event.target.value)} aria-label="Subject" className="h-8 text-xs">
                <option value="all">All subjects</option>
                {subjects.map(value => <option key={value} value={value}>{value}</option>)}
              </Select>
              <Select value={assignment} onChange={event => setAssignment(event.target.value)} aria-label="Assignment" className="h-8 text-xs">
                <option value="all">All assignments</option>
                {assignments.map((value, index) => <option key={value} value={value}>Assignment {index + 1}</option>)}
              </Select>
            </div>
            <p className="text-[11px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">{filteredSkills.length} skills</p>
            <div className="space-y-1.5">
              {filteredSkills.map(skill => (
                <div key={`${skill.curriculumId}-${skill.skillId}`} className="rounded-lg border border-[#E7E3F6] bg-white p-2.5 shadow-[0_1px_4px_rgba(83,74,183,0.02)] dark:border-white/10 dark:bg-[#161B2E]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#17143D] dark:text-[#EDECF8]">{skill.skillLabel}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">
                        {skill.plays} tries · {skill.sessions} sessions · {Math.round(skill.score * 100)}% score
                      </p>
                    </div>
                    <Badge variant={LEVEL_BADGE[skill.level]}>{LEVEL_LABEL[skill.level]}</Badge>
                  </div>
                  {skill.toNextLevel.length > 0 && (
                    <p className="mt-1 text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">Next: {skill.toNextLevel.join(" · ")}</p>
                  )}
                </div>
              ))}
              {filteredSkills.length === 0 && <div className="rounded-lg bg-[#FAF9FF] p-6 text-center text-xs font-semibold text-[#6D6997] dark:bg-white/5 dark:text-[#9A94B8]">No skills match these filters.</div>}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-2.5 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">{filteredEvents.length} recent events</p>
              <Select value={eventType} onChange={event => setEventType(event.target.value)} className="h-8 w-40 text-xs" aria-label="Event type">
                <option value="all">All activity</option>
                {eventTypes.map(value => <option key={value} value={value}>{formatLabel(value)}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              {filteredEvents.map(event => (
                <div key={event.id} className="flex items-center gap-2.5 rounded-lg border border-[#E7E3F6] bg-white px-2.5 py-1.5 shadow-[0_1px_4px_rgba(83,74,183,0.02)] dark:border-white/10 dark:bg-[#161B2E]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F1EDFF] text-[#6D55D8] dark:bg-white/10 dark:text-[#BEACFF]">
                    <Activity size={13} />
                  </div>
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#17143D] dark:text-[#EDECF8]">
                          {formatLabel(event.eventType ?? "activity")}
                        </span>
                        {event.outcome && (
                          <Badge variant={event.outcome === "correct" ? "success" : "warning"}>
                            {event.outcome}
                          </Badge>
                        )}
                        {!event.verified && <Badge variant="secondary">Unverified</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">
                        {formatLabel(event.technique || event.skillId || "Learning session")}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-[#9893B6] dark:text-[#8882AC]">
                      {compactDate(event.occurredAt)}
                    </span>
                  </div>
                </div>
              ))}
              {filteredEvents.length === 0 && (
                <div className="rounded-lg bg-[#FAF9FF] p-6 text-center text-xs font-semibold text-[#6D6997] dark:bg-white/5 dark:text-[#9A94B8]">
                  No activity recorded yet.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-2.5 pt-3">
            {(recommendations?.runs ?? []).map((run, idx) => (
              <div key={run.runId || idx} className="rounded-xl border border-[#E7E3F6] bg-white p-2.5 dark:border-white/10 dark:bg-[#161B2E]">
                <div className="flex items-center justify-between gap-2 border-b border-[#E7E3F6]/50 pb-2 dark:border-white/10">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#6D55D8] dark:text-[#BEACFF]" />
                    <p className="text-xs font-extrabold text-[#17143D] dark:text-[#EDECF8]">
                      Recommendation Set {run.sequence || idx + 1}
                    </p>
                  </div>
                  <p className="text-[10px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">{compactDate(run.createdAt)}</p>
                </div>
                <div className="mt-2 space-y-1">
                  {run.served.map((item, index) => (
                    <div key={`${item.skillId}-${index}`} className="flex items-start gap-2 rounded-lg bg-[#FAF9FF] px-2.5 py-1.5 dark:bg-white/5">
                      <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6D55D8] dark:bg-[#BEACFF]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#17143D] dark:text-[#EDECF8]">
                          {formatLabel(item.skillLabel ?? item.skillId ?? "Recommended skill")}
                        </p>
                        <p className="mt-0.5 text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">
                          {item.reason ?? "Selected from the learner's current progression state."}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {run.excluded.length > 0 && (
                  <details className="mt-2 text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">
                    <summary className="cursor-pointer font-bold hover:text-[#534AB7]">Skipped candidates ({run.excluded.length})</summary>
                    <div className="mt-1 space-y-0.5 pl-2 border-l border-[#E7E3F6] dark:border-white/10">
                      {run.excluded.map((item, index) => (
                        <p key={`${item.skillId}-${index}`}>
                          <strong className="text-[#17143D] dark:text-[#DEDCF0]">{formatLabel(item.skillLabel ?? item.skillId)}:</strong> {item.reason}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
                {run.decisions.filter(decision => decision.action === "skipped").map((decision, index) => (
                  <div key={`${decision.skill_id}-${index}`} className="mt-1.5 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1">
                    <Badge variant="warning">Skipped</Badge>
                    <p className="text-[10px] font-semibold text-amber-800">
                      {formatLabel(decision.skill_id ?? "Recommended skill")} · {compactDate(decision.occurred_at)}
                    </p>
                  </div>
                ))}
              </div>
            ))}
            {(recommendations?.runs.length ?? 0) === 0 && (
              <div className="rounded-lg bg-[#FAF9FF] p-6 text-center dark:bg-white/5">
                <Lightbulb size={20} className="mx-auto mb-1.5 text-[#8A7AE6]" />
                <p className="text-xs font-bold text-[#17143D] dark:text-[#EDECF8]">No recommendations yet</p>
                <p className="mt-0.5 text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">A recommendation history appears after the learner starts an assigned path.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="data" className="space-y-3 pt-3">
            <p className="text-xs font-medium leading-relaxed text-[#6D6997] dark:text-[#9A94B8]">
              Learning data is retained while this child profile exists. Export and deletion actions are recorded in the audit trail.
            </p>
            <div className="rounded-xl border border-[#E7E3F6] bg-white p-3.5 dark:border-white/10 dark:bg-[#161B2E]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1EDFF] text-[#6D55D8] dark:bg-white/10 dark:text-[#BEACFF]">
                    <Download size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0E0B55] dark:text-[#EDECF8]">Export learning data</p>
                    <p className="mt-0.5 truncate text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">Download events, mastery, assignments, and history as JSON.</p>
                  </div>
                </div>
                <Button size="xs" variant="outline" loading={exporting} loadingText="Exporting…" onClick={downloadExport} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
                  <Download size={12} /> Export JSON
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3.5 dark:border-rose-500/20 dark:bg-rose-500/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                    <ShieldAlert size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-rose-950 dark:text-rose-200">Clear learning history</p>
                    <p className="mt-0.5 truncate text-[10px] font-medium text-rose-700 dark:text-rose-300">Permanently reset events, mastery, and attempts.</p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="xs"
                  loading={deleting}
                  loadingText="Clearing…"
                  onClick={() => setConfirmClearOpen(true)}
                  className="shrink-0 rounded-lg px-3 py-1 text-xs font-extrabold"
                >
                  <Trash2 size={12} /> Clear history
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
      <ConfirmModal
        isOpen={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={purgeQuick}
        title={`Clear logs for ${student?.name}?`}
        description="This will clear all learning events, attempts, XP, and mastery data so you can re-test fresh."
        confirmText="Clear logs"
        cancelText="Cancel"
        variant="warning"
      />
    </Drawer>
  );
};
