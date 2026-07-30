import React from "react";
import { ArrowRight } from "lucide-react";
import { Button, Card } from "../components/ui";

export type LandingSkillCategory = "counting" | "addition" | "subtraction" | "multiplication";

interface LandingSkillCategoriesProps {
  isDark?: boolean;
  activityCounts: Record<LandingSkillCategory, number>;
  onSelectCategory: (category: LandingSkillCategory) => void;
}

const CATEGORIES = [
  { id: "counting", title: "Number Sense", art: "counting" },
  { id: "addition", title: "Addition", art: "addition" },
  { id: "subtraction", title: "Subtraction", art: "subtraction" },
  { id: "multiplication", title: "Multiplication", art: "multiplication" },
] as const;

const TONES = {
  rose: "from-rose-300 via-rose-400 to-rose-600 shadow-rose-600/25",
  amber: "from-amber-200 via-amber-400 to-orange-500 shadow-orange-500/25",
  green: "from-emerald-300 via-emerald-400 to-emerald-600 shadow-emerald-600/25",
  blue: "from-sky-300 via-blue-400 to-blue-600 shadow-blue-600/25",
};

const SkillBlock: React.FC<{ children: React.ReactNode; tone: keyof typeof TONES; className?: string }> = ({ children, tone, className = "" }) => (
  <span className={`flex h-12 w-12 items-center justify-center rounded-[13px] border border-white/50 bg-gradient-to-br text-2xl font-black text-white shadow-[0_9px_14px_-7px] ${TONES[tone]} ${className}`}>
    <span className="drop-shadow-sm">{children}</span>
  </span>
);

const CategoryArt: React.FC<{ art: string }> = ({ art }) => {
  if (art === "counting") return <div className="flex h-24 items-end justify-center -space-x-1"><SkillBlock tone="rose" className="h-11 w-11 -rotate-3">1</SkillBlock><SkillBlock tone="amber" className="z-10 -translate-y-2 rotate-2">2</SkillBlock><SkillBlock tone="green" className="h-14 w-14 -translate-y-4 -rotate-2">3</SkillBlock></div>;
  if (art === "addition") return <div className="flex h-24 items-center justify-center gap-2"><SkillBlock tone="blue" className="-rotate-6">+</SkillBlock><SkillBlock tone="blue" className="translate-y-1 rotate-6">+</SkillBlock></div>;
  if (art === "subtraction") return <div className="flex h-24 items-center justify-center gap-2"><SkillBlock tone="rose" className="-translate-y-2 rotate-3">−</SkillBlock><SkillBlock tone="rose" className="translate-y-2 -rotate-3">−</SkillBlock></div>;
  return <div className="flex h-24 items-center justify-center"><SkillBlock tone="green" className="h-16 w-16 -rotate-3 text-3xl">×</SkillBlock></div>;
};

export const LandingSkillCategories: React.FC<LandingSkillCategoriesProps> = ({ isDark = false, activityCounts, onSelectCategory }) => (
  <section id="learning" className={`scroll-mt-20 bg-white px-4 py-16 transition-colors dark:bg-[#080B18] sm:px-8 sm:py-20 ${isDark ? "dark" : ""}`}>
    <div className="mx-auto max-w-6xl">
      <div className="text-center">
        <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">One place for every growing skill.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-slate-500 dark:text-slate-400">Explore the activities currently available in Koda.</p>
      </div>
      <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map(({ id, title, art }) => (
          <Card
            key={id}
            interactive
            role="button"
            tabIndex={0}
            onClick={() => onSelectCategory(id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectCategory(id);
              }
            }}
            className="group overflow-hidden border-slate-200/80 bg-white p-3 shadow-[0_8px_28px_rgba(62,49,126,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-white/10 dark:bg-[#11172B]"
          >
            <CategoryArt art={art} />
            <div className="flex items-end justify-between gap-3 border-t border-slate-100 px-1 pb-1 pt-3 dark:border-white/10">
              <div><h3 className="text-sm font-black text-slate-900 dark:text-white">{title}</h3><p className="mt-0.5 text-[10px] font-medium text-slate-400">{activityCounts[id]} {activityCounts[id] === 1 ? "activity" : "activities"}</p></div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Explore ${title} activities`} className="pointer-events-none h-8 w-8 rounded-lg text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-400/10 dark:group-hover:text-indigo-300"><ArrowRight size={15} /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  </section>
);
