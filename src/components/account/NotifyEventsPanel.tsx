import React, { useCallback, useEffect, useState } from "react";
import { CalendarClock, Lock, SlidersHorizontal } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader, UIToggle, UIToggleRow } from "../ui";
import { ApiError } from "../../lib/sync";
import {
  notifyEvents,
  setNotifyJob,
  setNotifySwitch,
  type NotifyChannelState,
  type NotifyEvents,
  type NotifyJob,
} from "../../lib/push";

/**
 * Every notification Koda sends, on which channel, and when.
 *
 * The control panel the parent notifications plan asked for: one row per kind,
 * a switch per channel, and the schedule of the job behind it. A switch here is
 * the deployment's ceiling — a parent still chooses underneath it — and an
 * account notice has no switch at all, so it says "Always" rather than drawing
 * a control that the server would refuse.
 */

/** The server's numbering: Monday is 0. */
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const hourLabel = (hour: number): string => {
  if (hour === 0) return "midnight";
  if (hour === 12) return "midday";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
};

const JOB_NAMES: Record<string, string> = {
  "weekly-summary": "Weekly summary",
  "daily-reminders": "Daily reminders",
  "skill-announcements": "New skill announcements",
  "absence-check": "Absence check",
  "daily-digest": "Daily digest",
  "token-sweep": "Nightly clean-up",
};

const CLASS_NOTES: Record<string, string> = {
  account: "Account notice — always sent",
  courtesy: "Parents can switch it off",
  operator: "Staff only",
};

/** When a job's notification goes, in a sentence. */
export const whenOf = (job: NotifyJob | undefined): string => {
  if (!job) return "As it happens";
  if (!job.enabled) return "Off — the job is switched off below";
  if (job.weekday !== null && job.hour !== null) {
    return `${WEEKDAYS[job.weekday]} · ${hourLabel(job.hour)}, each family's own time`;
  }
  if (job.id === "absence-check") {
    return `After ${job.days ?? 7} days away, at each parent's reminder hour, once`;
  }
  if (job.id === "daily-digest") return "At each parent's digest hour, on days with practice";
  if (job.id === "daily-reminders") return "At the hour each parent chose";
  if (job.id === "skill-announcements") return "Within the hour a skill is published";
  return "Nightly";
};

const lastRunOf = (job: NotifyJob): string => {
  if (!job.lastRunAt) return "Has not run on this deployment yet.";
  const when = `Last ran ${new Date(job.lastRunAt).toLocaleString()}`;
  if (job.lastSkipped) return `${when} — ${job.lastSkipped}.`;
  if (job.lastSent !== null) return `${when} · ${job.lastSent} delivered.`;
  return `${when}.`;
};

const describe = (error: unknown, fallback: string): string =>
  error instanceof ApiError && error.message ? error.message : fallback;

const ChannelCell: React.FC<{
  state: NotifyChannelState;
  label: string;
  master: boolean;
  busy: boolean;
  onToggle(settingId: string, value: boolean): void;
}> = ({ state, label, master, busy, onToggle }) => {
  if (!state.available) {
    return (
      <span className="text-xs text-muted" title="Not sent on this channel">
        —
      </span>
    );
  }
  if (state.locked || !state.settingId) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Always
      </span>
    );
  }
  const settingId = state.settingId;
  return (
    <UIToggle
      checked={state.on}
      disabled={busy || !master}
      onChange={() => onToggle(settingId, !state.on)}
      label={label}
    />
  );
};

/** One grid for the header and every row, so the columns line up from `rail:` up. */
const GRID = "rail:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_minmax(0,13rem)]";

