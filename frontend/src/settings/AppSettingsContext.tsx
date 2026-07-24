import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppSettings, AppSettingsUpdate, settingsApi } from "../api/settings";
import { sounds } from "../sound";

const DEFAULTS: AppSettings = {
  sound_enabled: true,
  ai_model: "gpt-4o-mini",
  api_key_configured: false,
  api_key_hint: null,
  scoring_revision: 1,
  scoring: {
    weights: { firstTry: 0.45, accuracy: 0.2, independence: 0.2, speed: 0.15 },
    developingScore: 0.6,
    proficientScore: 0.85,
    masterScore: 0.92,
    successfulReviewScore: 0.8,
    gates: {
      developing: { minPlays: 6 },
      proficient: { minPlays: 10, minSessions: 2, minHardPlays: 3 },
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
  },
};

interface AppSettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  save: (update: AppSettingsUpdate) => Promise<AppSettings>;
  testAi: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, account } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !account || account.role === "student") return;
    let active = true;
    setLoading(true);
    void settingsApi.get()
      .then((next) => {
        if (!active) return;
        setSettings(next);
        sounds.setEnabled(next.sound_enabled);
      })
      .catch(() => {
        // Keep safe defaults when settings are temporarily unavailable.
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
    save: async (update) => {
      const next = await settingsApi.update(update);
      setSettings(next);
      sounds.setEnabled(next.sound_enabled);
      return next;
    },
    testAi: async () => {
      await settingsApi.testAi();
    },
  }), [settings, loading]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export function useAppSettings(): AppSettingsContextValue {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error("useAppSettings must be used inside AppSettingsProvider");
  return context;
}
