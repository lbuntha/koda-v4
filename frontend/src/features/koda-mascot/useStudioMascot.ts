/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Koda a canvas draws, taken from Mascot Studio.
 *
 * `KodaMascot` renders whatever `MascotDocument` it is handed and falls back to
 * a built-in starter when handed none. That fallback is the right *default* and
 * the wrong *answer*: a school that has drawn its own Koda should see it in the
 * activities, not only in the editor it was drawn in.
 *
 * What it reads are the studio's **styles** — the "My styles" shelf, each one a
 * saved mascot document under a name someone chose ("Talking Style"). Styles
 * rather than the `/mascots` documents because that shelf is the thing an author
 * actually curates, and a name is what they will pick from in a dropdown.
 *
 * Both places a style can live are read, and in this order:
 *
 *   1. the account's saved styles from the API — shared across devices;
 *   2. `localStorage`, which the studio also writes to, so a style saved while
 *      offline still shows up on the board in the same session.
 *
 * Four things it deliberately does not do:
 *
 *   - **Throw, or block paint.** Every failure resolves to `undefined`, which
 *     `KodaMascot` reads as "use the starter" — so a failed fetch looks like a
 *     design decision rather than a broken page.
 *   - **Fetch more than once.** The promise is cached at module scope: a board
 *     with three Kodas makes one request, and moving between slides makes none.
 *   - **Match loosely.** An id wins over a name, and a name matches
 *     case-insensitively but not partially — "Talk" must not silently resolve to
 *     somebody's "Talking Style".
 *   - **Work for a learner.** `GET /mascot-styles` is authoring-only: a
 *     student's token gets a 403 by design, since a learner's device is the
 *     least trusted place a token lives. They get the starter. The same canvases
 *     render inside the Studio for the author, which is where this earns itself.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { isApiConfigured } from "../../api/client";
import { mascotStylesApi } from "../../api/mascotStyles";
import { loadHiddenMascotPresetIds, loadMascotStyles, type MascotStyleRecord } from "../../admin/mascot-studio/styleModel";
import { MASCOT_STYLE_PRESETS } from "../../admin/mascot-studio/presets";
import type { KodaMascotState } from "./stateMachine";
import { defaultActorDocument, presetDocument } from "./defaultCast";
import type { MascotDocument } from "./types";

/**
 * The style a canvas asks for when nobody has said otherwise.
 *
 * A guide who is mid-sentence is the right resting pose for a board that has
 * just asked a question — Koda has said the thing and is waiting to see what
 * happens next.
 */
export const DEFAULT_ACTOR_STYLE = "Talking Style";

/**
 * The cast.
 *
 * A question has moments, not one mood: it is read out, then waited on, then
 * got wrong or got right. One actor holding the same face through all four is
 * the thing that makes a mascot feel like a sticker — the character has to
 * answer what just happened, or a child stops reading it as a character at all.
 *
 * Each role names two things:
 *
 *   - `style`, a Mascot Studio style to look for **by name**. Save a style
 *     called "Waiting Style" and every board's waiting moment picks it up, with
 *     no wiring and no per-slide choice. Nothing saved under that name falls
 *     back to the slide's chosen actor, and then to the built-in starter, so the
 *     cast works from one style upwards rather than needing all four.
 *   - `state`, which drives the motion and the built-in's expression. This part
 *     changes even for an account with a single style saved, so the moment is
 *     always legible in the movement even when the face cannot change.
 */
export type ActorRole = "talking" | "waiting" | "oops" | "celebrating";

export const ACTOR_ROLES: Record<ActorRole, { style: string; state: KodaMascotState; label: string }> = {
  talking: { style: "Talking Style", state: "talking", label: "Reading the question" },
  waiting: { style: "Waiting Style", state: "waiting", label: "Waiting while they work" },
  oops: { style: "Oops Style", state: "oops", label: "That answer was wrong" },
  celebrating: { style: "Happy Style", state: "excited", label: "They got it" },
};

/** A slide's explicit casting: which style plays which moment. */
export type GuideCast = Partial<Record<ActorRole, string>>;

