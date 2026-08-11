/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Casting a slide: who plays each moment of the question.
 *
 * This lived inside the Count panel, which was the wrong home for it the moment
 * a second canvas wanted the same thing. Nothing about it is about counting —
 * every technique that renders through `SharedCanvasLayout` casts a character
 * the same way, off the same config key — so it is a panel field like
 * `SelectField` is, and panels get it from `panelKit` alongside the rest.
 *
 * ## Moments, not an actor
 *
 * There used to be an "Actor" picker above these, setting one character for the
 * whole slide, and it read as a duplicate of the four below — because it very
 * nearly was. "Reading the question" already casts the beat an actor is most
 * visible in, and the other three fell back to it. Two controls for one decision
 * is a question the author has to answer twice, so the moments are the whole
 * control now: a question is read out, waited on, got wrong and got right, and
 * each of those beats casts a character.
 *
 * ## The contract
 *
 * One key on `question.config`, and a panel does not have to know it:
 *
 *   - `mascotStyles` — a `GuideCast`, one character per moment.
 *
 * (`mascotStyle`, the old slide-wide actor, is still *read* — the canvas keeps
 * honouring one on a slide authored before this, and the field says so rather
 * than letting it act invisibly.)
 *
 * A canvas reads them back by handing `guideStyle` and `guideCast` to
 * `SharedCanvasLayout`, which asks `useActor` for a character at each beat. A
 * panel that adds this field to a canvas which does not pass those two props
 * gets a picker that changes nothing — that plumbing is the other half.
 *
 * ## What it writes
 *
 * Only real choices. A moment set back to Auto is *deleted* rather than stored
 * as an empty string, and the last one leaving takes `mascotStyles` with it, so
 * a slide nobody cast about is a slide with nothing written on it.
 */

import React from "react";
import {
  useActorChoices,
  readGuideCast,
  writeGuideCast,
  readLegacyActor,
  clearLegacyActor,
  ACTOR_ROLES,
  type ActorChoice,
  type ActorRole,
} from "../../features/koda-mascot";

/** The order the moments happen in, which is the order to offer them in. */
const ACTOR_ROLE_ORDER: ActorRole[] = ["talking", "waiting", "oops", "celebrating"];

const LABEL = "text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2";
const FIELD = "w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white font-medium outline-none";

/**
 * The characters, under the two headings an author thinks in: the ones they
 * drew and the ones that came with the studio. Split here rather than in the
 * hook because it is a rendering concern, and an empty group renders nothing —
 * an account with no saved styles should not see an empty "My characters".
 */
const ActorOptions: React.FC<{ actors: ActorChoice[] }> = React.memo(({ actors }) => {
  /*
    Five selects share this list, so the split is memoised: the array only
    changes when a style is saved or deleted, and re-filtering thirty-odd
    characters five times per keystroke elsewhere in the panel is work nobody
    asked for.
  */
  const groups = React.useMemo(
    (): Array<[string, ActorChoice[]]> => [
      ["My characters", actors.filter(actor => actor.source === "style")],
      ["Built-in characters", actors.filter(actor => actor.source === "preset")],
    ],
    [actors],
  );
  return (
    <>
      {groups.map(([label, members]) =>
        members.length ? (
          <optgroup key={label} label={label}>
            {members.map(actor => (
              <option key={`${actor.source}-${actor.id}`} value={actor.value}>
                {actor.name}
              </option>
            ))}
          </optgroup>
        ) : null,
      )}
    </>
  );
});
ActorOptions.displayName = "ActorOptions";

export interface ActorCastFieldProps {
  /** The slide's config. Writes `mascotStyles`; reads `mascotStyle` only to report it. */
  config: Record<string, unknown>;
  /** Patch `question.config` — the panel's own `updateConfig`, passed straight in. */
  updateConfig: (patch: Record<string, unknown>) => void;
}

export const ActorCastField: React.FC<ActorCastFieldProps> = ({ config, updateConfig }) => {
  const actors = useActorChoices();
  const cast = readGuideCast(config);
  const legacyActor = readLegacyActor(config);

  return (
    <div className="space-y-2.5">
      <p className={LABEL}>Cast by moment</p>
      {ACTOR_ROLE_ORDER.map(role => (
        <div key={role}>
          <label className={LABEL}>{ACTOR_ROLES[role].label}</label>
          <select
            value={cast[role] ?? ""}
            onChange={e => updateConfig(writeGuideCast(config, role, e.target.value))}
            className={FIELD}
          >
            <option value="">Auto — {ACTOR_ROLES[role].style}</option>
            <ActorOptions actors={actors} />
          </select>
        </div>
      ))}
      <p className="text-[10px] text-slate-400 leading-relaxed">
        The board switches character on its own: it reads the question, waits
        while they work, reacts to a wrong answer and celebrates a right one.
        Left on Auto, a moment uses your saved style of that name, else Koda's
        own face for it. Draw your own in Mascot Studio and it joins these lists.
      </p>

      {/*
        A slide from before the moments were the whole story, still carrying a
        single actor for all four. It is shown rather than quietly obeyed: it
        outranks every Auto above, so an author reading "Auto" while the board
        draws somebody else has no way to explain the difference. Clearing it is
        theirs to do — deleting authored data on render is not a thing a panel
        should do behind someone's back.
      */}
      {legacyActor && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-slate-100 px-2.5 py-2">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            This slide also carries one actor for every moment,{" "}
            <span className="font-bold text-slate-700">{legacyActor}</span>. It plays
            wherever a moment is left on Auto.
          </p>
          <button
            type="button"
            onClick={() => updateConfig(clearLegacyActor())}
            className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
