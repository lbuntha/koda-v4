/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A pull-based notification inbox: a bell with an unread badge, opening a
 * Drawer list. No toast, no push, no sound — checking it is always the
 * learner's or parent's choice, never an interruption.
 */

import React, { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button, Drawer } from "../components/ui";
import { useNotifications } from "./useNotifications";

const KIND_EMOJI: Record<string, string> = {
  auto_achievement: "🌟",
  auto_streak: "🔥",
  auto_review: "📚",
  auto_inactivity: "👋",
  auto_pin_lockout: "🔒",
  auto_digest: "📬",
  announcement: "📣",
  broadcast: "📣",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const NotificationBell: React.FC<{ recipientType: "user" | "student" }> = ({ recipientType }) => {
  const { inbox, markRead, markAllRead } = useNotifications(recipientType);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={inbox.unread_count > 0 ? `Notifications, ${inbox.unread_count} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
      >
        <Bell size={18} />
        {inbox.unread_count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {inbox.unread_count > 9 ? "9+" : inbox.unread_count}
          </span>
        )}
      </button>

      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Notifications"
        widthClassName="w-full sm:w-[380px]"
      >
        {inbox.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Nothing here yet.</p>
        ) : (
          <div className="space-y-2">
            {inbox.unread_count > 0 && (
              <Button variant="ghost" size="xs" onClick={() => void markAllRead()} className="mb-1 text-slate-500">
                <CheckCheck size={12} /> Mark all read
              </Button>
            )}
            {inbox.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => !item.read_at && void markRead(item.id)}
                className={`w-full rounded-xl border px-3.5 py-3 text-left transition-colors ${
                  item.read_at
                    ? "border-slate-100 bg-white dark:border-white/5 dark:bg-transparent"
                    : "border-[#E2DEEF] bg-[#F8F6FF] dark:border-white/10 dark:bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-[#E2E0F2]">
                    {KIND_EMOJI[item.kind] ?? "🔔"} {item.title}
                  </p>
                  {!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#534AB7]" />}
                </div>
                {/* Clamped on purpose: a digest or announcement body is several
                    paragraphs, which would swamp the panel. The inbox page shows it whole. */}
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-500 dark:text-[#9A94B8]">{item.body}</p>
                <p className="mt-1.5 text-[10px] text-slate-400">{timeAgo(item.created_at)}</p>
              </button>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
};
