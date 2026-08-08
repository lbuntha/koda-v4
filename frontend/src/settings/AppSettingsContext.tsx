import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppSettings, AppSettingsUpdate, settingsApi } from "../api/settings";
import { sounds } from "../sound";

const DEFAULTS: AppSettings = {
  sound_enabled: true,
  ai_model: "gpt-4o-mini",
  api_key_configured: false,
  api_key_hint: null,
  mail_transport: "console",
  mail_configured: false,
  mail_from: null,
  smtp_host: null,
  smtp_port: null,
  smtp_username: null,
  smtp_use_tls: null,
  smtp_password_hint: null,
  scoring_revision: 1,
  mastery_gate_assets: {},
  scoring: {
    weights: { firstTry: 0.45, accuracy: 0.2, independence: 0.2, speed: 0.15 },
    developingScore: 0.6,
    proficientScore: 0.85,
    masterScore: 0.92,
    successfulReviewScore: 0.8,
    gates: {
      developing: { minPlays: 5 },
      proficient: { minPlays: 10, minSessions: 2, minHardPlays: 2 },
      master: { minPlays: 15, minDistinctDays: 3, minHardPlays: 3, minRecentScore: 0.9 },
    },
    speedBaselineMs: 8000,
    reviewIntervalDays: { not_started: null, beginner: 0, developing: 1, proficient: 4, master: 14 },
    placement: {
      per_skill: 2,
      checkpoint_cap: 8,
      pass_threshold: 0.8,
      checkpoints_only: true,
      generator_revision: 1,
      rapid_confirmation_plays: 2,
    },
    recommendation: {
      skills_per_session: 3,
      max_non_new: 2,
      skip_cooldown_sessions: 1,
      reinforce_threshold: 0.6,
    },
    streak: {
      counts: "attempt",
      min_events_per_day: 1,
      grace_days: 1,
    },
    notifications: {
      auto_achievement_enabled: true,
      auto_streak_enabled: true,
      auto_weekly_digest_enabled: true,
      weekly_digest_day: "sun",
      streak_milestones: [3, 7, 14, 30, 60, 100],
      auto_review_enabled: true,
      auto_inactivity_enabled: true,
      inactivity_days: 7,
      auto_pin_lockout_enabled: true,
    },
  },
};

interface AppSettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  save: (update: AppSettingsUpdate) => Promise<AppSettings>;
  /** The last load failed, so `settings` holds defaults rather than this account's values. */
  loadError: boolean;
  testAi: () => Promise<void>;
  testMail: () => Promise<string>;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, account } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !account) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    void settingsApi.get()
      .then((next) => {
        if (!active) return;
        setSettings(next);
        sounds.setEnabled(next.sound_enabled);
      })
      .catch(() => {
        // Safe defaults keep the app usable, but they are not this account's settings and
        // must not be presented as if they were — `loadError` lets the settings screen say so.
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, account?.id, account?.role]);

  const value = useMemo<AppSettingsContextValue>(() => ({
    settings,
    loading,
    loadError,
    save: async (update) => {
      const next = await settingsApi.update(update);
      setSettings(next);
      sounds.setEnabled(next.sound_enabled);
      return next;
    },
    testAi: async () => {
      await settingsApi.testAi();
    },
    testMail: async () => {
      const result = await settingsApi.testMail();
      return result.sentTo;
    },
  }), [settings, loading, loadError]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export function useAppSettings(): AppSettingsContextValue {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error("useAppSettings must be used inside AppSettingsProvider");
  return context;
}
