import React from "react";
import { Star } from "lucide-react";
import type { CourseMode, CourseQueueItem, TodayCourse } from "../api/course";
import type { GradeBand } from "../api/auth";
import { Card, CardContent } from "../components/ui";
import { HomeHeader } from "./home/HomeHeader";
import { HeroActivity } from "./home/HeroActivity";
import { UpNextRow } from "./home/UpNextRow";
import { FreePlaySwitch } from "./home/FreePlaySwitch";
import { LevelUpDialog, type LevelUp } from "./home/LevelUpDialog";

interface Props {
  course: TodayCourse;
  levelUp: LevelUp | null;
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

/**
 * Compact, single-focus student home (shared skeleton for all bands): one hero
 * activity + an "up next" row, plan-by-default with Free play as a secondary
 * action. Rank and the full skill map live on the adult dashboard, not here.
 * Band-specific treatments compose these same pieces in later phases.
 */
export const StudentTodayHome: React.FC<Props> = ({
  course,
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
}) => {
  const [hero, ...rest] = course.queue;
  const canSkip = course.mode === "scheduled" && Boolean(course.recommendationRunId);

  return (
    <div className="min-h-screen bg-[#F8F7FC] text-[#17152F]" data-band={band}>
      <HomeHeader studentName={studentName} studentAvatar={studentAvatar} onExit={onExit} />

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
          <Card className="border-[#E2DEEF] text-center shadow-sm">
            <CardContent className="p-10">
              <Star className="mx-auto text-[#6B57D8]" />
              <h3 className="mt-3 text-lg font-bold">You’re all caught up 🎉</h3>
              <p className="mt-1 text-sm text-[#77718F]">
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
