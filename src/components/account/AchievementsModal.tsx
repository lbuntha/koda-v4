import React, { useEffect, useState } from "react";
import { Award } from "lucide-react";

import { UIModal, UIButton } from "../ui";
import { BADGE_METRICS, badgeShelf, useBadges } from "../../lib/badges";
import { BadgeIcon } from "./BadgeVisuals";
import {
  EMPTY_STATS,
  fetchProfileStats,
  subscribeProfileStats,
  type ProfileStats,
} from "../../lib/profileStats";
import { loadProgress } from "../../lib/learnerProgress";

export interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile?: () => void;
  stats?: ProfileStats | null;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  onClose,
  onOpenProfile,
  stats: propStats,
}) => {
  const [stats, setStats] = useState<ProfileStats>(propStats ?? EMPTY_STATS);
  const rules = useBadges();

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

  const local = loadProgress();
  const xp = stats.totalXp || local.xp || 0;
  const longestStreak = stats.longestStreak || local.longestStreak || local.streakDays || 0;
  const starsEarned = stats.starsEarned || 0;

  const shelf = badgeShelf(rules, {
    xp,
    longestStreak,
    starsEarned,
  });

  return (
    <UIModal
      isOpen={isOpen}
      onClose={onClose}
      title="Achievements"
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
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          <div>
            <h4 className="font-mono text-base font-bold text-ink">Badges</h4>
            <p className="text-xs text-muted">Won, and the next one to go for</p>
          </div>
        </div>

        <div className="space-y-3">
          {shelf.map(({ rule, earned, standing, progress }) => {
            const unit = BADGE_METRICS.find((m) => m.id === rule.metric)?.unit ?? "";
            return (
              <div
                key={rule.id}
                className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
                  earned
                    ? "border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/20"
                    : "border-line bg-surface-muted"
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                    earned
                      ? "border-amber-300 bg-surface text-amber-500 dark:border-amber-700/60"
                      : "border-line bg-surface text-muted opacity-60"
                  }`}
                >
                  <BadgeIcon icon={rule.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4
                      className={`truncate font-mono text-sm font-bold ${
                        earned ? "text-ink" : "text-muted"
                      }`}
                    >
                      {rule.label}
                    </h4>
                    {!earned && (
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                        {standing} / {rule.threshold}
                      </span>
                    )}
                  </div>
                  {earned ? (
                    <p className="truncate text-xs text-muted">
                      {rule.description || `${rule.threshold} ${unit}`}
                    </p>
                  ) : (
                    <>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all"
                          style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {Math.max(0, rule.threshold - standing)} {unit} to go
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </UIModal>
  );
};
