import React, { useMemo, useState } from "react";
import { Play, X } from "lucide-react";
import { useThemeMode } from "../theme/appTheme";
import { Button, Card, Dialog } from "../components/ui";
import { ALL_TECHNIQUES } from "../techniques";
import { CANVAS_BY_TECHNIQUE } from "../components/studio/canvasRegistry";
import { DEFAULT_QUESTIONS } from "../templates";
import { CountingQuestion, CountingTechnique } from "../types";
import { LandingHeader } from "./LandingHeader";
import { LandingHero } from "./LandingHero";
import { LandingHowItWorks } from "./LandingHowItWorks";
import { LandingKidsParents } from "./LandingKidsParents";
import { LandingSkillCategories, type LandingSkillCategory } from "./LandingSkillCategories";
import { LandingClosingCta } from "./LandingClosingCta";
import { LandingFooter } from "./LandingFooter";
import { LandingFaq } from "./LandingFaq";

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp?: () => void;
}

const SKILL_CATEGORIES: Record<LandingSkillCategory, CountingTechnique[]> = {
  counting: [
    CountingTechnique.ONE_TO_ONE,
    CountingTechnique.MOVE_AND_COUNT,
    CountingTechnique.LINE_UP_AND_COUNT,
    CountingTechnique.SUBITIZE,
    CountingTechnique.COUNT_MAGNETS,
    CountingTechnique.DIFFERENT_ARRANGEMENTS,
    CountingTechnique.COUNT_ON,
    CountingTechnique.COUNT_BACK,
    CountingTechnique.GROUP_IN_TENS,
  ],
  addition: [
    CountingTechnique.ADDITION_SANDBOX,
    CountingTechnique.ADDITION_TUTOR,
    CountingTechnique.ADDITION_COLUMN,
    CountingTechnique.ADDITION_COLUMN_MULTI,
  ],
  subtraction: [
    CountingTechnique.SUBTRACTION_SANDBOX,
    CountingTechnique.SUBTRACTION_COLUMN,
    CountingTechnique.SUBTRACTION_COLUMN_MULTI,
  ],
  multiplication: [
    CountingTechnique.MULTIPLICATION_ARRAY,
    CountingTechnique.MULTIPLICATION_COLUMN,
  ],
};

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onSignUp }) => {
  const [mode] = useThemeMode();
  const [activeDemoTechnique, setActiveDemoTechnique] = useState<CountingTechnique | null>(null);

  const activeDemoQuestion = useMemo<CountingQuestion | null>(() => {
    if (!activeDemoTechnique) return null;
    const found = DEFAULT_QUESTIONS.find((question) => question.technique === activeDemoTechnique);
    if (found) return found;
    const manifest = ALL_TECHNIQUES.find((item) => item.technique === activeDemoTechnique);
    return {
      id: `demo-${activeDemoTechnique}`,
      technique: activeDemoTechnique,
      title: manifest?.label ?? "Interactive Demo",
      instruction: `Practice ${manifest?.label ?? "this learning activity"}.`,
      objectId: "star",
      targetCount: manifest?.defaultTargetCount ?? 5,
      config: {},
    };
  }, [activeDemoTechnique]);

  const DemoCanvas = activeDemoTechnique ? CANVAS_BY_TECHNIQUE[activeDemoTechnique] : null;

  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  const previewCategory = (category: LandingSkillCategory) => {
    const firstAvailable = SKILL_CATEGORIES[category].find((technique) =>
      ALL_TECHNIQUES.some((manifest) => manifest.technique === technique),
    );
    if (firstAvailable) setActiveDemoTechnique(firstAvailable);
  };

  return (
    <div className={`min-h-screen w-full bg-slate-50 font-sans text-slate-900 transition-colors dark:bg-[#080B18] dark:text-slate-100 ${mode === "dark" ? "dark" : ""}`}>
      <LandingHeader onSignIn={onSignIn} onStartFree={onSignUp ?? onSignIn} />

      <div id="hero">
        <LandingHero onStartFree={onSignUp ?? onSignIn} onSeeHowItWorks={scrollToHowItWorks} />
      </div>

      <LandingHowItWorks isDark={mode === "dark"} />
      <LandingKidsParents isDark={mode === "dark"} />
      <LandingSkillCategories
        isDark={mode === "dark"}
        activityCounts={{
          counting: SKILL_CATEGORIES.counting.length,
          addition: SKILL_CATEGORIES.addition.length,
          subtraction: SKILL_CATEGORIES.subtraction.length,
          multiplication: SKILL_CATEGORIES.multiplication.length,
        }}
        onSelectCategory={previewCategory}
      />

      <LandingFaq isDark={mode === "dark"} />

      <LandingClosingCta isDark={mode === "dark"} onStart={onSignUp ?? onSignIn} />
      <LandingFooter isDark={mode === "dark"} />

      {activeDemoTechnique && activeDemoQuestion && DemoCanvas && (
        <Dialog isOpen onClose={() => setActiveDemoTechnique(null)}>
          <Card className="w-full max-w-3xl border-none p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><Play size={10} /> Playable demo</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">{activeDemoQuestion.title}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveDemoTechnique(null)} className="h-8 w-8 p-0 text-slate-400"><X size={16} /></Button>
            </div>
            <div className="mt-3 min-h-[380px] rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
              <DemoCanvas
                question={activeDemoQuestion}
                isPlayMode
                isDark={mode === "dark"}
                onSuccess={() => window.setTimeout(() => setActiveDemoTechnique(null), 1200)}
              />
            </div>
          </Card>
        </Dialog>
      )}
    </div>
  );
};
