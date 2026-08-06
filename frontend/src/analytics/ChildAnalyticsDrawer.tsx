import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  Heart,
  Home,
  Lightbulb,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
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
  beginner: "Just started",
  developing: "Getting there",
  proficient: "Knows it",
  master: "Mastered",
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

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const activities = (count: number) => `${count} ${count === 1 ? "activity" : "activities"}`;

/** Tabs double as the mobile bottom toolbar, so each section carries the icon that bar needs. */
const SECTIONS = [
  { value: "overview", label: "Summary", icon: Home },
  { value: "skills", label: "Skills", icon: BookOpen },
  { value: "activity", label: "Activity", icon: Activity },
  { value: "recommendations", label: "Next up", icon: Sparkles },
  { value: "data", label: "Data", icon: Shield },
] as const satisfies ReadonlyArray<{ value: Tab; label: string; icon: React.ElementType }>;

/** The headline card carries the verdict, so its colour has to match the sentence it holds. */
const HEADLINE_STYLE = {
  great: "border-emerald-200/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100",
  steady: "border-[#DCD5F7] bg-[#F6F3FF] text-[#1B1257] dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-[#EDECF8]",
  help: "border-rose-200/80 bg-rose-50/70 text-rose-900 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100",
  neutral: "border-[#E7E3F6] bg-[#FAF9FF] text-[#17143D] dark:border-white/10 dark:bg-white/5 dark:text-[#EDECF8]",
} as const;

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

  const firstName = (student?.name ?? "Your child").split(" ")[0];
  const accuracyPct = summary?.accuracy == null ? null : Math.round(summary.accuracy * 100);
  const week = summary?.weeklyActivity ?? [];
  const weekBusiest = Math.max(1, ...week.map(day => day.count));
  const weekTotal = week.reduce((total, day) => total + day.count, 0);
  const skillsKnown = mastery?.rank.proficientPlus ?? 0;
  const skillsAssigned = mastery?.rank.assignedSkills ?? 0;

  /** One sentence a parent can read in three seconds — everything else on the tab supports it. */
  const headline = (() => {
    if (!summary || summary.totalAttempts === 0) {
      return {
        tone: "neutral" as const,
        title: `${firstName} hasn't started yet`,
        body: "As soon as the first activity is finished, progress shows up right here.",
      };
    }
    const parts = [
      `${plural(summary.lessonsCompleted, "lesson")} finished`,
      `${summary.correct} of ${summary.totalAttempts} answers right`,
      `${duration(summary.timeOnTaskMs)} of learning`,
    ];
    if ((accuracyPct ?? 0) >= 85) {
      return { tone: "great" as const, title: `${firstName} is doing great`, body: parts.join(" · ") };
    }
    if ((accuracyPct ?? 0) >= 60) {
      return { tone: "steady" as const, title: `${firstName} is making steady progress`, body: parts.join(" · ") };
    }
    return { tone: "help" as const, title: `${firstName} could use a hand`, body: parts.join(" · ") };
  })();

  const visibleSections = SECTIONS.filter(section => section.value !== "data" || canManageData);

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
      footer={
        <nav
          aria-label="Learning progress sections (mobile)"
          className="flex items-stretch justify-around gap-1 border-t border-[#E9E3F6] bg-white/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden dark:border-white/10 dark:bg-[#151A2B]/95"
        >
          {visibleSections.map(section => {
            const isActive = tab === section.value;
            return (
              <button
                key={section.value}
                type="button"
                onClick={() => setTab(section.value)}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-extrabold leading-none transition-colors [-webkit-tap-highlight-color:transparent] ${
                  isActive
                    ? "bg-[#F0EBFF] text-[#6844EA] dark:bg-violet-400/15 dark:text-[#CDBEFF]"
                    : "text-[#7B8496] dark:text-[#A79FC4]"
                }`}
              >
                <section.icon size={19} strokeWidth={2.2} />
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </nav>
      }
    >
      {loading ? <AnalyticsSkeleton /> : error && !mastery ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p>{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={load}>Try again</Button>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={value => setTab(value as Tab)} variant="underline">
          {/* Below sm the drawer fills the screen, so sections move to the bottom toolbar instead. */}
          <TabsList aria-label="Learning progress sections" className="hidden sm:flex">
            {visibleSections.map(section => (
              <TabsTrigger key={section.value} value={section.value}>{section.label}</TabsTrigger>
            ))}
          </TabsList>

          {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

          <TabsContent value="overview" className="space-y-3 pt-1 sm:pt-4">
            <section className={`rounded-2xl border p-4 ${HEADLINE_STYLE[headline.tone]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-black leading-snug tracking-tight">{headline.title}</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed opacity-80">{headline.body}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide dark:bg-white/10">
                  <Award size={12} /> {mastery?.rank.tierLabel ?? "Rookie"}
                </span>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                {
                  label: "Answers right",
                  value: accuracyPct == null ? "—" : `${accuracyPct}%`,
                  hint: summary?.totalAttempts ? `${summary.correct} of ${summary.totalAttempts} questions` : "No questions yet",
                  icon: Target,
                },
                {
                  label: "Lessons done",
                  value: String(summary?.lessonsCompleted ?? 0),
                  hint: "Finished start to end",
                  icon: CheckCircle2,
                },
                {
                  label: "Time learning",
                  value: duration(summary?.timeOnTaskMs ?? 0),
                  hint: `${plural(summary?.activeDays ?? 0, "day")} with activity`,
                  icon: Clock,
                },
                {
                  label: "Day streak",
                  value: plural(summary?.currentStreakDays ?? 0, "day"),
                  hint: `Best run: ${plural(summary?.longestStreakDays ?? 0, "day")}`,
                  icon: Flame,
                },
              ].map(item => (
                <div key={item.label} className="rounded-2xl border border-[#E7E3F6] bg-white p-3 shadow-[0_2px_8px_rgba(83,74,183,0.03)] dark:border-white/10 dark:bg-[#161B2E]">
                  <div className="flex items-center gap-1.5">
                    <item.icon size={13} className="shrink-0 text-[#6D55D8] dark:text-[#BEACFF]" />
                    <span className="truncate text-[10px] font-bold uppercase tracking-wider text-[#6D6997] dark:text-[#9A94B8]">{item.label}</span>
                  </div>
                  <p className="mt-1.5 text-xl font-black leading-none tracking-tight text-[#0E0B55] dark:text-[#EDECF8]">{item.value}</p>
                  <p className="mt-1.5 truncate text-[10px] font-semibold text-[#8B86AC] dark:text-[#8882AC]">{item.hint}</p>
                </div>
              ))}
            </div>

            {week.length > 0 && (
              <section className="rounded-2xl border border-[#E7E3F6] bg-white p-3.5 dark:border-white/10 dark:bg-[#161B2E]">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs font-black tracking-tight text-[#0E0B55] dark:text-[#EDECF8]">Last 7 days</p>
                  <p className="text-[11px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">
                    {weekTotal === 0 ? "No activity yet" : `${activities(weekTotal)} this week`}
                  </p>
                </div>
                <div className="mt-3 flex items-end justify-between gap-1.5" aria-hidden="true">
                  {week.map(day => (
                    <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex h-16 w-full items-end justify-center rounded-lg bg-[#F4F1FE] dark:bg-white/5">
                        <div
                          className="w-full rounded-lg bg-[#7C63E4] transition-all dark:bg-[#9C86F5]"
                          style={{ height: `${day.count === 0 ? 4 : Math.max(14, (day.count / weekBusiest) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-[#8B86AC] dark:text-[#8882AC]">{day.day}</span>
                    </div>
                  ))}
                </div>
                <p className="sr-only">
                  {week.map(day => `${day.date}: ${activities(day.count)}`).join(", ")}
                </p>
              </section>
            )}

            <div className="grid gap-2.5 sm:grid-cols-2">
              <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <TrendingUp size={12} /> Going well
                </p>
                <p className="mt-1 text-sm font-bold leading-snug text-emerald-950 dark:text-emerald-100">
                  {strongestSkill?.skillLabel || "Nothing to show yet"}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {strongestSkill
                    ? `Practiced ${plural(strongestSkill.plays, "time")} · ${Math.round(strongestSkill.score * 100)}% right`
                    : "Finish an activity and a strength shows up here."}
                </p>
              </section>
              <section className="rounded-2xl border border-sky-200/80 bg-sky-50/60 p-3.5 dark:border-sky-500/20 dark:bg-sky-500/10">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  <Heart size={12} /> Practice next
                </p>
                <p className="mt-1 text-sm font-bold leading-snug text-sky-950 dark:text-sky-100">
                  {supportSkills.length
                    ? supportSkills.map(skill => skill.skillLabel).join(", ")
                    : "Nothing needs review right now"}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                  {supportSkills.length
                    ? "A little practice together would help these stick."
                    : `${firstName} is on top of everything practised so far.`}
                </p>
              </section>
            </div>

            <section className="rounded-2xl border border-[#E7E3F6] bg-[#FAF9FF] p-3.5 dark:border-white/10 dark:bg-[#161B2E]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black tracking-tight text-[#0E0B55] dark:text-[#EDECF8]">Skills learned</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">
                    {skillsKnown} of {skillsAssigned} skills in {firstName}'s plan
                  </p>
                </div>
                <Badge variant="success">{mastery?.rank.mastered ?? 0} mastered</Badge>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#E9E5F6] dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-[#6D55D8] transition-all dark:bg-[#BEACFF]"
                  style={{ width: `${skillsAssigned ? Math.max(2, Math.round((skillsKnown / skillsAssigned) * 100)) : 0}%` }}
                />
              </div>
            </section>

            <details className="group rounded-2xl border border-[#E7E3F6] bg-white px-3.5 py-3 dark:border-white/10 dark:bg-[#161B2E]">
              <summary className="cursor-pointer list-none text-xs font-bold text-[#534AB7] marker:hidden dark:text-[#BEACFF]">
                Show the detailed numbers
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { label: "Right first try", value: summary?.firstTryAccuracy == null ? "—" : `${Math.round(summary.firstTryAccuracy * 100)}%` },
                  { label: "Solved without hints", value: summary?.independenceRate == null ? "—" : `${Math.round(summary.independenceRate * 100)}%` },
                  { label: "Hints used", value: String(summary?.hints ?? 0) },
                  { label: "XP earned", value: String(summary?.xpEarned ?? 0) },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-[#FAF9FF] p-2.5 dark:bg-white/5">
                    <p className="text-sm font-extrabold text-[#0E0B55] dark:text-[#EDECF8]">{item.value}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">{item.label}</p>
                  </div>
                ))}
              </div>
              {(activity?.xpBreakdown?.length ?? 0) > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6D6997] dark:text-[#9A94B8]">Where the XP came from</p>
                  {activity!.xpBreakdown.slice(0, 5).map(row => (
                    <div key={`${row.releaseId}:${row.skillId}`} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF9FF] px-2.5 py-1.5 dark:bg-white/5">
                      <span className="truncate text-xs font-semibold text-[#17143D] dark:text-[#DEDCF0]">{row.skillLabel}</span>
                      <span className="shrink-0 text-[11px] font-bold text-[#6D55D8] dark:text-[#BEACFF]">{row.totalXp} XP</span>
                    </div>
                  ))}
                </div>
              )}
            </details>
          </TabsContent>

          <TabsContent value="skills" className="space-y-2.5 pt-1 sm:pt-3">
            {/* Search and level answer "how is my child doing with X"; the rest stay tucked away. */}
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-[#9893B6]" />
                <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a skill…" className="h-9 pl-8 text-xs" />
              </div>
              <Select value={level} onChange={event => setLevel(event.target.value)} aria-label="How well the skill is known" className="h-9 text-xs">
                <option value="all">All skills</option>
                {LEVELS.map(value => <option key={value} value={value}>{LEVEL_LABEL[value]}</option>)}
              </Select>
            </div>
            <details className="text-[11px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">
              <summary className="cursor-pointer list-none text-[#534AB7] marker:hidden dark:text-[#BEACFF]">More filters</summary>
              <div className="mt-1.5 grid gap-1.5 sm:grid-cols-3">
                <Select value={grade} onChange={event => setGrade(event.target.value)} aria-label="Grade" className="h-9 text-xs">
                  <option value="all">All grades</option>
                  {grades.map(value => <option key={value} value={value}>{value}</option>)}
                </Select>
                <Select value={subject} onChange={event => setSubject(event.target.value)} aria-label="Subject" className="h-9 text-xs">
                  <option value="all">All subjects</option>
                  {subjects.map(value => <option key={value} value={value}>{value}</option>)}
                </Select>
                <Select value={assignment} onChange={event => setAssignment(event.target.value)} aria-label="Assignment" className="h-9 text-xs">
                  <option value="all">All assignments</option>
                  {assignments.map((value, index) => <option key={value} value={value}>Assignment {index + 1}</option>)}
                </Select>
              </div>
            </details>
            <p className="text-[11px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">Showing {plural(filteredSkills.length, "skill")}</p>
            <div className="space-y-1.5">
              {filteredSkills.map(skill => (
                <div key={`${skill.curriculumId}-${skill.skillId}`} className="rounded-lg border border-[#E7E3F6] bg-white p-2.5 shadow-[0_1px_4px_rgba(83,74,183,0.02)] dark:border-white/10 dark:bg-[#161B2E]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#17143D] dark:text-[#EDECF8]">{skill.skillLabel}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">
                        {skill.plays === 0
                          ? "Not practised yet"
                          : `Practised ${plural(skill.plays, "time")} · ${Math.round(skill.score * 100)}% right`}
                      </p>
                    </div>
                    <Badge variant={LEVEL_BADGE[skill.level]}>{LEVEL_LABEL[skill.level]}</Badge>
                  </div>
                  {skill.toNextLevel.length > 0 && (
                    <p className="mt-1 text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">To move up: {skill.toNextLevel.join(" · ")}</p>
                  )}
                </div>
              ))}
              {filteredSkills.length === 0 && <div className="rounded-lg bg-[#FAF9FF] p-6 text-center text-xs font-semibold text-[#6D6997] dark:bg-white/5 dark:text-[#9A94B8]">No skills match these filters.</div>}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-2.5 pt-1 sm:pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">Most recent first</p>
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
                          <Badge variant={event.outcome === "correct" ? "success" : "destructive"}>
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

          <TabsContent value="recommendations" className="space-y-2.5 pt-1 sm:pt-3">
            <p className="text-[11px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">
              What Koda picked for {firstName} to work on, and why.
            </p>
            {(recommendations?.runs ?? []).map((run, idx) => (
              <div key={run.runId || idx} className="rounded-xl border border-[#E7E3F6] bg-white p-2.5 dark:border-white/10 dark:bg-[#161B2E]">
                <div className="flex items-center justify-between gap-2 border-b border-[#E7E3F6]/50 pb-2 dark:border-white/10">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#6D55D8] dark:text-[#BEACFF]" />
                    <p className="text-xs font-extrabold text-[#17143D] dark:text-[#EDECF8]">
                      Suggested set {run.sequence || idx + 1}
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
                  <div key={`${decision.skill_id}-${index}`} className="mt-1.5 flex items-center gap-2 rounded-md border border-[#E7E3F6] bg-[#FAF9FF] px-2 py-1 dark:border-white/10 dark:bg-white/5">
                    <Badge variant="secondary">Skipped</Badge>
                    <p className="text-[10px] font-semibold text-[#6D6997] dark:text-[#9A94B8]">
                      {formatLabel(decision.skill_id ?? "Recommended skill")} · {compactDate(decision.occurred_at)}
                    </p>
                  </div>
                ))}
              </div>
            ))}
            {(recommendations?.runs.length ?? 0) === 0 && (
              <div className="rounded-lg bg-[#FAF9FF] p-6 text-center dark:bg-white/5">
                <Lightbulb size={20} className="mx-auto mb-1.5 text-[#8A7AE6]" />
                <p className="text-xs font-bold text-[#17143D] dark:text-[#EDECF8]">Nothing suggested yet</p>
                <p className="mt-0.5 text-[10px] font-medium text-[#6D6997] dark:text-[#9A94B8]">Suggestions appear once {firstName} starts a learning path.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="data" className="space-y-3 pt-1 sm:pt-3">
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
