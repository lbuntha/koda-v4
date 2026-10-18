/**
 * A seeded random source.
 *
 * A round, a Machine's pace and a shuffle all take one of these instead of
 * calling Math.random, so the same seed replays the same thing: a test can pin
 * it, and a rematch can be "the same round again".
 */

export type Rng = () => number;

/** A string or number to a 32-bit seed. */
export const hashSeed = (seed: string | number): number => {
  const text = String(seed);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** mulberry32: small, fast, and good enough for shuffling puzzles. */
export const makeRng = (seed: string | number): Rng => {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const between = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

/** A new array in a seeded random order; the input is untouched. */
export const shuffled = <T>(rng: Rng, items: readonly T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
