import React from "react";
import { motion } from "motion/react";

import { KodaMascot } from "../KodaMascot";

/**
 * How a character looks, everywhere one is drawn.
 *
 * A roster of teachers is not a table of rows, and the difference is almost
 * entirely visual: a parent choosing between three teachers is choosing between
 * three *people*, and people are told apart by face and colour before they are
 * told apart by name. So a character gets a consistent tint and a consistent
 * avatar on the operator's roster, in the parent's picker, and anywhere a child
 * is told who is teaching them — and the same character is the same colour in
 * all three.
 *
 * The tint is derived from the id rather than stored, for two reasons: an
 * operator adding a teacher should not have to pick a colour before they can
 * save, and a colour nobody chose cannot clash with the one next to it — the
 * palette below is fixed, tested in both themes, and only six wide.
 */

/**
 * Six tints, and no more.
 *
 * Enough that three or four characters are obviously distinct, few enough that
 * every one is checked against both themes. Each is a *tint*, not a brand
 * colour: the surface stays quiet and the ring carries the identity, because a
 * card that shouts is a card that competes with the one beside it.
 */
const TINTS = [
  { bg: "bg-indigo-50 dark:bg-indigo-500/15", ring: "ring-indigo-200 dark:ring-indigo-500/40", text: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-emerald-50 dark:bg-emerald-500/15", ring: "ring-emerald-200 dark:ring-emerald-500/40", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-amber-50 dark:bg-amber-500/15", ring: "ring-amber-200 dark:ring-amber-500/40", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-sky-50 dark:bg-sky-500/15", ring: "ring-sky-200 dark:ring-sky-500/40", text: "text-sky-700 dark:text-sky-300" },
  { bg: "bg-rose-50 dark:bg-rose-500/15", ring: "ring-rose-200 dark:ring-rose-500/40", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-violet-50 dark:bg-violet-500/15", ring: "ring-violet-200 dark:ring-violet-500/40", text: "text-violet-700 dark:text-violet-300" },
] as const;

export type CharacterTint = (typeof TINTS)[number];

/**
 * A stable tint for an id.
 *
 * Deterministic, so a character does not change colour between two screens or
 * between two loads of the same one — which would undo the whole point of
 * having a colour. A plain sum rather than a real hash: the input is a short
 * slug and the output space is six.
 */
export const tintFor = (personaId: string): CharacterTint => {
  let total = 0;
  for (let i = 0; i < personaId.length; i += 1) total += personaId.charCodeAt(i);
  return TINTS[total % TINTS.length];
};

/** Sizes an avatar is drawn at, so three screens cannot invent a fourth. */
const SIZES = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
} as const;

/** The same three in pixels, for the SVG, which cannot read a class. */
const PIXELS: Record<keyof typeof SIZES, number> = { sm: 40, md: 56, lg: 80 };

/**
 * A character's face.
 *
 * The emoji in its tint, ringed rather than bordered so the shape reads as a
 * portrait rather than as a button. `animated` adds the small lean on hover
 * that makes a roster feel alive — left off wherever the avatar is inside
 * something already moving, because two animations on one element read as a
 * glitch rather than as polish.
 */
export const CharacterAvatar: React.FC<{
  personaId: string;
  /** Kept for the tiny label beside a name; the face itself is the mascot. */
  emoji?: string;
  avatarSeed?: string;
  size?: keyof typeof SIZES;
  /** Retired characters are drawn present but plainly out of service. */
  muted?: boolean;
  animated?: boolean;
  className?: string;
}> = ({ personaId, avatarSeed, size = "md", muted = false, animated = false, className = "" }) => {
  const body = (
    <span
      className={[
        "block shrink-0 overflow-hidden rounded-2xl",
        SIZES[size],
        muted ? "opacity-50 grayscale" : "",
        className,
      ].join(" ")}
      aria-hidden
    >
      {/* The same mascot a child meets, at whatever size this is. Not a second
          drawing of the character: one component, so a teacher cannot look like
          two different people on two screens. */}
      <KodaMascot personaId={personaId} avatarSeed={avatarSeed} size={PIXELS[size]} />
    </span>
  );

  if (!animated) return body;
  return (
    <motion.span
      className="inline-flex"
      whileHover={{ scale: 1.06, rotate: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
    >
      {body}
    </motion.span>
  );
};
