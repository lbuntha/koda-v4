import React from "react";
import { Star, Target } from "lucide-react";
import { Card, CardContent } from "../../components/ui";
import { HomeHeader } from "./HomeHeader";
import { HeroActivity } from "./HeroActivity";
import { UpNextRow } from "./UpNextRow";
import { FreePlaySwitch } from "./FreePlaySwitch";
import { LevelUpDialog } from "./LevelUpDialog";
import { useThemeMode } from "../../theme/appTheme";
import type { StudentHomeProps } from "./types";

/**
 * Band B — Student (grades 7–9). The neutral, independent baseline: compact and
 * clean, with one light personal signal (today's count) and no childish frame.
 * Kid (playful) and Focus (professional) refine this in later phases.
 */
export const StudentHome: React.FC<StudentHomeProps> = ({
  course,
  levelUp,
  studentName,
  studentAvatar,
  loadingMode,
  skippingSkillId,
  onModeChange,
  onStart,
  onSkip,
  onDismissLevelUp,
  onExit,
}) => {
  const [theme, toggleTheme] = useThemeMode();
  const [hero, ...rest] = course.queue;
  const canSkip = course.mode === "scheduled" && Boolean(course.recommendationRunId);
  const goal =
    course.mode === "scheduled" && course.queue.length > 0 ? (
      <span className="hidden items-center gap-1.5 rounded-full border border-[#E2DEEF] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B57D8] sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-[#B7A7FF]">
        <Target size={14} /> {course.queue.length} to practise today
      </span>
    ) : null;

  return (
    <div
      className={`min-h-screen bg-[#F8F7FC] text-[#17152F] dark:bg-[#0F1220] dark:text-[#DEDCF0] ${
        theme === "dark" ? "dark" : ""
      }`}
      data-band="student"
    >
      <HomeHeader
        studentName={studentName}
        studentAvatar={studentAvatar}
        onExit={onExit}
        right={goal}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-12">
        {hero ? (
          <>
            <HeroActivity
              item={hero}
              canSkip={canSkip}
              skipping={skippingSkillId === hero.skillId}
              onStart={onStart}
              onSkip={onSkip}
            />
            <UpNextRow items={rest} onStart={onStart} />
          </>
        ) : (
          <Card className="border-[#E2DEEF] text-center shadow-sm dark:border-white/10 dark:bg-[#181D31]">
            <CardContent className="p-10">
              <Star className="mx-auto text-[#6B57D8] dark:text-[#A996FF]" />
              <h3 className="mt-3 text-lg font-bold">You’re all caught up 🎉</h3>
              <p className="mt-1 text-sm text-[#77718F] dark:text-[#9A94B8]">
                {course.mode === "free" ? "Come back next session for a fresh plan." : "Try Free play, or return for a fresh plan next session."}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 flex justify-center">
          <FreePlaySwitch mode={course.mode} loading={loadingMode !== null} onModeChange={onModeChange} />
        </div>
      </main>

      <LevelUpDialog levelUp={levelUp} onDismiss={onDismissLevelUp} />
    </div>
  );
};
