import { accessToken, request } from "./sync";

/** One thing a same-age student (or a buddy) finished this week. */
export interface StudyItem {
  id: string;
  nickname: string;
  avatarSeed: string | null;
  kind: "lesson" | "book";
  skillId: string;
  lessonId: string;
  /** Books only; lessons are named from the local catalog. */
  title: string | null;
  at: string;
  isBuddy: boolean;
  cheers: number;
  cheeredByMe: boolean;
}

/** Anonymous: how many students of this age finished it this week. */
export interface PopularItem {
  kind: "lesson" | "book";
  skillId: string;
  lessonId: string;
  title: string | null;
  learners: number;
}

export interface StudyFeed {
  band: [number, number] | null;
  sharingEnabled: boolean;
  popular: PopularItem[];
  items: StudyItem[];
}

/*
 * Offline first: the last feed is kept per learner, so a child on a weak
 * connection still sees the card at once and the network only refreshes it.
 */
const KEY = (learnerId: string) => `koda.studyFeed.${learnerId}`;

export function cachedFeed(learnerId: string): StudyFeed | null {
  try {
    const raw = localStorage.getItem(KEY(learnerId));
    return raw ? (JSON.parse(raw) as StudyFeed) : null;
  } catch {
    return null;
  }
}

function remember(learnerId: string, feed: StudyFeed): void {
  try {
    localStorage.setItem(KEY(learnerId), JSON.stringify(feed));
  } catch {
    /* storage full or blocked: the card still shows this session's copy */
  }
}

/* Home places the card twice (phone and computer layouts); both share one request. */
const inFlight = new Map<string, Promise<StudyFeed>>();

export const StudyFeedAPI = {
  get(learnerId: string): Promise<StudyFeed> {
    const running = inFlight.get(learnerId);
    if (running) return running;
    const next = (async () => {
      const feed = await request<StudyFeed>(
        `/study-feed/${learnerId}?tzOffsetMinutes=${-new Date().getTimezoneOffset()}`,
        { token: await accessToken(), timeoutMs: 8000 },
      );
      remember(learnerId, feed);
      return feed;
    })().finally(() => inFlight.delete(learnerId));
    inFlight.set(learnerId, next);
    return next;
  },

  async cheer(learnerId: string, itemId: string): Promise<{ cheers: number; cheeredByMe: boolean }> {
    return request(`/study-feed/${learnerId}/cheer/${encodeURIComponent(itemId)}`, {
      method: "POST",
      token: await accessToken(),
      timeoutMs: 8000,
    });
  },
};