/**
 * What a picker needs to offer a choice: what it stores and what it shows.
 *
 * `value` rather than the name alone, because the two kinds of character are
 * addressed differently. A saved style is stored **by name** — a style re-saved
 * under the same name is the same character to the person who drew it, and that
 * survives an id churn they never see. A built-in has no author to rename it, so
 * it is stored **by preset id**, which is the one thing about it that cannot
 * drift. Both resolve through the same lookup below, so a slide authored either
 * way keeps working.
 */
export interface ActorChoice {
  id: string;
  name: string;
  /** Write this into the slide. */
  value: string;
  /** Where it came from — a picker groups on this. */
  source: "style" | "preset";
}

/** Resolves once per page load. Never rejects. */
let pending: Promise<MascotStyleRecord[]> | null = null;

const load = (): Promise<MascotStyleRecord[]> => {
  if (pending) return pending;
  const remote = isApiConfigured()
    ? mascotStylesApi.list().catch(() => [] as MascotStyleRecord[])
    : Promise.resolve([] as MascotStyleRecord[]);

  pending = remote.then(rows => {
    // Server first, so a style edited elsewhere wins over a stale local copy of
    // the same id; local-only styles are appended rather than dropped.
    const seen = new Set(rows.map(row => row.id));
    let local: MascotStyleRecord[] = [];
    try {
      local = loadMascotStyles();
    } catch {
      local = [];
    }
    return [...rows, ...local.filter(style => !seen.has(style.id))];
  });
  return pending;
};

/**
 * Everyone currently drawing a Koda, so a save can reach them.
 *
 * Dropping the cached promise is not enough on its own: a mounted canvas
 * resolved its style once, in an effect keyed on the style *name*, and that name
 * does not change when the artwork behind it does. So the studio would save a
 * new Waiting Koda, the shelf beside it would update, and every open board would
 * go on drawing the old one until a reload — which is exactly the kind of stale
 * that makes an author think the feature is broken rather than cached.
 *
 * A version counter fixes it: `refreshStudioMascots` bumps it, every hook is
 * subscribed to it, and they all re-resolve against a fresh fetch.
 */
let version = 0;
const listeners = new Set<() => void>();

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

const useStylesVersion = () => useSyncExternalStore(subscribe, () => version, () => version);

/** Forget the cached fetch and redraw every Koda on screen. Call after a save. */
export const refreshStudioMascots = () => {
  pending = null;
  version += 1;
  for (const notify of listeners) notify();
};

/** An id match, else an exact name match ignoring case. Order is "most recent first". */
const pick = (styles: MascotStyleRecord[], wanted: string): MascotStyleRecord | undefined => {
  const key = wanted.trim().toLowerCase();
  if (!key) return undefined;
  return (
    styles.find(style => style.id.toLowerCase() === key) ??
    styles.find(style => style.name.trim().toLowerCase() === key)
  );
};

/**
 * The same lookup against the characters that ship with Mascot Studio.
 *
 * Tried only after the saved styles, so an author who saves their own "Panda"
 * gets theirs rather than ours — a built-in is a starting point, not a claim on
 * the name.
 */
const pickPreset = (wanted: string): MascotDocument | undefined => {
  const key = wanted.trim().toLowerCase();
  if (!key) return undefined;
  const preset =
    MASCOT_STYLE_PRESETS.find(candidate => candidate.id.toLowerCase() === key) ??
    MASCOT_STYLE_PRESETS.find(candidate => candidate.name.trim().toLowerCase() === key);
  return preset ? presetDocument(preset.id) : undefined;
};

/**
 * The saved mascot for the first of these styles that exists.
 *
 * Candidates in order of preference — a role's own style, then whatever the
 * slide chose, then nothing, which `KodaMascot` reads as "draw the starter".
 * Joined into one string for the dependency list so a caller can build the
 * array inline without re-running the fetch on every render.
 */
