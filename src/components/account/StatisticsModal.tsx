import React, { useEffect, useState } from "react";
import { Flame, Star, Target, Trophy, Zap } from "lucide-react";

import { UIModal, UIButton, UIStatTile } from "../ui";
import {
  EMPTY_STATS,
  fetchProfileStats,
  subscribeProfileStats,
  type ProfileStats,
} from "../../lib/profileStats";
import { getCourseLessons } from "../../curriculum";
import { loadProgress } from "../../lib/learnerProgress";
import { levelFromXp } from "../../lib/level";
import { useAudienceViewer } from "../../skills/viewer";

export interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile?: () => void;
  stats?: ProfileStats | null;
}

export const StatisticsModal: React.FC<StatisticsModalProps> = ({
  isOpen,
  onClose,
  onOpenProfile,
  stats: propStats,
}) => {
  const [stats, setStats] = useState<ProfileStats>(propStats ?? EMPTY_STATS);
  // The course is age-gated, so "how many lessons are there" is a question only
  // a viewer can answer — the same one Home and the profile ask.
  const viewer = useAudienceViewer();

  useEffect(() => {
    if (propStats) {
      setStats(propStats);
      return;
    }
    let cancelled = false;
    void fetchProfileStats().then((row) => {
      if (!cancelled && row) setStats(row);
    });
    return () => {
      cancelled = true;
    };
  }, [propStats]);

  useEffect(() => {
    if (propStats) return;
    return subscribeProfileStats((row) => setStats(row));
  }, [propStats]);

  if (!isOpen) return null;

  /*
   * The stored row first, then this device's own record.
   *
   * `loadProgress` is a real fallback: it reads the learner's XP and streak from
   * storage and resolves the goal through `DailyGoalAPI`, so nothing below has
   * to invent a number. The two that did invent one — a course of 284 lessons
   * with 2 of them mastered — printed a reading rather than a default: a learner
   * whose stats row had not arrived was shown somebody's progress, and 284 was
   * a count of the course as it stood on the day somebody typed it.
   *
   * The total is asked of the course itself, for this viewer, which is where
   * every other screen gets it (`App.tsx` publishes the same figure). A learner
   * with nothing recorded has mastered none of it, and says so.
   */
  const local = loadProgress();
  const xp = stats.totalXp || local.xp || 0;
  const streak = stats.dayStreak || local.streakDays || 0;
  const level = stats.level || levelFromXp(xp);
  const dailyGoal = stats.dailyGoal || local.dailyGoal;
  const dailySolved = stats.dailySolved || 0;
  const courseDone = stats.lessonsMastered || 0;
  const courseTotal = stats.lessonsAvailable || getCourseLessons(viewer).length;
  const starsEarned = stats.starsEarned || 0;

  return (
    <UIModal
      isOpen={isOpen}
      onClose={onClose}
      title="Statistics"
      maxWidth="max-w-lg"
      tone="plain"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <UIButton variant="secondary" size="sm" onClick={onClose}>
            Close
          </UIButton>
          {onOpenProfile && (
            <UIButton variant="primary" size="sm" onClick={onOpenProfile}>
              View in profile
            </UIButton>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {/* Today card — matches Statistics view in profile */}
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h4 className="font-mono text-base font-bold text-ink">Today</h4>
              <p className="text-xs text-muted">
                The daily goal, and how far through the course this learner is
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {/* Daily Goal */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4">
              <div className="flex items-center justify-between gap-3">
                <h5 className="font-mono text-sm font-bold text-ink">Daily goal</h5>
                <span className="font-mono text-sm font-black tabular-nums text-ink">
                  {dailySolved} / {dailyGoal}
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{
                    width: `${dailyGoal > 0 ? Math.min(100, (dailySolved / dailyGoal) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Course Progress */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4">
              <div className="flex items-center justify-between gap-3">
                <h5 className="font-mono text-sm font-bold text-ink">Course progress</h5>
                <span className="font-mono text-sm font-black tabular-nums text-ink">
                  {courseDone} / {courseTotal}
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{
                    width: `${courseTotal > 0 ? Math.min(100, (courseDone / courseTotal) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Key figures grid */}
        <div className="grid grid-cols-2 gap-3">
          <UIStatTile
            icon={<Flame className="fill-current" />}
            value={`${streak}`}
            label="Day streak"
            tone="streak"
          />
          <UIStatTile
            icon={<Zap className="fill-current" />}
            value={`${xp} XP`}
            label="Total XP"
          />
          <UIStatTile
            icon={<Trophy />}
            value={`Level ${level}`}
            label="Current level"
            tone="success"
          />
          <UIStatTile
            icon={<Star className="fill-current" />}
            value={`${starsEarned}`}
            label="Stars earned"
            tone="streak"
          />
        </div>
      </div>
    </UIModal>
  );
};
