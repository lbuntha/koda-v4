import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GraduationCap, Plus, Shuffle, Trash2 } from "lucide-react";

import { ApiError, accessToken, request } from "../../lib/sync";
import { Personas } from "../../lib/personas";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIDialog, UIModal, UISectionHeader, UIToggle } from "../ui";
import { CharacterAvatar, tintFor } from "./CharacterVisuals";
import { CharacterPreview } from "./CharacterPreview";
import { KodaMascot } from "../KodaMascot";
import { newAvatarSeed } from "../../lib/avatar";

/**
 * One character as an operator edits it — `manner` included, which a family
 * never sees. Mirrors `PersonaOut` on the API.
 */
export interface Character {
  personaId: string;
  name: string;
  emoji: string;
  blurb: string;
  manner: string;
  voice: string;
  /** DiceBear seed. Opaque — an input to a drawing, never an identifier. */
  avatarSeed: string;
  minAge: number;
  maxAge: number;
  enabled: boolean;
  order: number;
}

const FIELD =
  "w-full rounded-xl border-2 border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted transition-colors focus:outline-none focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500/30";

const LABEL = "block text-xs font-bold uppercase tracking-wide text-muted";

/** A blank teacher, for the Add form. */
const BLANK: Character = {
  personaId: "",
  name: "",
  emoji: "🦉",
  blurb: "",
  manner: "",
  voice: "Aoede",
  avatarSeed: "",
  minAge: 6,
  maxAge: 12,
  enabled: true,
  order: 100,
};

/**
 * Who Koda can be, for whoever runs the deployment.
 *
 * A roster of teachers, drawn as teachers. The first version of this screen was
 * a stack of rows that expanded into a form in place, which is the shape a
 * *settings list* wants and the wrong one here: every edit pushed the rest of
 * the page down, eight fields arrived at once with the important one no larger
 * than the rest, and three characters read as three database records rather
 * than as three people a parent is going to choose between.
 *
 * So: cards with a face, and editing in a modal. The page never jumps, the
 * roster stays scannable at a glance, and the form gets room to put `manner` —
 * the only field that changes how a child is taught — where the eye lands.
 *
 * The split underneath is unchanged and is the whole design: the roster is
 * **data** an operator owns, and the teaching rules every character obeys are
 * **code**, in `tutor/persona.ts`. Rewording Ms Vega cannot loosen the rule
 * against handing a child the answer. Those rules are not on this page because
 * they are not editable at all.
 */
