/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * What a guardian chooses to receive, grouped by section — one row per
 * notification feature, one switch each.
 *
 * Two rules the copy has to keep:
 *  - Every row says plainly what arrives and how often, because "notifications"
 *    with no stated frequency is what makes people switch everything off.
 *  - The account alert is shown, not hidden, even though it cannot be turned off.
 *    A switch that silently ignores a preference is worse than a locked one that
 *    explains itself.
 */

import React, { useEffect, useState } from "react";
import { Bell, CalendarDays, Lock, Megaphone, ShieldAlert, UserRoundCheck } from "lucide-react";
import { Card, Switch } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { notificationsApi, type NotificationPreferenceKey } from "../api/notifications";
import { useAppSettings } from "../settings/AppSettingsContext";

interface FeatureRow {
  /** Absent for a feature that always sends. */
  key?: NotificationPreferenceKey;
  icon: React.ElementType;
  label: string;
  detail: string;
  frequency: string;
}

interface FeatureSection {
  title: string;
  hint: string;
  rows: FeatureRow[];
}

const SECTIONS: FeatureSection[] = [
  {
    title: "Your child’s progress",
    hint: "Summaries of what your kids have been practising.",
    rows: [
      {
        key: "email_digest_enabled",
        icon: CalendarDays,
        label: "Weekly progress summary",
        detail: "What each of your kids practised, new skills they mastered, and their current streak.",
        frequency: "Once a week",
      },
    ],
  },
  {
    title: "Staying on track",
    hint: "A gentle heads-up when a learner drifts off.",
    rows: [
      {
        key: "email_inactivity_enabled",
        icon: UserRoundCheck,
        label: "Quiet-learner check-in",
        detail: "If a child who had been practising stops for about a week, we let you know once.",
        frequency: "Only when it happens, once per quiet stretch",
      },
    ],
  },
  {
    title: "From Koda",
    hint: "News about the product itself.",
    rows: [
      {
        key: "email_announcements_enabled",
        icon: Megaphone,
        label: "Announcements",
        detail: "Occasional notes when we add something new, like this notifications feature.",
        frequency: "Rarely",
      },
    ],
  },
  {
    title: "Account & security",
    hint: "These always send — see below.",
    rows: [
      {
        icon: ShieldAlert,
        label: "Account alerts",
        detail: "If a child’s PIN gets locked after too many wrong tries, we tell you and how to clear it.",
        frequency: "Only when it happens",
      },
    ],
  },
];

export const ParentNotificationSettings: React.FC = () => {
  const { account, refreshSession } = useAuth();
  const { settings } = useAppSettings();

  const systemKillSwitches: Record<NotificationPreferenceKey, boolean> = {
    email_digest_enabled: settings.scoring.notifications?.auto_weekly_digest_enabled ?? true,
    email_inactivity_enabled: settings.scoring.notifications?.auto_inactivity_enabled ?? true,
    email_announcements_enabled: true,
  };

  const [prefs, setPrefs] = useState<Record<NotificationPreferenceKey, boolean>>({
    email_digest_enabled: account?.email_digest_enabled ?? true,
    email_inactivity_enabled: account?.email_inactivity_enabled ?? true,
    email_announcements_enabled: account?.email_announcements_enabled ?? true,
  });
  const [saving, setSaving] = useState<NotificationPreferenceKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrefs({
      email_digest_enabled: account?.email_digest_enabled ?? true,
      email_inactivity_enabled: account?.email_inactivity_enabled ?? true,
      email_announcements_enabled: account?.email_announcements_enabled ?? true,
    });
  }, [
    account?.email_digest_enabled,
    account?.email_inactivity_enabled,
    account?.email_announcements_enabled,
  ]);

  const toggle = async (key: NotificationPreferenceKey, next: boolean) => {
    setError(null);
    setSaving(key);
    setPrefs((current) => ({ ...current, [key]: next }));
    try {
      await notificationsApi.updatePreferences({ [key]: next });
      await refreshSession();
    } catch (cause) {
      setPrefs((current) => ({ ...current, [key]: !next }));
      setError("Couldn’t save that change. Please try again.");
      console.error("notification preference save failed", cause);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-start gap-3 rounded-2xl border border-[#E7E3F6] bg-white p-4 dark:border-white/10 dark:bg-[#161B2E] sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#534AB7]">
          <Bell size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#0E0B55] dark:text-[#E7E5F7]">What you receive</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">
            The bell in your dashboard always shows updates as they happen — nothing there
            interrupts you. These switches decide what <strong>also arrives by email</strong>.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-600">
          {error}
        </div>
      )}

      {SECTIONS.map((section) => (
        <Card
          key={section.title}
          className="overflow-hidden border-[#E7E3F6] shadow-[0_6px_24px_rgba(83,74,183,0.06)]"
        >
          <div className="border-b border-[#EEEAF8] px-5 py-3.5 dark:border-white/10">
            <h3 className="text-sm font-bold text-slate-800 dark:text-[#E2E0F2]">{section.title}</h3>
            <p className="mt-0.5 text-[11px] text-[#6D6997]">{section.hint}</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/5">
            {section.rows.map((row) => {
              const Icon = row.icon;
              const alwaysOn = row.key === undefined;
              const systemDisabled = Boolean(row.key && systemKillSwitches[row.key] === false);
              return (
                <div key={row.label} className="flex items-start gap-3.5 px-5 py-4">
                  <Icon size={16} className="mt-0.5 shrink-0 text-[#534AB7]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-[#E2E0F2]">{row.label}</p>
                      {alwaysOn && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F0FF] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#534AB7]">
                          <Lock size={9} /> Always on
                        </span>
                      )}
                      {systemDisabled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          Paused by Admin
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">{row.detail}</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                      {systemDisabled ? "Currently paused system-wide by administrator" : row.frequency}
                    </p>
                  </div>
                  <Switch
                    checked={alwaysOn ? true : systemDisabled ? false : prefs[row.key!]}
                    disabled={alwaysOn || systemDisabled || saving === row.key}
                    onCheckedChange={(next) => { if (row.key && !systemDisabled) void toggle(row.key, next); }}
                    aria-label={alwaysOn ? `${row.label} (always on)` : `Email me: ${row.label}`}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-slate-400">
        <Lock size={11} className="mt-0.5 shrink-0" />
        Account alerts ignore these switches on purpose: if a child cannot sign in, telling you
        matters more than an email preference. Password resets work the same way.
      </p>
    </div>
  );
};
