import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type TargetAndTransition,
} from "motion/react";

import {
  EXPRESSIONS,
  STATE_ANIMATION,
  kodaFace,
  warmFaces,
  type ExpressionName,
  type MascotState,
} from "../lib/kodaFace";
import { EnvelopeFollower, beatMs, talkingMouth } from "../lib/kodaLive";

export type { MascotState };

/**
 * A character's face, and what it is doing.
 *
 * Two layers, and keeping them apart is the whole design:
 *
 * * **The face** is DiceBear thumbs — the same style every account in Koda
 *   already wears — swapped frame by frame between real expressions. The mouth
 *   actually opens and closes and the eyes actually blink, because each frame is
 *   a different generated face rather than the same picture being squashed.
 *   What plays when lives in `lib/kodaFace.ts` as data.
 * * **The body** is this component: the bob, the lean, the listening rings, the
 *   waveform. Things a still image cannot do, wrapped around one that cannot.
 *
 * Every state shown is true when it is shown — if the mascot is listening, the
 * microphone is open. None of it is a mood light.
 */

/**
 * A character's colour — the head itself, on nothing.
 *
 * There is no tile any more. A coloured square boxed the character into a shape
 * that fought every surface it sat on; a cut-out head sits on a white card, a
 * dark voice modal and a page alike, and it puts the identity on the character
 * rather than on its packaging.
 *
 * Six, index-matched to the roster tints in `CharacterVisuals`, so a teacher is
 * one colour wherever they appear. Solid mid-tones: the thumbs head is a flat
 * fill with black features on it, and a pale wash cannot carry them.
 */
export interface MascotPalette {
  /** The head. */
  head: string;
  /** Rings, dots, waveform and sparks. Lighter, so they read against the head. */
  accent: string;
}

export const MASCOT_PALETTES: MascotPalette[] = [
  { head: "#4f46e5", accent: "#818cf8" }, // indigo
  { head: "#059669", accent: "#34d399" }, // emerald
  { head: "#d97706", accent: "#fbbf24" }, // amber
  { head: "#0284c7", accent: "#38bdf8" }, // sky
  { head: "#e11d48", accent: "#fb7185" }, // rose
  { head: "#7c3aed", accent: "#a78bfa" }, // violet
];

/** The same stable hash the roster tint uses, so the two never disagree. */
export const paletteFor = (personaId: string): MascotPalette => {
  let total = 0;
  for (let i = 0; i < personaId.length; i += 1) total += personaId.charCodeAt(i);
  return MASCOT_PALETTES[total % MASCOT_PALETTES.length];
};

/** A character's resting tilt, so two teachers stand differently. */
const tiltFor = (personaId: string): number => {
  let total = 0;
  for (let i = 0; i < personaId.length; i += 1) total += personaId.charCodeAt(i) * 7;
  return (total % 5) - 2; // -2°…+2°
};

/** What the body does, per state. One place, so the five stay distinguishable. */
const MOTION: Record<MascotState, TargetAndTransition> = {
  idle: { y: [0, -2, 0], scale: [1, 1.01, 1] },
  listening: { rotate: [-5, -3, -5], scale: [1, 1.03, 1] },
  speaking: { y: [0, -3, 0], scale: [1, 1.02, 1] },
  thinking: { rotate: [4, 5.5, 4] },
  celebrating: { y: [0, -9, 0], rotate: [-4, 4, -4] },
};

const DURATION: Record<MascotState, number> = {
  idle: 3.4,
  listening: 2,
  speaking: 0.55,
  thinking: 2.6,
  celebrating: 0.5,
};

/**
 * The mouth, driven by Koda's actual voice.
 *
 * Three pieces of physics, all running in one animation frame loop so they stay
 * in step with each other and off React's render path:
 *
 * * an **envelope follower**, giving the spiky meter mass — fast to open, slower
 *   to close, so a consonant does not slam the mouth shut;
 * * a **decaying peak**, so "loud" means loud for this speaker rather than a
 *   number that only suits a hot microphone;
 * * a **beat clock** at speaking rate, because the meter's own 300ms fall time
 *   has already smeared out the syllables — the level can say how wide the mouth
 *   goes but no longer when it moves.
 *
 * React is told only when the *shape* changes, roughly nine times a second,
 * rather than on every frame. `level` is a motion value so the body can spring
 * off it without re-rendering at all.
 */