export const KodaCharacters: React.FC = () => {
  const [roster, setRoster] = useState<Character[] | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [defaultId, setDefaultId] = useState<string>("koda");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Character | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Character | null>(null);

  const load = async () => {
    try {
      const token = await accessToken();
      const body = await request<{
        personas: Character[];
        voices: string[];
        defaultPersonaId: string;
      }>("/personas/all", { token });
      setRoster(body.personas);
      setVoices(body.voices);
      setDefaultId(body.defaultPersonaId);
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** Every write goes through here, so the roster and the app never disagree. */
  const write = async (
    operation: string,
    call: (token: string) => Promise<unknown>,
  ): Promise<boolean> => {
    setBusy(operation);
    setError(null);
    try {
      const token = await accessToken();
      await call(token ?? "");
      await load();
      // Every screen naming this teacher repaints — a parent's picker, a child's
      // panel header. That is the point of editing here rather than in a file.
      void Personas.refresh();
      playSound("pop");
      return true;
    } catch (e) {
      setError((e as ApiError).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggle = (character: Character) =>
    void write(`toggle:${character.personaId}`, (token) =>
      request(`/personas/${character.personaId}`, {
        method: "PATCH",
        token,
        body: { enabled: !character.enabled },
      }),
    );

  const save = async (draft: Character, isNew: boolean) => {
    const body = {
      name: draft.name,
      emoji: draft.emoji,
      blurb: draft.blurb,
      manner: draft.manner,
      voice: draft.voice,
      avatarSeed: draft.avatarSeed || draft.personaId,
      minAge: draft.minAge,
      maxAge: draft.maxAge,
      ...(isNew ? { personaId: draft.personaId } : {}),
    };
    const ok = await write(isNew ? "new" : `save:${draft.personaId}`, (token) =>
      isNew
        ? request("/personas", { method: "POST", token, body })
        : request(`/personas/${draft.personaId}`, { method: "PATCH", token, body }),
    );
    if (ok) {
      setEditing(null);
      setCreating(false);
    }
  };

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Who Koda can be"
        subtitle="Characters a parent chooses between, per child. The rules they all obey are part of Koda, not settings"
        icon={<GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        action={
          <UIButton
            variant="secondary"
            size="sm"
            icon={<Plus />}
            onClick={() => {
              setCreating(true);
              setEditing({ ...BLANK, voice: voices[0] ?? "Aoede" });
            }}
          >
            Add teacher
          </UIButton>
        }
      />

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={themeSystem.flash("warning")}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/*
        * Seeing them comes before editing them.
        *
        * This sat at the bottom of the card to begin with, under the roster and
        * a paragraph of explanation, which meant the one thing an operator
        * opens this page to do — watch a teacher behave — was the one thing
        * they had to scroll to find. Reviewing is the job; the grid below is
        * how you change what you just watched.
        */}
      {roster && roster.length > 0 && <CharacterPreview roster={roster} />}

      {!roster ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-52 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      ) : (
        <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {roster.map((character, index) => (
              <CharacterCard
                key={character.personaId}
                character={character}
                index={index}
                isDefault={character.personaId === defaultId}
                busy={busy === `toggle:${character.personaId}`}
                onEdit={() => {
                  setCreating(false);
                  setEditing(character);
                }}
                onToggle={() => toggle(character)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <p className="text-xs text-muted">
        A parent chooses one per child on the Children page. Retiring a teacher takes them out of
        that choice and keeps their wording; the default cannot be retired, because it is what a
        child gets when nobody has chosen.
      </p>


      {editing && (
        <CharacterEditor
          draft={editing}
          isNew={creating}
          isDefault={editing.personaId === defaultId}
          voices={voices}
          taken={(roster ?? []).map((c) => c.personaId)}
          busy={busy === "new" || busy === `save:${editing.personaId}`}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={(draft) => void save(draft, creating)}
          onDelete={() => setRemoving(editing)}
        />
      )}

      <UIDialog
        isOpen={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name ?? "this character"}?`}
        description="Any child who had this teacher falls back to the default. Retiring them with the switch instead keeps the wording in case you want them back."
        confirmText="Delete"
        variant="danger"
        onConfirm={() => {
          if (!removing) return;
          const doomed = removing;
          setRemoving(null);
          setEditing(null);
          void write(`delete:${doomed.personaId}`, (token) =>
            request(`/personas/${doomed.personaId}`, { method: "DELETE", token }),
          );
        }}
      />
    </section>
  );
};

/**
 * One teacher at a glance.
 *
 * Everything a decision needs and nothing else: the face, the name, how a
 * parent will see them, and the two facts that decide whether they suit a child
 * — the ages and the voice. The manner is deliberately absent; it is a
 * paragraph, and a card with a paragraph on it is a card nobody scans.
 *
 * Entrance is staggered by position so a roster arrives in order rather than
 * all at once, and `layout` lets the grid close the gap when one is deleted
 * instead of snapping.
 */
const CharacterCard: React.FC<{
  character: Character;
  index: number;
  isDefault: boolean;
  busy: boolean;
  onEdit(): void;
  onToggle(): void;
}> = ({ character, index, isDefault, busy, onEdit, onToggle }) => {
  const tint = tintFor(character.personaId);
  const retired = !character.enabled;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay: index * 0.04 }}
      className={themeSystem.card(
        "default",
        `group flex flex-col gap-3 p-4 ${retired ? "opacity-70" : ""}`,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <CharacterAvatar
          personaId={character.personaId}
          avatarSeed={character.avatarSeed}
          size="md"
          muted={retired}
          animated
        />
        {/* The switch sits opposite the face: one glance says who they are, the
            other says whether anyone can choose them. */}
        <UIToggle
          checked={character.enabled}
          // The floor an unchosen child falls back to. A deployment whose
          // default teacher is retired has no teacher at all.
          disabled={isDefault || busy}
          onChange={onToggle}
          label={`${character.name} available to families`}
          tone="emerald"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-mono text-sm font-black text-ink">{character.name}</h4>
          {isDefault && <UIBadge variant="primary">Default</UIBadge>}
          {retired && <UIBadge variant="neutral">Retired</UIBadge>}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted">
          {character.blurb || "No description yet."}
        </p>
      </div>

      <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-muted">
        <span className={`rounded-full px-2 py-0.5 ${tint.bg} ${tint.text}`}>
          ages {character.minAge}–{character.maxAge}
        </span>
        <span className="truncate">speaks as {character.voice}</span>
      </div>

      <UIButton variant="secondary" size="sm" fullWidth onClick={onEdit}>
        Edit
      </UIButton>
    </motion.article>
  );
};

/**
 * The editor.
 *
 * In a modal rather than inline, so opening one does not move the five cards
 * below it — and so the form can be laid out by importance instead of by
 * whatever fits in a card. The order is the order the decisions are made:
 * who they are, how a parent will see them, how they teach, and the two
 * settings that decide who they suit.
 */
const CharacterEditor: React.FC<{
  draft: Character;
  isNew: boolean;
  isDefault: boolean;
  voices: string[];
  taken: string[];
  busy: boolean;
  onClose(): void;
  onSave(draft: Character): void;
  onDelete(): void;
}> = ({ draft, isNew, isDefault, voices, taken, busy, onClose, onSave, onDelete }) => {
  const [value, setValue] = useState<Character>(draft);
  const set = (patch: Partial<Character>) => setValue((v) => ({ ...v, ...patch }));

  const idClash = isNew && taken.includes(value.personaId);
  const idShape = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.personaId);
  const ready =
    value.name.trim().length > 0 &&
    value.manner.trim().length >= 10 &&
    value.minAge <= value.maxAge &&
    (!isNew || (idShape && !idClash));

  return (
    <UIModal
      isOpen
      onClose={onClose}
      title={isNew ? "A new teacher" : `Edit ${draft.name}`}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {!isNew && !isDefault ? (
            <UIButton variant="ghost" size="sm" icon={<Trash2 />} onClick={onDelete}>
              Delete
            </UIButton>
          ) : (
            <span className="text-[11px] text-muted">
              {isDefault ? "The default teacher cannot be deleted." : ""}
            </span>
          )}
          <div className="flex items-center gap-2">
            <UIButton variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </UIButton>
            <UIButton
              variant="primary"
              size="sm"
              isLoading={busy}
              disabled={!ready}
              onClick={() => onSave(value)}
            >
              {isNew ? "Add teacher" : "Save"}
            </UIButton>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Who they are. The face is the live mascot, not a preview of one, and
            it is talking — because "does this face suit this teacher" is a
            question about how it moves, not how it sits still. */}
        <div className="flex items-center gap-4">
          <motion.div
            key={value.avatarSeed}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <KodaMascot
              state="speaking"
              personaId={value.personaId || "new"}
              avatarSeed={value.avatarSeed || value.personaId || "new"}
              size={88}
            />
          </motion.div>
          <div className="min-w-0 flex-1 space-y-2">
            <label className="block space-y-1">
              <span className={LABEL}>Name</span>
              <input
                className={FIELD}
                value={value.name}
                maxLength={40}
                placeholder="Ms Vega"
                onChange={(e) => set({ name: e.target.value })}
              />
            </label>
            {/* Rerolling is the whole of face selection: the seed is opaque and
                the only useful question is "do I like this one". Same system,
                and the same gesture, as the avatar picker every account uses. */}
            <UIButton
              variant="secondary"
              size="sm"
              icon={<Shuffle />}
              onClick={() => set({ avatarSeed: newAvatarSeed() })}
            >
              Different face
            </UIButton>
          </div>
        </div>

        {isNew && (
          <label className="block space-y-1">
            <span className={LABEL}>Id</span>
            <input
              className={FIELD}
              value={value.personaId}
              placeholder="ms-vega"
              onChange={(e) => set({ personaId: e.target.value.toLowerCase().trim() })}
            />
            <span className="block text-[11px] text-muted">
              {idClash
                ? "A teacher with that id already exists."
                : value.personaId && !idShape
                  ? "Lowercase letters, numbers and hyphens only."
                  : "Permanent — a child's settings point at it. Lowercase, no spaces."}
            </span>
          </label>
        )}

        <label className="block space-y-1">
          <span className={LABEL}>How a parent sees them</span>
          <input
            className={FIELD}
            value={value.blurb}
            maxLength={160}
            placeholder="Precise and calm. Names the idea behind the question."
            onChange={(e) => set({ blurb: e.target.value })}
          />
        </label>

        {/* The one field that changes how a child is taught, given the room to
            say so. Everything above is identity; this is the teacher. */}
        <label className="block space-y-1">
          <span className={LABEL}>How they teach</span>
          <textarea
            className={`${FIELD} min-h-[8rem] leading-relaxed`}
            value={value.manner}
            maxLength={600}
            placeholder="You are calm, precise and encouraging, like a teacher who has taught this for twenty years…"
            onChange={(e) => set({ manner: e.target.value })}
          />
          <span className="flex items-center justify-between gap-3 text-[11px] text-muted">
            <span>
              Manner only. Never giving the answer away, one idea per reply, staying on maths —
              those are part of Koda and every character obeys them.
            </span>
            <span className="shrink-0 font-mono tabular-nums">{value.manner.length}/600</span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={LABEL}>Voice</span>
            <select
              className={FIELD}
              value={value.voice}
              onChange={(e) => set({ voice: e.target.value })}
            >
              {voices.map((voice) => (
                <option key={voice} value={voice}>
                  {voice}
                </option>
              ))}
            </select>
            <span className="block text-[11px] text-muted">
              What they sound like in a spoken session.
            </span>
          </label>

          <div className="space-y-1">
            <span className={LABEL}>Suits ages</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={3}
                max={18}
                aria-label="Youngest age"
                className={FIELD}
                value={value.minAge}
                onChange={(e) => set({ minAge: Number(e.target.value) })}
              />
              <span className="text-sm text-muted">to</span>
              <input
                type="number"
                min={3}
                max={18}
                aria-label="Oldest age"
                className={FIELD}
                value={value.maxAge}
                onChange={(e) => set({ maxAge: Number(e.target.value) })}
              />
            </div>
            <span className="block text-[11px] text-muted">
              {value.minAge > value.maxAge
                ? "The youngest age cannot be above the oldest."
                : "Shown to a parent choosing. Nothing switches automatically."}
            </span>
          </div>
        </div>
      </div>
    </UIModal>
  );
};
