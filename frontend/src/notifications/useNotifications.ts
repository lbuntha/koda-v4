/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Polls the inbox rather than pushing — deliberately: notifications here are a
 * pull channel (a bell you check), never an interrupting pop-up. A minute's
 * staleness on an unread badge is a fine trade for not standing up a
 * websocket/push stack for this.
 */

import { useCallback, useEffect, useState } from "react";
import { notificationsApi, type Inbox } from "../api/notifications";

const POLL_MS = 60_000;

/**
 * What the hook returns. Exported so a screen showing notifications in two places
 * at once (the parent dashboard has the header bell *and* the inbox page) can call
 * the hook once and pass this down, rather than polling twice and letting the two
 * disagree — "mark all read" must clear the badge immediately, not a minute later.
 */
export interface NotificationsState {
  inbox: Inbox;
  loading: boolean;
  markRead: (receiptId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(recipientType: "user" | "student"): NotificationsState {
  const [inbox, setInbox] = useState<Inbox>({ items: [], unread_count: 0 });
  const [loading, setLoading] = useState(true);

  const fetchInbox = recipientType === "student" ? notificationsApi.studentInbox : notificationsApi.inbox;
  const markReadApi = recipientType === "student" ? notificationsApi.studentMarkRead : notificationsApi.markRead;

  const refresh = useCallback(async () => {
    try {
      setInbox(await fetchInbox());
    } catch {
      // Silent — a failed poll should not disturb whatever the learner/parent is doing.
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientType]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const markRead = useCallback(async (receiptId: string) => {
    setInbox((current) => ({
      unread_count: Math.max(0, current.unread_count - (current.items.find((i) => i.id === receiptId && !i.read_at) ? 1 : 0)),
      items: current.items.map((item) => (item.id === receiptId ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item)),
    }));
    try {
      await markReadApi(receiptId);
    } catch {
      void refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientType]);

  const markAllRead = useCallback(async () => {
    setInbox((current) => ({
      unread_count: 0,
      items: current.items.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
    }));
    try {
      if (recipientType === "user") await notificationsApi.markAllRead();
      else await Promise.all(inbox.items.filter((i) => !i.read_at).map((i) => notificationsApi.studentMarkRead(i.id)));
    } catch {
      void refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientType]);

  return { inbox, loading, markRead, markAllRead, refresh };
}