const useLipSync = (energy: number | undefined, active: boolean) => {
  const [mouth, setMouth] = useState<ExpressionName>("talkClosed");
  const level = useMotionValue(0);
  const target = useRef(0);
  target.current = energy ?? 0;

  useEffect(() => {
    if (!active) {
      setMouth("talkClosed");
      level.set(0);
      return;
    }

    const envelope = new EnvelopeFollower();
    let peak = 0;
    let beatAge = 0;
    let openBeat = false;
    let last = performance.now();
    let shape: ExpressionName = "talkClosed";
    let raf = 0;

    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;

      const smoothed = envelope.follow(target.current, dt);
      // Decays about 3% a frame, so a shout raises the bar for a couple of
      // seconds and then it drifts back to the speaker's normal.
      peak = Math.max(smoothed, peak * 0.97);
      level.set(smoothed);

      beatAge += dt;
      if (beatAge >= beatMs(smoothed)) {
        beatAge = 0;
        openBeat = !openBeat;
      }

      const next = talkingMouth(smoothed, peak, openBeat);
      if (next !== shape) {
        shape = next;
        setMouth(next);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, level]);

  return { mouth, level };
};

/**
 * Steps a state's frames on its own timing.
 *
 * A `setTimeout` chain rather than an interval, because the frames hold for
 * different lengths — that unevenness is what makes talking read as syllables
 * instead of as a machine opening and shutting. Resets whenever the state
 * changes, so switching to `listening` starts on wide eyes rather than halfway
 * through somebody else's blink.
 */
const useFaceFrame = (state: MascotState, still: boolean): number => {
  const [frame, setFrame] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setFrame(0);
    if (still) return;

    const { frames, ms } = STATE_ANIMATION[state];
    let index = 0;
    const step = () => {
      index = (index + 1) % frames.length;
      setFrame(index);
      timer.current = window.setTimeout(step, ms[index]);
    };
    timer.current = window.setTimeout(step, ms[0]);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [state, still]);

  return frame;
};

