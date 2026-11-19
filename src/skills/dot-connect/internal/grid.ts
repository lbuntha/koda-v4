/** Deterministic stream. The same seed gives the same board, forever. */
export function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let state = (h ^ (h >>> 16)) >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

export const rowOf = (cell: number, size: number) => Math.floor(cell / size);
export const colOf = (cell: number, size: number) => cell % size;

/** Up, down, left, right — never diagonal, never off the board. */
export function neighbours(cell: number, size: number): number[] {
  const r = rowOf(cell, size), c = colOf(cell, size);
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

export const adjacent = (a: number, b: number, size: number) =>
  Math.abs(rowOf(a, size) - rowOf(b, size)) + Math.abs(colOf(a, size) - colOf(b, size)) === 1;

export const manhattan = (a: number, b: number, size: number) =>
  Math.abs(rowOf(a, size) - rowOf(b, size)) + Math.abs(colOf(a, size) - colOf(b, size));

export const onEdge = (cell: number, size: number) => {
  const r = rowOf(cell, size), c = colOf(cell, size);
  return r === 0 || c === 0 || r === size - 1 || c === size - 1;
};

export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
