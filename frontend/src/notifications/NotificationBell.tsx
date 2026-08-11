/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modern Notification Inbox: Bell button with glowing unread badge and responsive Drawer.
 */

import React, { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import {
  Button,
  Drawer,
  NotificationItemCard,
  NotificationEmptyState,
  NotificationSkeletonList,
} from "../components/ui";
import { useNotifications } from "./useNotifications";
import { SvgLibraryAsset } from "../assets/SvgLibraryAsset";

interface NotificationBellProps {
  recipientType: "user" | "student";
  /** Optional shared-library artwork; the Lucide bell remains the safe fallback. */
  iconAssetId?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ recipientType, iconAssetId }) => {
  const { inbox, loading, markRead, markAllRead } = useNotifications(recipientType);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const itemsToDisplay = inbox.items.filter(item => (filter === "unread" ? !item.read_at : true));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={inbox.unread_count > 0 ? `Notifications, ${inbox.unread_count} unread` : "Notifications"}
        className="relative flex h-10 w-10 touch-manipulation cursor-pointer items-center justify-center rounded-2xl text-slate-600 transition-all hover:bg-slate-100 active:scale-90 dark:text-slate-300 dark:hover:bg-white/10"
      >
        {iconAssetId
          ? <SvgLibraryAsset assetId={iconAssetId} size={25} fallback={<Bell size={20} />} />
          : <Bell size={20} className="transition-transform group-hover:rotate-12" />}
        {inbox.unread_count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-black text-white shadow-md ring-2 ring-white dark:ring-[#111329]">
            <span className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative">{inbox.unread_count > 9 ? "9+" : inbox.unread_count}</span>
          </span>
        )}
      </button>

      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className={iconAssetId
              ? "flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 shadow-sm ring-1 ring-violet-100 dark:bg-white/10 dark:ring-white/10"
              : "flex h-8 w-8 items-center justify-center rounded-xl bg-[#534AB7] text-white shadow-sm shadow-[#534AB7]/30"
            }>
              {iconAssetId
                ? <SvgLibraryAsset assetId={iconAssetId} size={21} fallback={<Bell size={16} />} />
                : <Bell size={16} />}
            </div>
            <span className="text-base font-black text-slate-900 dark:text-white">Notifications</span>
            {inbox.unread_count > 0 && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-extrabold text-[#534AB7] dark:bg-violet-400/20 dark:text-[#CDBEFF]">
                {inbox.unread_count} new
              </span>
            )}
          </div>
        }
        widthClassName="w-full sm:w-[420px]"
      >
        {/* Controls Bar */}
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/10">
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${
                filter === "all"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-violet-600 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              All ({inbox.items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${
                filter === "unread"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-violet-600 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Unread ({inbox.unread_count})
            </button>
          </div>

          {inbox.unread_count > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void markAllRead()}
              className="flex items-center gap-1.5 rounded-lg text-xs font-bold text-[#534AB7] hover:bg-violet-50 dark:text-[#CDBEFF] dark:hover:bg-white/10"
            >
              <CheckCheck size={14} /> Mark all read
            </Button>
          )}
        </div>

        {/* Content List */}
        {loading ? (
          <NotificationSkeletonList />
        ) : itemsToDisplay.length === 0 ? (
          <NotificationEmptyState unreadOnly={filter === "unread"} />
        ) : (
          <div className="space-y-2.5 pb-6">
            {itemsToDisplay.map(item => (
              <NotificationItemCard
                key={item.id}
                item={item}
                onRead={id => void markRead(id)}
              />
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
};