export const KodaMascot: React.FC<{
  state?: MascotState;
  /** Colour and tilt come from the character, so one teacher looks like one. */
  personaId?: string;
  /** The DiceBear seed. Falls back to the id, so a character always has a face. */
  avatarSeed?: string;
  /**
   * Koda's own voice level, 0–1, while speaking.
   *
   * Supplied by a live session and left out everywhere else. With it, the mouth
   * is chosen by how loud the model is *at this instant* — wide on a stressed
   * syllable, nearly shut between words — which is lip-sync rather than a loop
   * that happens to be playing while audio comes out of the speaker. Without it,
   * the canned cycle in `STATE_ANIMATION` plays, which is right for a preview
   * and for a written conversation, where there is no voice to follow.
   */
  energy?: number;
  /**
   * Overrides the colour `personaId` would have picked.
   *
   * For a character that has to match the product rather than the roster — the
   * floating Ask Koda button is the app's own control, so it wears the brand
   * indigo, while the same character inside a lesson stays the colour the
   * roster gave it.
   */
  palette?: MascotPalette;
  size?: number;
  className?: string;
}> = ({
  state = "idle",
  personaId = "koda",
  avatarSeed,
  energy,
  palette,
  size = 160,
  className = "",
}) => {
  const skin = palette ?? paletteFor(personaId);
  const tilt = tiltFor(personaId);
  const seed = avatarSeed || personaId;

  /*
   * Somebody who asked their system for less movement gets a face that changes
   * expression but does not blink, bob or cycle. `MotionConfig` at the app root
   * already flattens the transforms; the frame loop is ours to stop, and a
   * mouth flapping at 150ms is exactly what that preference is about.
   */
  const still = useReducedMotion() ?? false;
  // A live voice drives the mouth itself, so the timed cycle stands down rather
  // than fighting it — two things choosing the frame is a stutter.
  const lipSync = state === "speaking" && typeof energy === "number" && !still;
  const { mouth, level } = useLipSync(energy, lipSync);
  const frame = useFaceFrame(state, still || lipSync);
  const expression = lipSync
    ? EXPRESSIONS[mouth]
    : EXPRESSIONS[STATE_ANIMATION[state].frames[frame]];

  /*
   * The body's own physics.
   *
   * A spring on the smoothed level, so Koda lifts and swells on a loud passage
   * and settles between them with real inertia — rather than a keyframe loop
   * running at a fixed size while the voice does something else. Low stiffness
   * and heavy damping: this is a breath, not a bounce, and anything springier
   * reads as a character being startled by its own voice.
   *
   * Both values stay at their resting point when there is no live voice, so the
   * ambient loops below are unaffected.
   */
  const voice = useSpring(level, { stiffness: 90, damping: 20, mass: 0.9 });
  const voiceLift = useTransform(voice, [0, 1], [0, -7]);
  const voiceSwell = useTransform(voice, [0, 1], [1, 1.045]);

  // Every frame of every state, built before it is needed: a face that pops on
  // its opening blink undoes the effect it was there to create.
  useEffect(() => warmFaces(seed, skin.head), [seed, skin.head]);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Koda is ${state}`}
    >
      {/* Listening rings, behind the face: sound arriving at the tile rather
          than a halo around the head. */}
      {state === "listening" && !still && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
          {[0, 1].map((ring) => (
            <motion.circle
              key={ring}
              cx="50"
              cy="60"
              r="46"
              fill="none"
              stroke={skin.head}
              strokeWidth="2.5"
              initial={{ scale: 0.72, opacity: 0.55 }}
              animate={{ scale: 1.2, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, delay: ring, ease: "easeOut" }}
              style={{ transformOrigin: "50px 60px" }}
            />
          ))}
        </svg>
      )}

      {/*
        * Two layers of movement, deliberately separated.
        *
        * The outer div carries the *physics* — a spring off Koda's own voice, so
        * a loud passage lifts and swells the whole character with inertia. The
        * inner image carries the *ambient* loop for the state. Putting both on
        * one element would mean the keyframe animation and the spring fighting
        * over `transform`, and the spring would simply be overwritten.
        */}
      <motion.div
        className="absolute inset-0"
        style={{ y: lipSync ? voiceLift : 0, scale: lipSync ? voiceSwell : 1 }}
      >
        <motion.img
          src={kodaFace(seed, expression, skin.head)}
          alt=""
          draggable={false}
          className="h-full w-full select-none"
          animate={MOTION[state]}
          transition={{ repeat: Infinity, ease: "easeInOut", duration: DURATION[state] }}
          style={{ transformOrigin: "50% 85%", rotate: tilt }}
        />
      </motion.div>

      {/* Thinking dots, rising where a thought goes. */}
      {state === "thinking" && !still && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
          {[0, 1, 2].map((dot) => (
            <motion.circle
              key={dot}
              cx={80 + dot * 8}
              cy={16 - dot * 5}
              r={2 + dot}
              fill={skin.accent}
              animate={{ opacity: [0.15, 1, 0.15], y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 1.7, delay: dot * 0.28 }}
            />
          ))}
        </svg>
      )}

      {/* Speaking: a waveform, not a speech bubble. The bubble promises text;
          what is coming is a voice. */}
      {state === "speaking" && !still && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {[0, 1, 2, 3].map((bar) => (
            <motion.rect
              key={bar}
              x={7 + bar * 5.5}
              width="3"
              rx="1.5"
              fill={skin.accent}
              animate={{ height: [5, 17, 9, 14, 5], y: [88, 76, 84, 79, 88] }}
              transition={{ repeat: Infinity, duration: 0.75, delay: bar * 0.1 }}
            />
          ))}
        </svg>
      )}

      {/* One spark, not a shower: the tile is small and the style is flat. */}
      {state === "celebrating" && !still && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
          <motion.path
            d="M84 14 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 z"
            fill={skin.accent}
            animate={{ scale: [0, 1, 0], rotate: [0, 120, 240] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            style={{ transformOrigin: "87px 17px" }}
          />
        </svg>
      )}
    </div>
  );
};
