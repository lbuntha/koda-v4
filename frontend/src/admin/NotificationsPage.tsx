/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin-managed notifications: compose a broadcast, review what's gone out,
 * and toggle the automated notification types on or off. The automated
 * kill-switches live here (not in general Settings) because they're the
 * property of this feature, not a global app preference.
 */

import React, { useEffect, useState } from "react";
import { Send, Users as UsersIcon, Baby, Megaphone } from "lucide-react";
import {
  Badge, Button, Card, Input, Label, Select, Switch, Textarea,
} from "../components/ui";
import { AdminStudent, AdminUser } from "../api/admin";
import {
  notificationsApi,
  type NotificationAudience,
  type NotificationChannel,
  type SentNotification,
} from "../api/notifications";
import { useAppSettings } from "../settings/AppSettingsContext";

const AUDIENCE_LABEL: Record<NotificationAudience, string> = {
  parents: "All parents",
  students: "All students",
  all: "Everyone",
  user: "One parent",
  student: "One student",
};

const KIND_LABEL: Record<string, string> = {
  broadcast: "Broadcast", announcement: "Announcement",
  auto_achievement: "Achievement", auto_streak: "Streak", auto_digest: "Weekly digest",
  auto_review: "Review due", auto_inactivity: "Inactivity", auto_pin_lockout: "PIN locked",
};

interface Props {
  users: AdminUser[];
  students: AdminStudent[];
}

