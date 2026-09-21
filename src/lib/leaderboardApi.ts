import { accessToken, request } from "./sync";

export interface LeaderboardPrivacy {
  learnerId: string;
  sharingEnabled: boolean;
  visibility: "private" | "buddies" | "public";
  nickname: string | null;
  consentedAt: string | null;
  revokedAt: string | null;
}

export interface LeaderboardRow {
  rank: number;
  isYou: boolean;
  nickname: string;
  avatarSeed: string | null;
  weeklyXp: number;
}

export interface WeeklyLeaderboard {
  scope: "buddies" | "public";
  sharingEnabled: boolean;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  rows: LeaderboardRow[];
}

export interface Buddy {
  relationshipId: string;
  nickname: string | null;
  avatarSeed: string | null;
  sharingEnabled: boolean;
  connectedAt: string;
}

export interface BuddyInvite {
  id: string;
  code: string | null;
  expiresAt: string;
}

const withToken = async <T>(path: string, options: Parameters<typeof request<T>>[1] = {}) =>
  request<T>(path, { ...options, token: await accessToken() });

export const LeaderboardAPI = {
  privacy: (learnerId: string, signal?: AbortSignal) =>
    withToken<LeaderboardPrivacy>(`/leaderboard/privacy/${learnerId}`, { signal }),

  setPrivacy: (
    learnerId: string,
    visibility: "private" | "buddies" | "public",
    nickname?: string,
  ) =>
    withToken<LeaderboardPrivacy>(`/leaderboard/privacy/${learnerId}`, {
      method: "PATCH",
      body: visibility === "private"
        ? { visibility: "private", sharingEnabled: false }
        : {
            visibility,
            nickname,
            confirmed: true,
            publicConfirmed: visibility === "public",
          },
    }),

  weekly: (learnerId: string, signal?: AbortSignal) =>
    withToken<WeeklyLeaderboard>(
      `/leaderboard/${learnerId}?tzOffsetMinutes=${-new Date().getTimezoneOffset()}`,
      { signal },
    ),

  publicWeekly: (learnerId: string, signal?: AbortSignal) =>
    withToken<WeeklyLeaderboard>(
      `/leaderboard/public/${learnerId}?tzOffsetMinutes=${-new Date().getTimezoneOffset()}`,
      { signal },
    ),

  buddies: async (learnerId: string, signal?: AbortSignal) =>
    (await withToken<{ buddies: Buddy[] }>(`/leaderboard/buddies/${learnerId}`, { signal }))
      .buddies,

  createInvite: (learnerId: string) =>
    withToken<BuddyInvite>(`/leaderboard/buddies/${learnerId}/invites`, {
      method: "POST",
    }),

  acceptInvite: (learnerId: string, code: string) =>
    withToken<Buddy>("/leaderboard/buddies/accept", {
      method: "POST",
      body: { learnerId, code: code.trim().toUpperCase() },
    }),

  removeBuddy: (learnerId: string, relationshipId: string) =>
    withToken<void>(`/leaderboard/buddies/${learnerId}/${relationshipId}`, {
      method: "DELETE",
    }),

  blockBuddy: (learnerId: string, relationshipId: string) =>
    withToken<void>(`/leaderboard/buddies/${learnerId}/${relationshipId}/block`, {
      method: "POST",
    }),
};