export const NotifyEventsPanel: React.FC = () => {
  const [data, setData] = useState<NotifyEvents | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await notifyEvents());
    } catch (e) {
      setError(describe(e, "Could not load the notification events."));
    }
  }, []);

  useEffect(() => void load(), [load]);

  const flip = async (settingId: string, value: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await setNotifySwitch(settingId, value);
      setData(await notifyEvents());
    } catch (e) {
      setError(describe(e, "That switch could not be changed."));
    }
    setBusy(false);
  };

  const saveJob = async (
    job: string,
    patch: Partial<Pick<NotifyJob, "enabled" | "weekday" | "hour" | "days">>,
  ) => {
    setBusy(true);
    setError(null);
    try {
      setData(await setNotifyJob(job, patch));
    } catch (e) {
      setError(describe(e, "That schedule could not be saved."));
    }
    setBusy(false);
  };

  const card = themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`);

  if (!data) {
    return (
      <section className={card}>
        {error ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        ) : (
          <p className="text-xs text-muted">Reading…</p>
        )}
      </section>
    );
  }

  const jobs = Object.fromEntries(data.jobs.map((job) => [job.id, job]));
  const select = themeSystem.field("sm");

  return (
    <div className="space-y-4">
      <section className={card}>
        <UISectionHeader
          title="Events"
          subtitle="Every notification Koda sends, on which channel, and when"
          icon={<SlidersHorizontal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
        />

        <div className="grid gap-3 rail:grid-cols-2">
          <UIToggleRow
            title="Push notifications"
            description={
              data.pushDriver === "console"
                ? "PUSH_DRIVER is console — notifications are logged, not sent."
                : "The master over every push below."
            }
            checked={data.pushEnabled}
            disabled={busy}
            onChange={() => void flip("push.enabled", !data.pushEnabled)}
          />
          <UIToggleRow
            title="Notification emails"
            description={
              data.mailDriver === "console"
                ? "MAIL_DRIVER is console — emails are logged, not sent."
                : "The master over every email below."
            }
            checked={data.emailEnabled}
            disabled={busy}
            onChange={() => void flip("email.enabled", !data.emailEnabled)}
          />
        </div>

        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="overflow-hidden rounded-2xl border-2 border-line divide-y divide-line">
          <div
            className={`hidden rail:grid ${GRID} gap-3 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-muted`}
          >
            <span>Notification</span>
            <span>Push</span>
            <span>Email</span>
            <span>When</span>
          </div>
          {data.events.map((event) => (
            <div
              key={event.id}
              className={`grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 ${GRID} rail:items-center rail:gap-3`}
            >
              <div className="col-span-2 min-w-0 rail:col-span-1">
                <p className="text-sm font-bold text-ink">{event.label}</p>
                <p className="text-xs text-muted">{CLASS_NOTES[event.class] ?? ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 text-xs text-muted rail:hidden">Push</span>
                <ChannelCell
                  state={event.push}
                  label={`${event.label} push`}
                  master={data.pushEnabled}
                  busy={busy}
                  onToggle={(id, value) => void flip(id, value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 text-xs text-muted rail:hidden">Email</span>
                <ChannelCell
                  state={event.email}
                  label={`${event.label} email`}
                  master={data.emailEnabled}
                  busy={busy}
                  onToggle={(id, value) => void flip(id, value)}
                />
              </div>
              <p className="col-span-2 text-xs text-body rail:col-span-1">
                {event.job ? whenOf(jobs[event.job]) : "As it happens"}
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted">
          A switch here is this deployment&rsquo;s ceiling: parents still choose for themselves
          underneath it. Account notices have no switch because they tell a family about their own
          account.
        </p>
      </section>

      <section className={card}>
        <UISectionHeader
          title="Schedules"
          subtitle="When the jobs behind these notifications run"
          icon={<CalendarClock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
        />
        <div className="space-y-2">
          {data.jobs.map((job) => {
            const name = JOB_NAMES[job.id] ?? job.id;
            return (
              <div key={job.id} className="space-y-2 rounded-2xl border border-line bg-surface-muted px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-ink">{name}</h4>
                    <p className="text-xs text-muted">{job.description}</p>
                  </div>
                  <UIToggle
                    checked={job.enabled}
                    disabled={busy}
                    onChange={() => void saveJob(job.id, { enabled: !job.enabled })}
                    label={`${name} runs`}
                  />
                </div>
                {job.weekday !== null && job.hour !== null && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>Sends on</span>
                    <select
                      aria-label={`${name} day`}
                      value={job.weekday}
                      disabled={busy || !job.enabled}
                      onChange={(e) => void saveJob(job.id, { weekday: Number(e.target.value) })}
                      className={select}
                    >
                      {WEEKDAYS.map((day, index) => (
                        <option key={day} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <span>at</span>
                    <select
                      aria-label={`${name} hour`}
                      value={job.hour}
                      disabled={busy || !job.enabled}
                      onChange={(e) => void saveJob(job.id, { hour: Number(e.target.value) })}
                      className={select}
                    >
                      {Array.from({ length: 24 }, (_, hour) => (
                        <option key={hour} value={hour}>
                          {hourLabel(hour)}
                        </option>
                      ))}
                    </select>
                    <span>in each family&rsquo;s own time</span>
                  </div>
                )}
                {typeof job.days === "number" && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>Tell a parent after</span>
                    <select
                      aria-label={`${name} days`}
                      value={job.days}
                      disabled={busy || !job.enabled}
                      onChange={(e) => void saveJob(job.id, { days: Number(e.target.value) })}
                      className={select}
                    >
                      {[...new Set([3, 5, 7, 10, 14, 21, 30, job.days])]
                        .sort((a, b) => a - b)
                        .map((days) => (
                          <option key={days} value={days}>
                            {days}
                          </option>
                        ))}
                    </select>
                    <span>days without practice</span>
                  </div>
                )}
                <p className="text-[11px] text-muted">{lastRunOf(job)}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
