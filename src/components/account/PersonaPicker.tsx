import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";

import { Personas, pickCharacter } from "../../lib/personas";
import { usePersonaRoster } from "../../lib/usePersona";
import { playSound } from "../../utils/audio";
import { CharacterAvatar, tintFor } from "./CharacterVisuals";

/**
 * Choosing a teacher.
 *
 * Its own component because two different people choose one, from two different
 * screens: a parent picking for a child on the Children page, and an older
 * learner with their own sign-in picking for themselves in Settings. One
 * implementation, so the cards cannot drift apart — and so "which teachers can
 * be chosen" is answered in one place when the roster changes.
 *
 * Deliberately *only* the teacher. The rest of a child's settings — the daily
 * cap, the starting point — are a parent's call and stay on the parent's page:
 * a cap a learner can lift is not a cap. A character is a preference, not a
 * permission, which is why this one is safe to hand to the learner.
 *
 * Draws nothing when a deployment runs a single character: that is not a choice
 * and should not be presented as one.
 */
export const PersonaPicker: React.FC<{
  /** The chosen id, or `null` for whatever the deployment's default is. */
  value: string | null;
  onChange(personaId: string): void;
  /** Screen-reader label — the two callers ask the question differently. */
  ariaLabel?: string;
}> = ({ value, onChange, ariaLabel = "Koda's character" }) => {
  const roster = usePersonaRoster();
  // Resolved *within the roster being drawn*, not through the store: two
  // sources for one answer is how a picker comes to highlight a card that is
  // not the one the child will actually get. An id nobody recognises — a
  // character retired while this child was pointed at it — lands on the
  // default rather than leaving nothing selected.
  const chosen = pickCharacter(roster, value, Personas.defaultId());

  if (roster.length <= 1) return null;

  return (
    <div
      className="grid gap-2 sm:grid-cols-2"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {roster.map((option) => {
        const selected = option.personaId === chosen.personaId;
        const tint = tintFor(option.personaId);
        return (
          <motion.button
            key={option.personaId}
            type="button"
            role="radio"
            aria-checked={selected}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            onClick={() => {
              if (selected) return;
              playSound("pop");
              onChange(option.personaId);
            }}
            className={[
              "relative flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition-colors",
              selected
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15"
                : "border-line hover:border-indigo-300",
            ].join(" ")}
          >
            <CharacterAvatar
              personaId={option.personaId}
              avatarSeed={option.avatarSeed}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-sm font-bold text-ink">{option.name}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{option.blurb}</span>
              <span
                className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-mono font-bold ${tint.bg} ${tint.text}`}
              >
                ages {option.minAge}–{option.maxAge}
              </span>
            </span>
            {/* The tick, animated in, so choosing feels like a choice landing
                rather than a border colour quietly changing. */}
            <AnimatePresence>
              {selected && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white"
                  aria-hidden
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
};
