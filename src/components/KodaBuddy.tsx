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
  /**
   * Draw the character on a soft rounded tile.
   *
   * A prop rather than a setting read in here, because this component has no
   * business knowing what a deployment allows — `KodaFab` asks the switchboard
   * and passes the answer, the same way it decides whether to render at all.
   */
  backdrop?: boolean;
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
 * The drawn face is turned to its right — the eyes and mouth sit on that side
 * of the head — so parked bottom-left it already looks back into the page.
 * Carry it to the right edge and that same face is staring off the screen,
 * which reads as a character that has lost interest in the child.
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
  backdrop = false,
  className = "",
}) => {
  const { centreX, centreY, wasDragged, dragProps } = useDraggable<HTMLButtonElement>({
    storageKey,
  });

  // Off the hook's live centre, not off `anchor` in React state: the latter is
  // zeros on the first render, and a transform reading it never recomputed when
  // the real measurement landed — so which way Koda looked depended on which
  // corner it happened to start in.
  const facing = useTransform(centreX, (cx) =>
    // The drawn face looks to its *right* — the eyes and mouth sit on that side
    // of the head — so it is the right half of the screen that has to be
    // mirrored, or Koda stands in the corner staring off the edge. Worth
    // stating plainly because it is not visible from the markup: the face is a
    // generated image, and which way it points can only be seen by looking at
    // one.
    cx > window.innerWidth / 2 ? -1 : 1,
  );

  const tilt = useTransform(centreY, (cy) => {
    const fromMiddle = (cy - window.innerHeight / 2) / (window.innerHeight / 2);
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
      {/*
        * The tile, when a deployment asks for one.
        *
        * `overflow-hidden` with the character drawn larger than the tile, so
        * the head is cropped by the panel rather than floating in the middle of
        * it with a ring of empty space — which is what makes it read as a
        * portrait rather than as a sticker on a square. The turn is applied
        * *inside* the tile, so mirroring flips the character and never the
        * panel around it.
        */}
      {backdrop ? (
        <span
          className="grid overflow-hidden rounded-[30%] bg-indigo-100 dark:bg-indigo-500/25"
          style={{ width: size, height: size }}
        >
          {/* Sat on the floor of the tile at ~82%, not centred at 100%. Centred
              and full-size, the head covers the panel and leaves a sliver of
              colour that reads as a rendering artefact; dropped to the bottom
              edge it is a character standing *in* something, with room above it
              to be a character in. */}
          {/* Mirrored inside the tile, but never tilted in it. The lean is a
              head turning to look up or down; inside a square frame it is just
              a picture hanging crooked, and the frame is the thing the eye
              levels against. The tile keeps the turn — which is the part that
              actually reads — and drops the lean. */}
          <motion.div
            className="pointer-events-none self-end justify-self-center"
            style={still ? { scaleX: facing } : { scaleX: facingSmooth }}
          >
            <KodaFace state={state} palette={palette} size={Math.round(size * 0.82)} />
          </motion.div>
        </span>
      ) : (
        /* `pointer-events-none` so every press lands on the button: the mascot
           is an <img> inside it, and an image that swallows pointerdown is an
           image the drag never starts from.

           The turn lives on this wrapper rather than on the mascot, because
           `KodaMascot` is already running two layers of transform of its own —
           the voice spring and the ambient loop — and a third writing to the
           same element would simply overwrite one of them. */
        <motion.div
          className="pointer-events-none"
          style={still ? { scaleX: facing, rotate: tilt } : { scaleX: facingSmooth, rotate: tiltSmooth }}
        >
          <KodaFace state={state} palette={palette} size={size} />
        </motion.div>
      )}
    </motion.button>
  );
};
