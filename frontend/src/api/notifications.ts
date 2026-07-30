/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mirrors backend/app/features/notifications/router.py.
 */

import { api } from "./client";

export interface InboxItem {
  id: string; // receipt id
  notification_id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Inbox {
  items: InboxItem[];
  unread_count: number;
}

export type NotificationAudience = "parents" | "students" | "all" | "user" | "student";
export type NotificationChannel = "in_app" | "email";

export interface SentNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  channels: NotificationChannel[];
  created_by: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  recipient_count: number;
}

/** One field per notification feature a guardian can choose to receive by email. */
export interface NotificationPreferences {
  email_digest_enabled: boolean;
  email_inactivity_enabled: boolean;
  email_announcements_enabled: boolean;
}

export type NotificationPreferenceKey = keyof NotificationPreferences;

export interface NotificationStats {
  recipients: number;
  read: number;
  email_sent: number;
}

export interface ComposeNotificationInput {
  title: string;
  body: string;
  audience: NotificationAudience;
  target_user_id?: string;
  target_student_id?: string;
  channels: NotificationChannel[];
  scheduled_for?: string;
}

export const notificationsApi = {
  // Parent / adult inbox.
  inbox: () => api.get<Inbox>("/notifications/me"),
  markRead: (receiptId: string) => api.post<{ ok: true }>(`/notifications/me/${receiptId}/read`),
  markAllRead: () => api.post<{ marked: number }>("/notifications/me/read-all"),

  // Student inbox.
  studentInbox: () => api.get<Inbox>("/notifications/student/me"),
  studentMarkRead: (receiptId: string) => api.post<{ ok: true }>(`/notifications/student/me/${receiptId}/read`),

  // Admin.
  compose: (body: ComposeNotificationInput) => api.post<SentNotification>("/notifications/compose", body),
  sent: () => api.get<SentNotification[]>("/notifications/sent"),
  stats: (id: string) => api.get<NotificationStats>(`/notifications/${id}/stats`),

  // Parent's own per-feature preferences. Send only the switch that moved.
  updatePreferences: (body: Partial<NotificationPreferences>) =>
    api.patch<NotificationPreferences>("/family/me/notification-preferences", body),
};
