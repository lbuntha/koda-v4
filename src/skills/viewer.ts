import { useEffect, useState } from "react";
import { useSession } from "../lib/sync/useSession";
import type { Session } from "../lib/sync/session";

/**
 * Who is looking at the app.
 *
 * The local value is the publisher's preview identity and the offline fallback.
 * Learner-facing screens overlay the authenticated learner's Mongo birth year
 * through `useAudienceViewer`; release gating asks about the person, never the
 * skill itself.
 */
export interface Viewer {
  /** Learner age in years. Drives audience matching. */
  age: number;
  /** Sees draft skills. Developer machines only. */
  isDeveloper: boolean;
  /** Platform admins inspect the complete catalog, ignoring release and age gates. */
  showAllSkills: boolean;
}

const STORAGE_KEY = "koda_viewer_v1";

export const DEFAULT_VIEWER: Viewer = {
  age: 6,
  isDeveloper: import.meta.env.DEV,
  showAllSkills: false,
};

function read(): Viewer {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VIEWER;
    return { ...DEFAULT_VIEWER, ...(JSON.parse(raw) as Partial<Viewer>) };
  } catch {
    return DEFAULT_VIEWER;
  }
}

let current: Viewer = read();
const subscribers = new Set<() => void>();

export const getViewer = (): Viewer => current;

export function setViewer(patch: Partial<Viewer>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
  subscribers.forEach((fn) => fn());
}

/** Reactive read, so gating updates the moment the viewer changes. */
export function useViewer(): Viewer {
  const [viewer, setLocal] = useState<Viewer>(current);

  useEffect(() => {
    const sync = () => setLocal(current);
    subscribers.add(sync);
    sync();
    return () => {
      subscribers.delete(sync);
    };
  }, []);

  return viewer;
}

/** Approximate age from the birth-year precision stored by learner profiles. */
export function ageFromBirthYear(birthYear: number, year = new Date().getFullYear()): number {
  return Math.max(0, year - birthYear);
}

/**
 * The learner-facing audience identity.
 *
 * Authenticated learner data wins over the Skill Manager's local preview. A
 * platform admin gets an explicit catalog bypass; developer status alone may
 * reveal drafts but still exercises the selected preview age.
 */
export function viewerForSession(session: Session | null, preview: Viewer): Viewer {
  const isAdmin = session?.platformRole === "admin";
  const isDeveloper = isAdmin || session?.platformRole === "developer";
  return {
    age: session?.learnerBirthYear
      ? ageFromBirthYear(session.learnerBirthYear)
      : preview.age,
    isDeveloper: session ? isDeveloper : preview.isDeveloper,
    showAllSkills: isAdmin,
  };
}

/** Reactive viewer used by learner-facing course surfaces. */
export function useAudienceViewer(): Viewer {
  return viewerForSession(useSession(), useViewer());
}