export function useStudioMascot(style: string | string[] | null | undefined = DEFAULT_ACTOR_STYLE): MascotDocument | undefined {
  const candidates = (Array.isArray(style) ? style : [style ?? DEFAULT_ACTOR_STYLE]).filter(Boolean) as string[];
  /*
    Joined on a character no style name can contain. Every name in the wild has
    a space in it — "Talking Style" — so a space-joined key splits a two-name
    preference list into four nonsense lookups, all of which miss, and the whole
    cast silently falls back to the built-in.
  */
  const key = candidates.join("|");
  const styles = useStylesVersion();
  const [document, setDocument] = useState<MascotDocument | undefined>(undefined);

  useEffect(() => {
    let live = true;
    load().then(styles => {
      if (!live) return;
      for (const candidate of key.split("|")) {
        /*
          One candidate is resolved all the way down — saved style, then
          built-in — before the next is tried, because the list is a preference
          order. Draining every saved style first would let a role's generic
          "Waiting Style" outrank the built-in this slide explicitly cast.
        */
        const found = pick(styles, candidate)?.document ?? pickPreset(candidate);
        if (found) return setDocument(found);
      }
      setDocument(undefined);
    });
    return () => {
      live = false;
    };
  }, [key, styles]);

  return document;
}

/**
 * Koda for one moment of a question: the document to draw and the state to
 * drive it with. See `ACTOR_ROLES` for how a role finds its artwork.
 */
export function useActor(
  role: ActorRole,
  /** The slide's chosen actor, used when the role has no style of its own. */
  fallbackStyle?: string | null,
  /** This slide's explicit casting for this role, from the Studio. Wins over everything. */
  overrideStyle?: string | null,
  /** Which activity is asking — lets one component use a different house cast. */
  component?: string,
): { document: MascotDocument | undefined; state: KodaMascotState } {
  const { style, state } = ACTOR_ROLES[role];
  /*
    Saved styles first, most specific wins: what this slide cast for this
    moment, then the account's style named for the moment, then the slide's
    default actor.

    `DEFAULT_ACTOR_STYLE` used to be pinned on the end of that list, and it was
    the bug behind "the cast does not work": an account with only a Talking
    Style saved resolved *every* role to it, so the board read the question,
    waited and got an answer wrong wearing one face. An implicit default is only
    honest when it is a default for that role — which is what the built-in cast
    below is, and why this list now ends where the author's choices end.
  */
  const saved = useStudioMascot([overrideStyle, style, fallbackStyle].filter(Boolean) as string[]);
  return { document: saved ?? defaultActorDocument(component, role), state };
}

/**
 * Every character an author may choose from: their saved styles newest first,
 * then the characters Mascot Studio ships with. Empty until the styles load.
 *
 * The built-ins are the point of this list. An account that has drawn one style
 * used to see a picker with one entry in it, which reads as a feature that does
 * not work — while the studio next door already had a shelf of characters that
 * no board could ask for. A preset hidden in the studio stays hidden here, since
 * hiding one is a statement about the whole account, not about that shelf.
 *
 * The preset half is built once at module scope: it cannot change at runtime,
 * and rebuilding it per hook put a fresh array into state on every save and
 * re-rendered every picker below it for nothing. Note this lists presets — it
 * does not *instantiate* them; the artwork is only composed when a board asks
 * for that character, and `presetDocument` keeps it after that.
 */
const PRESET_CHOICES: ActorChoice[] = MASCOT_STYLE_PRESETS.map(preset => ({
  id: preset.id,
  name: preset.name,
  value: preset.id,
  source: "preset",
}));

export function useActorChoices(): ActorChoice[] {
  const styles = useStylesVersion();
  const [choices, setChoices] = useState<ActorChoice[]>(PRESET_CHOICES);

  useEffect(() => {
    let live = true;
    load().then(rows => {
      if (!live) return;
      let hidden: string[] = [];
      try {
        hidden = loadHiddenMascotPresetIds();
      } catch {
        hidden = [];
      }
      const presets = hidden.length
        ? PRESET_CHOICES.filter(choice => !hidden.includes(choice.id))
        : PRESET_CHOICES;
      setChoices([
        ...rows.map((row): ActorChoice => ({ id: row.id, name: row.name, value: row.name, source: "style" })),
        ...presets,
      ]);
    });
    return () => {
      live = false;
    };
  }, [styles]);

  return choices;
}
