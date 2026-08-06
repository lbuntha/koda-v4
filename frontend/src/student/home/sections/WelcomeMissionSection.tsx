import React from "react";
import type { CourseMode, CourseQueueItem } from "../../../api/course";
import { Button } from "../../../components/ui";
import { NextUpCard, type NextUpCardDifficulty } from "../shared";

interface Props {
  mode: CourseMode;
  studentName: string;
  isFirstVisit: boolean;
  hero: CourseQueueItem | null;
  artUrl?: string;
  badge?: string;
  difficulty?: NextUpCardDifficulty;
  mastery?: number;
  canSkip: boolean;
  skipping: boolean;
  onStart: (item: CourseQueueItem) => void;
  onSkip: (item: CourseQueueItem) => void;
}

/** Greeting plus the learner's single highest-priority mission for today. */
export const WelcomeMissionSection: React.FC<Props> = ({
  mode,
  studentName,
  isFirstVisit,
  hero,
  artUrl,
  badge,
  difficulty,
  mastery,
  canSkip,
  skipping,
  onStart,
  onSkip,
}) => (
  <section id="kid-home" className="scroll-mt-24">
    <div className="flex flex-col gap-4">
      <div className="pt-5 sm:pt-6">
        <h1 className="text-xl font-black leading-tight tracking-tight text-[#21183D] sm:text-2xl dark:text-[#F2EEFF]">
          {isFirstVisit
            ? `Welcome to Koda, ${studentName}! 🌟`
            : mode === "free"
              ? `Pick and play, ${studentName}!`
              : `Welcome back, ${studentName}! 👋`}
        </h1>
        <p className="mt-1 text-xs font-semibold text-[#6B6280] sm:text-[13px] dark:text-[#A79FC4]">
          {isFirstVisit && hero
            ? "Your first learning adventure is ready — let’s make it amazing!"
            : hero
              ? "Let’s keep learning and have fun!"
              : "You’re all caught up — nice work!"}
        </p>
      </div>

      {hero && (
        <NextUpCard
          title={hero.skillLabel}
          description={hero.description}
          artUrl={artUrl}
          badge={badge}
          difficulty={difficulty}
          minutes={hero.estimatedMinutes}
          questionCount={hero.questions.length}
          xp={hero.xpAvailable}
          progress={mastery}
          inProgress={hero.status === "in_progress"}
          onStart={() => onStart(hero)}
        />
      )}
    </div>

    {hero && canSkip && (
      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={skipping}
          loadingText="Finding another…"
          onClick={() => onSkip(hero)}
          className="rounded-full px-3 text-[11px] font-extrabold text-[#6E6480] hover:bg-white dark:text-[#A79FC4] dark:hover:bg-white/10"
        >
          Show me another
        </Button>
      </div>
    )}
  </section>
);
