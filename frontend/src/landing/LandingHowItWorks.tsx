import React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronRight,
  Gamepad2,
  Lock,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge, Card } from "../components/ui";

const PROFILE_AVATARS = [
  { seed: "koda-template-a7f2", label: "Example avatar one" },
  { seed: "koda-template-b4c9", label: "Example selected avatar" },
  { seed: "koda-template-c8e1", label: "Example avatar three" },
  { seed: "koda-template-d2a6", label: "Example avatar four" },
  { seed: "koda-template-e9b3", label: "Example avatar five" },
] as const;

const diceBearAvatarUrl = (seed: string): string => {
  const params = new URLSearchParams({
    seed,
    eyesVariant: "cute,glasses,shades,stars,wink,wink2",
    mouthVariant: "cute,lilSmile,smileLol,smileTeeth,tongueOut,wideSmile",
    mouthProbability: "100",
    backgroundColor: "b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf",
    backgroundColorFill: "linear",
    backgroundColorAngle: "135",
  });
  // DiceBear's list options use literal commas; URLSearchParams encodes them by default.
  return `https://api.dicebear.com/10.x/fun-emoji/svg?${params.toString().replaceAll("%2C", ",")}`;
};

const DiceBearAvatarStack: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const positions = [
    "left-0 top-5",
    "left-1/2 -top-2 -translate-x-1/2",
    "right-0 top-5",
    "left-[18%] bottom-0",
    "right-[18%] bottom-0",
  ];

  return (
    <div className="relative mt-7 h-36 w-full max-w-[250px]" aria-label="Example avatar choices">
      {PROFILE_AVATARS.map(({ seed, label }, index) => {
        const selected = index === 1;
        return (
          <div key={seed} className={`absolute ${positions[index]} ${selected ? "z-10" : "z-0"}`}>
            <motion.div
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: selected ? [0, -7, 0] : [0, -4, 0],
                      rotate: selected ? [0, 1.5, 0, -1.5, 0] : [0, index % 2 === 0 ? 2 : -2, 0],
                    }
              }
              whileHover={reduceMotion ? undefined : { scale: 1.07, y: -6 }}
              transition={{
                duration: selected ? 3.2 : 3.6 + index * 0.18,
                delay: index * 0.14,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className={`flex items-center justify-center overflow-hidden rounded-2xl bg-slate-100 shadow-sm dark:bg-white/10 ${
                selected
                  ? "h-24 w-24 border-4 border-violet-500 ring-4 ring-violet-100 shadow-lg shadow-violet-500/15 dark:ring-violet-400/15"
                  : "h-16 w-16 border-4 border-white dark:border-[#11172B]"
              }`}
            >
              <img
                src={diceBearAvatarUrl(seed)}
                alt={label}
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
        );
      })}
    </div>
  );
};

const ACTIVITY_TEMPLATES = [
  { icon: Gamepad2, title: "Count to 10", status: "Practice", tone: "violet" },
  { icon: Star, title: "Make 10", status: "New", tone: "amber" },
  { icon: Check, title: "Add within 5", status: "Completed", tone: "emerald" },
] as const;

const ROADMAP_STEPS = [
  { label: "Count\nto 10", state: "done" },
  { label: "Add\nwithin 10", state: "done" },
  { label: "Subtract\nwithin 10", state: "current" },
  { label: "Multiply\nby 2", state: "locked" },
] as const;

const activityTone = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-500 dark:bg-amber-400/15 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
};

