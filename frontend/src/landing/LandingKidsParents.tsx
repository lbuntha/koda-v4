import React from "react";
import {
  Activity,
  Award,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  FlaskConical,
  Grid3X3,
  Layers3,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Badge, Card } from "../components/ui";

const KID_FEATURES = [
  { label: "Practice streaks", icon: Flame, tone: "text-orange-500 bg-orange-100 dark:bg-orange-400/15 dark:text-orange-300" },
  { label: "Verified XP", icon: Zap, tone: "text-amber-500 bg-amber-100 dark:bg-amber-400/15 dark:text-amber-300" },
  { label: "Skill levels", icon: Layers3, tone: "text-violet-500 bg-violet-100 dark:bg-violet-400/15 dark:text-violet-300" },
] as const;

const REAL_GAMES = [
  { title: "Liquid Sort", caption: "Logic", icon: FlaskConical, gradient: "from-cyan-400 to-indigo-500" },
  { title: "Goods Sort", caption: "Sorting", icon: PackageCheck, gradient: "from-amber-400 to-orange-500" },
  { title: "Koda Sudoku", caption: "Patterns", icon: Grid3X3, gradient: "from-emerald-400 to-teal-600" },
] as const;

const SUMMARY_FIELDS = [
  { label: "Accuracy", icon: Target },
  { label: "Independence", icon: ShieldCheck },
  { label: "Completed lessons", icon: Award },
  { label: "Current streak", icon: Flame },
] as const;

export const LandingKidsParents: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => (
  <section id="for-parents" className={`scroll-mt-20 bg-slate-50 px-4 py-16 transition-colors dark:bg-[#0B1020] sm:px-8 sm:py-20 ${isDark ? "dark" : ""}`}>
    <div className="mx-auto max-w-7xl">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">
          <Sparkles size={13} /> One learning loop
        </span>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Fun for kids. Clear for parents.
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
          This preview uses capabilities already implemented in Koda. Personal values appear only after verified learner activity exists.
        </p>
      </div>

      <div className="mt-10 grid overflow-hidden lg:grid-cols-2">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 dark:from-violet-950/50 dark:via-[#15172D] dark:to-fuchsia-950/25 sm:p-7">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-600/15" />
          <div className="relative">
            <Badge className="border-none bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">For kids</Badge>
            <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-white">Play, progress, celebrate</h3>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {KID_FEATURES.map(({ label, icon: Icon, tone }) => (
                <Card key={label} className="flex items-center gap-2 border-white/80 bg-white/85 p-2.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon size={14} /></div>
                  <span className="text-[10px] font-bold leading-tight text-slate-700 dark:text-slate-200">{label}</span>
                </Card>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {REAL_GAMES.map(({ title, caption, icon: Icon, gradient }) => (
                <Card key={title} className="group overflow-hidden border-white/80 bg-white/90 p-2 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
                  <div className={`flex h-24 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-inner`}>
                    <Icon size={38} strokeWidth={1.8} className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
                  </div>
                  <p className="mt-2 truncate text-[11px] font-black text-slate-800 dark:text-white">{title}</p>
                  <p className="text-[9px] font-medium text-slate-400">{caption}</p>
                </Card>
              ))}
            </div>

            <Card className="relative mt-3 flex min-h-16 items-center overflow-hidden border-violet-100 bg-white/90 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-500 dark:bg-amber-400/15 dark:text-amber-300"><Award size={19} /></div>
              <div className="ml-2.5 min-w-0 pr-16">
                <p className="text-xs font-black text-slate-800 dark:text-white">Progress rewards</p>
                <p className="text-[9px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">XP, levels and achievements come from verified learning events.</p>
              </div>
              <img src="/assets/koda-bear-mascot.png" alt="Koda celebrating learning progress" className="pointer-events-none absolute -bottom-12 right-0 w-20 drop-shadow-md" />
            </Card>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50/70 via-white to-cyan-50/70 p-5 dark:from-emerald-950/30 dark:via-[#11172B] dark:to-cyan-950/20 sm:p-7">
          <Badge className="border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">For parents</Badge>
          <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-white">Evidence you can understand</h3>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            <Card className="border-emerald-100 bg-white/90 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <div className="flex items-center justify-between"><p className="text-[10px] font-black text-slate-700 dark:text-slate-200">Time learning</p><Clock3 size={14} className="text-emerald-500" /></div>
              <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">Tracked from activity</p>
              <div className="mt-3 flex h-12 items-end justify-between gap-1.5" aria-label="Seven-day activity slots awaiting learner data">
                {Array.from({ length: 7 }, (_, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-7 w-full items-center justify-center rounded-md border border-dashed border-emerald-200 bg-emerald-50/60 text-[8px] font-bold text-emerald-500 dark:border-emerald-400/20 dark:bg-emerald-400/5 dark:text-emerald-400">—</div>
                    <span className="text-[7px] font-bold text-slate-400">{"MTWTFSS"[index]}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-emerald-100 bg-white/90 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <div className="flex items-center justify-between"><p className="text-[10px] font-black text-slate-700 dark:text-slate-200">Mastery states</p><BarChart3 size={14} className="text-emerald-500" /></div>
              <div className="mt-3 space-y-2">
                {["Developing", "Proficient", "Master"].map((level, index) => (
                  <div key={level} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-white/[0.05]">
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">{level}</span>
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full ${index === 0 ? "bg-indigo-300" : index === 1 ? "bg-sky-400" : "bg-emerald-400"}`}><Check size={9} className="text-white" strokeWidth={3} /></span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-emerald-100 bg-white/90 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <div className="flex items-center justify-between"><p className="text-[10px] font-black text-slate-700 dark:text-slate-200">Practice next</p><RefreshCw size={14} className="text-indigo-500" /></div>
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-indigo-50 p-2 dark:bg-indigo-400/10">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white"><Target size={15} /></div>
                <div className="min-w-0 flex-1"><p className="text-[10px] font-black text-slate-800 dark:text-white">Review · Reinforce · New</p><p className="text-[8px] font-medium text-slate-400">Recommendation categories</p></div>
                <ChevronRight size={13} className="text-slate-400" />
              </div>
            </Card>

            <Card className="border-emerald-100 bg-white/90 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
              <div className="flex items-center justify-between"><p className="text-[10px] font-black text-slate-700 dark:text-slate-200">Progress summary</p><Activity size={14} className="text-emerald-500" /></div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {SUMMARY_FIELDS.map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-1 rounded-lg bg-slate-50 px-1.5 py-1.5 dark:bg-white/[0.05]">
                    <Icon size={10} className="text-emerald-500" /><span className="text-[8px] font-bold text-slate-500 dark:text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-white/80 px-3 py-2 text-[9px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400">
            <ShieldCheck size={14} className="shrink-0 text-emerald-500" />
            Guardian analytics are authorized per child and derived from recorded learning activity.
          </div>
        </div>
      </div>
    </div>
  </section>
);
