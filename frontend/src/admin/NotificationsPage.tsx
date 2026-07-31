import React, { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart2,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Inbox,
  Megaphone,
  Search,
  Send,
  ShieldAlert,
  Users as UsersIcon,
} from "lucide-react";
import { AdminStudent, AdminUser } from "../api/admin";
import {
  notificationsApi,
  type NotificationAudience,
  type NotificationChannel,
  type SentNotification,
} from "../api/notifications";
import {
  Button,
  Card,
  Drawer,
  Input,
  Label,
  Select,
  Switch,
  Textarea,
} from "../components/ui";
import { useAppSettings } from "../settings/AppSettingsContext";

const AUDIENCE_LABEL: Record<NotificationAudience, string> = {
  parents: "All parents",
  students: "All students",
  all: "Everyone",
  user: "One parent",
  student: "One student",
};

const KIND_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  broadcast: { label: "Broadcast", icon: Megaphone, bg: "bg-indigo-50 dark:bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-300" },
  announcement: { label: "Announcement", icon: Megaphone, bg: "bg-indigo-50 dark:bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-300" },
  auto_achievement: { label: "Achievement", icon: Award, bg: "bg-amber-50 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-300" },
  auto_streak: { label: "Streak", icon: Flame, bg: "bg-orange-50 dark:bg-orange-500/15", text: "text-orange-700 dark:text-orange-300" },
  auto_digest: { label: "Weekly digest", icon: Inbox, bg: "bg-purple-50 dark:bg-purple-500/15", text: "text-purple-700 dark:text-purple-300" },
  auto_review: { label: "Review due", icon: BookOpen, bg: "bg-blue-50 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300" },
  auto_inactivity: { label: "Inactivity", icon: Clock, bg: "bg-violet-50 dark:bg-violet-500/15", text: "text-violet-700 dark:text-violet-300" },
  auto_pin_lockout: { label: "PIN locked", icon: ShieldAlert, bg: "bg-rose-50 dark:bg-rose-500/15", text: "text-rose-700 dark:text-rose-300" },
};

interface Props {
  users?: AdminUser[];
  students?: AdminStudent[];
}