export const LandingHowItWorks: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => (
  <section
    id="how-it-works"
    className={`scroll-mt-20 bg-white px-4 py-16 transition-colors dark:bg-[#080B18] sm:px-8 sm:py-20 ${isDark ? "dark" : ""}`}
  >
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">
          <Sparkles size={13} /> How it works
        </span>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          A simple path to stronger skills.
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
          Template preview — the activities and progress below are examples only. Connect these cards to your learner data when implementing the flow.
        </p>
      </div>

      <div className="mt-12 grid gap-7 md:grid-cols-3 md:gap-4">
        {/* Step 1: profile-selection template */}
        <Card className="relative flex min-h-[350px] flex-col items-center overflow-visible border-slate-200/80 p-5 pt-8 text-center shadow-[0_10px_35px_rgba(66,48,130,0.06)] dark:border-white/10 dark:bg-[#11172B]">
          <div className="absolute -top-5 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-black text-white shadow-lg shadow-indigo-600/25">
            1
          </div>
          <Badge variant="secondary" className="mb-3 text-[9px] uppercase tracking-wider dark:bg-white/10 dark:text-slate-300">
            Template
          </Badge>
          <h3 className="text-base font-black text-slate-900 dark:text-white">Choose a profile</h3>

          <DiceBearAvatarStack />

          <p className="mt-auto max-w-[240px] text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Let a learner pick a friendly profile before beginning their personalized path.
          </p>
        </Card>

        {/* Step 2: recommendation-list template */}
        <Card className="relative flex min-h-[350px] flex-col overflow-visible border-slate-200/80 p-5 pt-8 shadow-[0_10px_35px_rgba(66,48,130,0.06)] dark:border-white/10 dark:bg-[#11172B]">
          <div className="absolute -top-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-black text-white shadow-lg shadow-indigo-600/25">
            2
          </div>
          <Badge variant="secondary" className="mx-auto mb-3 text-[9px] uppercase tracking-wider dark:bg-white/10 dark:text-slate-300">
            Example recommendations
          </Badge>
          <h3 className="text-center text-base font-black text-slate-900 dark:text-white">Play the right activity</h3>

          <Card className="mt-5 border-slate-200/80 bg-slate-50/70 p-3 shadow-inner shadow-slate-100 dark:border-white/10 dark:bg-slate-950/45 dark:shadow-black/20">
            <p className="mb-2 text-[10px] font-bold text-slate-600 dark:text-slate-300">Recommended for you</p>
            <div className="space-y-2">
              {ACTIVITY_TEMPLATES.map(({ icon: Icon, title, status, tone }) => (
                <div key={title} className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activityTone[tone]}`}>
                    <Icon size={16} className={tone === "amber" ? "fill-current" : ""} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800 dark:text-white">{title}</p>
                    <p className="text-[9px] font-medium text-slate-400">{status}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </div>
              ))}
            </div>
          </Card>

          <p className="mt-auto pt-4 text-center text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Populate this list from your recommendation service and the learner’s current level.
          </p>
        </Card>

        {/* Step 3: roadmap/progress template */}
        <Card className="relative flex min-h-[350px] flex-col overflow-visible border-slate-200/80 p-5 pt-8 shadow-[0_10px_35px_rgba(66,48,130,0.06)] dark:border-white/10 dark:bg-[#11172B]">
          <div className="absolute -top-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-black text-white shadow-lg shadow-indigo-600/25">
            3
          </div>
          <Badge variant="secondary" className="mx-auto mb-3 text-[9px] uppercase tracking-wider dark:bg-white/10 dark:text-slate-300">
            Example progress layout
          </Badge>
          <h3 className="text-center text-base font-black text-slate-900 dark:text-white">Watch skills grow</h3>

          <Card className="mt-5 border-slate-200/80 bg-slate-50/70 p-3 shadow-inner shadow-slate-100 dark:border-white/10 dark:bg-slate-950/45 dark:shadow-black/20">
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Your learning roadmap</p>
            <div className="mt-3 flex items-start justify-between">
              {ROADMAP_STEPS.map((step, index) => (
                <React.Fragment key={step.label}>
                  <div className="flex w-12 flex-col items-center text-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm ${
                      step.state === "done"
                        ? "bg-emerald-500"
                        : step.state === "current"
                          ? "bg-violet-500"
                          : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                    }`}>
                      {step.state === "done" ? <Check size={15} strokeWidth={3} /> : step.state === "current" ? <Star size={14} className="fill-current" /> : <Lock size={13} />}
                    </div>
                    <span className="mt-1 whitespace-pre-line text-[8px] font-bold leading-tight text-slate-500 dark:text-slate-400">{step.label}</span>
                  </div>
                  {index < ROADMAP_STEPS.length - 1 && <div className="mt-4 h-0.5 min-w-3 flex-1 bg-gradient-to-r from-emerald-400 to-violet-400" />}
                </React.Fragment>
              ))}
            </div>

            <p className="mt-4 text-[10px] font-bold text-slate-600 dark:text-slate-300">Parent progress</p>
            <svg aria-label="Example progress-chart placeholder" viewBox="0 0 220 65" className="mt-1 h-16 w-full">
              {[16, 32, 48].map((y) => <line key={y} x1="4" y1={y} x2="216" y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />)}
              <path d="M6 52 L37 43 L68 49 L101 32 L133 39 L164 21 L214 11" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {[6, 37, 68, 101, 133, 164, 214].map((cx, index) => <circle key={cx} cx={cx} cy={[52, 43, 49, 32, 39, 21, 11][index]} r="3" fill="#10B981" />)}
            </svg>
          </Card>

          <p className="mt-auto pt-4 text-center text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Bind the roadmap and chart to verified mastery and analytics records.
          </p>
        </Card>
      </div>
    </div>
  </section>
);
