/**
 * Celebration — a confetti burst with a spoken-style praise word.
 *
 * Shared so every canvas rewards a correct answer the same way. The praise is
 * drawn at random from a pool: a child who hears the identical phrase on every
 * question stops hearing it at all, and variety keeps the reward feeling like a
 * response rather than a mechanism.
 */

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

export const PRAISE_WORDS = [
  "Well done!",
  "Nice work!",
  "You got it!",
  "Brilliant!",
  "Great job!",
  "Awesome!",
  "Perfect!",
  "Superb!",
  "Way to go!",
  "Fantastic!",
  "Excellent!",
  "You're on fire!",
];

/** Pick a praise word, avoiding an immediate repeat of `previous`. */
export function randomPraise(previous?: string): string {
  const pool = previous ? PRAISE_WORDS.filter(w => w !== previous) : PRAISE_WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

const CONFETTI_COLORS = ["#6B46C1", "#FF2D78", "#FFD600", "#10B981", "#3B82F6", "#F59E0B"];

interface Piece {
  id: number;
  angle: number;
  distance: number;
  color: string;
  rotation: number;
  delay: number;
  width: number;
  height: number;
}

/** Generated once per mount, so every burst has a different scatter. */
function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
    distance: 80 + Math.random() * 130,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rotation: Math.random() * 720 - 360,
    delay: Math.random() * 0.12,
    width: 5 + Math.random() * 6,
    height: 8 + Math.random() * 7,
  }));
}

const Burst: React.FC<{ message?: string; count: number }> = ({ message, count }) => {
  const [pieces] = useState(() => makePieces(count));

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      {pieces.map(p => (
        <motion.span
          key={p.id}
          aria-hidden
          className="absolute"
          style={{ width: p.width, height: p.height, background: p.color, borderRadius: 2 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            // Bias downward so the scatter falls rather than floats.
            y: Math.sin(p.angle) * p.distance + 70,
            opacity: 0,
            rotate: p.rotation,
            scale: 0.5,
          }}
          transition={{ duration: 1.1 + Math.random() * 0.5, delay: p.delay, ease: "easeOut" }}
        />
      ))}

      {message && (
        <motion.div
          initial={{ scale: 0.4, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 16 }}
          className="relative px-5 py-2 rounded-full bg-emerald-600 text-white font-black text-base shadow-lg shadow-emerald-600/40 whitespace-nowrap"
        >
          {message}
        </motion.div>
      )}
    </div>
  );
};

export interface CelebrationProps {
  show: boolean;
  /** Praise to display. Pass one from `randomPraise()` and keep it in state. */
  message?: string;
  count?: number;
}

/**
 * Drop inside any `relative` container. Under reduce-motion the confetti is
 * skipped and only the praise remains, so the reward still lands.
 */
export const Celebration: React.FC<CelebrationProps> = ({ show, message, count = 26 }) => {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div key="burst" exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
          {reduce ? (
            message && (
              <div className="absolute inset-0 z-50 flex items-center justify-center">
                <span className="px-5 py-2 rounded-full bg-emerald-600 text-white font-black text-base shadow-lg">
                  {message}
                </span>
              </div>
            )
          ) : (
            <Burst message={message} count={count} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
