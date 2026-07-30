import React, { Suspense, useMemo } from "react";
import {
  CheckCircle,
  FlaskConical,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
  TrendingUp,
} from "lucide-react";
import { Button, Card } from "../components/ui";
import { useThemeMode } from "../theme/appTheme";
import { LiquidSortCanvas } from "../components/canvases/LiquidSortCanvas";
import { CountingQuestion, CountingTechnique } from "../types";

interface LandingHeroProps {
  onStartFree: () => void;
  onSeeHowItWorks: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onStartFree, onSeeHowItWorks }) => {
  const [mode] = useThemeMode();

  const liquidSortQuestion = useMemo<CountingQuestion>(
    () => ({
      id: "hero-liquid-sort",
      technique: CountingTechnique.LIQUID_SORT,
      title: "Liquid Bottle Sort",
      instruction: "Sort the colored liquids so each bottle contains only one color!",
      objectId: "bottle",
      targetCount: 5,
      config: { levelId: "level_5" },
    }),
    [],
  );

  return (
    <section
      className={`relative isolate overflow-hidden bg-gradient-to-br from-white via-[#fbf9ff] to-sky-50/80 pt-10 pb-16 transition-colors duration-300 dark:from-[#080B18] dark:via-[#111128] dark:to-[#071522] sm:pt-16 sm:pb-24 ${
        mode === "dark" ? "dark" : ""
      }`}
    >
      {/* Soft illustrated atmosphere inspired by the reference composition. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-[32%] h-[420px] w-[520px] rounded-full bg-violet-200/40 blur-[110px] dark:bg-violet-700/20" />
        <div className="absolute -right-28 top-0 h-[520px] w-[520px] rounded-full bg-sky-200/45 blur-[115px] dark:bg-sky-700/20" />
        <span className="absolute left-[42%] top-16 rotate-12 text-3xl font-black text-violet-300/60 dark:text-violet-400/35">+</span>
        <span className="absolute left-[48%] top-2 -rotate-6 text-3xl font-black text-orange-300/60 dark:text-orange-300/35">8</span>
        <span className="absolute right-[11%] top-24 rotate-12 text-2xl font-black text-sky-300/70 dark:text-sky-300/35">2</span>
        <span className="absolute right-[3%] top-[45%] h-2 w-2 rounded-full bg-amber-300 dark:bg-amber-300/60" />
        <span className="absolute left-[45%] top-[61%] h-2 w-2 rounded-full bg-amber-300 dark:bg-amber-300/60" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-6">
          {/* Left Column */}
          <div className="flex flex-col text-left lg:col-span-5">
            {/* Eyebrow */}
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              <Sparkles size={13} className="text-indigo-500 dark:text-indigo-300" />
              Play. Practice. Grow.
            </span>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.035em] text-slate-950 dark:text-white sm:text-5xl lg:text-[3.75rem] sm:leading-[1.08]">
              Learn with Koda.
            </h1>

            <p className="mt-4 max-w-lg text-base font-medium leading-relaxed text-slate-500 dark:text-slate-300 sm:text-lg">
              Fun, personalized activities help every child build skills, explore ideas, and grow with confidence—one step at a time.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={onStartFree}
                className="h-12 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700"
              >
                Start learning free
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={onSeeHowItWorks}
                className="h-12 gap-2.5 rounded-xl border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <Play size={11} className="ml-0.5 fill-current" />
                </div>
                See how it works
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 flex flex-wrap items-center gap-5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={15} className="text-emerald-500" />
                <span>No ads</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-indigo-500" />
                <span>Safe for kids</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={15} className="text-sky-500" />
                <span>Parent controls</span>
              </div>
            </div>
          </div>

          {/* Right Column: Preview Card with REAL LiquidSortCanvas */}
          <div className="relative min-h-[500px] lg:col-span-7 lg:pl-8 lg:pr-16">
            <Card className="relative mx-auto max-w-[540px] rotate-[1.2deg] overflow-hidden border-white/80 bg-white/95 p-0 shadow-[0_24px_65px_rgba(91,73,157,0.18)] backdrop-blur-sm dark:border-white/10 dark:bg-[#11172B]/95 dark:shadow-[0_28px_75px_rgba(0,0,0,0.48)]">
              <div className="flex min-h-[450px]">
                {/* App rail */}
                <aside aria-hidden="true" className="flex w-12 shrink-0 flex-col items-center gap-5 border-r border-violet-100 bg-violet-50/80 py-4 dark:border-white/10 dark:bg-violet-950/35">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white shadow-md shadow-indigo-600/25">
                    K
                  </div>
                  <Sparkles size={15} className="text-indigo-500 dark:text-indigo-300" />
                  <FlaskConical size={15} className="text-violet-400 dark:text-violet-300" />
                  <Star size={15} className="text-violet-400 dark:text-violet-300" />
                  <Users size={15} className="mt-auto text-violet-400 dark:text-violet-300" />
                </aside>

                <div className="min-w-0 flex-1 p-4 sm:p-5">
                  {/* Header: Featured Game */}
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-indigo-600/20">
                      <FlaskConical size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Liquid Bottle Sort</h3>
                      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-400">Physics &amp; Fluid Logic</p>
                    </div>
                  </div>

                  {/* REAL LiquidSortCanvas — compacted to fit the hero card */}
                  <Card className="mt-3 h-[300px] overflow-hidden border-none bg-slate-50/90 p-3 shadow-inner shadow-slate-100/70 dark:bg-slate-950/55 dark:shadow-black/20">
                    <div className="h-full">
                      <Suspense
                        fallback={
                          <div className="flex h-full items-center justify-center text-xs font-medium text-slate-400">
                            Loading game...
                          </div>
                        }
                      >
                        <LiquidSortCanvas
                          question={liquidSortQuestion}
                          isPlayMode={true}
                          isDark={mode === "dark"}
                          compact
                          onSuccess={() => {}}
                        />
                      </Suspense>
                    </div>
                  </Card>

                  <Card className="mt-3 flex items-center gap-2.5 border-violet-100 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-500 ring-2 ring-amber-300/50 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-300/20">
                      <Star size={17} className="fill-current" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-white">+20 XP</p>
                      <p className="text-[10px] font-medium text-slate-400 dark:text-slate-400">Keep experimenting!</p>
                    </div>
                  </Card>
                </div>
              </div>
            </Card>

            {/* Floating Parent Progress */}
            <Card className="absolute right-0 top-0 z-20 w-40 -rotate-2 border-white/90 bg-white/95 p-3.5 shadow-[0_18px_35px_rgba(61,52,101,0.16)] dark:border-white/10 dark:bg-[#151D32]/95 dark:shadow-[0_20px_42px_rgba(0,0,0,0.42)] sm:w-44">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                For parents
              </span>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <Trophy size={14} />
                </div>
                <div>
                  <p className="text-xs font-black leading-tight text-slate-800 dark:text-white">3 skills mastered</p>
                </div>
              </div>
              <svg aria-label="Improving weekly progress" viewBox="0 0 120 45" className="mt-2 h-10 w-full">
                <path d="M4 38 L26 31 L47 34 L70 22 L91 16 L116 5" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 38 L26 31 L47 34 L70 22 L91 16 L116 5 L116 43 L4 43 Z" className="fill-emerald-100/65 dark:fill-emerald-950/70" />
                {[4, 26, 47, 70, 91, 116].map((cx, index) => (
                  <circle key={cx} cx={cx} cy={[38, 31, 34, 22, 16, 5][index]} r="2.7" fill="#10B981" />
                ))}
              </svg>
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <TrendingUp size={11} /> +15% this week
              </div>
            </Card>

            <img
              src="/assets/koda-bear-mascot.png"
              alt="Koda, a cheerful purple bear, presenting a learning activity"
              className="pointer-events-none absolute -bottom-20 -right-14 z-30 w-48 select-none drop-shadow-[0_18px_16px_rgba(74,55,132,0.24)] dark:drop-shadow-[0_20px_20px_rgba(118,92,240,0.28)] sm:-right-10 sm:w-56"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
