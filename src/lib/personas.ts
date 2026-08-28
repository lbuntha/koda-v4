/**
 * Who Koda is, as far as the browser is concerned.
 *
 * Read-only, and deliberately thin. The roster is data an operator controls and
 * the *prompt* is built server-side from an id — see `tutor/persona.ts` for the
 * four layers and why the browser is never allowed near the manner text. What
 * this file is for is the two things a screen genuinely needs: drawing the
 * choices a parent picks from, and naming the teacher a child is talking to.
 *
 * Cached like the plan and the switchboard, for the same reason: a tablet that
 * cannot reach the server should still name the character it last knew about
 * rather than going anonymous mid-lesson.
 */

import { ChildSettingsAPI } from "./childSettings";
import { ApiError, accessToken, request } from "./sync";

export interface KodaCharacter {
  personaId: string;
  name: string;
  emoji: string;
  /** The human sentence, for a parent choosing. Not the model's instructions. */
  blurb: string;
  voice: string;
  /** DiceBear seed for their face — the same style every account here wears. */
  avatarSeed: string;
  minAge: number;
  maxAge: number;
}

/**
 * What the app draws before it has heard, and when it never will.
 *
 * One character, matching the API's own fallback (`FALLBACK_CHARACTER`), so an
 * offline device shows the teacher a child will actually get rather than an
 * empty picker.
 */
export const FALLBACK_CHARACTER: KodaCharacter = {
  personaId: "koda",
  name: "Koda",
  emoji: "🦭",
  blurb: "Warm, patient, and always asks before telling.",
  voice: "Aoede",
  avatarSeed: "koda-warm-01",
  minAge: 4,
  maxAge: 8,
};

const CACHE_KEY = "koda_personas_v1";

let roster: KodaCharacter[] = load();
/**
 * Which character an unchosen child gets.
 *
 * Tracked rather than assumed to be first in the list: the roster is ordered by
 * an `order` an operator can change, so "the default is roster[0]" is a rule
 * that holds until somebody drags a character up the page.
 */
let defaultId: string = FALLBACK_CHARACTER.personaId;
let version = 0;
const listeners = new Set<() => void>();

function load(): KodaCharacter[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as KodaCharacter[]) : null;
    return parsed?.length ? parsed : [FALLBACK_CHARACTER];
  } catch {
    return [FALLBACK_CHARACTER];
  }
}

const store = (next: KodaCharacter[], nextDefault?: string): void => {
  roster = next.length ? next : [FALLBACK_CHARACTER];
  if (nextDefault) defaultId = nextDefault;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(roster));
  } catch {
    /* a blocked store costs this device its offline copy and nothing else */
  }
  version += 1;
  listeners.forEach((fn) => fn());
};

/**
 * Which character a stored choice actually resolves to, within a given roster.
 *
 * Pure, and exported, because two things need the answer and must not disagree:
 * the store, and any component drawing the roster it was handed. A picker that
 * resolved through the store while rendering a different list would highlight
 * the wrong card — which is exactly what it did before this existed.
 *
 * Falls through: the chosen one, else the deployment's default, else whatever
 * is first, else the built-in. An id nobody recognises — a character retired
 * while a child was pointed at it — lands on the default rather than nothing.
 */
export const pickCharacter = (
  roster: KodaCharacter[],
  personaId: string | null | undefined,
  defaultPersonaId: string,
): KodaCharacter =>
  roster.find((row) => row.personaId === personaId) ??
  roster.find((row) => row.personaId === defaultPersonaId) ??
  roster[0] ??
  FALLBACK_CHARACTER;

export const Personas = {
  version: () => version,
  snapshot: (): KodaCharacter[] => roster,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** Every character a child may be given. Enabled ones only — the API filters. */
  all: (): KodaCharacter[] => roster,

  /** The character an unchosen child gets. */
  defaultId: (): string => defaultId,

  /** One by id, or the default. Never throws and never returns nothing. */
  byId: (personaId: string | null | undefined): KodaCharacter =>
    pickCharacter(roster, personaId, defaultId),

  /**
   * The teacher whoever is playing on this device has been given.
   *
   * The choice is a child's setting, so it follows the learner between devices
   * and a family can give two children two different teachers — which is the
   * whole point of having more than one.
   */
  current: (): KodaCharacter => Personas.byId(ChildSettingsAPI.current().personaId),

  /** Re-read from the server. Never throws — offline keeps the last roster. */
  async refresh(): Promise<void> {
    try {
      const token = await accessToken();
      if (!token) return;
      const body = await request<{ personas: KodaCharacter[]; defaultPersonaId?: string }>(
        "/personas",
        { token },
      );
      store(body.personas ?? [], body.defaultPersonaId);
    } catch (error) {
      void (error as ApiError);
    }
  },
};

/** The id every Koda request carries. Never the manner — that is the server's. */
export const currentPersonaId = (): string => Personas.current().personaId;
