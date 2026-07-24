import React from "react";
import {
  ArrowRight,
  BookOpen,
  LogOut,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import type {
  CourseMode,
  CourseQueueItem,
  MasteryLevel,
  StudentProgress,
  TodayCourse,
} from "../api/course";
import type { GradeBand } from "../api/auth";
import { Button, Card, CardContent, Dialog } from "../components/ui";

interface Props {
  course: TodayCourse;
  progress: StudentProgress | null;
  levelUp: {
    skillLabel: string;
    previousLevel: MasteryLevel;
    level: MasteryLevel;
  } | null;
  studentName: string;
  studentAvatar?: string | null;
  /** Grade band selecting the layout treatment (kid / student / focus). */
  band: GradeBand;
  loadingMode: CourseMode | null;
  skippingSkillId: string | null;
  onModeChange: (mode: CourseMode) => void;
  onStart: (item: CourseQueueItem) => void;
  onSkip: (item: CourseQueueItem) => void;
  onDismissLevelUp: () => void;
  onExit: () => void;
}

const KIND = {
  reinforce: { label: "Reinforce", icon: RefreshCw, tone: "bg-rose-50 text-rose-700 border-rose-200" },
  review: { label: "Review", icon: RotateCcw, tone: "bg-amber-50 text-amber-700 border-amber-200" },
  new: { label: "New", icon: Sparkles, tone: "bg-violet-50 text-violet-700 border-violet-200" },
  stretch: { label: "Stretch", icon: Star, tone: "bg-sky-50 text-sky-700 border-sky-200" },
  free: { label: "Free practice", icon: BookOpen, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
} as const;

const LEVEL: Record<MasteryLevel, { label: string; tone: string; fill: string }> = {
  not_started: { label: "Not started", tone: "text-slate-500 bg-slate-50 border-slate-200", fill: "bg-slate-300" },
  beginner: { label: "Beginner", tone: "text-sky-700 bg-sky-50 border-sky-200", fill: "bg-sky-500" },
  developing: { label: "Developing", tone: "text-violet-700 bg-violet-50 border-violet-200", fill: "bg-violet-500" },
  proficient: { label: "Proficient", tone: "text-emerald-700 bg-emerald-50 border-emerald-200", fill: "bg-emerald-500" },
  master: { label: "Master", tone: "text-amber-700 bg-amber-50 border-amber-200", fill: "bg-amber-500" },
};

const levelName = (level: MasteryLevel) => LEVEL[level].label;

export const StudentTodayHome: React.FC<Props> = ({
  course,
  progress,
  levelUp,
  studentName,
  studentAvatar,
  band,
  loadingMode,
  skippingSkillId,
  onModeChange,
  onStart,
  onSkip,
  onDismissLevelUp,
  onExit,
}) => (
  <div className="min-h-screen bg-[#F8F7FC] text-[#17152F]" data-band={band}>
    <header className="border-b border-[#E8E5F2] bg-white/90 px-5 py-4 backdrop-blur md:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5B48D6] text-xl font-bold text-white shadow-lg shadow-violet-200" aria-hidden>
            {studentAvatar || studentName.trim().charAt(0).toUpperCase() || "🙂"}
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8178AE]">Today’s learning</p>
            <h1 className="text-lg font-bold">Hi {studentName}</h1>
          </div>
        </div>
        <Button variant="outline" onClick={onExit}>
          <LogOut size={16} /> <span className="hidden sm:inline">Exit</span>
        </Button>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-5 py-7 md:px-8 md:py-10">
      {progress && (
        <Card className="mb-7 border-[#E2DEEF] shadow-[0_8px_24px_rgba(45,35,100,0.05)]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Trophy size={21} />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8178AE]">Your learning rank</p>
                <h2 className="text-lg font-bold text-[#22203A]">{progress.rank.tierLabel}</h2>
              </div>
            </div>
            <div className="w-full sm:max-w-sm">
              <div className="mb-1.5 flex justify-between text-xs font-semibold text-[#746E8D]">
                <span>{progress.rank.proficientPlus} proficient</span>
                <span>{progress.rank.mastered} mastered</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#EEEAF8]">
                <div
                  className="h-full rounded-full bg-[#6B57D8] transition-all"
                  style={{ width: `${Math.max(4, progress.rank.progressToNext * 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6B57D8]">Choose your path</p>
          <h2 className="mt-1 text-2xl font-bold md:text-3xl">What would you like to practise?</h2>
          <p className="mt-2 max-w-xl text-sm text-[#716C8C]">Follow today’s plan or choose any assigned skill. Recommendations are helpful, never forced.</p>
        </div>
        <div className="inline-flex rounded-2xl border border-[#E2DEEF] bg-white p-1 shadow-sm">
          {(["scheduled", "free"] as CourseMode[]).map(mode => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={course.mode === mode ? "default" : "ghost"}
              disabled={loadingMode !== null}
              onClick={() => onModeChange(mode)}
            >
              {mode === "scheduled" ? "My plan" : "Free practice"}
            </Button>
          ))}
        </div>
      </section>

      {course.queue.length === 0 ? (
        <Card className="mt-8 border-[#E2DEEF] text-center shadow-sm">
          <CardContent className="p-10">
            <Star className="mx-auto text-[#6B57D8]" />
            <h3 className="mt-3 text-lg font-bold">You’re all caught up</h3>
            <p className="mt-1 text-sm text-[#77718F]">Try Free practice, or return for a fresh plan next session.</p>
          </CardContent>
        </Card>
      ) : (
        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {course.queue.map((item, index) => {
            const meta = KIND[item.kind];
            const Icon = meta.icon;
            const skillProgress = progress?.skills.find(skill =>
              skill.curriculumId === item.curriculumId && skill.skillId === item.skillId
            );
            const level = LEVEL[skillProgress?.level ?? "not_started"];
            return (
              <Card key={`${item.assignmentId}:${item.skillId}`} className="border-[#E2DEEF] shadow-[0_10px_30px_rgba(45,35,100,0.06)]">
                <CardContent className="flex min-h-[270px] flex-col p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.tone}`}><Icon size={13} /> {meta.label}</span>
                    <span className="font-mono text-xs font-bold text-[#AAA4C0]">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-[#22203A]">{item.skillLabel}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#746E8D]">{item.reason}</p>
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${level.tone}`}>{level.label}</span>
                      <span className="text-[10px] font-semibold text-[#9B95B2]">{Math.round((skillProgress?.score ?? 0) * 100)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#EEEAF8]">
                      <div
                        className={`h-full rounded-full transition-all ${level.fill}`}
                        style={{ width: `${Math.max(skillProgress?.plays ? 5 : 0, (skillProgress?.score ?? 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-4 text-xs font-semibold text-[#9B95B2]">{item.questions.length} worksheet card{item.questions.length === 1 ? "" : "s"}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <Button className="flex-1" onClick={() => onStart(item)}>Start <ArrowRight size={15} /></Button>
                    {course.mode === "scheduled" && course.recommendationRunId && (
                      <Button
                        variant="outline"
                        disabled={skippingSkillId !== null}
                        onClick={() => onSkip(item)}
                      >
                        {skippingSkillId === item.skillId ? "Skipping…" : "Skip"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      {progress && progress.skills.length > 0 && (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6B57D8]">Skill map</p>
              <h2 className="mt-1 text-xl font-bold text-[#22203A]">Your progress</h2>
            </div>
            <p className="text-xs font-semibold text-[#8E88A7]">{progress.rank.assignedSkills} assigned skills</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {progress.skills.map(skill => {
              const meta = LEVEL[skill.level];
              return (
                <Card key={`${skill.curriculumId}:${skill.skillId}`} className="border-[#E2DEEF] shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-[#28243F]">{skill.skillLabel}</h3>
                        <p className="mt-1 text-[11px] font-medium text-[#8E88A7]">
                          {skill.plays ? `${skill.plays} strong ${skill.plays === 1 ? "try" : "tries"}` : "Ready when you are"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.tone}`}>{meta.label}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEEAF8]">
                      <div className={`h-full rounded-full ${meta.fill}`} style={{ width: `${Math.max(skill.plays ? 5 : 0, skill.score * 100)}%` }} />
                    </div>
                    <p className="mt-2 truncate text-[10px] font-medium text-[#9B95B2]">
                      {skill.toNextLevel[0] || (skill.level === "master" ? "Mastered — keep it fresh" : `Next: ${skill.nextLevel ? levelName(skill.nextLevel) : "Master"}`)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </main>

    <Dialog isOpen={levelUp !== null} onClose={onDismissLevelUp}>
      {levelUp && (
        <div className="py-3 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-500"><Trophy size={31} /></span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#6B57D8]">Level up</p>
          <h2 className="mt-2 text-2xl font-bold text-[#17152F]">{levelName(levelUp.level)}</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#716C8C]">
            Your work on <strong>{levelUp.skillLabel}</strong> moved you from {levelName(levelUp.previousLevel)} to {levelName(levelUp.level)}.
          </p>
          <Button className="mt-6 w-full" onClick={onDismissLevelUp}>Keep learning</Button>
        </div>
      )}
    </Dialog>
  </div>
);
