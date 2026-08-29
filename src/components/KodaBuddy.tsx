import React from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";

import { useDraggable } from "../lib/useDraggable";
import { KodaFace, KODA_BRAND } from "./KodaFace";
import { type MascotPalette, type MascotState } from "./KodaMascot";

export interface KodaBuddyProps {
  /** What a tap does. Never fired at the end of a drag. */
  onPress(): void;
  /** Read out, and shown on hover. */
  label?: string;
  /** Remember where it was left, under this `localStorage` key. */
  storageKey?: string;
  size?: number;
  palette?: MascotPalette;
  state?: MascotState;
  /** Placement. Where it *starts*; the drag takes it from there. */
  className?: string;
}

/**
 * Koda as a character you can pick up and put somewhere.
 *
 * The behaviour is split in two on purpose. `useDraggable` owns the gesture,
 * the edges, the memory and telling a tap from a drag, and knows nothing about
 * Koda — anything else that should float and be moved uses the same hook. What
 * is here is only what makes it a *character*: the face, and which way it is
 * looking.
 *
 * Placement is the caller's, through `className`, because where a buddy starts
 * is a question about the screen it is on and not about the buddy.
 *
 * ### Which way it looks
 *
 * The drawn face is turned to its left — the eyes and mouth sit on that side of
 * the head — so parked bottom-right it already looks back into the page. Carry
 * it to the left edge and that same face is staring off the screen, which reads
 * as a character that has lost interest in the child.
 *
 * So it mirrors when it crosses the middle, and tips toward the centre line
 * vertically: near the top it looks down, near the bottom it looks up. The
 * horizontal half is a hard switch rather than a gradual turn, deliberately — a
 * head that rotates smoothly through a profile view is a head that spends most
 * of its time facing nowhere. The spring is what makes the switch read as
 * turning round rather than as a frame swap.
 *
 * Both are driven off the live offsets, so it turns *while* being carried
 * rather than settling into place afterwards.
 */
export const KodaBuddy: React.FC<KodaBuddyProps> = ({
  onPress,
  label = "Ask Koda",
  storageKey,
  size = 64,
  palette = KODA_BRAND,
  state = "idle",
  className = "",
}) => {
  const { x, y, anchor, wasDragged, dragProps } = useDraggable<HTMLButtonElement>({ storageKey });

  const facing = useTransform(x, (dx) => {
    const centre = anchor.left + dx + anchor.width / 2;
    // Right of the middle the drawn face already looks inward; left of it,
    // mirror, so the features point back the way they came.
    return centre > window.innerWidth / 2 ? 1 : -1;
  });

  const tilt = useTransform(y, (dy) => {
    const centre = anchor.top + dy + anchor.height / 2;
    const fromMiddle = (centre - window.innerHeight / 2) / (window.innerHeight / 2);
    // Level through the middle, and clamped well short of a somersault.
    return Math.max(-1, Math.min(1, -fromMiddle)) * 12;
  });

  /* Springs so a flip has weight. Bypassed outright for anyone who asked their
     system for less movement — a character snapping between mirror images is
     exactly the kind of motion that preference is about. */
  const still = useReducedMotion() ?? false;
  const facingSmooth = useSpring(facing, { stiffness: 260, damping: 24, mass: 0.6 });
  const tiltSmooth = useSpring(tilt, { stiffness: 150, damping: 20, mass: 0.7 });

  return (
    <motion.button
      {...dragProps}
      whileDrag={{ scale: 1.08 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={(event) => {
        if (wasDragged()) {
          event.preventDefault();
          return;
        }
        onPress();
      }}
      title={`${label} — drag to move`}
      aria-label={label}
      className={[
        "grid place-items-center rounded-full cursor-grab active:cursor-grabbing",
        // The shadow is the whole affordance: it is what says the character is
        // above the page rather than printed on it.
        "drop-shadow-[0_6px_14px_rgba(15,23,42,0.28)]",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className,
      ].join(" ")}
    >
      {/* `pointer-events-none` so every press lands on the button: the mascot is
          an <img> inside it, and an image that swallows pointerdown is an image
          the drag never starts from.

          The turn lives on this wrapper rather than on the mascot, because
          `KodaMascot` is already running two layers of transform of its own —
          the voice spring and the ambient loop — and a third writing to the same
          element would simply overwrite one of them. */}
      <motion.div
        className="pointer-events-none"
        style={still ? { scaleX: facing, rotate: tilt } : { scaleX: facingSmooth, rotate: tiltSmooth }}
      >
        <KodaFace state={state} palette={palette} size={size} />
      </motion.div>
    </motion.button>
  );
};
