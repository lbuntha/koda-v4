import React from "react";
import {
  Bell,
  CheckCheck,
  Flame,
  Award,
  BookOpen,
  Lock,
  Mail,
  Megaphone,
  Sparkles,
  Inbox as InboxIcon,
} from "lucide-react";
import { Skeleton } from "./ProgressiveSkeleton";

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  read_at?: string | null;
}

export const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ElementType; bg: string; text: string; label: string }
> = {
  auto_achievement: {
    icon: Award,
    bg: "bg-amber-100 dark:bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-300",
    label: "Achievement",
  },
  auto_streak: {
    icon: Flame,
    bg: "bg-orange-100 dark:bg-orange-500/20",
    text: "text-orange-600 dark:text-orange-300",
    label: "Streak",
  },
  auto_review: {
    icon: BookOpen,
    bg: "bg-violet-100 dark:bg-violet-500/20",
    text: "text-violet-600 dark:text-violet-300",
    label: "Review",
  },
  auto_inactivity: {
    icon: Sparkles,
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-300",
    label: "Update",
  },
  auto_pin_lockout: {
    icon: Lock,
    bg: "bg-rose-100 dark:bg-rose-500/20",
    text: "text-rose-600 dark:text-rose-300",
    label: "Security",
  },
  auto_digest: {
    icon: Mail,
    bg: "bg-indigo-100 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-300",
    label: "Digest",
  },
  announcement: {
    icon: Megaphone,
    bg: "bg-sky-100 dark:bg-sky-500/20",
    text: "text-sky-600 dark:text-sky-300",
    label: "News",
  },
  broadcast: {
    icon: Megaphone,
    bg: "bg-sky-100 dark:bg-sky-500/20",
    text: "text-sky-600 dark:text-sky-300",
    label: "Broadcast",
  },
};

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const NotificationItemCard: React.FC<{
  item: NotificationItem;
  onRead?: (id: string) => void;
}> = ({ item, onRead }) => {
  const category = CATEGORY_CONFIG[item.kind] ?? {
    icon: Bell,
    bg: "bg-slate-100 dark:bg-white/10",
    text: "text-slate-600 dark:text-slate-300",
    label: "Notice",
  };
  const Icon = category.icon;
  const isUnread = !item.read_at;

  return (
    <button
      type="button"
      onClick={() => isUnread && onRead?.(item.id)}
      className={`group relative flex w-full touch-manipulation cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.99] ${
        isUnread
          ? "border-violet-200/90 bg-violet-50/50 shadow-sm dark:border-violet-500/30 dark:bg-violet-500/10"
          : "border-slate-100 bg-white hover:border-slate-200 dark:border-white/5 dark:bg-transparent dark:hover:border-white/10"
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${category.bg} ${category.text}`}>
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="truncate text-xs font-black text-slate-900 dark:text-white">
            {item.title}
          </h4>
          {isUnread && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#534AB7] ring-2 ring-violet-200 dark:ring-violet-900 animate-pulse" />
          )}
        </div>
        <p className="mt-1 line-clamp-3 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
          {item.body}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
            {timeAgo(item.created_at)}
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className={`text-[10px] font-extrabold ${category.text}`}>
            {category.label}
          </span>
        </div>
      </div>
    </button>
  );
};

export const NotificationEmptyState: React.FC<{ unreadOnly?: boolean }> = ({ unreadOnly = false }) => (
  <div className="flex flex-col items-center justify-center py-14 text-center">
    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-50 text-[#534AB7] shadow-inner dark:bg-violet-400/10 dark:text-[#CDBEFF]">
      <InboxIcon size={32} />
    </div>
    <h4 className="mt-4 text-sm font-black text-slate-900 dark:text-white">
      {unreadOnly ? "No unread notifications" : "All caught up!"}
    </h4>
    <p className="mt-1 max-w-[240px] text-xs font-bold text-slate-400 dark:text-slate-500">
      {unreadOnly
        ? "You have read all your notifications."
        : "New updates and activity milestones will appear here."}
    </p>
  </div>
);

export const NotificationSkeletonList: React.FC = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex gap-3 rounded-2xl border border-slate-100 p-3.5 dark:border-white/5">
        <Skeleton className="h-10 w-10 shrink-0" rounded="2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" rounded="md" />
          <Skeleton className="h-3 w-full" rounded="md" />
        </div>
      </div>
    ))}
  </div>
);