export const NotificationsPage: React.FC<Props> = ({ users = [], students = [] }) => {
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

  // Filters, Pagination, and Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKind, setFilterKind] = useState<string>("all");
  const [filterAudience, setFilterAudience] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Detailed Stats Drawer state
  const [selectedItem, setSelectedItem] = useState<SentNotification | null>(null);
  const [statsData, setStatsData] = useState<{ recipients: number; read: number; email_sent: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

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
      setTargetUserId("");
      setTargetStudentId("");
      setMessage("Broadcast sent successfully!");
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
    setError(null);
    try {
      await save({
        scoring: { ...settings.scoring, notifications: { ...notifications, ...patch } },
        scoring_revision: settings.scoring_revision,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save notification settings");
    } finally {
      setSavingToggles(false);
    }
  };

  const filteredSent = useMemo(() => {
    return sent.filter((item) => {
      if (filterKind !== "all" && item.kind !== filterKind) return false;
      if (filterAudience !== "all" && item.audience !== filterAudience) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesBody = item.body.toLowerCase().includes(q);
        if (!matchesTitle && !matchesBody) return false;
      }
      return true;
    });
  }, [sent, filterKind, filterAudience, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSent.length / pageSize));

  const paginatedSent = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSent.slice(start, start + pageSize);
  }, [filteredSent, currentPage, pageSize]);

  const openStats = async (item: SentNotification) => {
    setSelectedItem(item);
    setLoadingStats(true);
    try {
      setStatsData(await notificationsApi.stats(item.id));
    } catch {
      setStatsData(null);
    } finally {
      setLoadingStats(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 flex-1 min-w-0">
      {/* Row 1: Side-by-Side Cards (Compose a Broadcast & Automated Notifications) */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {/* Card 1: Compose Broadcast Form */}
        <Card className="flex flex-col border-[#E7E3F6] p-3.5 shadow-[0_4px_16px_rgba(83,74,183,0.05)] sm:p-4 dark:bg-[#111329]">
          <div className="flex items-center gap-2.5 border-b border-[#EEEAF8] pb-3 dark:border-white/10">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#534AB7] dark:bg-violet-500/20 dark:text-[#BEACFF]">
              <Megaphone size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-[#0E0B55] dark:text-white">Compose a broadcast</h2>
              <p className="text-[11px] text-[#6D6997] dark:text-slate-400">Sent immediately to chosen audience.</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">Message</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={3} required className="text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">Audience</Label>
              <Select value={audience} onChange={(e) => { setAudience(e.target.value as NotificationAudience); }} className="h-9 text-xs">
                {(Object.keys(AUDIENCE_LABEL) as NotificationAudience[]).map((key) => (
                  <option key={key} value={key}>{AUDIENCE_LABEL[key]}</option>
                ))}
              </Select>
            </div>

            {audience === "user" && (
              <div className="space-y-1">
                <Label className="text-xs font-bold">Parent</Label>
                <Select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required className="h-9 text-xs">
                  <option value="" disabled>Choose a parent…</option>
                  {parents.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
                </Select>
              </div>
            )}
            {audience === "student" && (
              <div className="space-y-1">
                <Label className="text-xs font-bold">Student</Label>
                <Select value={targetStudentId} onChange={(e) => setTargetStudentId(e.target.value)} required className="h-9 text-xs">
                  <option value="" disabled>Choose a student…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-bold">Channels</Label>
              <div className="flex gap-4 text-xs font-semibold text-[#4B4670] dark:text-slate-300">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={channels.includes("in_app")} onChange={() => toggleChannel("in_app")} />
                  In-app
                </label>
                <label className={`flex items-center gap-1.5 cursor-pointer ${emailDisabled ? "opacity-40 cursor-not-allowed" : ""}`}>
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
              <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300">{error}</div>
            )}
            {message && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} /> {message}
              </div>
            )}

            <div className="pt-1">
              <Button type="submit" loading={sending} loadingText="Sending..." disabled={channels.length === 0} className="h-9 w-full rounded-xl bg-[#5C46DF] text-xs font-black text-white hover:bg-[#4C36CF]">
                <Send size={13} /> Send Broadcast
              </Button>
            </div>
          </form>
        </Card>

        {/* Card 2: Automated Notification Switches */}
        <Card className="flex flex-col border-[#E7E3F6] p-3.5 shadow-[0_4px_16px_rgba(83,74,183,0.05)] sm:p-4 dark:bg-[#111329]">
          <div className="flex items-center justify-between gap-3 border-b border-[#EEEAF8] pb-3 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#534AB7] dark:bg-violet-500/20 dark:text-[#BEACFF]">
                <UsersIcon size={16} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-[#0E0B55] dark:text-white">Automated notifications</h2>
                <p className="text-[11px] text-[#6D6997] dark:text-slate-400">Global kill-switches for automated events.</p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto max-h-[380px] pr-1 scrollbar-thin">
            {[
              { key: "auto_achievement_enabled" as const, label: "Achievement notes", hint: "When a skill reaches Proficient or Master" },
              { key: "auto_streak_enabled" as const, label: "Streak milestones", hint: "3, 7, 14, 30… day streaks" },
              { key: "auto_review_enabled" as const, label: "Review reminders", hint: "Grouped note when skills are due" },
              { key: "auto_inactivity_enabled" as const, label: "Inactivity nudges", hint: `Quiet-learner alert after ${notifications?.inactivity_days ?? 7} days` },
              { key: "auto_weekly_digest_enabled" as const, label: "Weekly parent digest", hint: "Once-a-week progress email" },
              { key: "auto_pin_lockout_enabled" as const, label: "PIN lockout alerts", hint: "Account alert — emails guardian" },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 rounded-xl border border-[#EEEAF8] bg-[#FBFAFF] px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">{row.label}</p>
                  <p className="text-[11px] text-[#6D6997] dark:text-slate-400">{row.hint}</p>
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
      </div>

      {/* Row 2: Full Width Notification Log Card with Shared Table & Pagination */}
      <Card className="w-full overflow-hidden border-[#E7E3F6] shadow-[0_4px_16px_rgba(83,74,183,0.05)] dark:bg-[#111329]">
        <div className="flex flex-col gap-2.5 border-b border-[#EEEAF8] p-3.5 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">Notification Log</h3>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-black text-violet-700 dark:bg-violet-500/20 dark:text-[#CDBEFF]">
                {filteredSent.length} logs
              </span>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-slate-400">Page Size:</span>
              {[10, 20, 50].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => { setPageSize(size); setCurrentPage(1); }}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold transition-all cursor-pointer ${
                    pageSize === size
                      ? "bg-[#5C46DF] text-white shadow-xs dark:bg-[#BEACFF] dark:text-[#191338]"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search log..."
                className="h-8 pl-8 text-xs font-bold"
              />
            </div>

            <Select
              value={filterKind}
              onChange={(e) => { setFilterKind(e.target.value); setCurrentPage(1); }}
              className="h-8 text-xs font-bold"
            >
              <option value="all">All Types</option>
              {Object.keys(KIND_CONFIG).map((k) => (
                <option key={k} value={k}>{KIND_CONFIG[k].label}</option>
              ))}
            </Select>

            <Select
              value={filterAudience}
              onChange={(e) => { setFilterAudience(e.target.value); setCurrentPage(1); }}
              className="h-8 text-xs font-bold"
            >
              <option value="all">All Audiences</option>
              {(Object.keys(AUDIENCE_LABEL) as NotificationAudience[]).map((k) => (
                <option key={k} value={k}>{AUDIENCE_LABEL[k]}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Shared Table Component */}
        {loadingSent ? (
          <p className="px-5 py-8 text-center text-xs font-bold text-slate-400">Loading notification logs…</p>
        ) : paginatedSent.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs font-bold text-slate-400">
            {sent.length === 0 ? "No notifications sent yet." : "No matching notification log found."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
                  <th className="px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Type</th>
                  <th className="px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Title & Content</th>
                  <th className="px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Audience</th>
                  <th className="px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Recipients</th>
                  <th className="px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Sent Date</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {paginatedSent.map((row) => {
                  const kindInfo = KIND_CONFIG[row.kind] ?? {
                    label: row.kind,
                    icon: Bell,
                    bg: "bg-slate-100 dark:bg-white/10",
                    text: "text-slate-700 dark:text-slate-300",
                  };
                  const KindIcon = kindInfo.icon;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => void openStats(row)}
                      className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5 align-middle">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-black ${kindInfo.bg} ${kindInfo.text}`}>
                          <KindIcon size={12} />
                          <span>{kindInfo.label}</span>
                        </span>
                      </td>

                      <td className="px-4 py-2.5 align-middle min-w-[200px]">
                        <div className="font-extrabold text-slate-800 dark:text-white truncate">{row.title}</div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-1">{row.body}</div>
                      </td>

                      <td className="px-4 py-2.5 align-middle">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {AUDIENCE_LABEL[row.audience] ?? row.audience}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 align-middle">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                          <UsersIcon size={12} className="text-slate-400" />
                          <span>{row.recipient_count}</span>
                        </div>
                      </td>

                      <td className="px-4 py-2.5 align-middle text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString()}
                      </td>

                      <td className="px-4 py-2.5 align-middle text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={(e) => { e.stopPropagation(); void openStats(row); }}
                          className="text-slate-400 hover:text-indigo-600"
                        >
                          <BarChart2 size={13} /> Stats
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredSent.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
            <div>
              Showing <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(filteredSent.length, (currentPage - 1) * pageSize + 1)}</span> to{" "}
              <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(filteredSent.length, currentPage * pageSize)}</span> of{" "}
              <span className="font-bold text-slate-700 dark:text-slate-200">{filteredSent.length}</span> entries
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 text-[11px]"
              >
                <ChevronLeft size={12} /> Prev
              </Button>
              <span className="px-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 text-[11px]"
              >
                Next <ChevronRight size={12} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Stats Drawer when clicking a notification item */}
      <Drawer
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title="Notification Delivery Stats"
        widthClassName="w-full sm:w-[420px]"
      >
        {selectedItem && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-[#BEACFF]">
                {React.createElement(KIND_CONFIG[selectedItem.kind]?.icon ?? Bell, { size: 13 })}
                {KIND_CONFIG[selectedItem.kind]?.label ?? selectedItem.kind}
              </span>
              <h4 className="mt-1 text-sm font-black text-slate-800 dark:text-white">{selectedItem.title}</h4>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{selectedItem.body}</p>
              <p className="mt-2 text-[10px] font-bold text-slate-400">
                Sent on {new Date(selectedItem.created_at).toLocaleString()}
              </p>
            </div>

            {loadingStats ? (
              <p className="py-6 text-center text-xs font-bold text-slate-400">Loading delivery metrics...</p>
            ) : statsData ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-xs dark:border-white/10 dark:bg-white/5">
                  <span className="text-lg font-black text-indigo-600 dark:text-[#BEACFF]">{statsData.recipients}</span>
                  <p className="mt-0.5 text-[10px] font-bold text-slate-400">Recipients</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-xs dark:border-white/10 dark:bg-white/5">
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{statsData.read}</span>
                  <p className="mt-0.5 text-[10px] font-bold text-slate-400">Read Receipts</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-xs dark:border-white/10 dark:bg-white/5">
                  <span className="text-lg font-black text-purple-600 dark:text-purple-300">{statsData.email_sent}</span>
                  <p className="mt-0.5 text-[10px] font-bold text-slate-400">Emails Sent</p>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSelectedItem(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