export const NotificationsPage: React.FC<Props> = ({ users, students }) => {
  const { settings, save, loading: settingsLoading } = useAppSettings();
  const parents = users.filter((u) => u.role === "parent");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NotificationAudience>("parents");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetStudentId, setTargetStudentId] = useState("");
  const [channels, setChannels] = useState<NotificationChannel[]>(["in_app"]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [sent, setSent] = useState<SentNotification[]>([]);
  const [loadingSent, setLoadingSent] = useState(true);

  const [savingToggles, setSavingToggles] = useState(false);

  const loadSent = async () => {
    setLoadingSent(true);
    try {
      setSent(await notificationsApi.sent());
    } finally {
      setLoadingSent(false);
    }
  };

  useEffect(() => {
    void loadSent();
  }, []);

  const emailDisabled = audience === "students" || audience === "student";
  useEffect(() => {
    if (emailDisabled) setChannels((current) => current.filter((c) => c !== "email"));
  }, [emailDisabled]);

  const toggleChannel = (channel: NotificationChannel) => {
    setChannels((current) => (current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      await notificationsApi.compose({
        title: title.trim(),
        body: body.trim(),
        audience,
        channels,
        ...(audience === "user" ? { target_user_id: targetUserId } : {}),
        ...(audience === "student" ? { target_student_id: targetStudentId } : {}),
      });
      setTitle("");
      setBody("");
      setMessage("Sent.");
      await loadSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  const notifications = settings.scoring.notifications;
  const saveToggle = async (patch: Partial<typeof notifications>) => {
    setSavingToggles(true);
    try {
      await save({ scoring: { ...settings.scoring, notifications: { ...notifications, ...patch } } });
    } finally {
      setSavingToggles(false);
    }
  };

  return (
    <div className="grid flex-1 gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card className="flex h-full min-w-0 flex-col border-[#E7E3F6] p-4 shadow-[0_6px_24px_rgba(83,74,183,0.06)] sm:p-5 md:p-6">
        <div className="flex items-start gap-3 border-b border-[#EEEAF8] pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#534AB7]">
            <Megaphone size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#0E0B55]">Compose a broadcast</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">Sent immediately to the chosen audience.</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-1 flex-col gap-4">
          <div className="space-y-1.5">
            <Label className="normal-case tracking-normal">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>
          <div className="space-y-1.5">
            <Label className="normal-case tracking-normal">Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={4} required />
          </div>
          <div className="space-y-1.5">
            <Label className="normal-case tracking-normal">Audience</Label>
            <Select value={audience} onChange={(e) => setAudience(e.target.value as NotificationAudience)}>
              {(Object.keys(AUDIENCE_LABEL) as NotificationAudience[]).map((key) => (
                <option key={key} value={key}>{AUDIENCE_LABEL[key]}</option>
              ))}
            </Select>
          </div>

          {audience === "user" && (
            <div className="space-y-1.5">
              <Label className="normal-case tracking-normal">Parent</Label>
              <Select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required>
                <option value="" disabled>Choose a parent…</option>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
              </Select>
            </div>
          )}
          {audience === "student" && (
            <div className="space-y-1.5">
              <Label className="normal-case tracking-normal">Student</Label>
              <Select value={targetStudentId} onChange={(e) => setTargetStudentId(e.target.value)} required>
                <option value="" disabled>Choose a student…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="normal-case tracking-normal">Channels</Label>
            <div className="flex gap-4 text-xs font-medium text-[#4B4670]">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={channels.includes("in_app")} onChange={() => toggleChannel("in_app")} />
                In-app
              </label>
              <label className={`flex items-center gap-1.5 ${emailDisabled ? "opacity-40" : ""}`}>
                <input
                  type="checkbox"
                  checked={channels.includes("email")}
                  disabled={emailDisabled}
                  onChange={() => toggleChannel("email")}
                />
                Email {emailDisabled && "(students have no email)"}
              </label>
            </div>
          </div>

          {error && (
            <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
          )}
          {message && <div className="text-xs font-medium text-emerald-600">{message}</div>}

          <Button type="submit" loading={sending} loadingText="Sending..." disabled={channels.length === 0} className="mt-auto">
            <Send size={14} /> Send
          </Button>
        </form>
      </Card>

      <div className="flex h-full min-w-0 flex-col gap-4">
        <Card className="border-[#E7E3F6] p-4 shadow-[0_6px_24px_rgba(83,74,183,0.06)] sm:p-5 md:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-[#EEEAF8] pb-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#534AB7]">
                <UsersIcon size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#0E0B55]">Automated notifications</h2>
                <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">Global switches — turning one off stops new ones, it doesn't retract sent ones.</p>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {[
              { key: "auto_achievement_enabled" as const, label: "Achievement notes", hint: "When a skill reaches Proficient or Master" },
              { key: "auto_streak_enabled" as const, label: "Streak milestones", hint: "3, 7, 14, 30… day streaks" },
              { key: "auto_review_enabled" as const, label: "Review reminders", hint: "One grouped note a learner has skills due — never one per skill" },
              { key: "auto_inactivity_enabled" as const, label: "Inactivity nudges", hint: `Parent hears once when a learner goes quiet for ${notifications?.inactivity_days ?? 7} days` },
              { key: "auto_weekly_digest_enabled" as const, label: "Weekly parent digest", hint: "Once-a-week progress email" },
              { key: "auto_pin_lockout_enabled" as const, label: "PIN lockout alerts", hint: "Account alert — emails the parent even if they've opted out of other email" },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 rounded-xl border border-[#EEEAF8] bg-[#FBFAFF] px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{row.label}</p>
                  <p className="text-xs text-[#6D6997]">{row.hint}</p>
                </div>
                <Switch
                  checked={Boolean(notifications?.[row.key])}
                  disabled={settingsLoading || savingToggles}
                  onCheckedChange={(checked) => void saveToggle({ [row.key]: checked } as Partial<typeof notifications>)}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex-1 overflow-hidden border-[#E7E3F6] shadow-[0_6px_24px_rgba(83,74,183,0.06)]">
          <div className="border-b border-[#EEEAF8] px-5 py-3.5">
            <h3 className="text-sm font-bold text-slate-800">Sent ({sent.length})</h3>
          </div>
          {loadingSent ? (
            <p className="px-5 py-6 text-xs text-slate-400">Loading…</p>
          ) : sent.length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-400">Nothing sent yet.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
              {sent.map((row) => (
                <div key={row.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{row.title}</span>
                    <Badge variant="secondary">{KIND_LABEL[row.kind] ?? row.kind}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{row.body}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                    <Baby size={11} /> {row.recipient_count} recipient{row.recipient_count === 1 ? "" : "s"}
                    <span>·</span>
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
